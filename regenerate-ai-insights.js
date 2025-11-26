/**
 * AI 인사이트 재생성 스크립트
 * Gemini API를 사용하여 기존 리포트의 AI 인사이트를 업그레이드
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ============================================================================
// Gemini AI 인사이트 생성
// ============================================================================

async function generateAiInsightsWithGemini(reportType, reportData, stats, adPerformance, prevStats) {
  const model = genAI.getGenerativeModel({ model: 'gemini-3-pro-preview' });

  const isWeekly = reportType === 'weekly';
  const periodLabel = isWeekly
    ? `W${getWeekNumber(reportData.week_start)} (${reportData.week_start} ~ ${reportData.week_end})`
    : `${reportData.week_start.substring(0, 7)} 월간`;

  // 상위 광고 정보
  const topAds = adPerformance.slice(0, 5).map((ad, i) =>
    `${i + 1}. ${ad.ad_name} - 리드 ${ad.leads}건, CPL $${ad.cpl.toFixed(2)}, 지출비중 ${ad.spendPercent.toFixed(1)}%`
  ).join('\n');

  // 전주/전월 대비 변화
  let comparisonText = '';
  if (prevStats && prevStats.leads > 0) {
    const leadsChange = ((stats.leads - prevStats.leads) / prevStats.leads * 100).toFixed(1);
    const cplChange = prevStats.cpl > 0 ? ((stats.cpl - prevStats.cpl) / prevStats.cpl * 100).toFixed(1) : 0;
    const spendChange = prevStats.spend > 0 ? ((stats.spend - prevStats.spend) / prevStats.spend * 100).toFixed(1) : 0;
    comparisonText = `
전${isWeekly ? '주' : '월'} 대비:
- 리드: ${prevStats.leads}건 → ${stats.leads}건 (${leadsChange >= 0 ? '+' : ''}${leadsChange}%)
- CPL: $${prevStats.cpl.toFixed(2)} → $${stats.cpl.toFixed(2)} (${cplChange >= 0 ? '+' : ''}${cplChange}%)
- 지출: $${prevStats.spend.toFixed(0)} → $${stats.spend.toFixed(0)} (${spendChange >= 0 ? '+' : ''}${spendChange}%)`;
  }

  const prompt = `당신은 메타(페이스북/인스타그램) 광고 성과 분석 전문가입니다.
다음 광고 성과 데이터를 분석하여 ${isWeekly ? '주간' : '월간'} 인사이트를 작성해주세요.

## ${periodLabel} 성과 요약
- 총 리드: ${stats.leads}건
- 총 지출: $${stats.spend.toFixed(2)}
- 평균 CPL: $${stats.cpl.toFixed(2)}
- CTR: ${stats.ctr.toFixed(2)}%
- 전환율: ${stats.conversion_rate?.toFixed(2) || 0}%
${comparisonText}

## 광고별 성과 (상위 5개)
${topAds || '데이터 없음'}

## 작성 요청사항
1. **핵심 성과 요약** (2-3줄): 이번 ${isWeekly ? '주' : '월'}의 핵심 성과를 간결하게
2. **주요 인사이트** (3-4개): 데이터에서 발견되는 의미있는 패턴이나 트렌드
3. **액션 아이템** (2-3개): 다음 ${isWeekly ? '주' : '월'} 실행할 구체적인 개선 방안

## 작성 스타일
- 이모지를 적절히 사용하여 가독성 높게
- 구체적인 수치를 포함
- 실무자가 바로 활용할 수 있는 실행 가능한 제안
- 한국어로 작성
- 마크다운 형식 사용 금지, 일반 텍스트로 작성`;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error('Gemini API 오류:', error.message);
    return null;
  }
}

function getWeekNumber(dateStr) {
  const date = new Date(dateStr);
  const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
  const pastDaysOfYear = (date - firstDayOfYear) / 86400000;
  return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
}

// ============================================================================
// 광고 성과 조회
// ============================================================================

async function getAdPerformance(startDate, endDate) {
  const { data, error } = await supabase
    .from('ads_insights_daily')
    .select('ad_id, ad_name, campaign_name, impressions, clicks, spend, leads')
    .gte('date', startDate)
    .lte('date', endDate);

  if (error || !data) return [];

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

async function getStatsFromReportData(reportData) {
  if (reportData && reportData.summary) {
    return {
      leads: reportData.summary.leads || 0,
      spend: reportData.summary.spend || 0,
      cpl: reportData.summary.cpl || 0,
      ctr: reportData.summary.ctr || 0,
      impressions: reportData.summary.impressions || 0,
      clicks: reportData.summary.clicks || 0,
      conversion_rate: reportData.summary.conversion_rate || 0
    };
  }
  return null;
}

async function getPrevStats(reportData) {
  if (reportData && reportData.comparison) {
    const comp = reportData.comparison;
    return {
      leads: comp.prev_leads || 0,
      spend: comp.prev_spend || 0,
      cpl: comp.prev_cpl || 0,
      ctr: comp.prev_ctr || 0,
      impressions: comp.prev_impressions || 0,
      clicks: comp.prev_clicks || 0
    };
  }
  return null;
}

// ============================================================================
// 메인 실행
// ============================================================================

async function main() {
  console.log('🤖 AI 인사이트 재생성 시작 (Gemini API)\n');

  // 최근 리포트 조회
  const { data: reports, error } = await supabase
    .from('telegram_reports')
    .select('*')
    .in('report_type', ['weekly', 'monthly'])
    .order('week_start', { ascending: false })
    .limit(10);

  if (error) {
    console.error('리포트 조회 실패:', error.message);
    return;
  }

  console.log(`📋 ${reports.length}개 리포트 발견\n`);

  for (const report of reports) {
    const periodLabel = report.report_type === 'weekly'
      ? `W${getWeekNumber(report.week_start)}`
      : report.week_start.substring(0, 7);

    console.log(`\n[${report.report_type.toUpperCase()}] ${periodLabel} (${report.week_start} ~ ${report.week_end})`);

    // 광고 성과 조회
    const adPerformance = await getAdPerformance(report.week_start, report.week_end);

    // 기존 데이터에서 통계 추출
    const stats = await getStatsFromReportData(report.report_data) || {
      leads: report.total_leads || 0,
      spend: report.total_spend || 0,
      cpl: report.avg_cpl || 0,
      ctr: report.avg_ctr || 0,
      impressions: report.total_impressions || 0,
      clicks: report.total_clicks || 0
    };

    const prevStats = await getPrevStats(report.report_data);

    // Gemini로 AI 인사이트 생성
    console.log('   🔄 Gemini API 호출 중...');
    const newInsights = await generateAiInsightsWithGemini(
      report.report_type,
      report,
      stats,
      adPerformance,
      prevStats
    );

    if (newInsights) {
      // DB 업데이트
      const { error: updateError } = await supabase
        .from('telegram_reports')
        .update({
          ai_insights: newInsights,
          updated_at: new Date().toISOString()
        })
        .eq('id', report.id);

      if (updateError) {
        console.log(`   ❌ 업데이트 실패: ${updateError.message}`);
      } else {
        console.log(`   ✅ AI 인사이트 업데이트 완료`);
        console.log(`   📝 미리보기: ${newInsights.substring(0, 100)}...`);
      }
    } else {
      console.log('   ⚠️ AI 인사이트 생성 실패, 스킵');
    }

    // Rate limit 방지
    await new Promise(resolve => setTimeout(resolve, 1500));
  }

  console.log('\n✅ AI 인사이트 재생성 완료!');
}

main().catch(console.error);
