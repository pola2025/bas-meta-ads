const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function createView() {
  const sql = `
CREATE OR REPLACE VIEW ads_insights_daily AS
SELECT
  date,
  platform,
  campaign_name,
  ad_name,
  SUM(impressions) as impressions,
  SUM(reach) as reach,
  SUM(clicks) as clicks,
  SUM(leads) as leads,
  SUM(spend) as spend,
  SUM(video_views) as video_views,
  AVG(avg_watch_time) as avg_watch_time,
  CASE
    WHEN SUM(impressions) > 0 THEN ROUND((SUM(clicks)::DECIMAL / SUM(impressions) * 100), 2)
    ELSE 0
  END as ctr,
  CASE
    WHEN SUM(clicks) > 0 THEN ROUND((SUM(leads)::DECIMAL / SUM(clicks) * 100), 2)
    ELSE 0
  END as cvr,
  CASE
    WHEN SUM(leads) > 0 THEN ROUND((SUM(spend) / SUM(leads)), 2)
    ELSE 0
  END as cpl,
  CASE
    WHEN SUM(clicks) > 0 THEN ROUND((SUM(spend) / SUM(clicks)), 2)
    ELSE 0
  END as cpc,
  CASE
    WHEN SUM(impressions) > 0 THEN ROUND((SUM(spend) / SUM(impressions) * 1000), 2)
    ELSE 0
  END as cpm
FROM raw_data
GROUP BY date, platform, campaign_name, ad_name
ORDER BY date DESC, spend DESC;
  `;

  console.log('Creating ads_insights_daily view...');
  const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });

  if (error) {
    console.error('❌ Error:', error);

    // Try direct query
    console.log('\nTrying direct query...');
    const { error: directError } = await supabase
      .from('raw_data')
      .select('*')
      .limit(1);

    if (directError) {
      console.error('❌ Direct query error:', directError);
    } else {
      console.log('✅ Direct query works, but RPC exec_sql not available');
      console.log('\n⚠️  Please run this SQL manually in Supabase SQL Editor:');
      console.log('\nhttps://supabase.com/dashboard/project/mpljqcuqrrfwzamfyxnz/sql/new\n');
      console.log(sql);
    }
  } else {
    console.log('✅ View created successfully:', data);
  }

  // Test the view
  console.log('\nTesting ads_insights_daily view...');
  const { data: viewData, error: viewError } = await supabase
    .from('ads_insights_daily')
    .select('*')
    .limit(3);

  if (viewError) {
    console.error('❌ View test error:', viewError);
  } else {
    console.log('✅ View works! Sample data:');
    console.log(JSON.stringify(viewData, null, 2));
  }
}

createView();
