require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function verifyPartitions() {
  console.log('📊 Verifying partition setup...\n');

  // Try to query recent data from November (current month)
  console.log('1️⃣ Checking November 2025 partition (raw_data_2025_11)...');

  const { data: novData, error: novError } = await supabase
    .from('raw_data')
    .select('*')
    .gte('date', '2025-11-01')
    .lt('date', '2025-12-01')
    .limit(5);

  if (novError) {
    console.log('❌ Error querying November data:', novError.message);
  } else {
    console.log(`✅ November partition OK - ${novData.length} sample rows found\n`);
  }

  // Get first client ID
  const { data: clients, error: clientError } = await supabase
    .from('clients')
    .select('id')
    .limit(1);

  if (clientError || !clients || clients.length === 0) {
    console.log('⚠️  No clients found. Skipping partition test.\n');
  } else {
    const testClientId = clients[0].id;

    // Try to insert test data for January
    console.log('2️⃣ Testing January 2025 partition (raw_data_2025_01)...');

    const testData = {
      date: '2025-01-15',
      client_id: testClientId,
      ad_id: 'test-ad-partition-999',
      ad_name: 'Test Ad',
      campaign_id: 'test-campaign',
      campaign_name: 'Test Campaign',
      platform: 'facebook',
      device: 'mobile',
      impressions: 100,
      clicks: 10,
      spend: 1000,
      currency: 'KRW'
    };

    const { data: insertData, error: insertError } = await supabase
      .from('raw_data')
      .insert([testData])
      .select();

    if (insertError) {
      console.log('❌ Error inserting to January partition:', insertError.message);

      if (insertError.message.includes('partition') || insertError.message.includes('no partition')) {
        console.log('⚠️  파티션이 생성되지 않았습니다!\n');
      } else {
        console.log('⚠️  알 수 없는 에러 - 파티션 상태 불명\n');
      }
    } else {
      console.log('✅ January partition exists and accepts data\n');

      // Clean up test data
      await supabase
        .from('raw_data')
        .delete()
        .eq('ad_id', 'test-ad-partition-999');

      console.log('🧹 Test data cleaned up\n');
    }
  }

  // Query to check partition list (this will use the default partition if available)
  console.log('3️⃣ Checking existing data distribution...');

  const { data: countData, error: countError } = await supabase
    .from('raw_data')
    .select('date', { count: 'exact', head: true })
    .gte('date', '2025-01-01')
    .lt('date', '2025-12-01');

  if (!countError) {
    console.log(`✅ Total rows in 2025: ${countData || 0} rows\n`);
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('\n💡 Next steps:');
  console.log('   If January partition test FAILED, you need to create partitions in Supabase SQL Editor');
  console.log('   See: PARTITION_SETUP_GUIDE.md\n');
}

verifyPartitions().catch(console.error);
