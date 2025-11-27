require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function updateClientEmail() {
  try {
    console.log('📝 Updating client email to mkt@polarad.co.kr...');

    const { data, error } = await supabase
      .from('clients')
      .update({ email: 'mkt@polarad.co.kr' })
      .eq('client_id', 'client_001')
      .select();

    if (error) throw error;

    console.log('✅ Client email updated successfully:');
    console.log(JSON.stringify(data, null, 2));

    // 업데이트 확인
    console.log('\n📋 Updated client data:');
    const { data: updatedClient, error: selectError } = await supabase
      .from('clients')
      .select('client_id, client_name, email, meta_ad_account_id, plan_type, auth_status, is_active')
      .eq('client_id', 'client_001')
      .single();

    if (selectError) throw selectError;

    console.table([updatedClient]);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

updateClientEmail();
