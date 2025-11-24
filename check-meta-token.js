require('dotenv').config();

(async () => {
  const accessToken = process.env.META_ACCESS_TOKEN;

  console.log('🔑 Checking Meta Access Token...\n');

  // 1. 토큰 정보 조회
  const debugUrl = `https://graph.facebook.com/v21.0/debug_token?input_token=${accessToken}&access_token=${accessToken}`;

  const debugResponse = await fetch(debugUrl);
  const debugData = await debugResponse.json();

  if (debugData.error) {
    console.log('❌ Token is INVALID or EXPIRED');
    console.log('Error:', debugData.error.message);
    console.log('\n📌 Action Required: Generate new long-lived token\n');
    process.exit(1);
  }

  const tokenInfo = debugData.data;

  console.log('✅ Token is VALID\n');
  console.log('━'.repeat(80));
  console.log('Token Info:');
  console.log(`  App ID: ${tokenInfo.app_id}`);
  console.log(`  Type: ${tokenInfo.type}`);
  console.log(`  Is Valid: ${tokenInfo.is_valid}`);
  console.log(`  Expires At: ${tokenInfo.data_access_expires_at ? new Date(tokenInfo.data_access_expires_at * 1000).toLocaleString('ko-KR') : 'Never (long-lived)'}`);
  console.log(`  Issued At: ${new Date(tokenInfo.issued_at * 1000).toLocaleString('ko-KR')}`);
  console.log(`  Scopes: ${tokenInfo.scopes ? tokenInfo.scopes.join(', ') : 'N/A'}`);
  console.log('━'.repeat(80));

  // 2. 광고 계정 접근 테스트
  console.log('\n🔍 Testing Ad Account Access...\n');

  const adAccountId = process.env.META_AD_ACCOUNT_ID;
  const testUrl = `https://graph.facebook.com/v21.0/${adAccountId}?fields=id,name,account_status,currency&access_token=${accessToken}`;

  const testResponse = await fetch(testUrl);
  const testData = await testResponse.json();

  if (testData.error) {
    console.log('❌ Cannot access ad account');
    console.log('Error:', testData.error.message);
    process.exit(1);
  }

  console.log('✅ Ad Account Access OK\n');
  console.log('━'.repeat(80));
  console.log('Ad Account Info:');
  console.log(`  ID: ${testData.id}`);
  console.log(`  Name: ${testData.name}`);
  console.log(`  Status: ${testData.account_status}`);
  console.log(`  Currency: ${testData.currency}`);
  console.log('━'.repeat(80));

  console.log('\n🎉 All checks passed! Token is working correctly.\n');

  process.exit(0);
})();
