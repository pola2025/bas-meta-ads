#!/usr/bin/env node

/**
 * Weekly Report Generator with Telegram Sending
 * 주간 리포트 생성 및 텔레그램 발송 (MarkdownV2 이스케이프 포함)
 *
 * 사용법:
 *   node send-weekly-report.js                    # 모든 활성 클라이언트
 *   node send-weekly-report.js --client=내일채움  # 특정 클라이언트만
 *   node send-weekly-report.js --force            # 중복 체크 무시 (재발송)
 *   node send-weekly-report.js --client=내일채움 --force  # 특정 클라이언트 재발송
 *
 * 환경변수:
 *   DRY_RUN=true    # 실제 발송 없이 테스트
 *   SKIP_AI=true    # AI 인사이트 생략
 */

require('dotenv').config();

// 명령줄 인자 파싱
const args = process.argv.slice(2);
const clientArg = args.find(a => a.startsWith('--client='));
const FILTER_CLIENT = clientArg ? clientArg.split('=')[1] : null;
const FORCE_SEND = args.includes('--force');
const { createClient } = require('@supabase/supabase-js');
const TelegramBot = require('node-telegram-bot-api');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { notifyZeroData, sendAdminError } = require('./lib/telegram-notifier');
const { saveWeeklyReport } = require('./lib/report-storage');
const { spawn } = require('child_process');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN);

// 대시보드 URL
const DASHBOARD_URL = 'https://bas-meta-ads-git-main-mkt9834-4301s-projects.vercel.app';

// 날짜 계산 (가장 최근 완료된 주 기준: 월~일)
// 오늘이 11/25(화)이면 → 이번주: 11/17~23, 지난주: 11/10~16
function getWeekDates() {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0=일, 1=월, 2=화, ...

  // 가장 최근 일요일 (이번 주 마지막 날)
  // 오늘이 일요일(0)이면 오늘, 아니면 지난 일요일
  const lastSunday = new Date(now);
  lastSunday.setDate(now.getDate() - dayOfWeek);

  // 이번 주 월요일 (일요일 - 6일)
  const thisWeekStart = new Date(lastSunday);
  thisWeekStart.setDate(lastSunday.getDate() - 6);

  // 지난 주 일요일 (이번 주 월요일 - 1일)
  const lastWeekEnd = new Date(thisWeekStart);
  lastWeekEnd.setDate(thisWeekStart.getDate() - 1);

  // 지난 주 월요일 (지난 주 일요일 - 6일)
  const lastWeekStart = new Date(lastWeekEnd);
  lastWeekStart.setDate(lastWeekEnd.getDate() - 6);

  // 날짜 포맷팅 (YYYY-MM-DD)
  const formatDate = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  return {
    thisWeekStart: formatDate(thisWeekStart),
    thisWeekEnd: formatDate(lastSunday),
    lastWeekStart: formatDate(lastWeekStart),
    lastWeekEnd: formatDate(lastWeekEnd)
  };
}

