require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

(async () => {
  console.log('🔄 Regenerating weekly_summary for 2025-11-17 ~ 2025-11-23\n');

  // Get client ID
  const { data: clients, error: clientError } = await supabase
    .from('clients')
    .select('id, client_name')
    .limit(1);

  if (clientError) {
    console.error('❌ Error fetching clients:', clientError.message);
    return;
  }

  if (!clients || clients.length === 0) {
    console.error('❌ No clients found');
    return;
  }

  const client = clients[0];
  console.log(`📋 Client: ${client.client_name} (${client.id})`);

  // Call generate_weekly_summary RPC
  const { data, error } = await supabase.rpc('generate_weekly_summary', {
    p_client_id: client.id,
    p_week_start: '2025-11-17',
    p_week_end: '2025-11-23'
  });

  if (error) {
    console.error('❌ Error:', error.message);
    return;
  }

  console.log('✅ Weekly summary regenerated successfully');

  // Verify
  const { data: summary } = await supabase
    .from('weekly_summary')
    .select('*')
    .eq('client_id', client.id)
    .eq('week_start', '2025-11-17')
    .eq('week_end', '2025-11-23');

  if (summary && summary.length > 0) {
    console.log(`\n📊 Generated ${summary.length} ad summaries`);

    const totals = summary.reduce((acc, row) => ({
      impressions: acc.impressions + (row.total_impressions || 0),
      clicks: acc.clicks + (row.total_clicks || 0),
      spend: acc.spend + (row.total_spend || 0),
      leads: acc.leads + (row.total_leads || 0)
    }), { impressions: 0, clicks: 0, spend: 0, leads: 0 });

    console.log('\n📈 Totals:');
    console.log(`   Impressions: ${totals.impressions.toLocaleString()}`);
    console.log(`   Clicks: ${totals.clicks}`);
    console.log(`   Spend: $${totals.spend.toFixed(2)}`);
    console.log(`   Leads: ${totals.leads}`);

    if (totals.leads > 0) {
      console.log(`   CPL: $${(totals.spend / totals.leads).toFixed(2)}`);
    }
  } else {
    console.log('⚠️ Weekly summary not found after regeneration');
  }
})();
