/**
 * Vault 토큰 저장 확인 스크립트
 */
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function checkVault() {
  console.log('🔍 Checking Vault secrets...\n');

  // 1. Test Company 클라이언트 조회
  const { data: client, error: clientError } = await supabase
    .from('clients')
    .select('*')
    .eq('client_name', 'Test Company')
    .single();

  if (clientError) {
    console.error('❌ Client not found:', clientError.message);
    return;
  }

  console.log('📋 Client Info:');
  console.log(`  ID: ${client.id}`);
  console.log(`  Name: ${client.client_name}`);
  console.log(`  Meta Account: ${client.meta_ad_account_id}`);
  console.log(`  Token ID: ${client.meta_access_token_id}`);
  console.log(`  Auth Status: ${client.auth_status}`);

  // 2. Vault에서 토큰 조회 시도
  if (client.meta_access_token_id) {
    console.log('\n🔐 Checking Vault token...');
    const { data: token, error: tokenError } = await supabase.rpc('get_client_meta_token', {
      p_client_id: client.id
    });

    if (tokenError) {
      console.error('❌ Token read error:', tokenError);
    } else {
      console.log('✅ Token found in Vault:', token ? token.slice(0, 20) + '...' : 'null');
    }
  } else {
    console.log('\n⚠️ No token ID stored in client record');

    // 직접 Vault 저장 테스트
    console.log('\n🧪 Testing direct Vault storage...');
    const { data: storedId, error: storeError } = await supabase.rpc('store_client_meta_token', {
      p_client_id: client.id,
      p_access_token: 'TEST_TOKEN_MANUAL_' + Date.now()
    });

    if (storeError) {
      console.error('❌ Store error:', storeError);
    } else {
      console.log('✅ Token stored! Secret ID:', storedId);

      // 다시 클라이언트 조회
      const { data: updatedClient } = await supabase
        .from('clients')
        .select('meta_access_token_id, auth_status')
        .eq('id', client.id)
        .single();

      console.log('📋 Updated client:');
      console.log(`  Token ID: ${updatedClient?.meta_access_token_id}`);
      console.log(`  Auth Status: ${updatedClient?.auth_status}`);
    }
  }
}

checkVault().catch(console.error);
