#!/usr/bin/env node
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function main() {
  const clientName = '비즈액터스쿨';
  const startDate = '2025-12-15';
  const endDate = '2025-12-21';

  // 1. 클라이언트 ID 조회
  const { data: client } = await supabase
    .from('clients')
    .select('id')
    .eq('client_name', clientName)
    .single();

  console.log(`=== ${clientName} 데이터 정합성 체크 ===\n`);
  console.log(`Client ID: ${client.id}`);

  // 2. raw_meta_insights에서 데이터 확인
  const { data: rawData, error: rawError } = await supabase
    .from('raw_meta_insights')
    .select('*')
    .eq('client_id', client.id)
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date');

  console.log(`\n=== raw_meta_insights (${rawData?.length || 0}건) ===`);

  // 날짜별 집계
  const rawByDate = {};
  rawData?.forEach(r => {
    if (!rawByDate[r.date]) rawByDate[r.date] = { leads: 0, spend: 0, count: 0, ad_ids: new Set() };
    rawByDate[r.date].leads += r.leads || 0;
    rawByDate[r.date].spend += parseFloat(r.spend) || 0;
    rawByDate[r.date].count++;
    rawByDate[r.date].ad_ids.add(r.ad_id);
  });

  Object.keys(rawByDate).sort().forEach(date => {
    const d = rawByDate[date];
    console.log(`  ${date}: ${d.leads}건, $${d.spend.toFixed(2)}, ${d.count}rows, ${d.ad_ids.size}ads`);
  });

  // 3. ads_insights_daily에서 데이터 확인
  const { data: aggData, error: aggError } = await supabase
    .from('ads_insights_daily')
    .select('*')
    .eq('client_id', client.id)
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date');

  console.log(`\n=== ads_insights_daily (${aggData?.length || 0}건) ===`);

  const aggByDate = {};
  aggData?.forEach(r => {
    if (!aggByDate[r.date]) aggByDate[r.date] = { leads: 0, spend: 0, count: 0 };
    aggByDate[r.date].leads += r.leads || 0;
    aggByDate[r.date].spend += parseFloat(r.spend) || 0;
    aggByDate[r.date].count++;
  });

  Object.keys(aggByDate).sort().forEach(date => {
    const d = aggByDate[date];
    console.log(`  ${date}: ${d.leads}건, $${d.spend.toFixed(2)}, ${d.count}rows`);
  });

  // 4. 중복 데이터 확인 (같은 날짜, 같은 ad_id)
  console.log('\n=== 중복 데이터 체크 ===');
  const duplicates = {};
  rawData?.forEach(r => {
    const key = `${r.date}|${r.ad_id}|${r.platform}`;
    if (!duplicates[key]) duplicates[key] = [];
    duplicates[key].push(r);
  });

  const dupeKeys = Object.keys(duplicates).filter(k => duplicates[k].length > 1);
  if (dupeKeys.length > 0) {
    console.log(`  중복 발견: ${dupeKeys.length}개`);
    dupeKeys.slice(0, 5).forEach(k => {
      const items = duplicates[k];
      console.log(`    ${k}: ${items.length}건`);
      items.forEach(i => console.log(`      id=${i.id}, leads=${i.leads}, spend=${i.spend}`));
    });
  } else {
    console.log('  중복 없음');
  }

  // 5. ads_insights_daily가 VIEW인지 TABLE인지 확인
  console.log('\n=== ads_insights_daily 구조 확인 ===');

  // 직접 쿼리로 확인
  const { data: viewCheck, error: viewError } = await supabase.rpc('exec_sql', {
    sql: "SELECT table_type FROM information_schema.tables WHERE table_name = 'ads_insights_daily'"
  }).maybeSingle();

  if (viewError) {
    // RPC 없으면 다른 방법 시도
    console.log('  (RPC 없음 - 데이터 비교로 판단)');

    // raw와 agg 비교
    const rawTotal = rawData?.reduce((sum, r) => sum + (r.leads || 0), 0) || 0;
    const aggTotal = aggData?.reduce((sum, r) => sum + (r.leads || 0), 0) || 0;

    console.log(`  raw_meta_insights 총 리드: ${rawTotal}`);
    console.log(`  ads_insights_daily 총 리드: ${aggTotal}`);

    if (rawTotal > 0 && aggTotal === 0) {
      console.log('\n  ⚠️ ads_insights_daily VIEW가 raw_meta_insights와 동기화되지 않음');
      console.log('  → VIEW 재생성 또는 materialized view refresh 필요');
    }
  }
}

main().catch(console.error);
