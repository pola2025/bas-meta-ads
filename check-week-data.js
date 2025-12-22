#!/usr/bin/env node
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function main() {
  const { data, error } = await supabase
    .from('ads_insights_daily')
    .select('client_id, date, leads, spend')
    .gte('date', '2025-12-15')
    .lte('date', '2025-12-21')
    .order('date');

  if (error) {
    console.log('Error:', error.message);
    return;
  }

  // 클라이언트별 집계
  const stats = {};
  data.forEach(row => {
    if (!stats[row.client_id]) stats[row.client_id] = { leads: 0, spend: 0, dates: new Set() };
    stats[row.client_id].leads += row.leads || 0;
    stats[row.client_id].spend += parseFloat(row.spend) || 0;
    stats[row.client_id].dates.add(row.date);
  });

  // 클라이언트 이름 조회
  const { data: clients } = await supabase.from('clients').select('id, client_name');
  const clientMap = {};
  clients.forEach(c => clientMap[c.id] = c.client_name);

  console.log('=== 12/15~12/21 데이터 현황 ===');
  Object.keys(stats).forEach(cid => {
    const s = stats[cid];
    const name = clientMap[cid] || cid;
    console.log(`${name}: ${s.leads} leads, $${s.spend.toFixed(2)}, ${s.dates.size} days`);
  });

  console.log('\nTotal records:', data.length);
}

main().catch(console.error);
