#!/usr/bin/env node
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function check() {
  // 활성 클라이언트 조회 (JY 제외)
  const { data: clients } = await supabase
    .from('clients')
    .select('id, client_name')
    .eq('is_active', true)
    .neq('client_name', 'JY경영지원센터');

  console.log('12/1~12/7 클라이언트별 일별 데이터 현황');
  console.log('='.repeat(80));

  for (const client of clients) {
    const { data } = await supabase
      .from('ads_insights_daily')
      .select('date, leads, spend')
      .eq('client_id', client.id)
      .gte('date', '2025-12-01')
      .lte('date', '2025-12-07')
      .order('date');

    // 날짜별 집계
    const byDate = {};
    (data || []).forEach(r => {
      if (!byDate[r.date]) byDate[r.date] = { leads: 0, spend: 0 };
      byDate[r.date].leads += r.leads || 0;
      byDate[r.date].spend += parseFloat(r.spend) || 0;
    });

    const dates = ['2025-12-01','2025-12-02','2025-12-03','2025-12-04','2025-12-05','2025-12-06','2025-12-07'];
    const missing = dates.filter(d => !byDate[d] || (byDate[d].leads === 0 && byDate[d].spend === 0));

    console.log('\n' + client.client_name);
    console.log('-'.repeat(40));

    dates.forEach(d => {
      const day = new Date(d).toLocaleDateString('ko-KR', {weekday: 'short'});
      const stat = byDate[d];
      if (stat && (stat.leads > 0 || stat.spend > 0)) {
        console.log(`  ${d} (${day}): 리드 ${stat.leads}, $${stat.spend.toFixed(2)}`);
      } else {
        console.log(`  ${d} (${day}): [X] 데이터 없음`);
      }
    });

    if (missing.length > 0) {
      console.log(`  >> 누락: ${missing.length}일`);
    } else {
      console.log(`  >> 7일 완전`);
    }
  }
}
check();
