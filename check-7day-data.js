require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

(async () => {
  const { data } = await supabase
    .from('weekly_summary')
    .select('week_start, week_end, ad_name')
    .eq('week_start', '2025-11-17')
    .eq('week_end', '2025-11-23');

  const start = new Date('2025-11-17');
  const end = new Date('2025-11-23');
  const days = Math.ceil((end - start) / (1000*60*60*24)) + 1;

  console.log('📊 2025-11-17 ~ 2025-11-23 데이터:');
  console.log(`   기간: ${days}일`);
  console.log(`   광고 수: ${data?.length || 0}개`);

  if (data && data.length > 0) {
    console.log('\n광고 목록:');
    data.forEach((row, i) => {
      console.log(`  ${i+1}. ${row.ad_name}`);
    });
    console.log('\n✅ 7일 데이터 완전함!');
  } else {
    console.log('\n❌ 데이터 없음');
  }
})();
