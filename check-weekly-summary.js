require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

(async () => {
  console.log('🔍 Checking weekly_summary for 2025-11-17 ~ 2025-11-23\n');

  // Check weekly_summary
  const { data, error } = await supabase
    .from('weekly_summary')
    .select('*')
    .eq('week_start', '2025-11-17')
    .eq('week_end', '2025-11-23')
    .order('ad_name');

  if (error) {
    console.error('❌ Error:', error.message);
    return;
  }

  if (!data || data.length === 0) {
    console.log('❌ No weekly_summary found');

    // Check all weekly_summary data
    const { data: allSummary } = await supabase
      .from('weekly_summary')
      .select('week_start, week_end')
      .order('week_start', { ascending: false })
      .limit(5);

    if (allSummary && allSummary.length > 0) {
      console.log('\n📅 Recent weekly summaries:');
      allSummary.forEach(row => {
        console.log(`   - ${row.week_start} ~ ${row.week_end}`);
      });
    } else {
      console.log('\n❌ weekly_summary table is empty!');
    }
    return;
  }

  console.log(`✅ Found ${data.length} ads in weekly_summary\n`);

  // Show totals
  const totals = data.reduce((acc, row) => ({
    impressions: acc.impressions + (row.total_impressions || 0),
    clicks: acc.clicks + (row.total_clicks || 0),
    spend: acc.spend + (row.total_spend || 0),
    leads: acc.leads + (row.total_leads || 0),
    video_views: acc.video_views + (row.total_video_views || 0)
  }), { impressions: 0, clicks: 0, spend: 0, leads: 0, video_views: 0 });

  console.log('📊 Weekly Totals:');
  console.log(`   Impressions: ${totals.impressions.toLocaleString()}`);
  console.log(`   Clicks: ${totals.clicks}`);
  console.log(`   Spend: $${totals.spend.toFixed(2)}`);
  console.log(`   Leads: ${totals.leads}`);
  console.log(`   Video Views: ${totals.video_views}`);

  if (totals.leads > 0) {
    console.log(`   CPL: $${(totals.spend / totals.leads).toFixed(2)}`);
  }
  if (totals.impressions > 0) {
    console.log(`   CTR: ${(totals.clicks / totals.impressions * 100).toFixed(2)}%`);
  }

  console.log('\n📝 Ads:');
  data.forEach((row, i) => {
    console.log(`   ${i+1}. ${row.ad_name} (Leads: ${row.total_leads})`);
  });
})();
