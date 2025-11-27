require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function check() {
  const { data: clients } = await supabase
    .from('clients')
    .select('id, client_name, auth_status')
    .eq('is_active', true);

  console.log('=== 클라이언트별 데이터 현황 ===\n');

  for (const c of clients) {
    const { count: rawCount } = await supabase
      .from('raw_data')
      .select('*', { count: 'exact', head: true })
      .eq('client_id', c.id);

    const { count: dailyCount } = await supabase
      .from('daily_aggregates')
      .select('*', { count: 'exact', head: true })
      .eq('client_id', c.id);

    const { count: adsCount } = await supabase
      .from('ads_insights_daily')
      .select('*', { count: 'exact', head: true })
      .eq('client_id', c.id);

    const { data: dateRange } = await supabase
      .from('raw_data')
      .select('date')
      .eq('client_id', c.id)
      .order('date', { ascending: true })
      .limit(1);

    const { data: dateRangeEnd } = await supabase
      .from('raw_data')
      .select('date')
      .eq('client_id', c.id)
      .order('date', { ascending: false })
      .limit(1);

    const firstDate = dateRange && dateRange[0] ? dateRange[0].date : 'N/A';
    const lastDate = dateRangeEnd && dateRangeEnd[0] ? dateRangeEnd[0].date : 'N/A';

    console.log(c.client_name + ' (' + c.auth_status + '):');
    console.log('  raw_data: ' + (rawCount || 0) + '건');
    console.log('  daily_aggregates: ' + (dailyCount || 0) + '건');
    console.log('  ads_insights_daily: ' + (adsCount || 0) + '건');
    console.log('  날짜 범위: ' + firstDate + ' ~ ' + lastDate);
    console.log('');
  }
}

check().catch(console.error);
