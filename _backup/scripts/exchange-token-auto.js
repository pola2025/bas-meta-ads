require('dotenv').config();
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

/**
 * Short-lived Token → Long-lived Token 교환 (자동 저장)
 *
 * 사용법:
 * node exchange-token-auto.js YOUR_SHORT_LIVED_TOKEN
 */

const SHORT_LIVED_TOKEN = process.argv[2];

async function exchangeAndSaveToken() {
  const APP_ID = process.env.META_APP_ID;
  const APP_SECRET = process.env.META_APP_SECRET;

  if (!APP_ID || !APP_SECRET) {
    console.error('❌ META_APP_ID 또는 META_APP_SECRET이 .env 파일에 없습니다.');
    process.exit(1);
  }

  if (!SHORT_LIVED_TOKEN) {
    console.error('❌ Short-lived Token을 인자로 전달해주세요!');
    console.log('\n사용법:');
    console.log('node exchange-token-auto.js YOUR_SHORT_LIVED_TOKEN');
    console.log('\n📝 Token 발급 방법:');
    console.log('1. https://developers.facebook.com/tools/explorer/ 접속');
    console.log('2. Generate Access Token 클릭');
    console.log('3. 필요한 권한 선택:');
    console.log('   ✅ ads_read');
    console.log('   ✅ ads_management');
    console.log('   ✅ read_insights');
    console.log('   ✅ business_management');
    console.log('4. 생성된 토큰 복사');
    console.log('5. node exchange-token-auto.js 토큰_붙여넣기');
    process.exit(1);
  }

  console.log('🔄 Exchanging Short-lived Token to Long-lived Token...\n');

  try {
    // Meta OAuth Token Exchange API
    const url = `https://graph.facebook.com/v18.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${APP_ID}&client_secret=${APP_SECRET}&fb_exchange_token=${SHORT_LIVED_TOKEN}`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.error) {
      console.error('❌ Token 교환 실패:', data.error.message);
      console.log('\n가능한 원인:');
      console.log('- Short-lived Token이 이미 만료되었습니다 (1시간 제한)');
      console.log('- META_APP_ID 또는 META_APP_SECRET이 잘못되었습니다');
      console.log('- Token이 해당 앱에서 발급되지 않았습니다');
      console.log('\n해결 방법:');
      console.log('1. Graph API Explorer에서 새로운 Token 발급');
      console.log('2. 발급 후 1시간 이내에 이 스크립트 실행');
      process.exit(1);
    }

    const longLivedToken = data.access_token;
    const expiresIn = data.expires_in;

    console.log('✅ Long-lived Token 교환 성공!\n');

    // Token 검증
    console.log('🔍 Token 검증 중...\n');
    const debugUrl = `https://graph.facebook.com/debug_token?input_token=${longLivedToken}&access_token=${longLivedToken}`;
    const debugResponse = await fetch(debugUrl);
    const debugData = await debugResponse.json();

    if (!debugData.data || !debugData.data.is_valid) {
      console.error('❌ Token이 유효하지 않습니다!');
      process.exit(1);
    }

    console.log('✅ Token 검증 완료:');
    console.log(`   App ID: ${debugData.data.app_id}`);
    console.log(`   User ID: ${debugData.data.user_id}`);
    console.log(`   Valid: ✅`);
    console.log(`   만료일: ${new Date(debugData.data.expires_at * 1000).toLocaleString('ko-KR')}`);
    console.log(`   유효 기간: 약 ${Math.floor(expiresIn / 86400)} 일\n`);

    if (debugData.data.scopes) {
      console.log(`   권한: ${debugData.data.scopes.join(', ')}\n`);
    }

    // .env 파일 업데이트
    console.log('💾 .env 파일 업데이트 중...\n');
    const envPath = path.join(__dirname, '.env');
    let envContent = fs.readFileSync(envPath, 'utf8');

    // META_ACCESS_TOKEN 교체
    if (envContent.includes('META_ACCESS_TOKEN=')) {
      envContent = envContent.replace(
        /META_ACCESS_TOKEN=.*/,
        `META_ACCESS_TOKEN=${longLivedToken}`
      );
    } else {
      envContent += `\nMETA_ACCESS_TOKEN=${longLivedToken}\n`;
    }

    fs.writeFileSync(envPath, envContent);

    console.log('✅ .env 파일 업데이트 완료!');
    console.log(`   META_ACCESS_TOKEN이 Long-lived Token으로 교체되었습니다.\n`);

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🎉 완료! Long-lived Token이 설정되었습니다.');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log('📋 Long-lived Token:');
    console.log(longLivedToken);
    console.log('\n📅 만료일:', new Date(debugData.data.expires_at * 1000).toLocaleString('ko-KR'));
    console.log(`⏰ 약 ${Math.floor(expiresIn / 86400)} 일 후 만료`);

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📝 다음 단계:');
    console.log('1. Supabase Vault에 토큰 저장 (보안):');
    console.log('   node save-token-to-vault.js');
    console.log('\n2. 로컬 테스트:');
    console.log('   npm run worker (터미널 1)');
    console.log('   npm run producer (터미널 2)');
    console.log('\n⚠️  60일 후 재발급 필요 (만료 7일 전 Telegram 알림 발송)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  } catch (error) {
    console.error('❌ 에러 발생:', error.message);
    process.exit(1);
  }
}

exchangeAndSaveToken();
