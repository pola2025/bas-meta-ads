/**
 * 리포트 아카이브 생성 스크립트
 * 10월/11월 주간 및 월간 리포트 일괄 생성
 * AI 인사이트: Claude가 직접 작성
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { saveWeeklyReport, saveMonthlyReport, DEFAULT_CLIENT_ID } = require('./lib/report-storage');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// ============================================================================
// 기간 정의
// ============================================================================

// 10월 주간 (월요일~일요일)
const OCTOBER_WEEKS = [
  { week: 41, start: '2025-10-06', end: '2025-10-12' },
  { week: 42, start: '2025-10-13', end: '2025-10-19' },
  { week: 43, start: '2025-10-20', end: '2025-10-26' },
  { week: 44, start: '2025-10-27', end: '2025-11-02' } // 월 경계 포함
];

// 11월 주간 (월요일~일요일)
const NOVEMBER_WEEKS = [
  { week: 45, start: '2025-11-03', end: '2025-11-09' },
  { week: 46, start: '2025-11-10', end: '2025-11-16' },
  { week: 47, start: '2025-11-17', end: '2025-11-23' }
];

// 월간 기간
const MONTHS = [
  { month: '2025-10', start: '2025-10-01', end: '2025-10-31', name: '10월' }
  // 11월은 아직 미마감
];

// ============================================================================
// 데이터 조회 함수
// ============================================================================

async function getStatsForPeriod(startDate, endDate) {
  // daily_aggregates에서 기간 데이터 조회
  const { data: dailyData, error } = await supabase
    .from('ads_insights_daily')
    .select('date, impressions, clicks, spend, leads')
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date');

  if (error) {
    console.error('데이터 조회 실패:', error.message);
    return null;
  }

  if (!dailyData || dailyData.length === 0) {
    console.log(`⚠️ ${startDate} ~ ${endDate} 기간 데이터 없음`);
    return null;
  }

  // 합산
  const stats = dailyData.reduce((acc, d) => ({
    impressions: acc.impressions + (d.impressions || 0),
    clicks: acc.clicks + (d.clicks || 0),
    spend: acc.spend + parseFloat(d.spend || 0),
    leads: acc.leads + (d.leads || 0)
  }), { impressions: 0, clicks: 0, spend: 0, leads: 0 });

  stats.cpl = stats.leads > 0 ? stats.spend / stats.leads : 0;
  stats.ctr = stats.impressions > 0 ? (stats.clicks / stats.impressions) * 100 : 0;
  stats.conversion_rate = stats.clicks > 0 ? (stats.leads / stats.clicks) * 100 : 0;
  stats.days = dailyData.length;

  return { stats, dailyData };
}

async function getAdPerformance(startDate, endDate) {
  const { data, error } = await supabase
    .from('ads_insights_daily')
    .select('ad_id, ad_name, campaign_name, impressions, clicks, spend, leads')
    .gte('date', startDate)
    .lte('date', endDate);

  if (error || !data) return [];

  // 광고별 합산
  const adMap = {};
  data.forEach(row => {
    const key = row.ad_id;
    if (!adMap[key]) {
      adMap[key] = {
        ad_id: row.ad_id,
        ad_name: row.ad_name,
        campaign_name: row.campaign_name,
        impressions: 0, clicks: 0, spend: 0, leads: 0
      };
    }
    adMap[key].impressions += row.impressions || 0;
    adMap[key].clicks += row.clicks || 0;
    adMap[key].spend += parseFloat(row.spend || 0);
    adMap[key].leads += row.leads || 0;
  });

  const ads = Object.values(adMap);
  const totalSpend = ads.reduce((sum, a) => sum + a.spend, 0);
  const totalLeads = ads.reduce((sum, a) => sum + a.leads, 0);

  return ads.map(ad => ({
    ...ad,
    cpl: ad.leads > 0 ? ad.spend / ad.leads : 0,
    ctr: ad.impressions > 0 ? (ad.clicks / ad.impressions) * 100 : 0,
    spendPercent: totalSpend > 0 ? (ad.spend / totalSpend) * 100 : 0,
    leadPercent: totalLeads > 0 ? (ad.leads / totalLeads) * 100 : 0
  })).sort((a, b) => b.leads - a.leads);
}

async function getCampaignPerformance(startDate, endDate) {
  const { data, error } = await supabase
    .from('ads_insights_daily')
    .select('campaign_id, campaign_name, impressions, clicks, spend, leads')
    .gte('date', startDate)
    .lte('date', endDate);

  if (error || !data) return [];

  // 캠페인별 합산
  const campMap = {};
  data.forEach(row => {
    const key = row.campaign_id;
    if (!campMap[key]) {
      campMap[key] = {
        campaign_id: row.campaign_id,
        campaign_name: row.campaign_name,
        impressions: 0, clicks: 0, spend: 0, leads: 0
      };
    }
    campMap[key].impressions += row.impressions || 0;
    campMap[key].clicks += row.clicks || 0;
    campMap[key].spend += parseFloat(row.spend || 0);
    campMap[key].leads += row.leads || 0;
  });

  const camps = Object.values(campMap);
  const totalSpend = camps.reduce((sum, c) => sum + c.spend, 0);
  const totalLeads = camps.reduce((sum, c) => sum + c.leads, 0);

  return camps.map(camp => ({
    ...camp,
    cpl: camp.leads > 0 ? camp.spend / camp.leads : 0,
    spendPercent: totalSpend > 0 ? (camp.spend / totalSpend) * 100 : 0,
    leadPercent: totalLeads > 0 ? (camp.leads / totalLeads) * 100 : 0
  })).sort((a, b) => b.leads - a.leads);
}

// ============================================================================
// AI 인사이트 (Claude 직접 작성)
// ============================================================================

function generateWeeklyAiInsights(weekNum, stats, prevStats, adPerformance) {
  const insights = [];

  // 리드 변동 분석
  if (prevStats) {
    const leadsChange = ((stats.leads - prevStats.leads) / prevStats.leads) * 100;
    const cplChange = ((stats.cpl - prevStats.cpl) / prevStats.cpl) * 100;

    if (leadsChange > 10) {
      insights.push(`📈 리드 ${leadsChange.toFixed(1)}% 증가 - 광고 효율 상승세`);
    } else if (leadsChange < -10) {
      insights.push(`📉 리드 ${Math.abs(leadsChange).toFixed(1)}% 감소 - 원인 분석 필요`);
    }

    if (cplChange < -10) {
      insights.push(`✅ CPL ${Math.abs(cplChange).toFixed(1)}% 개선 - 비용 효율 양호`);
    } else if (cplChange > 15) {
      insights.push(`⚠️ CPL ${cplChange.toFixed(1)}% 상승 - 타겟팅 점검 권장`);
    }
  }

  // 상위 광고 분석
  if (adPerformance.length > 0) {
    const topAd = adPerformance[0];
    if (topAd.leadPercent > 30) {
      insights.push(`🏆 "${topAd.ad_name.substring(0, 20)}..." 광고가 전체 리드의 ${topAd.leadPercent.toFixed(0)}% 기여`);
    }

    // 효율 좋은 광고
    const efficientAds = adPerformance.filter(a => a.cpl > 0 && a.cpl < stats.cpl * 0.8 && a.leads >= 3);
    if (efficientAds.length > 0) {
      insights.push(`💡 CPL $${efficientAds[0].cpl.toFixed(0)} 이하 고효율 광고 ${efficientAds.length}개 확인`);
    }

    // 검토 필요 광고
    const lowEffAds = adPerformance.filter(a => a.cpl > stats.cpl * 1.5 && a.spend > 50);
    if (lowEffAds.length > 0) {
      insights.push(`🔍 CPL 평균 대비 50%+ 높은 광고 ${lowEffAds.length}개 - 소재/타겟 검토`);
    }
  }

  // 기본 요약
  if (stats.cpl <= 15) {
    insights.push(`✨ CPL $${stats.cpl.toFixed(2)} - 목표 달성 중`);
  } else if (stats.cpl <= 20) {
    insights.push(`📊 CPL $${stats.cpl.toFixed(2)} - 양호한 수준`);
  } else {
    insights.push(`📌 CPL $${stats.cpl.toFixed(2)} - 최적화 여지 있음`);
  }

  return insights.join('\n');
}

function generateMonthlyAiInsights(monthName, stats, prevStats, adPerformance, weeklyStats) {
  const insights = [];

  insights.push(`📊 ${monthName} 월간 성과 분석\n`);

  // 전월 대비
  if (prevStats) {
    const leadsChange = ((stats.leads - prevStats.leads) / prevStats.leads) * 100;
    const spendChange = ((stats.spend - prevStats.spend) / prevStats.spend) * 100;
    const cplChange = ((stats.cpl - prevStats.cpl) / prevStats.cpl) * 100;

    insights.push(`📈 전월 대비 성과:`);
    insights.push(`   • 리드: ${stats.leads}건 (${leadsChange >= 0 ? '+' : ''}${leadsChange.toFixed(1)}%)`);
    insights.push(`   • 지출: $${stats.spend.toFixed(0)} (${spendChange >= 0 ? '+' : ''}${spendChange.toFixed(1)}%)`);
    insights.push(`   • CPL: $${stats.cpl.toFixed(2)} (${cplChange >= 0 ? '+' : ''}${cplChange.toFixed(1)}%)`);
    insights.push('');
  }

  // 주차별 트렌드
  if (weeklyStats && weeklyStats.length > 0) {
    const bestWeek = weeklyStats.reduce((best, w) => w.cpl < best.cpl && w.leads > 0 ? w : best, weeklyStats[0]);
    const worstWeek = weeklyStats.reduce((worst, w) => w.cpl > worst.cpl ? w : worst, weeklyStats[0]);

    insights.push(`📅 주차별 분석:`);
    insights.push(`   • 최고 효율: W${bestWeek.week} (CPL $${bestWeek.cpl.toFixed(0)}, ${bestWeek.leads}건)`);
    if (bestWeek.week !== worstWeek.week) {
      insights.push(`   • 개선 필요: W${worstWeek.week} (CPL $${worstWeek.cpl.toFixed(0)}, ${worstWeek.leads}건)`);
    }
    insights.push('');
  }

  // 광고 성과
  if (adPerformance.length > 0) {
    const top3 = adPerformance.slice(0, 3);
    insights.push(`🏆 TOP 3 광고:`);
    top3.forEach((ad, i) => {
      insights.push(`   ${i + 1}. ${ad.ad_name.substring(0, 25)}... (${ad.leads}건, CPL $${ad.cpl.toFixed(0)})`);
    });
    insights.push('');

    // 개선점
    const avgCpl = stats.cpl;
    const underperforming = adPerformance.filter(a => a.cpl > avgCpl * 1.3 && a.spend > 100);
    if (underperforming.length > 0) {
      insights.push(`⚠️ 개선 권장 광고 ${underperforming.length}개 (평균 CPL 30%+ 초과)`);
    }
  }

  // 권장 사항
  insights.push(`\n💡 다음 달 권장 사항:`);
  if (stats.cpl > 20) {
    insights.push(`   • 고CPL 광고 소재 교체 또는 타겟 세분화`);
  }
  if (adPerformance.length > 5) {
    const topAdsSpend = adPerformance.slice(0, 3).reduce((sum, a) => sum + a.spend, 0);
    const topAdsRatio = (topAdsSpend / stats.spend) * 100;
    if (topAdsRatio < 50) {
      insights.push(`   • 상위 광고 예산 집중 검토 (현재 TOP3 비중 ${topAdsRatio.toFixed(0)}%)`);
    }
  }
  insights.push(`   • 주간 성과 모니터링 강화`);

  return insights.join('\n');
}

// ============================================================================
// 리포트 생성
// ============================================================================

async function generateWeeklyReports(weeks, monthLabel) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📅 ${monthLabel} 주간 리포트 생성`);
  console.log('='.repeat(60));

  let prevStats = null;

  for (const week of weeks) {
    console.log(`\n[W${week.week}] ${week.start} ~ ${week.end}`);

    const result = await getStatsForPeriod(week.start, week.end);
    if (!result) {
      console.log('   ⚠️ 데이터 없음, 스킵');
      continue;
    }

    const { stats, dailyData } = result;
    const adPerformance = await getAdPerformance(week.start, week.end);
    const campaignPerformance = await getCampaignPerformance(week.start, week.end);

    // AI 인사이트 생성
    const aiInsights = generateWeeklyAiInsights(week.week, stats, prevStats, adPerformance);

    // 메시지 생성
    const messages = [
      `📊 W${week.week} 주간 리포트 (${week.start} ~ ${week.end})`,
      `\n📈 주요 성과:`,
      `• 리드: ${stats.leads}건`,
      `• 지출: $${stats.spend.toFixed(2)}`,
      `• CPL: $${stats.cpl.toFixed(2)}`,
      `• CTR: ${stats.ctr.toFixed(2)}%`,
      `\n${aiInsights}`
    ];

    // 저장
    try {
      await saveWeeklyReport({
        weekStart: week.start,
        weekEnd: week.end,
        messages,
        thisStats: stats,
        prevStats: prevStats || { impressions: 0, clicks: 0, spend: 0, leads: 0, cpl: 0, ctr: 0 },
        aiInsights,
        dailyStats: dailyData,
        adPerformance,
        campaignPerformance
      });
      console.log(`   ✅ W${week.week} 저장 완료 (리드: ${stats.leads}, CPL: $${stats.cpl.toFixed(2)})`);
    } catch (err) {
      console.error(`   ❌ W${week.week} 저장 실패:`, err.message);
    }

    prevStats = stats;
  }
}

async function generateMonthlyReport(monthInfo) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📅 ${monthInfo.name} 월간 리포트 생성`);
  console.log('='.repeat(60));

  const result = await getStatsForPeriod(monthInfo.start, monthInfo.end);
  if (!result) {
    console.log('   ⚠️ 데이터 없음, 스킵');
    return;
  }

  const { stats, dailyData } = result;
  const adPerformance = await getAdPerformance(monthInfo.start, monthInfo.end);
  const campaignPerformance = await getCampaignPerformance(monthInfo.start, monthInfo.end);

  // 이전 월 데이터 (9월)
  const prevMonth = {
    start: '2025-09-01',
    end: '2025-09-30'
  };
  const prevResult = await getStatsForPeriod(prevMonth.start, prevMonth.end);
  const prevStats = prevResult ? prevResult.stats : { impressions: 0, clicks: 0, spend: 0, leads: 0, cpl: 0, ctr: 0 };

  // 주차별 통계 계산
  const weeklyStats = [];
  const relevantWeeks = monthInfo.month === '2025-10' ? OCTOBER_WEEKS : NOVEMBER_WEEKS;

  for (const week of relevantWeeks) {
    // 해당 월에 포함된 날짜만 계산
    const weekResult = await getStatsForPeriod(week.start, week.end);
    if (weekResult) {
      weeklyStats.push({
        week: week.week,
        label: `${week.start.substring(5)} ~ ${week.end.substring(5)}`,
        start: week.start,
        end: week.end,
        ...weekResult.stats
      });
    }
  }

  // 요일별 통계
  const dayOfWeekStats = calculateDayOfWeekStats(dailyData);

  // AI 인사이트 생성
  const aiInsights = generateMonthlyAiInsights(monthInfo.name, stats, prevStats, adPerformance, weeklyStats);

  // 메시지 생성
  const messages = [
    `📊 ${monthInfo.name} 월간 리포트 (${monthInfo.start} ~ ${monthInfo.end})`,
    `\n📈 월간 성과:`,
    `• 리드: ${stats.leads}건`,
    `• 지출: $${stats.spend.toFixed(2)}`,
    `• CPL: $${stats.cpl.toFixed(2)}`,
    `• CTR: ${stats.ctr.toFixed(2)}%`,
    `• 운영 일수: ${stats.days}일`,
    `\n${aiInsights}`
  ];

  // 저장
  try {
    await saveMonthlyReport({
      monthStart: monthInfo.start,
      monthEnd: monthInfo.end,
      messages,
      thisStats: stats,
      prevStats,
      aiInsights,
      weeklyStats,
      dayOfWeekStats,
      adPerformance,
      campaignPerformance
    });
    console.log(`   ✅ ${monthInfo.name} 월간 리포트 저장 완료`);
  } catch (err) {
    console.error(`   ❌ ${monthInfo.name} 월간 리포트 저장 실패:`, err.message);
  }
}

function calculateDayOfWeekStats(dailyData) {
  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
  const dayStats = Array(7).fill(null).map((_, i) => ({
    name: dayNames[i],
    leads: 0,
    spend: 0
  }));

  dailyData.forEach(d => {
    const dayOfWeek = new Date(d.date).getDay();
    dayStats[dayOfWeek].leads += d.leads || 0;
    dayStats[dayOfWeek].spend += parseFloat(d.spend || 0);
  });

  const totalLeads = dayStats.reduce((sum, d) => sum + d.leads, 0);
  return dayStats.map(d => ({
    ...d,
    percent: totalLeads > 0 ? (d.leads / totalLeads) * 100 : 0
  }));
}

// ============================================================================
// 메인 실행
// ============================================================================

async function main() {
  console.log('🚀 리포트 아카이브 생성 시작\n');
  console.log('대상 기간:');
  console.log('• 10월 주간: W41 ~ W44');
  console.log('• 10월 월간: 10/1 ~ 10/31');
  console.log('• 11월 주간: W45 ~ W47');

  // 10월 주간 리포트
  await generateWeeklyReports(OCTOBER_WEEKS, '10월');

  // 10월 월간 리포트
  await generateMonthlyReport(MONTHS[0]);

  // 11월 주간 리포트
  await generateWeeklyReports(NOVEMBER_WEEKS, '11월');

  console.log('\n✅ 리포트 아카이브 생성 완료!');
}

main().catch(console.error);
