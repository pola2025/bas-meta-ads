require('dotenv').config();
const fetch = require('node-fetch');

/**
 * Short-lived Token → Long-lived Token 교환
 *
 * 사용법:
 * 1. Graph API Explorer에서 Short-lived Token 발급
 * 2. 아래 SHORT_LIVED_TOKEN에 붙여넣기
 * 3. node exchange-token.js 실행
 */

const SHORT_LIVED_TOKEN = 'YOUR_SHORT_LIVED_TOKEN_HERE'; // ← 여기에 붙여넣기

async function exchangeToken() {
  const APP_ID = process.env.META_APP_ID;
  const APP_SECRET = process.env.META_APP_SECRET;

  if (!APP_ID || !APP_SECRET) {
    console.error('❌ META_APP_ID 또는 META_APP_SECRET이 .env 파일에 없습니다.');
    process.exit(1);
  }

  if (SHORT_LIVED_TOKEN === 'YOUR_SHORT_LIVED_TOKEN_HERE') {
    console.error('❌ SHORT_LIVED_TOKEN을 설정해주세요!');
    console.log('\n📝 사용 방법:');
    console.log('1. https://developers.facebook.com/tools/explorer/ 접속');
    console.log('2. Generate Access Token 클릭');
    console.log('3. 필요한 권한 선택 (ads_read, ads_management, read_insights)');
    console.log('4. 생성된 토큰을 이 파일의 SHORT_LIVED_TOKEN에 붙여넣기');
    console.log('5. node exchange-token.js 실행');
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
      process.exit(1);
    }

    const longLivedToken = data.access_token;
    const expiresIn = data.expires_in; // 초 단위 (보통 5184000 = 60일)

    console.log('✅ Long-lived Token 교환 성공!\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📝 Long-lived Access Token:');
    console.log(longLivedToken);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`\n⏰ 유효 기간: ${expiresIn} 초 (약 ${Math.floor(expiresIn / 86400)} 일)`);
    console.log(`📅 만료일: ${new Date(Date.now() + expiresIn * 1000).toLocaleString('ko-KR')}\n`);

    // Token 검증
    console.log('🔍 Token 검증 중...\n');
    const debugUrl = `https://graph.facebook.com/debug_token?input_token=${longLivedToken}&access_token=${longLivedToken}`;
    const debugResponse = await fetch(debugUrl);
    const debugData = await debugResponse.json();

    if (debugData.data) {
      console.log('✅ Token 정보:');
      console.log(`   App ID: ${debugData.data.app_id}`);
      console.log(`   User ID: ${debugData.data.user_id}`);
      console.log(`   Valid: ${debugData.data.is_valid ? '✅' : '❌'}`);
      console.log(`   Expires: ${new Date(debugData.data.expires_at * 1000).toLocaleString('ko-KR')}`);

      if (debugData.data.scopes) {
        console.log(`   Permissions: ${debugData.data.scopes.join(', ')}`);
      }
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 다음 단계:');
    console.log('1. 위의 Long-lived Token을 .env 파일에 추가:');
    console.log('   META_ACCESS_TOKEN=위의_토큰_복사');
    console.log('\n2. Supabase Vault에 저장 (보안):');
    console.log('   node save-token-to-vault.js');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  } catch (error) {
    console.error('❌ 에러 발생:', error.message);
    process.exit(1);
  }
}

exchangeToken();
