#!/usr/bin/env node
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function check() {
  const { data: clients } = await supabase
    .from('clients')
    .select('id, client_name')
    .eq('is_active', true)
    .order('client_name');

  console.log('=== 전체 클라이언트 12/1~12/6 데이터 현황 ===\n');

  const summary = [];

  for (const client of clients) {
    const { data } = await supabase
      .from('ads_insights_daily')
      .select('date, leads, spend, impressions, clicks')
      .eq('client_id', client.id)
      .gte('date', '2025-12-01')
      .lte('date', '2025-12-06')
      .order('date');

    if (!data || data.length === 0) {
      console.log(client.client_name + ': 데이터 없음\n');
      summary.push({ name: client.client_name, leads: 0, spend: 0, cpl: '-', dates: 0 });
      continue;
    }

    const byDate = {};
    let totalLeads = 0, totalSpend = 0;

    data.forEach(row => {
      if (!byDate[row.date]) byDate[row.date] = { leads: 0, spend: 0 };
      byDate[row.date].leads += row.leads || 0;
      byDate[row.date].spend += parseFloat(row.spend) || 0;
      totalLeads += row.leads || 0;
      totalSpend += parseFloat(row.spend) || 0;
    });

    const dates = Object.keys(byDate).sort();
    const cpl = totalLeads > 0 ? (totalSpend / totalLeads).toFixed(2) : '-';

    summary.push({ name: client.client_name, leads: totalLeads, spend: totalSpend, cpl, dates: dates.length });

    console.log(client.client_name + ':');
    console.log('  총계: 리드 ' + totalLeads + '건, 지출 $' + totalSpend.toFixed(2) + ', CPL $' + cpl);
    console.log('  날짜: ' + dates.join(', '));

    dates.forEach(d => {
      const s = byDate[d];
      const dayCpl = s.leads > 0 ? (s.spend / s.leads).toFixed(2) : '-';
      console.log('    ' + d + ': ' + s.leads + '건, $' + s.spend.toFixed(2) + ' (CPL $' + dayCpl + ')');
    });
    console.log();
  }

  // 요약 테이블
  console.log('=== 요약 ===\n');
  console.log('클라이언트            | 리드 | 지출      | CPL    | 날짜수');
  console.log('---------------------|------|-----------|--------|-------');
  summary.forEach(s => {
    const name = (s.name + '                    ').substring(0, 20);
    const leads = (s.leads + '    ').substring(0, 4);
    const spend = ('$' + s.spend.toFixed(2) + '         ').substring(0, 9);
    const cpl = ('$' + s.cpl + '      ').substring(0, 6);
    console.log(name + ' | ' + leads + ' | ' + spend + ' | ' + cpl + ' | ' + s.dates + '/6');
  });
}

check().catch(console.error);
