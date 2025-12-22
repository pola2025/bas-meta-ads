#!/usr/bin/env node
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function main() {
  const clients = (await supabase.from('clients').select('id, client_name').eq('is_active', true).order('client_name')).data;

  console.log('📊 12/8~12/14 클라이언트별 데이터 현황');
  console.log('='.repeat(70));

  const allDates = ['2025-12-08', '2025-12-09', '2025-12-10', '2025-12-11', '2025-12-12', '2025-12-13', '2025-12-14'];
  console.log('클라이언트'.padEnd(20), '08 09 10 11 12 13 14', '리드', '지출');
  console.log('-'.repeat(70));

  for (const c of clients) {
    const { data } = await supabase
      .from('ads_insights_daily')
      .select('date, leads, spend')
      .eq('client_id', c.id)
      .gte('date', '2025-12-08')
      .lte('date', '2025-12-14')
      .order('date');

    const days = {};
    (data || []).forEach(r => {
      if (!days[r.date]) days[r.date] = { leads: 0, spend: 0 };
      days[r.date].leads += r.leads || 0;
      days[r.date].spend += parseFloat(r.spend) || 0;
    });

    const status = allDates.map(d => days[d] ? (days[d].leads > 0 ? '✅' : '⚪') : '❌').join(' ');
    const totalLeads = Object.values(days).reduce((s, d) => s + d.leads, 0);
    const totalSpend = Object.values(days).reduce((s, d) => s + d.spend, 0);

    console.log(c.client_name.padEnd(20), status, totalLeads.toString().padStart(3), '$' + totalSpend.toFixed(0));
  }

  console.log('-'.repeat(70));
  console.log('✅=리드있음  ⚪=데이터있음(리드0)  ❌=데이터없음');
}

main();
