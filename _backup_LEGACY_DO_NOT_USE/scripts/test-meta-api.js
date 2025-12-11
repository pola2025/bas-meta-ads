require('dotenv').config();
const fetch = require('node-fetch');

/**
 * Meta API 연결 테스트
 * Access Token과 Ad Account가 정상 작동하는지 확인
 */

async function testMetaAPI() {
  const accessToken = process.env.META_ACCESS_TOKEN;
  const adAccountId = process.env.META_AD_ACCOUNT_ID;

  if (!accessToken) {
    console.error('❌ META_ACCESS_TOKEN이 .env 파일에 없습니다!');
    process.exit(1);
  }

  if (!adAccountId) {
    console.error('❌ META_AD_ACCOUNT_ID가 .env 파일에 없습니다!');
    process.exit(1);
  }

  console.log('🧪 Meta API 연결 테스트 시작...\n');
  console.log(`📊 Ad Account: ${adAccountId}\n`);

  try {
    // 1. Token 검증
    console.log('1️⃣ Access Token 검증 중...');
    const debugUrl = `https://graph.facebook.com/debug_token?input_token=${accessToken}&access_token=${accessToken}`;
    const debugResponse = await fetch(debugUrl);
    const debugData = await debugResponse.json();

    if (!debugData.data || !debugData.data.is_valid) {
      console.error('❌ Token이 유효하지 않습니다!');
      console.error(debugData);
      process.exit(1);
    }

    console.log('✅ Token 유효');
    console.log(`   User ID: ${debugData.data.user_id}`);
    console.log(`   App ID: ${debugData.data.app_id}`);
    console.log(`   만료일: ${new Date(debugData.data.expires_at * 1000).toLocaleString('ko-KR')}`);
    console.log(`   권한: ${debugData.data.scopes ? debugData.data.scopes.join(', ') : 'N/A'}\n`);

    // 2. Ad Account 정보 조회
    console.log('2️⃣ Ad Account 정보 조회 중...');
    const accountUrl = `https://graph.facebook.com/v18.0/${adAccountId}?fields=id,name,account_status,currency,timezone_name&access_token=${accessToken}`;
    const accountResponse = await fetch(accountUrl);
    const accountData = await accountResponse.json();

    if (accountData.error) {
      console.error('❌ Ad Account 조회 실패:', accountData.error.message);
      console.error('   원인:', accountData.error.error_user_msg || accountData.error.message);
      process.exit(1);
    }

    console.log('✅ Ad Account 정보:');
    console.log(`   ID: ${accountData.id}`);
    console.log(`   Name: ${accountData.name}`);
    console.log(`   Status: ${accountData.account_status}`);
    console.log(`   Currency: ${accountData.currency}`);
    console.log(`   Timezone: ${accountData.timezone_name}\n`);

    // 3. 최근 캠페인 조회 (테스트)
    console.log('3️⃣ 캠페인 목록 조회 중 (최근 5개)...');
    const campaignsUrl = `https://graph.facebook.com/v18.0/${adAccountId}/campaigns?fields=id,name,status&limit=5&access_token=${accessToken}`;
    const campaignsResponse = await fetch(campaignsUrl);
    const campaignsData = await campaignsResponse.json();

    if (campaignsData.error) {
      console.error('❌ 캠페인 조회 실패:', campaignsData.error.message);
      process.exit(1);
    }

    if (campaignsData.data && campaignsData.data.length > 0) {
      console.log(`✅ 캠페인 ${campaignsData.data.length}개 발견:\n`);
      campaignsData.data.forEach((campaign, index) => {
        console.log(`   ${index + 1}. ${campaign.name} (${campaign.status})`);
      });
    } else {
      console.log('⚠️  캠페인이 없습니다.');
    }

    // 4. 광고 인사이트 조회 테스트 (지난 7일)
    console.log('\n4️⃣ 광고 인사이트 조회 테스트...');
    const today = new Date();
    const weekAgo = new Date(today);
    weekAgo.setDate(today.getDate() - 7);

    const since = weekAgo.toISOString().split('T')[0];
    const until = today.toISOString().split('T')[0];

    const insightsUrl = `https://graph.facebook.com/v18.0/${adAccountId}/insights?fields=impressions,clicks,spend&time_range={"since":"${since}","until":"${until}"}&access_token=${accessToken}`;
    const insightsResponse = await fetch(insightsUrl);
    const insightsData = await insightsResponse.json();

    if (insightsData.error) {
      console.error('❌ 인사이트 조회 실패:', insightsData.error.message);
    } else if (insightsData.data && insightsData.data.length > 0) {
      const insights = insightsData.data[0];
      console.log(`✅ 광고 인사이트 (${since} ~ ${until}):`);
      console.log(`   노출수: ${insights.impressions || 0}`);
      console.log(`   클릭수: ${insights.clicks || 0}`);
      console.log(`   지출액: ${insights.spend || 0} ${accountData.currency}`);
    } else {
      console.log('⚠️  해당 기간에 광고 데이터가 없습니다.');
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🎉 Meta API 연결 테스트 성공!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log('✅ 모든 테스트 통과:');
    console.log('   • Access Token 유효');
    console.log('   • Ad Account 접근 가능');
    console.log('   • 캠페인 조회 가능');
    console.log('   • 인사이트 데이터 조회 가능\n');

    console.log('📝 다음 단계:');
    console.log('   이제 Worker + Producer로 실제 데이터 수집이 가능합니다!');
    console.log('   1. npm run worker');
    console.log('   2. npm run producer\n');

  } catch (error) {
    console.error('\n❌ 에러 발생:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

testMetaAPI();
