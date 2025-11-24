/**
 * Gemini AI 분석 테스트 (텔레그램 전송 없음)
 */

require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

(async () => {
  // 실제 데이터 (이미 알고 있는 값)
  const currentWeekData = {
    spend: 641.42,
    leads: 15,
    cpl: 42.76,
    ctr: 2.45,
    impressions: 8875,
    clicks: 217
  };

  const prevWeekData = {
    spend: 1716.29,
    leads: 108,
    cpl: 15.89,
    ctr: 2.70
  };

  const topAds = [
    { name: '20251115_고객이찾아오는영업', cpl: 19.57, ctr: 2.75, leads: 3 },
    { name: '20250808_고객이찾아오는영업', cpl: 19.59, ctr: 2.67, leads: 7 },
    { name: '251101_법인영업에지친당신', cpl: 25.46, ctr: 3.56, leads: 2 },
    { name: '251101_삶이불안막막하다면', cpl: 53.49, ctr: 2.10, leads: 1 },
    { name: '20251115_보험영업중이라면 꼭 보셔야 합니다', cpl: 55.30, ctr: 2.78, leads: 1 },
    { name: '20241127_보험타겟', cpl: 131.86, ctr: 2.37, leads: 1 }
  ];

  const prompt = `당신은 메타 광고 전문가입니다. 다음 주간 성과 데이터를 분석하여 **3가지 핵심 인사이트**와 **2가지 실행 가능한 추천 액션**을 제공해주세요.

**현재 주 성과 (2025-11-10 ~ 2025-11-16)**:
- 총 지출: $${currentWeekData.spend.toFixed(2)}
- 총 리드: ${currentWeekData.leads}건
- 평균 CPL: $${currentWeekData.cpl.toFixed(2)}
- 평균 CTR: ${currentWeekData.ctr.toFixed(2)}%
- 노출수: ${currentWeekData.impressions.toLocaleString()}회
- 클릭수: ${currentWeekData.clicks}회

**전주 대비 변화**:
- 지출: $${prevWeekData.spend.toFixed(2)} → $${currentWeekData.spend.toFixed(2)} (-62.6%)
- 리드: ${prevWeekData.leads}건 → ${currentWeekData.leads}건 (-86.1%)
- CPL: $${prevWeekData.cpl.toFixed(2)} → $${currentWeekData.cpl.toFixed(2)} (+169.2%)
- CTR: ${prevWeekData.ctr.toFixed(2)}% → ${currentWeekData.ctr.toFixed(2)}% (-9.4%)

**광고별 성과 (CPL 낮은 순)**:
${topAds.map((ad, i) => `${i+1}. ${ad.name}
   CPL: $${ad.cpl.toFixed(2)} | CTR: ${ad.ctr.toFixed(2)}% | 리드: ${ad.leads}건`).join('\n')}

**응답 형식**:

💡 핵심 인사이트

1. [인사이트 1 - 구체적인 숫자와 광고명 포함]
2. [인사이트 2 - 구체적인 숫자와 광고명 포함]
3. [인사이트 3 - 구체적인 숫자와 광고명 포함]

🎯 추천 액션

1. [액션 1 - 즉시 실행 가능한 구체적인 조치]
2. [액션 2 - 즉시 실행 가능한 구체적인 조치]

**중요**: 각 인사이트와 액션은 반드시 구체적인 숫자, 광고명, ROI 계산을 포함하여 작성해주세요. 일반적인 조언이 아닌 이 데이터에만 적용되는 특화된 분석을 제공해주세요.`;

  console.log('\n📊 Gemini API 호출 중...');
  console.log('━'.repeat(80));

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash-exp',
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 1024,
    }
  });

  const result = await model.generateContent(prompt);
  const aiResponse = result.response.text();

  console.log('\n✨ 폴라애드 AI 분석 결과 (Gemini 2.0 Flash)');
  console.log('━'.repeat(80));
  console.log(aiResponse);
  console.log('━'.repeat(80));
  console.log('\n📌 참고: 이 분석은 텔레그램에 전송되지 않았습니다.');
  console.log('📌 텔레그램 배포 시 타이틀: "🤖 폴라애드 AI 분석"');

  process.exit(0);
})();
