require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

(async () => {
  console.log('🔍 Checking raw_data for 2025-11-17 ~ 2025-11-23\n');

  // Check data
  const { data, error } = await supabase
    .from('raw_data')
    .select('client_id, date, ad_name')
    .gte('date', '2025-11-17')
    .lte('date', '2025-11-23')
    .order('date');

  if (error) {
    console.error('❌ Error:', error.message);
    return;
  }

  if (!data || data.length === 0) {
    console.log('❌ No data found in raw_data table for this period');

    // Check what dates we have
    const { data: allDates } = await supabase
      .from('raw_data')
      .select('date')
      .order('date', { ascending: false })
      .limit(10);

    if (allDates && allDates.length > 0) {
      console.log('\n📅 Recent dates in database:');
      const uniqueDates = [...new Set(allDates.map(r => r.date))];
      uniqueDates.forEach(date => console.log(`   - ${date}`));
    } else {
      console.log('\n❌ raw_data table is empty!');
    }
    return;
  }

  // Group by date
  const dateCount = {};
  data.forEach(row => {
    dateCount[row.date] = (dateCount[row.date] || 0) + 1;
  });

  // Show client_id
  const uniqueClientIds = [...new Set(data.map(r => r.client_id))];
  console.log('👤 Client IDs in raw_data:');
  uniqueClientIds.forEach(id => console.log(`   - ${id}`));

  console.log('\n📊 Data by date:');
  Object.entries(dateCount).sort().forEach(([date, count]) => {
    console.log(`   ${date}: ${count} records`);
  });

  console.log(`\n✅ Total records: ${data.length}`);

  // Show sample ads
  const uniqueAds = [...new Set(data.map(r => r.ad_name))].slice(0, 5);
  console.log('\n📝 Sample ads:');
  uniqueAds.forEach((ad, i) => console.log(`   ${i+1}. ${ad}`));
})();
