#!/usr/bin/env node

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function checkDataDates() {
  const { data, error } = await supabase
    .from('daily_aggregates')
    .select('date, leads, spend')
    .order('date', { ascending: false })
    .limit(50);

  if (error) {
    console.error('Error:', error.message);
    return;
  }

  console.log('최근 데이터 (최대 50건):\n');
  console.log('날짜        리드  지출');
  console.log('─'.repeat(35));

  const grouped = {};
  data.forEach(row => {
    if (!grouped[row.date]) grouped[row.date] = { leads: 0, spend: 0 };
    grouped[row.date].leads += row.leads || 0;
    grouped[row.date].spend += parseFloat(row.spend) || 0;
  });

  Object.keys(grouped).sort().reverse().forEach(date => {
    const stats = grouped[date];
    console.log(`${date}  ${stats.leads}건  $${stats.spend.toFixed(2)}`);
  });

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('정상 분석 기간 (오늘 기준):');
  console.log('지난주: 2025-11-10 ~ 2025-11-16');
  console.log('이번주: 2025-11-17 ~ 2025-11-23');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

checkDataDates();
