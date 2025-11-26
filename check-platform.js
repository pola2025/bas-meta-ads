require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function check() {
  const { data, error } = await supabase
    .from('raw_data')
    .select('platform, impressions, clicks, leads, spend')
    .gte('date', '2025-11-18')
    .lte('date', '2025-11-24');

  if (error) {
    console.log('Error:', error.message);
    return;
  }

  const platforms = {};
  (data || []).forEach(function(d) {
    if (!platforms[d.platform]) {
      platforms[d.platform] = { leads: 0, spend: 0, impressions: 0, clicks: 0 };
    }
    platforms[d.platform].leads += d.leads || 0;
    platforms[d.platform].spend += d.spend || 0;
    platforms[d.platform].impressions += d.impressions || 0;
    platforms[d.platform].clicks += d.clicks || 0;
  });

  console.log('raw_data 플랫폼별 집계 (11/18~11/24):');
  console.log(JSON.stringify(platforms, null, 2));
  console.log('\n총 레코드:', data.length);
}

check();
