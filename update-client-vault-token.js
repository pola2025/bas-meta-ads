require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function updateClientVaultToken() {
  const SECRET_ID = '8d930f47-392b-4f17-b88a-8ff532f162f0';
  const CLIENT_ID = 'client_001';

  console.log('💾 Updating client with Vault Secret ID...\n');

  try {
    // 60일 후 만료 (Long-lived Token)
    const expiresAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from('clients')
      .update({
        meta_access_token_id: SECRET_ID,
        token_expires_at: expiresAt,
        auth_status: 'active',
        updated_at: new Date().toISOString()
      })
      .eq('client_id', CLIENT_ID)
      .select();

    if (error) {
      console.error('❌ Update failed:', error);
      process.exit(1);
    }

    console.log('✅ Client 업데이트 완료!\n');

    // 결과 확인
    const { data: client, error: selectError } = await supabase
      .from('clients')
      .select('client_id, client_name, meta_access_token_id, token_expires_at, auth_status')
      .eq('client_id', CLIENT_ID)
      .single();

    if (selectError) {
      console.error('❌ Select failed:', selectError);
      process.exit(1);
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ 완료! Vault Secret ID가 clients 테이블에 연결되었습니다.');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log('📋 Client 정보:');
    console.table([{
      'Client ID': client.client_id,
      'Client Name': client.client_name,
      'Vault Token ID': client.meta_access_token_id,
      'Expires At': new Date(client.token_expires_at).toLocaleString('ko-KR'),
      'Auth Status': client.auth_status
    }]);

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🎉 설정 완료! 이제 데이터 수집 테스트가 가능합니다!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log('📝 다음 단계:');
    console.log('1. SQL Functions 생성 (vault_read_secret)');
    console.log('2. npm run worker (터미널 1)');
    console.log('3. npm run producer (터미널 2)');
    console.log('4. Worker 로그에서 데이터 수집 성공 확인\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

updateClientVaultToken();
