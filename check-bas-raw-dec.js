#!/usr/bin/env node
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function check() {
  const { data, error } = await supabase
    .from('raw_data')
    .select('date, leads, spend')
    .eq('client_id', '79e35fc6-a817-4ccc-9d5d-9a93c1ad4515')
    .gte('date', '2025-12-01')
    .lte('date', '2025-12-07')
    .order('date');

  if (error) {
    console.error('Error:', error.message);
    return;
  }
  console.log('총 건수:', data?.length || 0);

  const byDate = {};
  (data || []).forEach(r => {
    if (!byDate[r.date]) byDate[r.date] = { count: 0, leads: 0, spend: 0 };
    byDate[r.date].count++;
    byDate[r.date].leads += r.leads || 0;
    byDate[r.date].spend += parseFloat(r.spend) || 0;
  });

  console.log('비즈액터스쿨 12/1~12/7 raw 데이터:');
  Object.entries(byDate).sort().forEach(([date, stat]) => {
    console.log(`${date}: ${stat.count}건, 리드 ${stat.leads}, $${stat.spend.toFixed(2)}`);
  });
}
check();
