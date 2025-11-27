#!/usr/bin/env node
/**
 * 11월 데이터만 집계
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const CLIENT_ID = '79e35fc6-a817-4ccc-9d5d-9a93c1ad4515';

async function main() {
  console.log('🔄 11월 데이터 집계 시작...\n');

  const startDate = '2025-11-17';
  const endDate = '2025-11-23';

  // 1. 기존 데이터 삭제
  console.log(`🗑️  기존 데이터 삭제 중... (${startDate} ~ ${endDate})`);

  const { error: deleteError } = await supabase
    .from('daily_aggregates')
    .delete()
    .eq('client_id', CLIENT_ID)
    .gte('date', startDate)
    .lte('date', endDate);

  if (deleteError) {
    console.error('❌ 삭제 실패:', deleteError.message);
    return;
  }

  console.log('   ✅ 삭제 완료\n');

  // 2. raw_data 조회
  console.log('📊 raw_data 조회 중...');

  const { data: rawData, error: rawError } = await supabase
    .from('raw_data')
    .select('*')
    .eq('client_id', CLIENT_ID)
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date');

  if (rawError) {
    console.error('❌ 조회 실패:', rawError.message);
    return;
  }

  if (!rawData || rawData.length === 0) {
    console.error('❌ 데이터 없음');
    return;
  }

  console.log(`   ✅ ${rawData.length}건 조회\n`);

  // 3. 날짜별, 광고별로 집계
  console.log('📊 집계 중...\n');

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
        avg_watch_time: 0,
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
  console.log(`   📊 ${records.length}개 레코드로 집계됨\n`);

  // 4. daily_aggregates에 삽입
  console.log('📥 저장 중...');

  const { error: insertError } = await supabase
    .from('daily_aggregates')
    .insert(records);

  if (insertError) {
    console.error('❌ 저장 실패:', insertError.message);
    console.error('샘플 데이터:', JSON.stringify(records[0], null, 2));
    return;
  }

  console.log('   ✅ 저장 완료\n');

  // 5. 결과 확인
  console.log('🔍 결과 확인 중...\n');

  const { data: result, error: resultError } = await supabase
    .from('daily_aggregates')
    .select('date, ad_name, leads, spend, cpl, ctr')
    .eq('client_id', CLIENT_ID)
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date');

  if (resultError) {
    console.error('❌ 확인 실패:', resultError.message);
    return;
  }

  // 날짜별 집계
  const byDate = {};
  result.forEach(row => {
    if (!byDate[row.date]) {
      byDate[row.date] = { leads: 0, spend: 0 };
    }
    byDate[row.date].leads += row.leads || 0;
    byDate[row.date].spend += parseFloat(row.spend) || 0;
  });

  console.log('📅 날짜별 결과:');
  console.log('─'.repeat(50));

  let totalLeads = 0;
  let totalSpend = 0;

  Object.keys(byDate).sort().forEach(date => {
    const d = byDate[date];
    totalLeads += d.leads;
    totalSpend += d.spend;
    const cpl = d.leads > 0 ? d.spend / d.leads : 0;
    console.log(`${date}: 리드 ${d.leads}건, 지출 $${d.spend.toFixed(2)}, CPL $${cpl.toFixed(2)}`);
  });

  console.log('─'.repeat(50));
  console.log(`합계: 리드 ${totalLeads}건, 지출 $${totalSpend.toFixed(2)}`);
  console.log();

  console.log('✅ 11월 데이터 집계 완료!');
}

main();
