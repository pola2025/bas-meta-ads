#!/usr/bin/env node
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

(async () => {
  const clientId = '79e35fc6-a817-4ccc-9d5d-9a93c1ad4515';

  console.log('=== 비즈액터스쿨 12월 데이터 확인 ===\n');

  // 2025년 11월 말 ~ 12월 초 데이터 확인
  const { data: recentData } = await supabase
    .from('raw_data')
    .select('date, leads, spend')
    .eq('client_id', clientId)
    .gte('date', '2025-11-28')
    .lte('date', '2025-12-04')
    .order('date');

  console.log('2025년 11/28 ~ 12/04 일별 데이터:');
  const dailySum = {};
  if (recentData) {
    recentData.forEach(r => {
      if (!dailySum[r.date]) dailySum[r.date] = { leads: 0, spend: 0 };
      dailySum[r.date].leads += r.leads || 0;
      dailySum[r.date].spend += parseFloat(r.spend || 0);
    });
  }
  Object.keys(dailySum).sort().forEach(date => {
    console.log(date, 'leads=' + dailySum[date].leads, 'spend=$' + dailySum[date].spend.toFixed(2));
  });

  if (Object.keys(dailySum).length === 0) {
    console.log('(데이터 없음)');
  }

  // 가장 최근 데이터 날짜 확인
  const { data: latest } = await supabase
    .from('raw_data')
    .select('date')
    .eq('client_id', clientId)
    .order('date', { ascending: false })
    .limit(5);

  console.log('\n가장 최근 수집된 날짜 (최근 5개):');
  if (latest) {
    const uniqueDates = [...new Set(latest.map(r => r.date))];
    uniqueDates.forEach(d => console.log(' -', d));
  }
})();
