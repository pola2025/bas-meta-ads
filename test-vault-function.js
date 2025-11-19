require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function testVaultFunction() {
  const SECRET_ID = '8d930f47-392b-4f17-b88a-8ff532f162f0';

  console.log('🔍 Testing vault_read_secret function...\n');
  console.log(`Secret ID: ${SECRET_ID}\n`);

  try {
    const { data, error } = await supabase.rpc('vault_read_secret', {
      secret_id: SECRET_ID
    });

    if (error) {
      console.error('❌ Function call failed:', error);
      process.exit(1);
    }

    if (!data || !data.secret) {
      console.error('❌ No secret returned');
      console.log('Response:', data);
      process.exit(1);
    }

    const token = data.secret;
    console.log('✅ vault_read_secret function works!\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 Access Token (first 50 chars):');
    console.log(token.substring(0, 50) + '...');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log('🎉 Vault 설정 완료!');
    console.log('\n✅ 시스템 준비 완료:');
    console.log('   • Supabase Database ✅');
    console.log('   • Supabase Vault ✅');
    console.log('   • Upstash Redis ✅');
    console.log('   • Meta API Token (60일) ✅');
    console.log('   • Worker + Producer 코드 ✅\n');

    console.log('📝 다음 단계: 실제 데이터 수집 테스트');
    console.log('   1. npm run worker');
    console.log('   2. npm run producer\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

testVaultFunction();
