const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

(async () => {
  // 모든 클라이언트 12월 데이터 확인
  const { data: clients } = await supabase
    .from('clients')
    .select('id, client_name')
    .eq('is_active', true);

  console.log('=== 모든 클라이언트 12월 1-7일 데이터 ===\n');

  for (const client of clients) {
    const { data: daily, count } = await supabase
      .from('ads_insights_daily')
      .select('date_start, leads, spend', { count: 'exact' })
      .eq('client_id', client.id)
      .gte('date_start', '2025-12-01')
      .lte('date_start', '2025-12-07');

    const totalLeads = daily?.reduce((sum, d) => sum + (d.leads || 0), 0) || 0;
    const dates = daily?.map(d => d.date_start).sort() || [];

    console.log(`${client.client_name}: ${count || 0}건, leads=${totalLeads}`);
    if (dates.length > 0) {
      console.log(`  날짜: ${dates.join(', ')}`);
    }
  }
})();
