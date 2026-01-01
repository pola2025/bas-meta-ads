#!/usr/bin/env node

/**
 * Monthly Report Generator with Telegram Sending
 * 월간 리포트 생성 및 텔레그램 발송 (MarkdownV2 이스케이프 포함)
 *
 * 사용법:
 *   node send-monthly-report.js                            # 모든 활성 클라이언트
 *   node send-monthly-report.js --client=내일채움          # 특정 클라이언트만
 *   node send-monthly-report.js --force                    # 중복 체크 무시 (재발송)
 *   REPORT_MONTH=2025-11 node send-monthly-report.js       # 특정 월
 *   DRY_RUN=true node send-monthly-report.js               # 실제 발송 없이 테스트
 *   SKIP_AI=true node send-monthly-report.js               # AI 제외
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
const { saveMonthlyReport } = require('./lib/report-storage');
const { validateBeforeReport } = require('./lib/data-integrity');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN);

// 대시보드 URL
const DASHBOARD_URL = 'https://bas-meta-ads-git-main-mkt9834-4301s-projects.vercel.app';

// 날짜 포맷팅 (YYYY-MM-DD)
function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// 월간 날짜 계산
function getMonthDates(targetMonth) {
  const now = new Date();
  let year, month;

  if (targetMonth) {
    [year, month] = targetMonth.split('-').map(Number);
  } else {
    // 기본: 전월
    year = now.getFullYear();
    month = now.getMonth(); // 0-indexed, 현재 월
    if (month === 0) {
      month = 12;
      year--;
    }
  }

  // 해당 월의 시작일과 마지막일
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);

  // 전월 (비교용)
  const prevYear = month === 1 ? year - 1 : year;
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevFirstDay = new Date(prevYear, prevMonth - 1, 1);
  const prevLastDay = new Date(prevYear, prevMonth, 0);

  return {
    thisMonth: `${year}-${String(month).padStart(2, '0')}`,
    thisMonthStart: formatDate(firstDay),
    thisMonthEnd: formatDate(lastDay),
    thisMonthYear: year,
    thisMonthNum: month,
    prevMonth: `${prevYear}-${String(prevMonth).padStart(2, '0')}`,
    prevMonthStart: formatDate(prevFirstDay),
    prevMonthEnd: formatDate(prevLastDay)
  };
}

// 월의 주차 계산 (단순 날짜 기준)
function getWeekOfMonth(dateString) {
  const date = new Date(dateString);
  const day = date.getDate();
  return Math.ceil(day / 7);
}

// 주차별 날짜 범위 계산
function getWeekRanges(year, month) {
  const lastDay = new Date(year, month, 0).getDate();
  const ranges = [];

  for (let week = 1; week <= 5; week++) {
    const start = (week - 1) * 7 + 1;
    const end = Math.min(week * 7, lastDay);
    if (start <= lastDay) {
      ranges.push({
        week,
        start: `${year}-${String(month).padStart(2, '0')}-${String(start).padStart(2, '0')}`,
        end: `${year}-${String(month).padStart(2, '0')}-${String(end).padStart(2, '0')}`,
        label: `${String(month).padStart(2, '0')}/${String(start).padStart(2, '0')}~${String(month).padStart(2, '0')}/${String(end).padStart(2, '0')}`
      });
    }
  }

  return ranges;
}

// MarkdownV2 이스케이프
function escapeMd(text) {
  if (!text) return '';
  return text.toString().replace(/[-_*[\]()~`>#+\=|{}.!]/g, '\\$&');
}

// 데이터 조회 (클라이언트별 필터링)
async function fetchMonthlyData(startDate, endDate, clientId) {
  let query = supabase
    .from('daily_aggregates')
    .select('*')
    .gte('date', startDate)
    .lte('date', endDate);

  // 클라이언트 ID가 있으면 필터링
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

// 월간 통계 계산
function calculateMonthlySummary(data) {
  if (!data || data.length === 0) {
    return {
      impressions: 0,
      clicks: 0,
      leads: 0,
      spend: 0,
      ctr: 0,
      cpl: 0,
      conversion_rate: 0,
      days: 0
    };
  }

  const totals = data.reduce((acc, row) => {
    acc.impressions += row.impressions || 0;
    acc.clicks += row.clicks || 0;
    acc.leads += row.leads || 0;
    acc.spend += parseFloat(row.spend) || 0;
    return acc;
  }, { impressions: 0, clicks: 0, leads: 0, spend: 0 });

  const uniqueDays = new Set(data.map(r => r.date)).size;
  const ctr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;
  const cpl = totals.leads > 0 ? totals.spend / totals.leads : 0;
  const conversion_rate = totals.clicks > 0 ? (totals.leads / totals.clicks) * 100 : 0;

  return {
    ...totals,
    ctr,
    cpl,
    conversion_rate,
    days: uniqueDays
  };
}

// 주별 통계 계산
function getWeeklyStats(data, weekRanges) {
  const weekStats = weekRanges.map(range => {
    const weekData = data.filter(r => r.date >= range.start && r.date <= range.end);
    const summary = calculateMonthlySummary(weekData);
    return {
      ...range,
      ...summary
    };
  });

  return weekStats;
}

// 요일별 통계 계산
function getDayOfWeekStats(data) {
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  const stats = {};

  days.forEach((day, idx) => {
    stats[idx] = { name: day, leads: 0, spend: 0, count: 0 };
  });

  data.forEach(row => {
    const date = new Date(row.date);
    const dayIdx = date.getDay();
    stats[dayIdx].leads += row.leads || 0;
    stats[dayIdx].spend += parseFloat(row.spend) || 0;
    stats[dayIdx].count++;
  });

  const totalLeads = Object.values(stats).reduce((sum, d) => sum + d.leads, 0);

  return Object.values(stats).map(d => ({
    ...d,
    percent: totalLeads > 0 ? (d.leads / totalLeads) * 100 : 0
  }));
}

// 광고별 성과 집계
function getAdPerformance(monthData) {
  if (!monthData || monthData.length === 0) return [];

  const adStats = {};

  monthData.forEach(row => {
    const adKey = row.ad_id || 'unknown';
    if (!adStats[adKey]) {
      adStats[adKey] = {
        ad_id: row.ad_id,
        ad_name: row.ad_name || 'Unknown Ad',
        impressions: 0,
        clicks: 0,
        leads: 0,
        spend: 0
      };
    }

    adStats[adKey].impressions += row.impressions || 0;
    adStats[adKey].clicks += row.clicks || 0;
    adStats[adKey].leads += row.leads || 0;
    adStats[adKey].spend += parseFloat(row.spend) || 0;
  });

  const total = Object.values(adStats).reduce(
    (acc, ad) => ({ leads: acc.leads + ad.leads, spend: acc.spend + ad.spend }),
    { leads: 0, spend: 0 }
  );

  return Object.values(adStats).map(ad => ({
    ...ad,
    cpl: ad.leads > 0 ? ad.spend / ad.leads : null,
    ctr: ad.impressions > 0 ? (ad.clicks / ad.impressions) * 100 : 0,
    spendPercent: total.spend > 0 ? (ad.spend / total.spend) * 100 : 0,
    leadPercent: total.leads > 0 ? (ad.leads / total.leads) * 100 : 0
  }));
}

// 캠페인별 성과 집계
function getCampaignPerformance(monthData) {
  if (!monthData || monthData.length === 0) return [];

  const campaignStats = {};

  monthData.forEach(row => {
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
    cpl: camp.leads > 0 ? camp.spend / camp.leads : null,
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
다음 월간 데이터를 분석하여 실행 가능한 인사이트를 제공해주세요.

## 데이터

### 월간 성과 비교
- 이번 달 (${reportData.dates.thisMonth}): 리드 ${reportData.thisStats.leads}건, CPL $${reportData.thisStats.cpl.toFixed(2)}, CTR ${reportData.thisStats.ctr.toFixed(2)}%, 지출 $${reportData.thisStats.spend.toFixed(2)}
- 지난 달 (${reportData.dates.prevMonth}): 리드 ${reportData.prevStats.leads}건, CPL $${reportData.prevStats.cpl.toFixed(2)}, CTR ${reportData.prevStats.ctr.toFixed(2)}%, 지출 $${reportData.prevStats.spend.toFixed(2)}

### 주별 트렌드
${reportData.weekStats.map(w =>
  `W${w.week} (${w.label}): 리드 ${w.leads}건, CPL $${w.cpl.toFixed(2)}, 지출 $${w.spend.toFixed(2)}`
).join('\n')}

### 광고별 성과 (TOP 5)
${reportData.adPerformance.slice(0, 5).map((ad, idx) =>
  `${idx + 1}. ${ad.ad_name}: 리드 ${ad.leads}건, CPL ${ad.cpl !== null ? '$' + ad.cpl.toFixed(2) : '-'}, CTR ${ad.ctr.toFixed(2)}%, 지출 비중 ${ad.spendPercent.toFixed(1)}%`
).join('\n')}

### 캠페인별 성과
${reportData.campaignPerformance.map(camp =>
  `- ${camp.campaign_name}: 리드 ${camp.leads}건 (${camp.leadPercent.toFixed(1)}%), 지출 $${camp.spend.toFixed(2)} (${camp.spendPercent.toFixed(1)}%)`
).join('\n')}

### 요일별 패턴
${reportData.dayOfWeekStats.map(d =>
  `${d.name}요일: ${d.leads}건 (${d.percent.toFixed(1)}%)`
).join(', ')}

## 요구사항

다음 형식으로 응답해주세요 (텔레그램 발송용, 간결하게):

📊 성과 종합 분석
[3-4문장으로 전월 대비 변화, 주요 패턴, 핵심 성과 설명]

💡 핵심 인사이트 (5-7개)
1. [구체적 수치 포함 인사이트]
2. ...

🎯 다음 달 액션 플랜 (3-5개)
1. ✅ [액션 제목]
   • [구체적 실행 방법]
2. 🔄 [액션 제목]
   • [구체적 실행 방법]
...

반드시 구체적인 수치와 실행 가능한 조언을 포함하세요.
월간 트렌드와 요일별 패턴을 활용한 최적화 제안을 포함하세요.
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

// 변화율 계산 (이모지 포함: 🟢⬆️ 상승, 🔴⬇️ 하락)
function calculateChange(current, previous) {
  if (!previous || previous === 0) return current > 0 ? '🟢⬆️ +100%' : '-';
  const change = ((current - previous) / previous) * 100;
  const emoji = change >= 0 ? '🟢⬆️' : '🔴⬇️';
  const sign = change >= 0 ? '+' : '';
  return `${emoji} ${sign}${change.toFixed(1)}%`;
}

// 이모지 막대 그래프 (최대값 기준 비율로 표시, maxBars개)
function generateEmojiBar(value, maxValue, maxBars = 10) {
  if (!value || value === 0 || !maxValue || maxValue === 0) return '';
  const ratio = value / maxValue;
  const bars = Math.max(1, Math.round(ratio * maxBars)); // 최소 1개
  return '🟩'.repeat(bars);
}

// 효율성 평가
function getEfficiencyLabel(leadPercent, spendPercent, threshold = 5) {
  const diff = leadPercent - spendPercent;
  if (diff > threshold) return '✅ 효율적';
  if (diff < -threshold) return '⚠️ 검토 필요';
  return '📊 보통';
}

// 텔레그램 메시지 생성 (4개로 분할)
function generateTelegramMessages(dates, thisStats, prevStats, weekStats, dayOfWeekStats, adPerformance, campaignPerformance, aiInsights, clientInfo = { name: '클라이언트', slug: '', id: '' }) {
  const messages = [];

  // 메시지 1: 헤더 & 월간 핵심 성과
  let msg1 = `🤖 *Polarad AI 월간 성과 리포트*\n`;
  msg1 += `${escapeMd(clientInfo.name)}\n`;
  msg1 += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  msg1 += `📅 리포트 기간: ${escapeMd(dates.thisMonth.replace('-', '년 '))}월\n`;
  msg1 += `📅 비교 기간: ${escapeMd(dates.prevMonth.replace('-', '년 '))}월\n\n`;

  msg1 += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  msg1 += `📊 *월간 성과 요약*\n`;
  msg1 += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
  msg1 += `🎯 리드: ${thisStats.leads}건\n`;
  msg1 += `💰 총 지출: $${escapeMd(thisStats.spend.toFixed(2))}\n`;
  msg1 += `💵 평균 CPL: $${escapeMd(thisStats.cpl.toFixed(2))}\n`;
  msg1 += `📈 CTR: ${escapeMd(thisStats.ctr.toFixed(2))}%\n`;
  msg1 += `🔄 전환율: ${escapeMd(thisStats.conversion_rate.toFixed(2))}%\n\n`;

  msg1 += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  msg1 += `📈 *전월 대비 변화*\n`;
  msg1 += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
  msg1 += `리드: ${prevStats.leads}건 → ${thisStats.leads}건 \\(${escapeMd(calculateChange(thisStats.leads, prevStats.leads))}\\)\n`;
  msg1 += `지출: $${escapeMd(prevStats.spend.toFixed(2))} → $${escapeMd(thisStats.spend.toFixed(2))} \\(${escapeMd(calculateChange(thisStats.spend, prevStats.spend))}\\)\n`;
  msg1 += `CPL: $${escapeMd(prevStats.cpl.toFixed(2))} → $${escapeMd(thisStats.cpl.toFixed(2))} \\(${escapeMd(calculateChange(thisStats.cpl, prevStats.cpl))}\\)\n`;
  msg1 += `CTR: ${escapeMd(prevStats.ctr.toFixed(2))}% → ${escapeMd(thisStats.ctr.toFixed(2))}%\n`;
  msg1 += `전환율: ${escapeMd(prevStats.conversion_rate.toFixed(2))}% → ${escapeMd(thisStats.conversion_rate.toFixed(2))}%\n\n`;

  // 핵심 요약 생성
  const leadChange = thisStats.leads - prevStats.leads;
  const spendChange = thisStats.spend - prevStats.spend;
  const cplChange = thisStats.cpl - prevStats.cpl;

  msg1 += `💡 *핵심 요약*\n`;
  if (leadChange >= 0 && spendChange <= 0) {
    msg1 += `• 리드 \\+${leadChange}건 증가, 비용 절감 → 효율 개선\\!\n`;
  } else if (leadChange >= 0) {
    msg1 += `• 리드 \\+${leadChange}건 증가\n`;
  } else {
    msg1 += `• 리드 \\-${Math.abs(leadChange)}건 감소 → 원인 분석 필요\n`;
  }

  if (cplChange < 0) {
    msg1 += `• CPL ${Math.abs(cplChange).toFixed(0)}% 절감 → 비용 효율 향상\n`;
  } else if (cplChange > 0) {
    msg1 += `• CPL ${cplChange.toFixed(0)}% 증가 → 최적화 필요\n`;
  }

  messages.push(msg1);

  // 메시지 2: 주별 트렌드 & 요일별 패턴
  let msg2 = `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  msg2 += `📅 *주별 트렌드 \\(1주차\\~${weekStats.length}주차\\)*\n`;
  msg2 += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

  // 주별 최대 리드 수 계산
  const maxWeekLeads = Math.max(...weekStats.map(w => w.leads || 0));

  weekStats.forEach(w => {
    const bar = generateEmojiBar(w.leads, maxWeekLeads, 10);
    msg2 += `${w.week}주차 \\(${escapeMd(w.label)}\\)\n`;
    msg2 += `${bar} ${w.leads}건\n`;
    msg2 += `CPL: ${w.leads > 0 ? '$' + escapeMd(w.cpl.toFixed(2)) : '\\-'} │ 지출: $${escapeMd(w.spend.toFixed(2))}\n\n`;
  });

  msg2 += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  msg2 += `📊 *요일별 성과 패턴*\n`;
  msg2 += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

  // 요일별 최대 리드 수 계산
  const maxDayLeads = Math.max(...dayOfWeekStats.map(d => d.leads || 0));

  // 요일 순서: 월~일
  const orderedDays = [1, 2, 3, 4, 5, 6, 0]; // 월화수목금토일
  orderedDays.forEach(idx => {
    const d = dayOfWeekStats.find(s => s.name === ['일', '월', '화', '수', '목', '금', '토'][idx]);
    if (d) {
      const bar = generateEmojiBar(d.leads, maxDayLeads, 8);
      msg2 += `${d.name}: ${String(d.leads).padStart(2, ' ')}건 \\(${escapeMd(d.percent.toFixed(1))}%\\) ${bar}\n`;
    }
  });

  // 패턴 분석
  const topDays = dayOfWeekStats
    .filter(d => d.leads > 0)
    .sort((a, b) => b.leads - a.leads)
    .slice(0, 2)
    .map(d => d.name);

  if (topDays.length > 0) {
    msg2 += `\n💡 패턴 분석: ${topDays.join('/')}요일 리드 집중\n`;
  }

  messages.push(msg2);

  // 메시지 3: 광고 & 캠페인 성과
  let msg3 = `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  msg3 += `🏆 *TOP 5 광고 \\(CPL 기준\\)*\n`;
  msg3 += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

  const adsWithLeads = adPerformance.filter(ad => ad.leads > 0);
  const topAds = adsWithLeads.sort((a, b) => a.cpl - b.cpl).slice(0, 5);

  topAds.forEach((ad, idx) => {
    const efficiency = getEfficiencyLabel(ad.leadPercent, ad.spendPercent);
    msg3 += `${idx + 1}\\. *${escapeMd(ad.ad_name)}*\n`;
    msg3 += `   💰 지출: $${escapeMd(ad.spend.toFixed(2))} \\(${escapeMd(ad.spendPercent.toFixed(1))}%\\)\n`;
    msg3 += `   🎯 리드: ${ad.leads}건 \\(${escapeMd(ad.leadPercent.toFixed(1))}%\\)\n`;
    msg3 += `   💵 CPL: ${ad.cpl !== null ? '$' + escapeMd(ad.cpl.toFixed(2)) : '\\-'}\n`;
    msg3 += `   📊 CTR: ${escapeMd(ad.ctr.toFixed(2))}%\n`;
    msg3 += `   ${escapeMd(efficiency)}\n\n`;
  });

  msg3 += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  msg3 += `💰 *캠페인별 예산 효율성*\n`;
  msg3 += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

  campaignPerformance.forEach(camp => {
    const efficiency = getEfficiencyLabel(camp.leadPercent, camp.spendPercent, 10);
    msg3 += `*${escapeMd(camp.campaign_name)}*\n`;
    msg3 += `• 지출: $${escapeMd(camp.spend.toFixed(2))} \\(${escapeMd(camp.spendPercent.toFixed(1))}%\\)\n`;
    msg3 += `• 리드: ${camp.leads}건 \\(${escapeMd(camp.leadPercent.toFixed(1))}%\\)\n`;
    msg3 += `• CPL: ${camp.cpl !== null ? '$' + escapeMd(camp.cpl.toFixed(2)) : '\\-'}\n`;
    msg3 += `• 평가: ${escapeMd(efficiency)}\n\n`;
  });

  // 예산 재배분 제안
  if (campaignPerformance.length >= 2) {
    const sortedByEfficiency = [...campaignPerformance].sort(
      (a, b) => (b.leadPercent - b.spendPercent) - (a.leadPercent - a.spendPercent)
    );
    const bestCamp = sortedByEfficiency[0];
    const worstCamp = sortedByEfficiency[sortedByEfficiency.length - 1];

    if (bestCamp && worstCamp && bestCamp !== worstCamp) {
      msg3 += `💡 *예산 재배분 제안*\n`;
      msg3 += `• ${escapeMd(bestCamp.campaign_name)} 예산 \\+15% \\(고효율\\)\n`;
      msg3 += `• ${escapeMd(worstCamp.campaign_name)} 소재 A/B 테스트 권장\n`;
    }
  }

  messages.push(msg3);

  // 메시지 4: AI 인사이트 & 푸터
  let msg4 = `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  msg4 += `🤖 *Polarad AI 월간 인사이트*\n`;
  msg4 += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

  if (aiInsights) {
    msg4 += escapeMd(aiInsights);
    msg4 += `\n\n`;
  }

  msg4 += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  msg4 += `📊 *상세 대시보드*\n`;
  msg4 += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
  msg4 += `더 자세한 데이터는 대시보드에서 확인하세요\\.\n`;
  const reportUrl = `${DASHBOARD_URL}/reports?client=${clientInfo.slug || clientInfo.id}`;
  msg4 += `🔗 ${escapeMd(reportUrl)}\n\n`;
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
  msg4 += `자동 생성 리포트 \\| 매월 1일 오전 9시 발송\n`;

  messages.push(msg4);

  return messages;
}

// 이번 월 리포트가 이미 발송되었는지 확인
async function checkAlreadySent(clientId, monthStart, monthEnd) {
  const { data, error } = await supabase
    .from('telegram_reports')
    .select('id, sent_at')
    .eq('client_id', clientId)
    .eq('week_start', monthStart)  // 테이블은 week_start/week_end 컬럼 사용
    .eq('week_end', monthEnd)
    .eq('report_type', 'monthly')
    .single();

  if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
    console.error('중복 체크 오류:', error.message);
    return null;
  }

  return data; // null이면 미발송, 있으면 이미 발송됨
}

// 단일 클라이언트 월간 리포트 생성 및 발송
async function generateAndSendReport(client, dates, forceResend = false) {
  const clientId = client.id;
  const clientName = client.client_name;
  const clientSlug = client.slug;
  const clientChatId = client.telegram_chat_id;

  console.log(`\n${'='.repeat(60)}`);
  console.log(`📊 ${clientName} 월간 리포트 생성 중...`);
  console.log(`${'='.repeat(60)}\n`);

  // 0. 중복 발송 체크 (--force 옵션이 없을 때만)
  if (!forceResend) {
    const existingReport = await checkAlreadySent(clientId, dates.thisMonthStart, dates.thisMonthEnd);
    if (existingReport) {
      console.log(`⏭️ ${clientName}: 이번 월 이미 발송됨 (${existingReport.sent_at})`);
      console.log(`   재발송하려면 --force 옵션 사용`);
      return { client: clientName, status: 'skipped', reason: 'already_sent', sentAt: existingReport.sent_at };
    }
  } else {
    console.log(`🔄 ${clientName}: 강제 재발송 모드`);
  }

  // 0.5. 데이터 정합성 검증 (P1-3)
  if (process.env.SKIP_VALIDATION !== 'true') {
    const validation = await validateBeforeReport(clientId, dates.thisMonthStart, dates.thisMonthEnd);
    if (!validation.passed) {
      console.warn(`⚠️ ${clientName}: 데이터 검증 실패 - ${validation.errors.join(', ')}`);
      if (process.env.STRICT_VALIDATION === 'true') {
        return { client: clientName, status: 'skipped', reason: 'validation_failed', errors: validation.errors };
      }
      // STRICT_VALIDATION이 아니면 경고만 출력하고 계속 진행
    }
  }

  // 1. 클라이언트별 데이터 조회
  const [thisMonthData, prevMonthData] = await Promise.all([
    fetchMonthlyData(dates.thisMonthStart, dates.thisMonthEnd, clientId),
    fetchMonthlyData(dates.prevMonthStart, dates.prevMonthEnd, clientId)
  ]);

  // 2. 통계 계산
  const thisStats = calculateMonthlySummary(thisMonthData);
  const prevStats = calculateMonthlySummary(prevMonthData);

  // 데이터 검증
  if (thisStats.leads === 0 && thisStats.spend === 0) {
    console.warn(`⚠️ ${clientName}: 이번 달 데이터 없음 - 리포트 생략`);
    return { client: clientName, status: 'skipped', reason: 'no_data' };
  }

  console.log(`✅ ${clientName} 데이터: 리드 ${thisStats.leads}건, 지출 $${thisStats.spend.toFixed(2)}`);

  // 3. 주별 통계
  const weekRanges = getWeekRanges(dates.thisMonthYear, dates.thisMonthNum);
  const weekStats = getWeeklyStats(thisMonthData, weekRanges);

  // 4. 요일별 통계
  const dayOfWeekStats = getDayOfWeekStats(thisMonthData);

  // 5. 광고/캠페인 성과
  const adPerformance = getAdPerformance(thisMonthData);
  const campaignPerformance = getCampaignPerformance(thisMonthData);

  // 6. 클라이언트 정보 설정
  const clientInfo = {
    name: clientName,
    slug: clientSlug,
    id: clientId
  };

  // 7. AI 인사이트 (SKIP_AI=true로 비활성화 가능)
  let aiInsights = null;
  if (process.env.SKIP_AI !== 'true') {
    console.log(`🤖 ${clientName} AI 인사이트 생성 중...`);
    aiInsights = await generateAIInsights({
      dates,
      thisStats,
      prevStats,
      weekStats,
      dayOfWeekStats,
      adPerformance,
      campaignPerformance
    });
    // AI 인사이트 생성 실패 감지
    if (aiInsights && aiInsights.startsWith('⚠️')) {
      console.warn(`⚠️ ${clientName}: AI 인사이트 생성 실패 - ${aiInsights}`);
    }
  } else {
    console.warn(`⚠️ ${clientName}: AI 인사이트 비활성화 (SKIP_AI=true)`);
    aiInsights = '📊 AI 인사이트가 비활성화되었습니다.';
  }

  // 8. 텔레그램 메시지 생성
  const messages = generateTelegramMessages(
    dates,
    thisStats,
    prevStats,
    weekStats,
    dayOfWeekStats,
    adPerformance,
    campaignPerformance,
    aiInsights,
    clientInfo
  );

  // 9. 텔레그램 발송 (클라이언트별 chat_id 사용)
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
    console.log(`📝 ${clientName} 월간 리포트 미리보기`);
    console.log(`${'━'.repeat(60)}`);
    messages.forEach((msg, idx) => {
      const cleanMsg = msg.replace(/\\([_*[\]()~`>#+\-=|{}.!])/g, '$1');
      console.log(`\n--- 메시지 ${idx + 1}/${messages.length} ---\n`);
      console.log(cleanMsg);
    });
    console.log(`\n${'━'.repeat(60)}\n`);

    // DB 저장은 DRY_RUN에서도 수행
    try {
      await saveMonthlyReport({
        clientId,
        monthStart: dates.thisMonthStart,
        monthEnd: dates.thisMonthEnd,
        messages,
        thisStats,
        prevStats,
        aiInsights,
        weeklyStats: weekStats,
        dayOfWeekStats,
        adPerformance,
        campaignPerformance
      });
      console.log(`✅ ${clientName} 리포트 DB 저장 완료`);
    } catch (saveError) {
      console.error(`⚠️ ${clientName} 리포트 저장 실패:`, saveError.message);
    }

    return { client: clientName, status: 'dry_run', chatId };
  }

  // 클라이언트별 봇 토큰 (내일채움만 예외 - 환경변수 사용)
  const clientBot = clientName === '내일채움' && process.env.NAEILCHAEUM_BOT_TOKEN
    ? new TelegramBot(process.env.NAEILCHAEUM_BOT_TOKEN)
    : bot;

  console.log(`📤 ${clientName} 텔레그램 발송 중... (Chat ID: ${chatId})`);

  try {
    for (let i = 0; i < messages.length; i++) {
      console.log(`메시지 ${i + 1}/${messages.length} 발송 중...`);
      await clientBot.sendMessage(chatId, messages[i], {
        parse_mode: 'MarkdownV2',
        disable_web_page_preview: true
      });
      console.log(`✅ 메시지 ${i + 1} 발송 완료`);

      if (i < messages.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    console.log(`✅ ${clientName} 월간 리포트 발송 완료!`);

    // 10. DB에 리포트 저장
    try {
      await saveMonthlyReport({
        clientId,
        monthStart: dates.thisMonthStart,
        monthEnd: dates.thisMonthEnd,
        messages,
        thisStats,
        prevStats,
        aiInsights,
        weeklyStats: weekStats,
        dayOfWeekStats,
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
  console.log('📊 월간 리포트 생성 시작...\n');

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

  // 타겟 월 결정
  const targetMonth = process.env.REPORT_MONTH || null;
  const dates = getMonthDates(targetMonth);

  console.log(`📅 리포트 기간: ${dates.thisMonth} (${dates.thisMonthStart} ~ ${dates.thisMonthEnd})`);
  console.log(`📅 비교 기간: ${dates.prevMonth} (${dates.prevMonthStart} ~ ${dates.prevMonthEnd})\n`);

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
  for (let i = 0; i < clients.length; i++) {
    const client = clients[i];
    try {
      const result = await generateAndSendReport(client, dates, FORCE_SEND);
      results.push(result);
    } catch (err) {
      console.error(`❌ ${client.client_name} 처리 중 오류:`, err.message);
      results.push({ client: client.client_name, status: 'error', error: err.message });
    }

    // Gemini API rate limit 방지: 클라이언트 간 3초 딜레이
    if (i < clients.length - 1) {
      console.log(`⏳ 다음 클라이언트 대기 (3초)...`);
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }

  // 3. 최종 결과 요약
  console.log(`\n${'='.repeat(60)}`);
  console.log('📊 월간 리포트 발송 결과');
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
