/**
 * AI 인사이트 선택적 재생성 스크립트
 * 특정 클라이언트, 특정 기간의 리포트만 AI 인사이트 재생성
 *
 * 사용법:
 *   node regenerate-ai-insights-selective.js --client=비즈액터스쿨 --start=2025-12-01 --end=2025-12-07
 *   node regenerate-ai-insights-selective.js --all --start=2025-12-01 --end=2025-12-07
 *
 * 참고: ads_insights_daily VIEW는 'date' 컬럼 사용 (date_start 아님!)
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// 명령줄 인자 파싱
const args = process.argv.slice(2);
const clientArg = args.find(a => a.startsWith('--client='));
const startArg = args.find(a => a.startsWith('--start='));
const endArg = args.find(a => a.startsWith('--end='));
const ALL_CLIENTS = args.includes('--all');

const TARGET_CLIENT = clientArg ? clientArg.split('=')[1] : null;
const START_DATE = startArg ? startArg.split('=')[1] : null;
const END_DATE = endArg ? endArg.split('=')[1] : null;

if (!START_DATE || !END_DATE) {
  console.error('❌ --start=YYYY-MM-DD --end=YYYY-MM-DD 필수');
  process.exit(1);
}

if (!TARGET_CLIENT && !ALL_CLIENTS) {
  console.error('❌ --client=클라이언트명 또는 --all 필수');
  process.exit(1);
}

// ============================================================================
// Gemini AI 인사이트 생성
// ============================================================================

async function generateAiInsightsWithGemini(reportType, reportData, stats, adPerformance, prevStats) {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

  const isWeekly = reportType === 'weekly';
  const periodLabel = isWeekly
    ? `${reportData.week_start} ~ ${reportData.week_end}`
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
1. **성과 종합 분석** (3-4줄): 이번 ${isWeekly ? '주' : '월'}의 핵심 성과를 구체적인 수치와 함께
2. **주요 인사이트** (3-4개): 데이터에서 발견되는 의미있는 패턴이나 트렌드
3. **액션 아이템** (2-3개): 다음 ${isWeekly ? '주' : '월'} 실행할 구체적인 개선 방안

## 작성 스타일
- 마크다운 헤더(###) 사용하여 섹션 구분
- 구체적인 수치를 포함
- 실무자가 바로 활용할 수 있는 실행 가능한 제안
- 한국어로 작성`;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error('Gemini API 오류:', error.message);
    return null;
  }
}

// ============================================================================
// 광고 성과 조회 (ads_insights_daily VIEW - 'date' 컬럼 사용!)
// ============================================================================

async function getAdPerformance(startDate, endDate, clientId) {
  // ⚠️ ads_insights_daily VIEW는 'date' 컬럼 사용 (date_start 아님!)
  const { data, error } = await supabase
    .from('ads_insights_daily')
    .select('ad_id, ad_name, campaign_name, impressions, clicks, spend, leads')
    .gte('date', startDate)
    .lte('date', endDate)
    .eq('client_id', clientId);

  if (error || !data) {
    console.error('광고 성과 조회 실패:', error?.message);
    return [];
  }

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

// ============================================================================
// 메인 실행
// ============================================================================

async function main() {
  console.log('🤖 AI 인사이트 선택적 재생성\n');
  console.log(`📅 기간: ${START_DATE} ~ ${END_DATE}`);
  console.log(`🎯 대상: ${TARGET_CLIENT || '모든 클라이언트'}\n`);

  // 클라이언트 조회
  let clientQuery = supabase.from('clients').select('id, client_name');
  if (TARGET_CLIENT) {
    clientQuery = clientQuery.eq('client_name', TARGET_CLIENT);
  }
  const { data: clients, error: clientError } = await clientQuery;

  if (clientError || !clients || clients.length === 0) {
    console.error('❌ 클라이언트를 찾을 수 없습니다.');
    return;
  }

  for (const client of clients) {
    console.log(`\n===== ${client.client_name} =====`);

    // 해당 기간 리포트 조회
    const { data: reports, error: reportError } = await supabase
      .from('telegram_reports')
      .select('*')
      .eq('client_id', client.id)
      .eq('week_start', START_DATE)
      .eq('week_end', END_DATE);

    if (reportError || !reports || reports.length === 0) {
      console.log('   ⚠️ 해당 기간 리포트 없음');
      continue;
    }

    for (const report of reports) {
      console.log(`   📋 ${report.report_type} 리포트 (${report.week_start} ~ ${report.week_end})`);

      // 광고 성과 조회
      const adPerformance = await getAdPerformance(report.week_start, report.week_end, client.id);

      if (adPerformance.length === 0) {
        console.log('   ⚠️ 광고 데이터 없음');
        continue;
      }

      // 기존 데이터에서 통계 추출
      const stats = report.report_data?.summary || {
        leads: report.total_leads || 0,
        spend: report.total_spend || 0,
        cpl: report.avg_cpl || 0,
        ctr: report.avg_ctr || 0,
        conversion_rate: 0
      };

      const prevStats = report.report_data?.comparison ? {
        leads: report.report_data.comparison.prev_leads || 0,
        spend: report.report_data.comparison.prev_spend || 0,
        cpl: report.report_data.comparison.prev_cpl || 0
      } : null;

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
          console.log(`   📝 미리보기: ${newInsights.substring(0, 150)}...`);
        }
      } else {
        console.log('   ⚠️ AI 인사이트 생성 실패');
      }

      // Rate limit 방지
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  console.log('\n✅ AI 인사이트 재생성 완료!');
}

main().catch(console.error);
