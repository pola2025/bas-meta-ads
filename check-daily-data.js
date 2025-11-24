require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

(async () => {
  console.log('🔍 Checking daily_insights data for 2025-11-17 ~ 2025-11-23\n');

  // Check by date
  const { data: byDate, error: dateError } = await supabase
    .from('daily_insights')
    .select('date')
    .gte('date', '2025-11-17')
    .lte('date', '2025-11-23')
    .order('date');

  if (dateError) {
    console.error('❌ Error:', dateError.message);
    return;
  }

  if (!byDate || byDate.length === 0) {
    console.log('❌ No data found in daily_insights table for this period');

    // Check what dates we have
    const { data: allDates } = await supabase
      .from('daily_insights')
      .select('date')
      .order('date', { ascending: false })
      .limit(10);

    if (allDates && allDates.length > 0) {
      console.log('\n📅 Recent dates in database:');
      allDates.forEach(row => console.log(`   - ${row.date}`));
    } else {
      console.log('\n❌ daily_insights table is empty!');
    }
    return;
  }

  // Group by date
  const dateCount = {};
  byDate.forEach(row => {
    dateCount[row.date] = (dateCount[row.date] || 0) + 1;
  });

  console.log('📊 Data by date:');
  Object.entries(dateCount).sort().forEach(([date, count]) => {
    console.log(`   ${date}: ${count} records`);
  });

  console.log(`\n✅ Total records: ${byDate.length}`);
})();
