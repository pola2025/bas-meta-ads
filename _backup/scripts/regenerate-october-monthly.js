/**
 * 10월 월간 AI 인사이트 재생성 (Gemini)
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function main() {
  // 10월 월간 리포트 조회
  const { data: report } = await supabase
    .from('telegram_reports')
    .select('*')
    .eq('report_type', 'monthly')
    .eq('week_start', '2025-10-01')
    .single();

  if (!report) {
    console.log('10월 월간 리포트 없음');
    return;
  }

  console.log('📊 10월 월간 리포트 발견');
  console.log('   리드:', report.total_leads, '| 지출: $' + report.total_spend.toFixed(0), '| CPL: $' + report.avg_cpl.toFixed(2));

  // 10월 광고 성과 조회
  const { data: adsData } = await supabase
    .from('ads_insights_daily')
    .select('ad_id, ad_name, campaign_name, impressions, clicks, spend, leads')
    .gte('date', '2025-10-01')
    .lte('date', '2025-10-31');

  // 광고별 집계
  const adMap = {};
  adsData.forEach(row => {
    if (!adMap[row.ad_id]) {
      adMap[row.ad_id] = { ad_name: row.ad_name, campaign_name: row.campaign_name, impressions: 0, clicks: 0, spend: 0, leads: 0 };
    }
    adMap[row.ad_id].impressions += row.impressions || 0;
    adMap[row.ad_id].clicks += row.clicks || 0;
    adMap[row.ad_id].spend += parseFloat(row.spend || 0);
    adMap[row.ad_id].leads += row.leads || 0;
  });

  const ads = Object.values(adMap).map(ad => ({
    ...ad,
    cpl: ad.leads > 0 ? ad.spend / ad.leads : 0,
    ctr: ad.impressions > 0 ? (ad.clicks / ad.impressions) * 100 : 0
  })).sort((a, b) => b.leads - a.leads);

  const totalSpend = ads.reduce((s, a) => s + a.spend, 0);
  const topAds = ads.slice(0, 7).map((ad, i) =>
    `${i+1}. ${ad.ad_name} - 리드 ${ad.leads}건, CPL $${ad.cpl.toFixed(2)}, 지출비중 ${(ad.spend/totalSpend*100).toFixed(1)}%`
  ).join('\n');

  // 주차별 성과
  const weeklyData = report.report_data?.weekly_stats || [];
  const weeklyText = weeklyData.map(w => `W${w.week}: 리드 ${w.leads}건, CPL $${w.cpl.toFixed(2)}`).join('\n');

  // 9월 대비 (있으면)
  const { data: prevReport } = await supabase
    .from('telegram_reports')
    .select('total_leads, total_spend, avg_cpl')
    .eq('report_type', 'monthly')
    .eq('week_start', '2025-09-01')
    .single();

  let compText = '';
  if (prevReport) {
    const leadsChg = ((report.total_leads - prevReport.total_leads) / prevReport.total_leads * 100).toFixed(1);
    const cplChg = ((report.avg_cpl - prevReport.avg_cpl) / prevReport.avg_cpl * 100).toFixed(1);
    compText = `전월(9월) 대비: 리드 ${prevReport.total_leads}건 → ${report.total_leads}건 (${leadsChg}%), CPL $${prevReport.avg_cpl.toFixed(2)} → $${report.avg_cpl.toFixed(2)} (${cplChg}%)`;
  }

  const prompt = `당신은 메타(페이스북/인스타그램) 광고 성과 분석 전문가입니다.
다음 10월 월간 광고 성과 데이터를 심층 분석하여 인사이트를 작성해주세요.

## 2025년 10월 월간 성과 요약
- 총 리드: ${report.total_leads}건
- 총 지출: $${report.total_spend.toFixed(2)}
- 평균 CPL: $${report.avg_cpl.toFixed(2)}
- CTR: ${report.avg_ctr.toFixed(2)}%
${compText}

## 주차별 성과
${weeklyText || '데이터 없음'}

## 광고별 성과 (상위 7개)
${topAds}

## 작성 요청사항
1. **핵심 성과 요약** (3-4줄): 10월 전체 성과의 핵심 포인트
2. **주차별 트렌드 분석**: 주차별 성과 변화 패턴과 원인 분석
3. **Top 광고 분석**: 상위 광고들의 성과 특징과 성공 요인
4. **개선 기회**: CPL이 높은 광고나 효율 개선이 필요한 부분
5. **11월 액션 플랜** (3-4개): 다음 달 실행할 구체적인 전략

## 작성 스타일
- 이모지를 적절히 사용하여 가독성 높게
- 구체적인 수치와 퍼센트를 포함
- 실무자가 바로 활용할 수 있는 실행 가능한 제안
- 한국어로 작성
- 마크다운 형식 사용 금지, 일반 텍스트로 작성
- 총 길이는 500-700자`;

  console.log('\n🔄 Gemini API 호출 중...');

  const model = genAI.getGenerativeModel({ model: 'gemini-3-pro-preview' });
  const result = await model.generateContent(prompt);
  const insights = result.response.text();

  console.log('\n📝 생성된 인사이트:\n');
  console.log(insights);

  // DB 업데이트
  const { error } = await supabase
    .from('telegram_reports')
    .update({ ai_insights: insights, updated_at: new Date().toISOString() })
    .eq('id', report.id);

  if (error) {
    console.log('\n❌ 업데이트 실패:', error.message);
  } else {
    console.log('\n✅ 10월 월간 AI 인사이트 업데이트 완료!');
  }
}

main().catch(console.error);
