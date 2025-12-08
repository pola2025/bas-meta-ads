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
    .select('id, client_name, telegram_chat_id, telegram_enabled')
    .eq('is_active', true)
    .order('client_name');

  console.log('=== 활성 클라이언트 ===');
  clients.forEach(c => {
    const chatStatus = c.telegram_chat_id ? 'O' : 'X';
    const enabled = c.telegram_enabled !== false ? 'ON' : 'OFF';
    console.log('  ' + chatStatus + ' ' + enabled + ' ' + c.client_name);
  });
  console.log();

  const { data, error } = await supabase
    .from('ads_insights_daily')
    .select('client_id, date, leads, spend, impressions, clicks')
    .gte('date', '2025-12-01')
    .lte('date', '2025-12-07')
    .order('date', { ascending: true });

  if (error) {
    console.error('Error:', error.message);
    return;
  }

  console.log('=== 12/1~12/7 데이터 현황 ===');
  console.log('총 레코드: ' + (data ? data.length : 0));

  const clientStats = {};
  if (data) {
    data.forEach(row => {
      if (!clientStats[row.client_id]) {
        clientStats[row.client_id] = { dates: new Set(), leads: 0, spend: 0 };
      }
      clientStats[row.client_id].dates.add(row.date);
      clientStats[row.client_id].leads += row.leads || 0;
      clientStats[row.client_id].spend += parseFloat(row.spend) || 0;
    });
  }

  console.log();
  console.log('=== 클라이언트별 데이터 ===');

  for (const client of clients) {
    const stats = clientStats[client.id];
    if (stats) {
      const dates = Array.from(stats.dates).sort();
      console.log(client.client_name + ':');
      console.log('  날짜: ' + dates.join(', '));
      console.log('  리드: ' + stats.leads + '건, 지출: $' + stats.spend.toFixed(2));
    } else {
      console.log(client.client_name + ': 데이터 없음');
    }
  }

  // 11/24~11/30 (지난 주) 데이터도 확인
  console.log();
  console.log('=== 11/24~11/30 (지난 주) 데이터 ===');

  const { data: lastWeekData } = await supabase
    .from('ads_insights_daily')
    .select('client_id, date, leads, spend')
    .gte('date', '2025-11-24')
    .lte('date', '2025-11-30')
    .order('date', { ascending: true });

  const lastWeekStats = {};
  if (lastWeekData) {
    lastWeekData.forEach(row => {
      if (!lastWeekStats[row.client_id]) {
        lastWeekStats[row.client_id] = { dates: new Set(), leads: 0, spend: 0 };
      }
      lastWeekStats[row.client_id].dates.add(row.date);
      lastWeekStats[row.client_id].leads += row.leads || 0;
      lastWeekStats[row.client_id].spend += parseFloat(row.spend) || 0;
    });
  }

  for (const client of clients) {
    const stats = lastWeekStats[client.id];
    if (stats) {
      const dates = Array.from(stats.dates).sort();
      console.log(client.client_name + ':');
      console.log('  날짜: ' + dates.join(', '));
      console.log('  리드: ' + stats.leads + '건, 지출: $' + stats.spend.toFixed(2));
    } else {
      console.log(client.client_name + ': 데이터 없음');
    }
  }
}

check().catch(console.error);
