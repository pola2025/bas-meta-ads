// Gemini 사용 가능한 모델 목록 확인
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config({ path: '.env.local' });

async function listModels() {
  try {
    const apiKey = process.env.GOOGLE_AI_API_KEY;
    const genAI = new GoogleGenerativeAI(apiKey);

    console.log('🔍 사용 가능한 Gemini 모델 조회 중...\n');

    // 모델 목록 가져오기
    const models = await genAI.listModels();

    console.log('✅ 사용 가능한 모델 목록:\n');
    console.log('─'.repeat(80));

    for (const model of models) {
      console.log(`📦 모델명: ${model.name}`);
      console.log(`   표시명: ${model.displayName || 'N/A'}`);
      console.log(`   설명: ${model.description || 'N/A'}`);
      console.log(`   지원 메소드: ${model.supportedGenerationMethods?.join(', ') || 'N/A'}`);
      console.log('');
    }

    console.log('─'.repeat(80));
    console.log(`\n총 ${models.length}개의 모델이 사용 가능합니다.\n`);

    // Gemini 3 관련 모델 필터링
    const gemini3Models = models.filter(m =>
      m.name.toLowerCase().includes('gemini-3') ||
      m.name.toLowerCase().includes('gemini-2')
    );

    if (gemini3Models.length > 0) {
      console.log('🎯 Gemini 2.0/3.0 관련 모델:\n');
      gemini3Models.forEach(m => {
        console.log(`   • ${m.name}`);
      });
    } else {
      console.log('⚠️  Gemini 3.0 모델을 찾을 수 없습니다.');
      console.log('💡 현재 사용 가능한 최신 모델을 사용하세요.');
    }

  } catch (error) {
    console.error('❌ 모델 목록 조회 실패:', error.message);
  }
}

listModels();