// MarkdownV2 이스케이프 (CRITICAL!)
function escapeMd(text) {
  if (!text) return '';
  // MarkdownV2에서 이스케이프해야 하는 모든 특수문자
  return text.toString().replace(/[-_*[\]()~`>#+\=|{}.!]/g, '\\$&');
}

// 데이터 재수집 트리거 (Producer 호출)
async function triggerDataRecollection(startDate, endDate) {
  return new Promise((resolve, reject) => {
    console.log('🔄 데이터 재수집 시작...');
    console.log(`   기간: ${startDate} ~ ${endDate}`);

    // 날짜 차이 계산
    const start = new Date(startDate);
    const end = new Date(endDate);
    const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;

    const env = {
      ...process.env,
      MODE: 'producer',
      DATA_DAYS: days.toString()
    };

    const child = spawn('node', ['index.js'], {
      cwd: process.cwd(),
      env,
      stdio: 'inherit'
    });

    child.on('close', (code) => {
      if (code === 0) {
        console.log('✅ 데이터 재수집 요청 완료 (Worker 처리 대기 중)\n');
        resolve(true);
      } else {
        console.error(`❌ 데이터 재수집 실패 (exit code: ${code})`);
        reject(new Error(`Producer failed with code ${code}`));
      }
    });

    child.on('error', (err) => {
      console.error('❌ Producer 실행 오류:', err.message);
      reject(err);
    });
  });
}

// 데이터 조회 (클라이언트별 필터 추가) - ads_insights_daily VIEW 사용
async function fetchWeeklyData(startDate, endDate, clientId = null) {
  let query = supabase
    .from('ads_insights_daily')
    .select('*')
    .gte('date', startDate)
    .lte('date', endDate);

  // ⚠️ 클라이언트별 데이터 분리 - 필수!
  if (clientId) {
    query = query.eq('client_id', clientId);
  }

  const { data, error } = await query.order('date', { ascending: true });

  if (error) {
    console.error('❌ Error:', error.message);
    return null;
  }

  return data;
}

// 주간 통계 계산
function calculateWeeklySummary(data) {
  if (!data || data.length === 0) {
    return {
      impressions: 0,
      clicks: 0,
      leads: 0,
      spend: 0,
      ctr: 0,
      cpl: 0,
      conversion_rate: 0
    };
  }

  const totals = data.reduce((acc, row) => {
    acc.impressions += row.impressions || 0;
    acc.clicks += row.clicks || 0;
    acc.leads += row.leads || 0;
    acc.spend += parseFloat(row.spend) || 0;
    return acc;
  }, { impressions: 0, clicks: 0, leads: 0, spend: 0 });

  const ctr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;
  const cpl = totals.leads > 0 ? totals.spend / totals.leads : 0;
  const conversion_rate = totals.clicks > 0 ? (totals.leads / totals.clicks) * 100 : 0;

  return {
    ...totals,
    ctr,
    cpl,
    conversion_rate
  };
}

// 광고별 성과 집계
function getAdPerformance(weekData) {
  if (!weekData || weekData.length === 0) return [];

  const adStats = {};

  weekData.forEach(row => {
    const adKey = row.ad_id || 'unknown';
    if (!adStats[adKey]) {
      adStats[adKey] = {
        ad_id: row.ad_id,
        ad_name: row.ad_name || 'Unknown Ad',
        impressions: 0,
        clicks: 0,
        leads: 0,
        spend: 0,
        dailyPerformance: {}
      };
    }

    adStats[adKey].impressions += row.impressions || 0;
    adStats[adKey].clicks += row.clicks || 0;
    adStats[adKey].leads += row.leads || 0;
    adStats[adKey].spend += parseFloat(row.spend) || 0;

    if (row.date) {
      if (!adStats[adKey].dailyPerformance[row.date]) {
        adStats[adKey].dailyPerformance[row.date] = { leads: 0, spend: 0 };
      }
      adStats[adKey].dailyPerformance[row.date].leads += row.leads || 0;
      adStats[adKey].dailyPerformance[row.date].spend += parseFloat(row.spend) || 0;
    }
  });

  return Object.values(adStats).map(ad => ({
    ...ad,
    cpl: ad.leads > 0 ? ad.spend / ad.leads : 999999,
    ctr: ad.impressions > 0 ? (ad.clicks / ad.impressions) * 100 : 0
  }));
}

// 캠페인별 성과 집계
function getCampaignPerformance(weekData) {
  if (!weekData || weekData.length === 0) return [];

  const campaignStats = {};

  weekData.forEach(row => {
    const campKey = row.campaign_id || 'unknown';
    if (!campaignStats[campKey]) {
      campaignStats[campKey] = {
        campaign_id: row.campaign_id,
        campaign_name: row.campaign_name || 'Unknown Campaign',
        spend: 0,
        leads: 0
      };
    }

    campaignStats[campKey].spend += parseFloat(row.spend) || 0;
    campaignStats[campKey].leads += row.leads || 0;
  });

  const total = Object.values(campaignStats).reduce(
    (acc, c) => ({ spend: acc.spend + c.spend, leads: acc.leads + c.leads }),
    { spend: 0, leads: 0 }
  );

  return Object.values(campaignStats).map(camp => ({
    ...camp,
    cpl: camp.leads > 0 ? camp.spend / camp.leads : 999999,
    spendPercent: total.spend > 0 ? (camp.spend / total.spend) * 100 : 0,
    leadPercent: total.leads > 0 ? (camp.leads / total.leads) * 100 : 0
  }));
}

// AI 인사이트 생성 (Gemini 2.0 Flash)
async function generateAIInsights(reportData) {
  if (!process.env.GEMINI_API_KEY) {
    return '⚠️ Gemini API Key가 설정되지 않아 AI 인사이트를 생성할 수 없습니다.';
  }

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: 'gemini-3-pro-preview' });

  const prompt = `
당신은 Meta 광고 성과를 분석하는 마케팅 전문가입니다.
다음 데이터를 분석하여 실행 가능한 인사이트를 제공해주세요.

## 데이터

### 주간 성과 비교
- 지난 주: 리드 ${reportData.lastStats.leads}건, CPL $${reportData.lastStats.cpl.toFixed(2)}, CTR ${reportData.lastStats.ctr.toFixed(2)}%, 지출 $${reportData.lastStats.spend.toFixed(2)}
- 이번 주: 리드 ${reportData.thisStats.leads}건, CPL $${reportData.thisStats.cpl.toFixed(2)}, CTR ${reportData.thisStats.ctr.toFixed(2)}%, 지출 $${reportData.thisStats.spend.toFixed(2)}

### 광고별 성과 (TOP 3)
${reportData.adPerformance.slice(0, 3).map((ad, idx) =>
  `${idx + 1}. ${ad.ad_name}: 리드 ${ad.leads}건, CPL $${ad.cpl.toFixed(2)}, CTR ${ad.ctr.toFixed(2)}%`
).join('\n')}

### 캠페인별 성과
${reportData.campaignPerformance.map(camp =>
  `- ${camp.campaign_name}: 리드 ${camp.leads}건 (${camp.leadPercent.toFixed(1)}%), 지출 $${camp.spend.toFixed(2)} (${camp.spendPercent.toFixed(1)}%)`
).join('\n')}

## 요구사항

다음 형식으로 응답해주세요:

📊 성과 종합 분석
[2-3문장으로 전주 대비 변화, 주요 패턴 설명]

💡 핵심 인사이트 (5-7개)
1. [인사이트 1: 구체적 수치 포함]
2. [인사이트 2]
...

🎯 즉시 실행 가능한 액션 (3-5개)
1. ✅ [액션 제목]
   • [구체적 실행 방법 1]
   • [구체적 실행 방법 2]

2. 🔄 [액션 제목]
   • [구체적 실행 방법]

반드시 구체적인 수치와 실행 가능한 조언을 포함하세요.
`;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error('AI 인사이트 생성 실패:', error.message);
    return '⚠️ AI 인사이트 생성 중 오류가 발생했습니다.';
  }
}

// 변화율 계산
function calculateChange(current, previous) {
  if (!previous || previous === 0) return current > 0 ? '+100%' : '-';
  const change = ((current - previous) / previous) * 100;
  return `${change >= 0 ? '+' : ''}${change.toFixed(2)}%`;
}

// 이모지 막대 그래프 (리드 1건 = 1블럭)
function generateEmojiBar(value) {
  if (!value || value === 0) return '';
  return '🟩'.repeat(Math.min(value, 10)); // 최대 10개
}

// 요일 한글
function getDayOfWeekKr(dateString) {
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  const date = new Date(dateString);
  return days[date.getDay()];
}

// 텔레그램 메시지 생성 (3개로 분할)
function generateTelegramMessages(dates, thisStats, lastStats, thisWeekData, adPerformance, campaignPerformance, aiInsights, clientInfo = { name: '비즈액터스쿨', slug: 'bas-k92m7x', id: '79e35fc6-a817-4ccc-9d5d-9a93c1ad4515' }) {
  const messages = [];

  // 메시지 1: 핵심 성과 (Section 1-4)
  let msg1 = `🤖 *Polarad AI 주간 성과 리포트*\n`;
  msg1 += `${escapeMd(clientInfo.name)}\n`;
  msg1 += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  msg1 += `📅 이번 주: ${escapeMd(dates.thisWeekStart)} \\~ ${escapeMd(dates.thisWeekEnd)}\n`;
  msg1 += `📅 지난 주: ${escapeMd(dates.lastWeekStart)} \\~ ${escapeMd(dates.lastWeekEnd)}\n\n`;

  msg1 += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  msg1 += `📊 *주간 성과 비교*\n`;
  msg1 += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
  msg1 += `노출수: ${escapeMd(lastStats.impressions.toString())} → ${escapeMd(thisStats.impressions.toString())} \\(${escapeMd(calculateChange(thisStats.impressions, lastStats.impressions))}\\)\n`;
  msg1 += `클릭수: ${escapeMd(lastStats.clicks.toString())} → ${escapeMd(thisStats.clicks.toString())} \\(${escapeMd(calculateChange(thisStats.clicks, lastStats.clicks))}\\)\n`;
  msg1 += `리드: ${escapeMd(lastStats.leads.toString())}건 → ${escapeMd(thisStats.leads.toString())}건 \\(${escapeMd(calculateChange(thisStats.leads, lastStats.leads))}\\)\n`;
  msg1 += `지출: $${escapeMd(lastStats.spend.toFixed(2))} → $${escapeMd(thisStats.spend.toFixed(2))} \\(${escapeMd(calculateChange(thisStats.spend, lastStats.spend))}\\)\n`;
  msg1 += `CPL: $${escapeMd(lastStats.cpl.toFixed(2))} → $${escapeMd(thisStats.cpl.toFixed(2))} \\(${escapeMd(calculateChange(thisStats.cpl, lastStats.cpl))}\\)\n`;
  msg1 += `CTR: ${escapeMd(lastStats.ctr.toFixed(2))}% → ${escapeMd(thisStats.ctr.toFixed(2))}%\n`;
  msg1 += `전환율: ${escapeMd(lastStats.conversion_rate.toFixed(2))}% → ${escapeMd(thisStats.conversion_rate.toFixed(2))}%\n\n`;

  // 일별 트렌드
  msg1 += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  msg1 += `📅 *일별 상세 성과*\n`;
  msg1 += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

  if (thisWeekData && thisWeekData.length > 0) {
    const dailyStats = {};
    thisWeekData.forEach(row => {
      if (!dailyStats[row.date]) {
        dailyStats[row.date] = { leads: 0, spend: 0 };
      }
      dailyStats[row.date].leads += row.leads || 0;
      dailyStats[row.date].spend += parseFloat(row.spend) || 0;
    });

    Object.keys(dailyStats).sort().forEach(date => {
      const stats = dailyStats[date];
      const cpl = stats.leads > 0 ? stats.spend / stats.leads : 0;
      const dayKr = getDayOfWeekKr(date);
      const dateFormatted = date.substring(5).replace('-', '/');
      const bar = generateEmojiBar(stats.leads);

      msg1 += `${dayKr} ${dateFormatted}  ${stats.leads}건 \\| ${bar}\n`;
      msg1 += `CPL: ${stats.leads > 0 ? '$' + escapeMd(cpl.toFixed(2)) : '\\-'} │ 지출: $${escapeMd(stats.spend.toFixed(2))}\n\n`;
    });
  } else {
    msg1 += `데이터 없음\n\n`;
  }

  // 광고별 성과
  msg1 += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  msg1 += `🏆 *Best Performing 광고 \\(TOP 5\\)*\n`;
  msg1 += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

  const adsWithLeads = adPerformance.filter(ad => ad.leads > 0);
  const topAds = adsWithLeads.sort((a, b) => a.cpl - b.cpl).slice(0, 5);

  topAds.forEach((ad, idx) => {
    msg1 += `${idx + 1}\\. *${escapeMd(ad.ad_name)}*\n`;
    msg1 += `   💰 지출: $${escapeMd(ad.spend.toFixed(2))}\n`;
    msg1 += `   🎯 리드: ${ad.leads}건\n`;
    msg1 += `   💵 CPL: $${escapeMd(ad.cpl.toFixed(2))}\n`;
    msg1 += `   📊 CTR: ${escapeMd(ad.ctr.toFixed(2))}%\n`;
    msg1 += `   ━━━━━━━━━━━━━━━━━━━━━━\n`;

    // 일별 성과
    const dailyDates = Object.keys(ad.dailyPerformance).sort();
    if (dailyDates.length > 0) {
      msg1 += `   일별 성과:\n`;
      dailyDates.forEach(date => {
        const daily = ad.dailyPerformance[date];
        if (daily.leads > 0) {
          const dailyCPL = daily.spend / daily.leads;
          msg1 += `   • ${escapeMd(date)}: 리드 ${daily.leads}건, CPL $${escapeMd(dailyCPL.toFixed(2))}\n`;
        }
      });
      msg1 += `\n`;
    }
  });

  // WORST 2 (평균 대비 150% 이상)
  const avgCPL = thisStats.cpl;
  const worstAds = adsWithLeads
    .filter(ad => ad.cpl > avgCPL * 1.5)
    .sort((a, b) => b.cpl - a.cpl)
    .slice(0, 2);

  if (worstAds.length > 0) {
    msg1 += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    msg1 += `⚠️ *개선 필요 광고*\n`;
    msg1 += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    worstAds.forEach(ad => {
      const excess = ((ad.cpl - avgCPL) / avgCPL) * 100;
      msg1 += `• *${escapeMd(ad.ad_name)}*\n`;
      msg1 += `  문제: CPL $${escapeMd(ad.cpl.toFixed(2))} \\(평균 $${escapeMd(avgCPL.toFixed(2))} 대비 \\+${escapeMd(excess.toFixed(0))}%\\)\n`;
      msg1 += `  제안: 타겟팅 재검토 또는 소재 A/B 테스트\n\n`;
    });
  }

  messages.push(msg1);

  // 메시지 2: 캠페인 효율 & AI 인사이트 (Section 5-6)
  let msg2 = `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  msg2 += `💰 *캠페인별 예산 효율성*\n`;
  msg2 += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

  campaignPerformance.forEach(camp => {
    msg2 += `*${escapeMd(camp.campaign_name)}*\n`;
    msg2 += `• 지출: $${escapeMd(camp.spend.toFixed(2))} \\(${escapeMd(camp.spendPercent.toFixed(1))}%\\)\n`;
    msg2 += `• 리드: ${camp.leads}건 \\(${escapeMd(camp.leadPercent.toFixed(1))}%\\)\n`;
    msg2 += `• CPL: $${escapeMd(camp.cpl.toFixed(2))}\n`;

    const efficiency = camp.leadPercent - camp.spendPercent;
    if (efficiency > 10) {
      msg2 += `• 평가: ✅ 효율적 \\(예산 대비 리드 비율 높음\\)\n\n`;
    } else if (efficiency < -10) {
      msg2 += `• 평가: ⚠️ 검토 필요 \\(예산 대비 리드 비율 낮음\\)\n\n`;
    } else {
      msg2 += `• 평가: 📊 보통 \\(균형적\\)\n\n`;
    }
  });

  // 예산 재배분 제안
  if (campaignPerformance.length >= 2) {
    const sortedByEfficiency = [...campaignPerformance].sort(
      (a, b) => (b.leadPercent - b.spendPercent) - (a.leadPercent - a.spendPercent)
    );
    const bestCamp = sortedByEfficiency[0];
    const worstCamp = sortedByEfficiency[sortedByEfficiency.length - 1];

    if (bestCamp && worstCamp && bestCamp !== worstCamp) {
      msg2 += `💡 *예산 재배분 제안*\n`;
      msg2 += `• ${escapeMd(bestCamp.campaign_name)} 예산 \\+20% \\(고효율\\)\n`;
      msg2 += `• ${escapeMd(worstCamp.campaign_name)} 예산 \\-20% 또는 소재 개선\n\n`;
    }
  }

  messages.push(msg2);

  // 메시지 3: AI 인사이트 (별도 메시지로 분리)
  let msg3 = '';
  if (aiInsights) {
    msg3 += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    msg3 += `🤖 *Polarad AI 인사이트*\n`;
    msg3 += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    msg3 += escapeMd(aiInsights);
    msg3 += `\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    msg3 += `🤖 Powered by Polarad AI\n`;
    msg3 += `자동 생성 리포트 \\| 매주 월요일 오전 9시 발송\n`;
  }

  messages.push(msg3);

  // 메시지 4: 링크 & 푸터 (별도 메시지로 분리)
  // 대시보드 링크 생성
  const reportUrl = `${DASHBOARD_URL}/reports?client=${clientInfo.slug}`;
  const dashboardUrl = `${DASHBOARD_URL}/?client=${clientInfo.id}&start=${dates.thisWeekStart}&end=${dates.thisWeekEnd}`;

  let msg4 = `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  msg4 += `📊 *상세 리포트 보기*\n`;
  msg4 += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
  msg4 += `더 자세한 분석은 리포트 아카이브에서 확인하세요\\:\n`;
  msg4 += `${escapeMd(reportUrl)}\n\n`;

  msg4 += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  msg4 += `📊 *Meta 광고 성과분석 대시보드*\n`;
  msg4 += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
  msg4 += `${escapeMd(dashboardUrl)}\n\n`;

  msg4 += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  msg4 += `📞 *문의하기*\n`;
  msg4 += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
  msg4 += `리포트 관련 문의가 필요하시면 언제든 연락주세요\\.\n\n`;
  msg4 += `📧 이메일: mkt@polarad\\.co\\.kr\n\n`;
  msg4 += `🕐 *운영시간*\n`;
  msg4 += `평일 09:00 \\~ 18:00\n`;
  msg4 += `주말 휴무 \\(공휴일 포함\\)\n\n`;
  msg4 += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  msg4 += `🤖 Powered by Polarad AI\n`;
  msg4 += `자동 생성 리포트 \\| 매주 월요일 오전 9시 발송\n`;

  messages.push(msg4);

  return messages;
}

// 이번 주차 리포트가 이미 발송되었는지 확인
async function checkAlreadySent(clientId, weekStart, weekEnd) {
  const { data, error } = await supabase
    .from('telegram_reports')
    .select('id, sent_at')
    .eq('client_id', clientId)
    .eq('week_start', weekStart)
    .eq('week_end', weekEnd)
    .eq('report_type', 'weekly')
    .single();

  if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
    console.error('중복 체크 오류:', error.message);
    return null;
  }

  return data; // null이면 미발송, 있으면 이미 발송됨
}

// 단일 클라이언트 리포트 생성 및 발송
async function generateAndSendReport(client, dates, forceResend = false) {
  const clientId = client.id;
  const clientName = client.client_name;
  const clientSlug = client.slug;
  const clientChatId = client.telegram_chat_id;

  console.log(`\n${'='.repeat(60)}`);
  console.log(`📊 ${clientName} 리포트 생성 중...`);
  console.log(`${'='.repeat(60)}\n`);

  // 0. 중복 발송 체크 (--force 옵션이 없을 때만)
  if (!forceResend) {
    const existingReport = await checkAlreadySent(clientId, dates.thisWeekStart, dates.thisWeekEnd);
    if (existingReport) {
      console.log(`⏭️ ${clientName}: 이번 주차 이미 발송됨 (${existingReport.sent_at})`);
      console.log(`   재발송하려면 --force 옵션 사용`);
      return { client: clientName, status: 'skipped', reason: 'already_sent', sentAt: existingReport.sent_at };
    }
  } else {
    console.log(`🔄 ${clientName}: 강제 재발송 모드`);
  }

  // 1. 클라이언트별 데이터 조회
  const [thisWeekData, lastWeekData] = await Promise.all([
    fetchWeeklyData(dates.thisWeekStart, dates.thisWeekEnd, clientId),
    fetchWeeklyData(dates.lastWeekStart, dates.lastWeekEnd, clientId)
  ]);

  // 2. 통계 계산
  const thisStats = calculateWeeklySummary(thisWeekData);
  const lastStats = calculateWeeklySummary(lastWeekData);

  // 데이터 검증
  if (thisStats.leads === 0 && thisStats.spend === 0) {
    console.warn(`⚠️ ${clientName}: 이번 주 데이터 없음 - 리포트 생략`);
    return { client: clientName, status: 'skipped', reason: 'no_data' };
  }

  console.log(`✅ ${clientName} 데이터: 리드 ${thisStats.leads}건, 지출 $${thisStats.spend.toFixed(2)}`);

  // 3. 광고/캠페인 성과
  const adPerformance = getAdPerformance(thisWeekData);
  const campaignPerformance = getCampaignPerformance(thisWeekData);

  // 4. 클라이언트 정보 설정
  const clientInfo = {
    name: clientName,
    slug: clientSlug,
    id: clientId
  };

  // 5. AI 인사이트 (SKIP_AI=true로 비활성화 가능)
  let aiInsights = null;
  if (process.env.SKIP_AI !== 'true') {
    console.log(`🤖 ${clientName} AI 인사이트 생성 중...`);
    aiInsights = await generateAIInsights({
      thisStats,
      lastStats,
      thisWeekData,
      adPerformance,
      campaignPerformance
    });
  } else {
    aiInsights = '📊 AI 인사이트가 비활성화되었습니다.';
  }

  // 6. 텔레그램 메시지 생성
  const messages = generateTelegramMessages(
    dates,
    thisStats,
    lastStats,
    thisWeekData,
    adPerformance,
    campaignPerformance,
    aiInsights,
    clientInfo
  );

  // 7. 텔레그램 발송 (클라이언트별 chat_id 사용)
  const chatId = clientChatId || process.env.TELEGRAM_CHAT_ID || process.env.TELEGRAM_ADMIN_CHAT_ID;

  if (!chatId) {
    console.warn(`⚠️ ${clientName}: telegram_chat_id 미설정 - 발송 생략`);
    return { client: clientName, status: 'skipped', reason: 'no_chat_id' };
  }

  // 텔레그램 발송 ON/OFF 확인
  if (client.telegram_enabled === false) {
    console.log(`⏭️ ${clientName}: 텔레그램 발송 비활성화 - 발송 생략`);
    return { client: clientName, status: 'skipped', reason: 'telegram_disabled' };
  }

  // DRY_RUN 모드: 실제 발송 없이 테스트
  if (process.env.DRY_RUN === 'true') {
    console.log(`🧪 ${clientName} DRY_RUN 모드 - 발송 생략 (Chat ID: ${chatId})`);

    // 메시지 미리보기 출력
    console.log(`\n${'━'.repeat(60)}`);
    console.log(`📝 ${clientName} 리포트 미리보기`);
    console.log(`${'━'.repeat(60)}`);
    messages.forEach((msg, idx) => {
      // MarkdownV2 이스케이프 제거해서 읽기 쉽게
      const cleanMsg = msg.replace(/\\([_*[\]()~`>#+\-=|{}.!])/g, '$1');
      console.log(`\n--- 메시지 ${idx + 1}/${messages.length} ---\n`);
      console.log(cleanMsg);
    });
    console.log(`\n${'━'.repeat(60)}\n`);

    // DB 저장은 DRY_RUN에서도 수행
    try {
      const dailyStats = [];
      if (thisWeekData && thisWeekData.length > 0) {
        const dailyMap = {};
        thisWeekData.forEach(row => {
          if (!dailyMap[row.date]) {
            dailyMap[row.date] = { date: row.date, leads: 0, spend: 0, impressions: 0, clicks: 0 };
          }
          dailyMap[row.date].leads += row.leads || 0;
          dailyMap[row.date].spend += parseFloat(row.spend) || 0;
          dailyMap[row.date].impressions += row.impressions || 0;
          dailyMap[row.date].clicks += row.clicks || 0;
        });
        Object.keys(dailyMap).sort().forEach(date => {
          dailyStats.push(dailyMap[date]);
        });
      }

      await saveWeeklyReport({
        clientId,
        weekStart: dates.thisWeekStart,
        weekEnd: dates.thisWeekEnd,
        messages,
        thisStats,
        prevStats: lastStats,
        aiInsights,
        dailyStats,
        adPerformance,
        campaignPerformance
      });
      console.log(`✅ ${clientName} 리포트 DB 저장 완료`);
    } catch (saveError) {
      console.error(`⚠️ ${clientName} 리포트 저장 실패:`, saveError.message);
    }

    return { client: clientName, status: 'dry_run', chatId };
  }

  // 클라이언트별 봇 토큰 (내일채움만 예외)
  const NAEILCHAEUM_BOT_TOKEN = '7963284811:AAGBE0V2dt_Ht6KmhJmntxH_kbw5XqoiEiE';
  const clientBot = clientName === '내일채움'
    ? new TelegramBot(NAEILCHAEUM_BOT_TOKEN)
    : bot;

  console.log(`📤 ${clientName} 텔레그램 발송 중... (Chat ID: ${chatId})`);

  try {
    for (let i = 0; i < messages.length; i++) {
      await clientBot.sendMessage(chatId, messages[i], { parse_mode: 'MarkdownV2', disable_web_page_preview: true });
      if (i < messages.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    console.log(`✅ ${clientName} 리포트 발송 완료!`);

    // 8. DB에 리포트 저장
    try {
      const dailyStats = [];
      if (thisWeekData && thisWeekData.length > 0) {
        const dailyMap = {};
        thisWeekData.forEach(row => {
          if (!dailyMap[row.date]) {
            dailyMap[row.date] = { date: row.date, leads: 0, spend: 0, impressions: 0, clicks: 0 };
          }
          dailyMap[row.date].leads += row.leads || 0;
          dailyMap[row.date].spend += parseFloat(row.spend) || 0;
          dailyMap[row.date].impressions += row.impressions || 0;
          dailyMap[row.date].clicks += row.clicks || 0;
        });
        Object.keys(dailyMap).sort().forEach(date => {
          dailyStats.push(dailyMap[date]);
        });
      }

      await saveWeeklyReport({
        clientId,
        weekStart: dates.thisWeekStart,
        weekEnd: dates.thisWeekEnd,
        messages,
        thisStats,
        prevStats: lastStats,
        aiInsights,
        dailyStats,
        adPerformance,
        campaignPerformance
      });
    } catch (saveError) {
      console.error(`⚠️ ${clientName} 리포트 저장 실패:`, saveError.message);
    }

    return { client: clientName, status: 'sent', chatId };

  } catch (error) {
    console.error(`❌ ${clientName} 텔레그램 발송 실패:`, error.message);
    return { client: clientName, status: 'failed', error: error.message };
  }
}

// 메인 실행 (멀티클라이언트 지원)
async function main() {
  console.log('📊 주간 리포트 생성 시작...\n');

  // 명령줄 옵션 표시
  if (FILTER_CLIENT) {
    console.log(`🎯 대상 클라이언트: ${FILTER_CLIENT}`);
  }
  if (FORCE_SEND) {
    console.log(`🔄 강제 재발송 모드 활성화`);
  }
  if (process.env.DRY_RUN === 'true') {
    console.log(`🧪 DRY_RUN 모드: 실제 발송 없음`);
  }
  console.log();

  const dates = getWeekDates();
  console.log(`📅 기간: ${dates.thisWeekStart} ~ ${dates.thisWeekEnd}`);
  console.log(`📅 비교: ${dates.lastWeekStart} ~ ${dates.lastWeekEnd}\n`);

  // 1. 클라이언트 조회 (필터 적용)
  let query = supabase
    .from('clients')
    .select('id, client_name, slug, telegram_chat_id, telegram_enabled')
    .eq('is_active', true);

  // --client 옵션으로 특정 클라이언트만 필터
  if (FILTER_CLIENT) {
    query = query.eq('client_name', FILTER_CLIENT);
  }

  const { data: clients, error } = await query.order('client_name');

  if (error) {
    console.error('❌ 클라이언트 조회 오류:', error.message);
    return;
  }

  if (!clients || clients.length === 0) {
    if (FILTER_CLIENT) {
      console.error(`❌ 클라이언트를 찾을 수 없습니다: ${FILTER_CLIENT}`);
    } else {
      console.error('❌ 활성 클라이언트가 없습니다.');
    }
    return;
  }

  console.log(`👥 대상 클라이언트: ${clients.length}개`);

  // slug가 없는 클라이언트에 자동 생성
  for (const c of clients) {
    if (!c.slug) {
      const crypto = require('crypto');
      const base = c.client_name
        .toLowerCase()
        .replace(/[가-힣]+/g, match => {
          const cho = ['g','kk','n','d','tt','r','m','b','pp','s','ss','','j','jj','ch','k','t','p','h'];
          return match.split('').map(char => {
            const code = char.charCodeAt(0) - 44032;
            if (code < 0 || code > 11171) return '';
            return cho[Math.floor(code / 588)] || '';
          }).join('');
        })
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .substring(0, 20);
      const random = crypto.randomBytes(3).toString('hex');
      c.slug = `${base}-${random}`;

      // DB 업데이트
      await supabase.from('clients').update({ slug: c.slug }).eq('id', c.id);
      console.log(`   ⚙️ ${c.client_name}: slug 자동 생성 → ${c.slug}`);
    }

    const chatStatus = c.telegram_chat_id ? '✅' : '❌';
    const enabledStatus = c.telegram_enabled !== false ? '🔔' : '🔕';
    console.log(`   ${chatStatus} ${enabledStatus} ${c.client_name}`);
  }

  // 2. 각 클라이언트별 리포트 생성 및 발송
  const results = [];
  for (const client of clients) {
    try {
      const result = await generateAndSendReport(client, dates, FORCE_SEND);
      results.push(result);
    } catch (err) {
      console.error(`❌ ${client.client_name} 처리 중 오류:`, err.message);
      results.push({ client: client.client_name, status: 'error', error: err.message });
    }
  }

  // 3. 최종 결과 요약
  console.log(`\n${'='.repeat(60)}`);
  console.log('📊 주간 리포트 발송 결과');
  console.log(`${'='.repeat(60)}\n`);

  const sent = results.filter(r => r.status === 'sent').length;
  const skipped = results.filter(r => r.status === 'skipped').length;
  const failed = results.filter(r => r.status === 'failed' || r.status === 'error').length;

  console.log(`✅ 발송 완료: ${sent}개`);
  console.log(`⏭️ 생략: ${skipped}개`);
  console.log(`❌ 실패: ${failed}개`);

  results.forEach(r => {
    const icon = r.status === 'sent' ? '✅' : r.status === 'skipped' ? '⏭️' : '❌';
    const detail = r.reason || r.error || r.chatId || '';
    console.log(`   ${icon} ${r.client}: ${r.status} ${detail ? `(${detail})` : ''}`);
  });

  console.log(`\n${'='.repeat(60)}\n`);
}

// 실행
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { main };
