require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function checkVaultToken() {
  // 1. DB에서 클라이언트 정보 조회
  const { data: client, error } = await supabase
    .from('clients')
    .select('id, client_name, meta_access_token_id')
    .eq('client_name', '비즈액터스쿨')
    .single();

  if (error) {
    console.error('❌ Failed to fetch client:', error);
    process.exit(1);
  }

  console.log('📋 Client Info:');
  console.log(`   ID: ${client.id}`);
  console.log(`   Name: ${client.client_name}`);
  console.log(`   Token ID: ${client.meta_access_token_id}\n`);

  // 2. Vault에서 토큰 가져오기
  const { data: vaultData, error: vaultError } = await supabase.rpc('vault_read_secret', {
    secret_id: client.meta_access_token_id
  });

  if (vaultError) {
    console.error('❌ Failed to read from Vault:', vaultError);
    process.exit(1);
  }

  const vaultToken = vaultData.secret;
  const envToken = process.env.META_ACCESS_TOKEN;

  console.log('🔍 Token Comparison:\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Vault Token:');
  console.log(vaultToken);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('.env Token:');
  console.log(envToken);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log('📊 Analysis:');
  console.log(`   Vault Token Length: ${vaultToken.length}`);
  console.log(`   .env Token Length: ${envToken.length}`);
  console.log(`   Tokens Match: ${vaultToken === envToken ? '✅' : '❌'}`);
  console.log(`   Vault has whitespace: ${/\s/.test(vaultToken) ? '⚠️ YES' : '✅ NO'}`);
  console.log(`   .env has whitespace: ${/\s/.test(envToken) ? '⚠️ YES' : '✅ NO'}`);

  if (vaultToken !== envToken) {
    console.log('\n🔧 Difference detected!');
    console.log('   First 50 chars comparison:');
    console.log(`   Vault: ${vaultToken.substring(0, 50)}`);
    console.log(`   .env:  ${envToken.substring(0, 50)}`);
  }
}

checkVaultToken();
