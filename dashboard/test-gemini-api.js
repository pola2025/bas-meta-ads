// Gemini API 테스트 스크립트
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config({ path: '.env.local' });

async function testGeminiAPI() {
  try {
    console.log('🔍 Gemini API 테스트 시작...\n');

    // API 키 확인
    const apiKey = process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) {
      console.error('❌ GOOGLE_AI_API_KEY가 설정되지 않았습니다.');
      console.log('💡 .env.local 파일을 확인하세요.');
      process.exit(1);
    }

    console.log('✅ API 키 확인 완료');
    console.log(`   키 시작: ${apiKey.substring(0, 10)}...`);
    console.log('');

    // Gemini AI 초기화
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-3-pro-preview'
    });

    console.log('✅ Gemini 모델 초기화 완료');
    console.log('   모델: gemini-3-pro-preview (최신 Gemini 3.0)\n');

    // 테스트 프롬프트
    const testPrompt = `당신은 Meta 광고 성과 분석 전문가입니다. 다음 데이터를 기반으로 주간 리포트를 작성해주세요.

## 분석 기간
2025-11-14 ~ 2025-11-21

## 주요 지표 (KPI)
- 총 리드: 150
- 총 지출: $3000.00
- 평균 CPL: $20.00
- 평균 CTR: 2.50%
- 총 노출수: 50000
- 총 클릭수: 1250
- 평균 CVR: 12.00%

## 플랫폼별 성과
- Facebook: 리드 100, 지출 $2000.00, CPL $20.00 (66.7%)
- Instagram: 리드 50, 지출 $1000.00, CPL $20.00 (33.3%)

다음 형식으로 분석을 제공해주세요:

1. **핵심 요약** (2-3문장)
2. **주요 발견사항** (3-4개 bullet points)
3. **성과 분석**
   - 잘된 점
   - 개선이 필요한 점
4. **실행 가능한 제안** (3-5개)

간결하고 실용적으로 작성하되, 구체적인 숫자와 예시를 포함해주세요.`;

    console.log('📤 Gemini API 호출 중...\n');

    // API 호출
    const startTime = Date.now();
    const result = await model.generateContent(testPrompt);
    const endTime = Date.now();

    const insights = result.response.text();

    console.log('✅ API 호출 성공!');
    console.log(`⏱️  응답 시간: ${endTime - startTime}ms\n`);
    console.log('📊 생성된 인사이트:\n');
    console.log('─'.repeat(80));
    console.log(insights);
    console.log('─'.repeat(80));
    console.log('\n✨ Gemini API 테스트 완료!\n');

    // 응답 메타데이터
    console.log('📈 응답 메타데이터:');
    console.log(`   텍스트 길이: ${insights.length} 문자`);
    console.log(`   단어 수: 약 ${insights.split(/\s+/).length}개`);

  } catch (error) {
    console.error('\n❌ API 호출 실패:');
    console.error('   오류:', error.message);

    if (error.message.includes('API key')) {
      console.error('\n💡 API 키를 확인하세요:');
      console.error('   1. .env.local 파일에 GOOGLE_AI_API_KEY가 있는지 확인');
      console.error('   2. Google AI Studio에서 키가 활성화되어 있는지 확인');
      console.error('   3. 키에 공백이나 특수문자가 없는지 확인');
    }

    if (error.message.includes('quota')) {
      console.error('\n💡 할당량 초과:');
      console.error('   Google Cloud Console에서 할당량을 확인하세요.');
    }

    process.exit(1);
  }
}

// 테스트 실행
testGeminiAPI();
