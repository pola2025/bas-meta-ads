require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function insertTestClient() {
  try {
    console.log('📝 Inserting test client data...');

    const { data, error } = await supabase
      .from('clients')
      .insert([
        {
          client_id: 'client_001',
          client_name: '비즈액터스쿨',
          email: 'mkt@polarad.co.kr',
          password_hash: '$2a$10$dummyhash',
          meta_ad_account_id: 'act_705731635104506',
          token_expires_at: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(), // 60일 후
          auth_status: 'active',
          plan_type: 'pro',
          is_active: true
        }
      ])
      .select();

    if (error) {
      if (error.code === '23505') {
        console.log('⚠️  Client already exists, fetching existing data...');

        // 기존 데이터 조회
        const { data: existingData, error: selectError } = await supabase
          .from('clients')
          .select('*')
          .eq('client_id', 'client_001')
          .single();

        if (selectError) throw selectError;

        console.log('✅ Existing client data:');
        console.log(JSON.stringify(existingData, null, 2));
      } else {
        throw error;
      }
    } else {
      console.log('✅ Test client inserted successfully:');
      console.log(JSON.stringify(data, null, 2));
    }

    // 모든 클라이언트 조회
    console.log('\n📋 All clients:');
    const { data: allClients, error: listError } = await supabase
      .from('clients')
      .select('client_id, client_name, email, meta_ad_account_id, plan_type, auth_status, is_active, token_expires_at, created_at');

    if (listError) throw listError;

    console.table(allClients);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

insertTestClient();
