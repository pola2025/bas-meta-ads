#!/usr/bin/env node
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function check() {
  // 1. raw_data 11/10~16 확인
  console.log('=== raw_data 테이블 (11/10~11/16) ===');
  const { data: raw, error: rawErr } = await supabase
    .from('raw_data')
    .select('date, ad_name, leads, spend')
    .gte('date', '2025-11-10')
    .lte('date', '2025-11-16')
    .order('date');

  if (rawErr) {
    console.error('Error:', rawErr.message);
  } else if (raw && raw.length > 0) {
    console.log('총 ' + raw.length + '개 레코드');
    let totalLeads = 0;
    let totalSpend = 0;
    raw.forEach(r => {
      totalLeads += r.leads || 0;
      totalSpend += parseFloat(r.spend) || 0;
      console.log(`${r.date} | ${(r.ad_name || '').substring(0,35)} | 리드:${r.leads} | 지출:$${r.spend}`);
    });
    console.log(`\n합계: 리드 ${totalLeads}건, 지출 $${totalSpend.toFixed(2)}`);
  } else {
    console.log('데이터 없음');
  }

  // 2. 11월 전체 raw_data 날짜별 요약
  console.log('\n=== 11월 raw_data 날짜별 요약 ===');
  const { data: novData } = await supabase
    .from('raw_data')
    .select('date, leads, spend')
    .gte('date', '2025-11-01')
    .order('date');

  if (novData && novData.length > 0) {
    const byDate = {};
    novData.forEach(r => {
      if (!byDate[r.date]) byDate[r.date] = { leads: 0, spend: 0 };
      byDate[r.date].leads += r.leads || 0;
      byDate[r.date].spend += parseFloat(r.spend) || 0;
    });
    Object.keys(byDate).sort().forEach(d => {
      console.log(`${d} | 리드: ${byDate[d].leads} | 지출: $${byDate[d].spend.toFixed(2)}`);
    });
  } else {
    console.log('데이터 없음');
  }

  // 3. daily_aggregates 11/10~16 확인
  console.log('\n=== daily_aggregates 테이블 (11/10~11/16) ===');
  const { data: agg, error: aggErr } = await supabase
    .from('daily_aggregates')
    .select('*')
    .gte('date', '2025-11-10')
    .lte('date', '2025-11-16')
    .order('date');

  if (aggErr) {
    console.error('Error:', aggErr.message);
  } else if (agg && agg.length > 0) {
    console.log('총 ' + agg.length + '개 레코드');
    let totalLeads = 0;
    let totalSpend = 0;
    agg.forEach(r => {
      totalLeads += r.leads || 0;
      totalSpend += parseFloat(r.spend) || 0;
      console.log(`${r.date} | ${(r.ad_name || '').substring(0,35)} | 리드:${r.leads} | 지출:$${r.spend}`);
    });
    console.log(`\n합계: 리드 ${totalLeads}건, 지출 $${totalSpend.toFixed(2)}`);
  } else {
    console.log('데이터 없음');
  }

  // 4. 11월 daily_aggregates 날짜별 요약
  console.log('\n=== 11월 daily_aggregates 날짜별 요약 ===');
  const { data: novAgg } = await supabase
    .from('daily_aggregates')
    .select('date, leads, spend')
    .gte('date', '2025-11-01')
    .order('date');

  if (novAgg && novAgg.length > 0) {
    const byDate = {};
    novAgg.forEach(r => {
      if (!byDate[r.date]) byDate[r.date] = { leads: 0, spend: 0 };
      byDate[r.date].leads += r.leads || 0;
      byDate[r.date].spend += parseFloat(r.spend) || 0;
    });
    Object.keys(byDate).sort().forEach(d => {
      console.log(`${d} | 리드: ${byDate[d].leads} | 지출: $${byDate[d].spend.toFixed(2)}`);
    });
  } else {
    console.log('데이터 없음');
  }
}

check().catch(console.error);
