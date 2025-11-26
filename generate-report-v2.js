#!/usr/bin/env node
/**
 * Weekly Report Generator V2
 * 상세 게이지바, 비교 분석, AI 인사이트 포함
 *
 * 사용법:
 *   node generate-report-v2.js
 *   SKIP_AI=true node generate-report-v2.js
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const CLIENT_ID = '79e35fc6-a817-4ccc-9d5d-9a93c1ad4515';
const LEAD_VALUE = 100; // 리드당 가치 ($)
const TARGET_CPL = 35; // 목표 CPL ($)

// ===== 유틸리티 함수 =====

// 게이지바 생성 (█░ 스타일)
function createGauge(value, maxValue, width = 20) {
  if (maxValue === 0) return '░'.repeat(width);
  const ratio = Math.min(value / maxValue, 1);
  const filled = Math.round(ratio * width);
  const empty = width - filled;
  return '█'.repeat(filled) + '░'.repeat(empty);
}

// 리드 박스 게이지 (🟦 스타일)
function createLeadBoxes(leads, maxLeads = 10) {
  if (leads === 0) return '';
  const boxes = Math.min(leads, maxLeads);
  return '🟦'.repeat(boxes);
}

// 변화율 계산
function calcChange(current, previous) {
  if (!previous || previous === 0) {
    return current > 0 ? { value: 100, text: '+100%', direction: 'up' } : { value: 0, text: '-', direction: 'none' };
  }
  const change = ((current - previous) / previous) * 100;
  return {
    value: change,
    text: `${change >= 0 ? '+' : ''}${change.toFixed(0)}%`,
    direction: change > 0 ? 'up' : change < 0 ? 'down' : 'same'
  };
}

// 방향 이모지
function getDirectionEmoji(direction, isLowerBetter = false) {
  if (direction === 'none') return '';
  if (isLowerBetter) {
    return direction === 'down' ? ' ⬇️ 개선!' : direction === 'up' ? ' ⬆️' : '';
  }
  return direction === 'up' ? ' ⬆️' : direction === 'down' ? ' ⬇️' : '';
}

// 효율 등급 계산
function getEfficiencyGrade(cpl, targetCpl) {
  if (cpl === 0) return { grade: '-', label: '데이터 없음', emoji: '⚪' };
  const ratio = (targetCpl - cpl) / targetCpl * 100; // 목표 대비 개선율
  if (ratio >= 20) return { grade: 'A', label: '우수', emoji: '🏆' };
  if (ratio >= 10) return { grade: 'B', label: '양호', emoji: '✅' };
  if (ratio >= -10) return { grade: 'C', label: '보통', emoji: '📊' };
  if (ratio >= -30) return { grade: 'D', label: '미흡', emoji: '⚠️' };
  return { grade: 'F', label: '위험', emoji: '❌' };
}

// 요일 한글
function getDayKr(dateStr) {
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  return days[new Date(dateStr).getDay()];
}

// 날짜 포맷 (MM/DD)
function formatDateShort(dateStr) {
  return dateStr.substring(5).replace('-', '/');
}

// ===== 날짜 계산 =====
function getWeekDates() {
  const now = new Date();
  const dayOfWeek = now.getDay();

  const lastSunday = new Date(now);
  lastSunday.setDate(now.getDate() - dayOfWeek);

  const thisWeekStart = new Date(lastSunday);
  thisWeekStart.setDate(lastSunday.getDate() - 6);

  const lastWeekEnd = new Date(thisWeekStart);
  lastWeekEnd.setDate(thisWeekStart.getDate() - 1);

  const lastWeekStart = new Date(lastWeekEnd);
  lastWeekStart.setDate(lastWeekEnd.getDate() - 6);

  const fmt = d => d.toISOString().split('T')[0];

  return {
    thisWeekStart: fmt(thisWeekStart),
    thisWeekEnd: fmt(lastSunday),
    lastWeekStart: fmt(lastWeekStart),
    lastWeekEnd: fmt(lastWeekEnd)
  };
}

// ===== 데이터 조회 =====
async function fetchWeekData(startDate, endDate) {
  const { data, error } = await supabase
    .from('daily_aggregates')
    .select('*')
    .eq('client_id', CLIENT_ID)
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date');

  if (error) {
    console.error('❌ 데이터 조회 실패:', error.message);
    return [];
  }
  return data || [];
}

// ===== 통계 계산 =====
function calcStats(data) {
  if (!data || data.length === 0) {
    return { impressions: 0, clicks: 0, leads: 0, spend: 0, ctr: 0, cpl: 0, convRate: 0 };
  }

  const totals = data.reduce((acc, row) => {
    acc.impressions += row.impressions || 0;
    acc.clicks += row.clicks || 0;
    acc.leads += row.leads || 0;
    acc.spend += parseFloat(row.spend) || 0;
    return acc;
  }, { impressions: 0, clicks: 0, leads: 0, spend: 0 });

  return {
    ...totals,
    ctr: totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0,
    cpl: totals.leads > 0 ? totals.spend / totals.leads : 0,
    convRate: totals.clicks > 0 ? (totals.leads / totals.clicks) * 100 : 0
  };
}

// 일별 통계
function getDailyStats(data) {
  const daily = {};
  data.forEach(row => {
    if (!daily[row.date]) {
      daily[row.date] = { leads: 0, spend: 0, impressions: 0, clicks: 0 };
    }
    daily[row.date].leads += row.leads || 0;
    daily[row.date].spend += parseFloat(row.spend) || 0;
    daily[row.date].impressions += row.impressions || 0;
    daily[row.date].clicks += row.clicks || 0;
  });

  return Object.keys(daily).sort().map(date => ({
    date,
    ...daily[date],
    cpl: daily[date].leads > 0 ? daily[date].spend / daily[date].leads : 0
  }));
}

// 광고별 통계
function getAdStats(data) {
  const ads = {};
  data.forEach(row => {
    const key = row.ad_id;
    if (!ads[key]) {
      ads[key] = {
        ad_id: row.ad_id,
        ad_name: row.ad_name || 'Unknown',
        impressions: 0,
        clicks: 0,
        leads: 0,
        spend: 0,
        daily: {}
      };
    }
    ads[key].impressions += row.impressions || 0;
    ads[key].clicks += row.clicks || 0;
    ads[key].leads += row.leads || 0;
    ads[key].spend += parseFloat(row.spend) || 0;

    if (!ads[key].daily[row.date]) {
      ads[key].daily[row.date] = { leads: 0, spend: 0 };
    }
    ads[key].daily[row.date].leads += row.leads || 0;
    ads[key].daily[row.date].spend += parseFloat(row.spend) || 0;
  });

  return Object.values(ads).map(ad => ({
    ...ad,
    cpl: ad.leads > 0 ? ad.spend / ad.leads : 999999,
    ctr: ad.impressions > 0 ? (ad.clicks / ad.impressions) * 100 : 0,
    roi: ad.spend > 0 ? ((ad.leads * LEAD_VALUE) / ad.spend) * 100 : 0
  })).sort((a, b) => a.cpl - b.cpl);
}

// 캠페인별 통계
function getCampaignStats(data) {
  const camps = {};
  let totalSpend = 0;
  let totalLeads = 0;

  data.forEach(row => {
    const key = row.campaign_id || 'unknown';
    if (!camps[key]) {
      camps[key] = {
        campaign_id: row.campaign_id,
        campaign_name: row.campaign_name || 'Unknown',
        leads: 0,
        spend: 0
      };
    }
    camps[key].leads += row.leads || 0;
    camps[key].spend += parseFloat(row.spend) || 0;
    totalSpend += parseFloat(row.spend) || 0;
    totalLeads += row.leads || 0;
  });

  return Object.values(camps).map(c => ({
    ...c,
    cpl: c.leads > 0 ? c.spend / c.leads : 999999,
    spendPct: totalSpend > 0 ? (c.spend / totalSpend) * 100 : 0,
    leadPct: totalLeads > 0 ? (c.leads / totalLeads) * 100 : 0
  }));
}

// ===== AI 인사이트 생성 =====
async function generateAIInsights(reportData) {
  if (process.env.SKIP_AI === 'true') {
    return null;
  }

  if (!process.env.GEMINI_API_KEY) {
    console.warn('⚠️ GEMINI_API_KEY 없음');
    return null;
  }

  const { thisStats, lastStats, dailyStats, adStats } = reportData;

  const prompt = `당신은 Meta 광고 성과 분석 전문가입니다.
다음 데이터를 분석하여 실행 가능한 인사이트를 제공해주세요.

## 주간 비교 데이터
- 지난 주: 리드 ${lastStats.leads}건, CPL $${lastStats.cpl.toFixed(2)}, CTR ${lastStats.ctr.toFixed(2)}%, 지출 $${lastStats.spend.toFixed(2)}
- 이번 주: 리드 ${thisStats.leads}건, CPL $${thisStats.cpl.toFixed(2)}, CTR ${thisStats.ctr.toFixed(2)}%, 지출 $${thisStats.spend.toFixed(2)}
- 리드 변화: ${calcChange(thisStats.leads, lastStats.leads).text}
- CPL 변화: ${calcChange(thisStats.cpl, lastStats.cpl).text}

## 일별 성과 (이번 주)
${dailyStats.map(d => `${getDayKr(d.date)} ${formatDateShort(d.date)}: 리드 ${d.leads}건, CPL $${d.cpl.toFixed(2)}, 지출 $${d.spend.toFixed(2)}`).join('\n')}

## 광고별 성과 (CPL 순)
${adStats.slice(0, 5).map((ad, i) => `${i + 1}. ${ad.ad_name}: 리드 ${ad.leads}건, CPL $${ad.cpl.toFixed(2)}, CTR ${ad.ctr.toFixed(2)}%`).join('\n')}

## 요구사항

다음 형식으로 정확히 응답하세요:

📊 종합 평가: {A/B/C/D/F}등급

{2-3문장으로 이번 주 성과 요약. 전주 대비 변화와 주요 특징 설명}

📈 핵심 인사이트

1. 🎯 {인사이트 제목}
   • {구체적 수치와 함께 설명}

2. 💵 {인사이트 제목}
   • {구체적 수치와 함께 설명}

3. 📅 {인사이트 제목}
   • {구체적 수치와 함께 설명}

4. 🏆 {인사이트 제목}
   • {구체적 수치와 함께 설명}

5. 📊 {인사이트 제목}
   • {구체적 수치와 함께 설명}

🎯 즉시 실행 액션

1. ✅ {액션 제목}
   └─ {구체적 실행 방법}

2. 🔄 {액션 제목}
   └─ {구체적 실행 방법}

3. 📝 {액션 제목}
   └─ {구체적 실행 방법}

4. 🎯 다음 주 목표
   └─ 리드: {N}건 이상
   └─ CPL: ${N} 이하
   └─ CTR: {N}% 달성

반드시 구체적인 수치를 포함하고, 추상적인 표현은 피하세요.`;

  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-3-pro-preview' });
    const result = await model.generateContent(prompt);
    return result.response.text();
  } catch (error) {
    console.error('❌ AI 인사이트 생성 실패:', error.message);
    return null;
  }
}

// ===== 리포트 생성 =====
function generateReport(dates, thisStats, lastStats, dailyStats, adStats, campStats, aiInsights) {
  const lines = [];

  // ===== 헤더 =====
  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  lines.push('🤖 Polarad AI 주간 성과 리포트');
  lines.push('비즈액터스쿨');
  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  lines.push('📅 분석 기간');
  lines.push(`• 이번 주: ${dates.thisWeekStart.substring(5)}(${getDayKr(dates.thisWeekStart)}) ~ ${dates.thisWeekEnd.substring(5)}(${getDayKr(dates.thisWeekEnd)})`);
  lines.push(`• 지난 주: ${dates.lastWeekStart.substring(5)}(${getDayKr(dates.lastWeekStart)}) ~ ${dates.lastWeekEnd.substring(5)}(${getDayKr(dates.lastWeekEnd)})`);
  lines.push('');

  // ===== 핵심 성과 요약 (게이지바) =====
  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  lines.push('📊 핵심 성과 요약');
  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  lines.push('');

  // 리드
  const maxLeads = Math.max(thisStats.leads, lastStats.leads, 1);
  const leadChange = calcChange(thisStats.leads, lastStats.leads);
  lines.push('🎯 리드 획득');
  lines.push('┌────────────────────────────────────┐');
  lines.push(`│ 지난주  ${createGauge(lastStats.leads, maxLeads)}  ${String(lastStats.leads).padStart(3)}건  │`);
  lines.push(`│ 이번주  ${createGauge(thisStats.leads, maxLeads)}  ${String(thisStats.leads).padStart(3)}건  │ ${leadChange.text}${getDirectionEmoji(leadChange.direction)}`);
  lines.push('└────────────────────────────────────┘');
  lines.push('');

  // 지출
  const maxSpend = Math.max(thisStats.spend, lastStats.spend, 1);
  const spendChange = calcChange(thisStats.spend, lastStats.spend);
  lines.push('💰 광고 지출');
  lines.push('┌────────────────────────────────────┐');
  lines.push(`│ 지난주  ${createGauge(lastStats.spend, maxSpend)}  $${lastStats.spend.toFixed(0).padStart(4)}  │`);
  lines.push(`│ 이번주  ${createGauge(thisStats.spend, maxSpend)}  $${thisStats.spend.toFixed(0).padStart(4)}  │ ${spendChange.text}${getDirectionEmoji(spendChange.direction)}`);
  lines.push('└────────────────────────────────────┘');
  lines.push('');

  // CPL (낮을수록 좋음)
  const maxCPL = Math.max(thisStats.cpl, lastStats.cpl, 1);
  const cplChange = calcChange(thisStats.cpl, lastStats.cpl);
  lines.push('💵 리드당 비용 (CPL)');
  lines.push('┌────────────────────────────────────┐');
  lines.push(`│ 지난주  ${createGauge(lastStats.cpl, maxCPL)}  $${lastStats.cpl.toFixed(2).padStart(6)}│`);
  lines.push(`│ 이번주  ${createGauge(thisStats.cpl, maxCPL)}  $${thisStats.cpl.toFixed(2).padStart(6)}│ ${cplChange.text}${getDirectionEmoji(cplChange.direction, true)}`);
  lines.push('└────────────────────────────────────┘');
  lines.push('');

  // CTR
  const maxCTR = Math.max(thisStats.ctr, lastStats.ctr, 0.1);
  const ctrChange = calcChange(thisStats.ctr, lastStats.ctr);
  lines.push('📈 클릭률 (CTR)');
  lines.push('┌────────────────────────────────────┐');
  lines.push(`│ 지난주  ${createGauge(lastStats.ctr, maxCTR)}  ${lastStats.ctr.toFixed(2).padStart(5)}% │`);
  lines.push(`│ 이번주  ${createGauge(thisStats.ctr, maxCTR)}  ${thisStats.ctr.toFixed(2).padStart(5)}% │ ${ctrChange.text}${getDirectionEmoji(ctrChange.direction)}`);
  lines.push('└────────────────────────────────────┘');
  lines.push('');

  // 전환율
  const maxConv = Math.max(thisStats.convRate, lastStats.convRate, 0.1);
  const convChange = calcChange(thisStats.convRate, lastStats.convRate);
  lines.push('🔄 전환율 (리드/클릭)');
  lines.push('┌────────────────────────────────────┐');
  lines.push(`│ 지난주  ${createGauge(lastStats.convRate, maxConv)}  ${lastStats.convRate.toFixed(2).padStart(5)}% │`);
  lines.push(`│ 이번주  ${createGauge(thisStats.convRate, maxConv)}  ${thisStats.convRate.toFixed(2).padStart(5)}% │ ${convChange.text}${getDirectionEmoji(convChange.direction)}`);
  lines.push('└────────────────────────────────────┘');
  lines.push('');

  // 효율 등급
  const grade = getEfficiencyGrade(thisStats.cpl, TARGET_CPL);
  lines.push(`${grade.emoji} 광고 효율 등급: ${grade.grade} (${grade.label})`);
  if (cplChange.direction === 'down' && cplChange.value < 0) {
    lines.push(`   전주 대비 CPL ${Math.abs(cplChange.value).toFixed(0)}% 개선`);
  }
  lines.push('');

  // ===== 일별 리드 현황 =====
  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  lines.push('📅 일별 리드 획득 현황');
  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  lines.push('');

  const avgCPL = thisStats.cpl;
  const bestDay = dailyStats.filter(d => d.leads > 0).sort((a, b) => a.cpl - b.cpl)[0];
  const worstDay = dailyStats.filter(d => d.leads > 0).sort((a, b) => b.cpl - a.cpl)[0];

  dailyStats.forEach(d => {
    const dayKr = getDayKr(d.date);
    const dateShort = formatDateShort(d.date);
    const boxes = createLeadBoxes(d.leads);
    const cplStr = d.leads > 0 ? `CPL $${d.cpl.toFixed(2)}` : 'CPL -';

    let marker = '';
    if (bestDay && d.date === bestDay.date && d.leads > 0) marker = ' ⭐BEST';
    else if (d.leads > 0 && d.cpl > avgCPL * 1.5) marker = ' ⚠️';
    else if (bestDay && d.cpl === bestDay.cpl && d.leads > 0) marker = ' ⭐';

    lines.push(`${dayKr} ${dateShort} │${boxes.padEnd(20)}│ ${String(d.leads).padStart(2)}건  $${d.spend.toFixed(0).padStart(3)} (${cplStr})${marker}`);
  });
  lines.push('');

  // 패턴 분석
  const weekendLeads = dailyStats.filter(d => ['토', '일'].includes(getDayKr(d.date))).reduce((a, d) => a + d.leads, 0);
  const weekdayLeads = thisStats.leads - weekendLeads;

  lines.push('💡 패턴 분석');
  if (bestDay) {
    lines.push(`• 최고 성과일: ${getDayKr(bestDay.date)}요일 (${bestDay.leads}건, CPL $${bestDay.cpl.toFixed(2)})`);
  }
  if (worstDay && worstDay !== bestDay) {
    lines.push(`• 최저 효율일: ${getDayKr(worstDay.date)}요일 (${worstDay.leads}건, CPL $${worstDay.cpl.toFixed(2)})`);
  }
  lines.push(`• 주말 vs 평일: 주말 ${weekendLeads}건 vs 평일 ${weekdayLeads}건`);
  lines.push('');

  // ===== 광고별 성과 랭킹 =====
  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  lines.push('🏆 광고별 성과 랭킹');
  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  lines.push('');

  const rankEmojis = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];
  const adsWithLeads = adStats.filter(a => a.leads > 0);

  adsWithLeads.slice(0, 5).forEach((ad, idx) => {
    const cplStatus = ad.cpl <= TARGET_CPL ? '✅' : ad.cpl <= TARGET_CPL * 1.3 ? '⚠️' : '❌';

    lines.push(`${rankEmojis[idx]} ${idx + 1}위: ${ad.ad_name}`);
    lines.push('┌────────────────────────────────────┐');
    lines.push(`│ 리드   │${createLeadBoxes(ad.leads, 10).padEnd(20)}│ ${ad.leads}건     │`);
    lines.push(`│ 지출   │ $${ad.spend.toFixed(2)}${' '.repeat(20 - ad.spend.toFixed(2).length)}│`);
    lines.push(`│ CPL    │ $${ad.cpl.toFixed(2)} ${cplStatus}${' '.repeat(16 - ad.cpl.toFixed(2).length)}│`);
    lines.push(`│ CTR    │ ${ad.ctr.toFixed(2)}%${' '.repeat(20 - ad.ctr.toFixed(2).length)}│`);
    lines.push(`│ ROI    │ ${ad.roi.toFixed(0)}% (리드가치 $${LEAD_VALUE} 기준)${' '.repeat(5)}│`);
    lines.push('├────────────────────────────────────┤');

    // 일별 미니 표시
    const dailyMini = Object.keys(ad.daily).sort().map(date => {
      const dayKr = getDayKr(date);
      return `${dayKr}${ad.daily[date].leads}`;
    }).join(' ');
    lines.push(`│ 일별: ${dailyMini.padEnd(28)}│`);

    // 추천
    let rec = '';
    if (ad.cpl <= avgCPL * 0.8) rec = '⭐ 예산 +30% 증액 권장';
    else if (ad.cpl <= avgCPL) rec = '✅ 현재 예산 유지';
    else rec = '🔄 소재 테스트 필요';
    lines.push(`│ 추천: ${rec.padEnd(28)}│`);
    lines.push('└────────────────────────────────────┘');
    lines.push('');
  });

  // 개선 필요 광고
  const worstAds = adsWithLeads.filter(a => a.cpl > avgCPL * 1.5);
  if (worstAds.length > 0) {
    lines.push('⚠️ 개선 필요 광고');
    worstAds.forEach(ad => {
      const excess = ((ad.cpl - avgCPL) / avgCPL * 100).toFixed(0);
      lines.push(`• ${ad.ad_name}`);
      lines.push(`  └─ CPL $${ad.cpl.toFixed(2)} (평균 대비 +${excess}%)`);
    });
    lines.push('');
  } else {
    lines.push('⚠️ 개선 필요 광고: 없음');
    lines.push(`   (모든 광고 CPL이 목표 $${TARGET_CPL} 이하)`);
    lines.push('');
  }

  // ===== 캠페인별 효율 =====
  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  lines.push('💰 캠페인별 예산 효율');
  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  lines.push('');

  campStats.forEach(c => {
    const efficiency = c.leadPct - c.spendPct;
    let effLabel = '📊 균형';
    if (efficiency > 5) effLabel = '✅ 효율적';
    else if (efficiency < -5) effLabel = '⚠️ 검토 필요';

    lines.push(`캠페인: ${c.campaign_name}`);
    lines.push(`├─ 예산 점유율: ${createGauge(c.spendPct, 100, 10)} ${c.spendPct.toFixed(1)}%`);
    lines.push(`├─ 리드 점유율: ${createGauge(c.leadPct, 100, 10)} ${c.leadPct.toFixed(1)}%`);
    lines.push(`├─ 효율 판정: ${effLabel}`);
    lines.push(`└─ CPL: $${c.cpl.toFixed(2)}`);
    lines.push('');
  });

  // ===== AI 인사이트 =====
  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  lines.push('🤖 Polarad AI 분석 리포트');
  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  lines.push('');

  if (aiInsights) {
    lines.push(aiInsights);
  } else {
    // 기본 인사이트 (AI 없을 때)
    lines.push(`📊 종합 평가: ${grade.grade}등급 (${grade.label})`);
    lines.push('');
    lines.push(`이번 주는 전주 대비 리드가 ${leadChange.text} 변화했으며,`);
    lines.push(`CPL은 $${lastStats.cpl.toFixed(2)}에서 $${thisStats.cpl.toFixed(2)}로 ${cplChange.text} 되었습니다.`);
    if (bestDay) {
      lines.push(`${getDayKr(bestDay.date)}요일이 가장 효율적인 요일로 분석됩니다.`);
    }
    lines.push('');
    lines.push('📈 핵심 인사이트');
    lines.push('');
    lines.push(`1. 🎯 리드 ${leadChange.text} 변화`);
    lines.push(`   • ${lastStats.leads}건 → ${thisStats.leads}건`);
    lines.push('');
    lines.push(`2. 💵 CPL ${cplChange.text}`);
    lines.push(`   • $${lastStats.cpl.toFixed(2)} → $${thisStats.cpl.toFixed(2)}`);
    lines.push('');
    lines.push(`3. 📅 ${bestDay ? getDayKr(bestDay.date) : '일'}요일 최고 성과`);
    lines.push(`   • 해당 요일 예산 증액 검토`);
    lines.push('');
    lines.push('🎯 즉시 실행 액션');
    lines.push('');
    lines.push('1. ✅ 고효율 요일 예산 증액');
    lines.push(`   └─ ${bestDay ? getDayKr(bestDay.date) : '일'}요일 예산 +30%`);
    lines.push('');
    lines.push('2. 🔄 저효율 요일 검토');
    lines.push(`   └─ ${worstDay && worstDay !== bestDay ? getDayKr(worstDay.date) : '토'}요일 타겟팅 재검토`);
    lines.push('');
    lines.push('3. 🎯 다음 주 목표');
    lines.push(`   └─ 리드: ${Math.ceil(thisStats.leads * 1.2)}건 이상`);
    lines.push(`   └─ CPL: $${Math.max(thisStats.cpl * 0.9, 15).toFixed(0)} 이하`);
  }
  lines.push('');

  // ===== 푸터 =====
  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  lines.push('📞 문의');
  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  lines.push('📧 support@polarad.co.kr');
  lines.push('📱 카카오톡 @polarad');
  lines.push('');
  lines.push('🤖 Powered by Polarad AI');
  lines.push('자동 생성 | 매주 월요일 09:00');
  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  return lines.join('\n');
}

// ===== 메인 =====
async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 주간 리포트 V2 생성 시작');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');

  const dates = getWeekDates();
  console.log(`📅 이번 주: ${dates.thisWeekStart} ~ ${dates.thisWeekEnd}`);
  console.log(`📅 지난 주: ${dates.lastWeekStart} ~ ${dates.lastWeekEnd}`);
  console.log('');

  // 데이터 조회
  console.log('📡 데이터 조회 중...');
  const [thisWeekData, lastWeekData] = await Promise.all([
    fetchWeekData(dates.thisWeekStart, dates.thisWeekEnd),
    fetchWeekData(dates.lastWeekStart, dates.lastWeekEnd)
  ]);

  console.log(`   이번 주: ${thisWeekData.length}개 레코드`);
  console.log(`   지난 주: ${lastWeekData.length}개 레코드`);
  console.log('');

  // 통계 계산
  const thisStats = calcStats(thisWeekData);
  const lastStats = calcStats(lastWeekData);
  const dailyStats = getDailyStats(thisWeekData);
  const adStats = getAdStats(thisWeekData);
  const campStats = getCampaignStats(thisWeekData);

  // 데이터 검증
  if (thisStats.leads === 0 && thisStats.spend === 0) {
    console.error('❌ 이번 주 데이터 없음!');
    console.error('   데이터 수집을 먼저 실행하세요: node aggregate-november.js');
    return;
  }

  console.log(`✅ 이번 주: 리드 ${thisStats.leads}건, 지출 $${thisStats.spend.toFixed(2)}, CPL $${thisStats.cpl.toFixed(2)}`);
  console.log(`✅ 지난 주: 리드 ${lastStats.leads}건, 지출 $${lastStats.spend.toFixed(2)}, CPL $${lastStats.cpl.toFixed(2)}`);
  console.log('');

  // AI 인사이트
  let aiInsights = null;
  if (process.env.SKIP_AI !== 'true') {
    console.log('🤖 AI 인사이트 생성 중...');
    aiInsights = await generateAIInsights({ thisStats, lastStats, dailyStats, adStats });
    if (aiInsights) {
      console.log('   ✅ AI 인사이트 생성 완료');
    } else {
      console.log('   ⚠️ AI 인사이트 생성 실패, 기본 인사이트 사용');
    }
  } else {
    console.log('⏭️ AI 인사이트 생략 (SKIP_AI=true)');
  }
  console.log('');

  // 리포트 생성
  console.log('📝 리포트 생성 중...');
  const report = generateReport(dates, thisStats, lastStats, dailyStats, adStats, campStats, aiInsights);
  console.log('');

  // 출력
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📋 리포트 미리보기');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log(report);
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ 리포트 생성 완료!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

main().catch(console.error);
