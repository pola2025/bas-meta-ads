require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function saveTokenToVault() {
  const accessToken = process.env.META_ACCESS_TOKEN;
  const clientId = 'client_001';

  if (!accessToken) {
    console.error('❌ META_ACCESS_TOKEN이 .env 파일에 없습니다!');
    process.exit(1);
  }

  console.log('💾 Saving Access Token to Supabase Vault...\n');

  try {
    // 1. Vault에 Access Token 저장
    console.log('1️⃣ Creating secret in Vault...');
    const { data: secretData, error: secretError } = await supabase.rpc('vault_create_secret', {
      secret: accessToken,
      name: `meta_access_token_비즈액터스쿨_${Date.now()}`
    });

    if (secretError) {
      console.error('❌ Failed to save to Vault:', secretError);
      process.exit(1);
    }

    const tokenId = secretData.id;
    console.log(`✅ Token saved to Vault: ${tokenId}\n`);

    // 2. clients 테이블에 token_id 업데이트
    console.log('2️⃣ Updating clients table...');

    // 60일 후 만료 (Long-lived Token)
    const expiresAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString();

    const { data: clientData, error: updateError } = await supabase
      .from('clients')
      .update({
        meta_access_token_id: tokenId,
        token_expires_at: expiresAt,
        auth_status: 'active',
        updated_at: new Date().toISOString()
      })
      .eq('client_id', clientId)
      .select();

    if (updateError) {
      console.error('❌ Failed to update clients table:', updateError);
      process.exit(1);
    }

    console.log('✅ clients 테이블 업데이트 완료\n');

    // 3. 결과 확인
    const { data: client, error: selectError } = await supabase
      .from('clients')
      .select('client_id, client_name, meta_access_token_id, token_expires_at, auth_status')
      .eq('client_id', clientId)
      .single();

    if (selectError) {
      console.error('❌ Failed to fetch client:', selectError);
      process.exit(1);
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ 완료! Token이 Supabase Vault에 저장되었습니다.');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log('📋 Client 정보:');
    console.table([{
      'Client ID': client.client_id,
      'Client Name': client.client_name,
      'Token ID': client.meta_access_token_id,
      'Expires At': new Date(client.token_expires_at).toLocaleString('ko-KR'),
      'Auth Status': client.auth_status
    }]);

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🎉 이제 데이터 수집을 테스트할 수 있습니다!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log('📝 다음 단계:');
    console.log('1. npm run worker (터미널 1)');
    console.log('2. npm run producer (터미널 2)');
    console.log('3. Worker 로그에서 데이터 수집 성공 확인\n');

  } catch (error) {
    console.error('❌ 에러 발생:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

saveTokenToVault();
