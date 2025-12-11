#!/usr/bin/env node
/**
 * 11/10~11/16 기간 daily_aggregates 재집계
 * raw_data에서 읽어서 daily_aggregates에 upsert
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const CLIENT_ID = '79e35fc6-a817-4ccc-9d5d-9a93c1ad4515';
const START_DATE = '2025-11-09';
const END_DATE = '2025-11-16';

async function main() {
  console.log('━'.repeat(60));
  console.log('🔧 11/10~11/16 daily_aggregates 재집계');
  console.log('━'.repeat(60));
  console.log();

  // 1. raw_data에서 해당 기간 데이터 조회
  console.log(`📊 raw_data 조회 중... (${START_DATE} ~ ${END_DATE})`);

  const { data: rawData, error: rawError } = await supabase
    .from('raw_data')
    .select('*')
    .eq('client_id', CLIENT_ID)
    .gte('date', START_DATE)
    .lte('date', END_DATE)
    .order('date');

  if (rawError) {
    console.error('❌ raw_data 조회 실패:', rawError.message);
    return;
  }

  console.log(`   총 ${rawData.length}개 레코드\n`);

  // 2. 날짜+광고별로 집계
  const aggregates = {};

  rawData.forEach(row => {
    const key = `${row.date}_${row.ad_id}`;

    if (!aggregates[key]) {
      aggregates[key] = {
        client_id: CLIENT_ID,
        date: row.date,
        ad_id: row.ad_id,
        ad_name: row.ad_name,
        campaign_id: row.campaign_id,
        campaign_name: row.campaign_name,
        impressions: 0,
        reach: 0,
        clicks: 0,
        leads: 0,
        spend: 0,
        video_views: 0,
        video_p25_watched: 0,
        video_p50_watched: 0,
        video_p75_watched: 0,
        video_p100_watched: 0
      };
    }

    aggregates[key].impressions += row.impressions || 0;
    aggregates[key].reach += row.reach || 0;
    aggregates[key].clicks += row.clicks || 0;
    aggregates[key].leads += row.leads || 0;
    aggregates[key].spend += parseFloat(row.spend) || 0;
    aggregates[key].video_views += row.video_views || 0;
    aggregates[key].video_p25_watched += row.video_p25_watched || 0;
    aggregates[key].video_p50_watched += row.video_p50_watched || 0;
    aggregates[key].video_p75_watched += row.video_p75_watched || 0;
    aggregates[key].video_p100_watched += row.video_p100_watched || 0;
  });

  const records = Object.values(aggregates);
  console.log(`📝 집계 결과: ${records.length}개 레코드\n`);

  // 3. 기존 데이터 삭제
  console.log('🗑️  기존 daily_aggregates 삭제 중...');

  const { error: deleteError } = await supabase
    .from('daily_aggregates')
    .delete()
    .eq('client_id', CLIENT_ID)
    .gte('date', START_DATE)
    .lte('date', END_DATE);

  if (deleteError) {
    console.error('❌ 삭제 실패:', deleteError.message);
    return;
  }
  console.log('   ✅ 삭제 완료\n');

  // 4. 새 데이터 삽입
  console.log('📥 새 데이터 삽입 중...');

  const { error: insertError } = await supabase
    .from('daily_aggregates')
    .insert(records);

  if (insertError) {
    console.error('❌ 삽입 실패:', insertError.message);
    return;
  }
  console.log('   ✅ 삽입 완료\n');

  // 5. 결과 확인
  console.log('━'.repeat(60));
  console.log('📊 결과 확인');
  console.log('━'.repeat(60));

  const { data: result } = await supabase
    .from('daily_aggregates')
    .select('date, ad_name, leads, spend')
    .eq('client_id', CLIENT_ID)
    .gte('date', START_DATE)
    .lte('date', END_DATE)
    .order('date');

  // 날짜별 요약
  const byDate = {};
  result.forEach(row => {
    if (!byDate[row.date]) {
      byDate[row.date] = { leads: 0, spend: 0 };
    }
    byDate[row.date].leads += row.leads || 0;
    byDate[row.date].spend += parseFloat(row.spend) || 0;
  });

  let totalLeads = 0;
  let totalSpend = 0;

  console.log('\n날짜별 집계:');
  console.log('─'.repeat(50));

  Object.keys(byDate).sort().forEach(date => {
    const d = byDate[date];
    totalLeads += d.leads;
    totalSpend += d.spend;
    const cpl = d.leads > 0 ? d.spend / d.leads : 0;
    console.log(`${date}: 리드 ${d.leads}건, 지출 $${d.spend.toFixed(2)}, CPL $${cpl.toFixed(2)}`);
  });

  console.log('─'.repeat(50));
  console.log(`합계: 리드 ${totalLeads}건, 지출 $${totalSpend.toFixed(2)}`);

  // raw_data와 비교
  console.log('\n📋 raw_data vs daily_aggregates 비교:');
  console.log('─'.repeat(50));

  const { data: rawCheck } = await supabase
    .from('raw_data')
    .select('date, leads, spend')
    .eq('client_id', CLIENT_ID)
    .gte('date', START_DATE)
    .lte('date', END_DATE);

  const rawByDate = {};
  rawCheck.forEach(row => {
    if (!rawByDate[row.date]) {
      rawByDate[row.date] = { leads: 0, spend: 0 };
    }
    rawByDate[row.date].leads += row.leads || 0;
    rawByDate[row.date].spend += parseFloat(row.spend) || 0;
  });

  let allMatch = true;
  Object.keys(rawByDate).sort().forEach(date => {
    const raw = rawByDate[date];
    const agg = byDate[date] || { leads: 0, spend: 0 };
    const match = raw.leads === agg.leads && Math.abs(raw.spend - agg.spend) < 0.01;
    const status = match ? '✅' : '❌';
    if (!match) allMatch = false;
    console.log(`${date}: raw(${raw.leads}건, $${raw.spend.toFixed(2)}) vs agg(${agg.leads}건, $${agg.spend.toFixed(2)}) ${status}`);
  });

  console.log('─'.repeat(50));
  console.log(allMatch ? '✅ 모든 데이터 정합성 일치!' : '❌ 정합성 불일치 있음');
  console.log();
}

main();
