const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

(async () => {
  // 최근 1주일 데이터 확인
  const { data, error } = await supabase
    .from('weekly_summary')
    .select('week_start, week_end, total_leads, total_spend')
    .order('week_end', { ascending: false })
    .limit(5);

  if (error) {
    console.log('❌ Error:', error.message);
  } else if (!data || data.length === 0) {
    console.log('⚠️ No weekly_summary data found');
    console.log('📌 This means Meta API data collection has not run yet');
  } else {
    console.log('✅ Recent weekly data found:');
    data.forEach(d => {
      console.log(`  ${d.week_start} ~ ${d.week_end}: ${d.total_leads} leads, $${d.total_spend.toFixed(2)}`);
    });
  }
})();
