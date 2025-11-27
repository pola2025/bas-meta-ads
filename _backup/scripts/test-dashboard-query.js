require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function testDashboardQuery() {
  console.log('🔍 Testing dashboard queries...\n');

  // 1. Get clients
  console.log('1️⃣ Fetching clients...');
  const { data: clients, error: clientsError } = await supabase
    .from('clients')
    .select('*');

  if (clientsError) {
    console.error('❌ Error fetching clients:', clientsError);
  } else {
    console.log(`✅ Found ${clients.length} clients:`);
    clients.forEach(c => {
      console.log(`   - ${c.client_name} (ID: ${c.id})`);
    });
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // 2. Get weekly_summary (no filter)
  console.log('2️⃣ Fetching all weekly_summary...');
  const { data: allWeekly, error: allWeeklyError } = await supabase
    .from('weekly_summary')
    .select('*')
    .order('week_start', { ascending: false })
    .limit(5);

  if (allWeeklyError) {
    console.error('❌ Error fetching weekly_summary:', allWeeklyError);
  } else {
    console.log(`✅ Found ${allWeekly.length} weekly records (no filter):`);
    if (allWeekly.length > 0) {
      console.log('   First record:');
      console.log(`   - Week: ${allWeekly[0].week_start} ~ ${allWeekly[0].week_end}`);
      console.log(`   - Ad: ${allWeekly[0].ad_name}`);
      console.log(`   - Client ID: ${allWeekly[0].client_id}`);
    }
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // 3. Get weekly_summary with client_id filter
  if (clients && clients.length > 0) {
    const clientId = clients[0].id;
    console.log(`3️⃣ Fetching weekly_summary for client_id: ${clientId}...`);

    const { data: filteredWeekly, error: filteredError } = await supabase
      .from('weekly_summary')
      .select('*')
      .eq('client_id', clientId)
      .order('week_start', { ascending: false });

    if (filteredError) {
      console.error('❌ Error fetching filtered weekly_summary:', filteredError);
    } else {
      console.log(`✅ Found ${filteredWeekly.length} weekly records for this client`);
      if (filteredWeekly.length > 0) {
        console.log('   Sample records:');
        filteredWeekly.slice(0, 3).forEach(r => {
          console.log(`   - ${r.week_start}: ${r.ad_name}, Spend: $${r.total_spend}, Leads: ${r.total_leads}`);
        });
      }
    }
  }

  console.log('\n🎉 Dashboard query test complete!');
}

testDashboardQuery();
