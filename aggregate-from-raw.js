#!/usr/bin/env node
/**
 * raw_data → daily_aggregates 집계 스크립트
 *
 * 사용법:
 *   node aggregate-from-raw.js
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const CLIENT_ID = '79e35fc6-a817-4ccc-9d5d-9a93c1ad4515'; // 비즈액터스쿨

async function main() {
  console.log('━'.repeat(60));
  console.log('🔄 raw_data → daily_aggregates 집계 시작');
  console.log('━'.repeat(60));
  console.log();

  // 1. raw_data 날짜 범위 확인
  console.log('📅 raw_data 날짜 범위 확인 중...');

  const { data: dateData, error: dateError } = await supabase
    .from('raw_data')
    .select('date')
    .eq('client_id', CLIENT_ID)
    .order('date', { ascending: true });

  if (dateError) {
    console.error('❌ 오류:', dateError.message);
    return;
  }

  if (!dateData || dateData.length === 0) {
    console.error('❌ raw_data에 데이터가 없습니다.');
    return;
  }

  const dates = [...new Set(dateData.map(r => r.date))].sort();
  const startDate = dates[0];
  const endDate = dates[dates.length - 1];

  console.log(`   범위: ${startDate} ~ ${endDate}`);
  console.log(`   날짜: ${dates.length}일\n`);

  // 2. 기존 daily_aggregates 데이터 삭제 (해당 기간)
  console.log(`🗑️  기존 daily_aggregates 데이터 삭제 중... (${startDate} ~ ${endDate})`);

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

  // 3. 날짜별로 집계
  console.log('📊 날짜별 집계 시작...\n');

  let successCount = 0;
  let errorCount = 0;

  for (const date of dates) {
    console.log(`   처리 중: ${date}...`);

    // raw_data에서 해당 날짜 조회
    const { data: rawData, error: rawError } = await supabase
      .from('raw_data')
      .select('*')
      .eq('client_id', CLIENT_ID)
      .eq('date', date);

    if (rawError) {
      console.error(`   ❌ 조회 실패:`, rawError.message);
      errorCount++;
      continue;
    }

    if (!rawData || rawData.length === 0) {
      console.log(`   ⚠️  데이터 없음`);
      continue;
    }

    // 광고별로 집계
    const adAggregates = {};

    rawData.forEach(row => {
      const adId = row.ad_id;

      if (!adAggregates[adId]) {
        adAggregates[adId] = {
          client_id: CLIENT_ID,
          date: date,
          ad_id: adId,
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

      adAggregates[adId].impressions += row.impressions || 0;
      adAggregates[adId].reach += row.reach || 0;
      adAggregates[adId].clicks += row.clicks || 0;
      adAggregates[adId].leads += row.leads || 0;
      adAggregates[adId].spend += parseFloat(row.spend) || 0;
      adAggregates[adId].video_views += row.video_views || 0;
      adAggregates[adId].video_p25_watched += row.video_p25_watched || 0;
      adAggregates[adId].video_p50_watched += row.video_p50_watched || 0;
      adAggregates[adId].video_p75_watched += row.video_p75_watched || 0;
      adAggregates[adId].video_p100_watched += row.video_p100_watched || 0;
    });

    // daily_aggregates에 삽입
    const records = Object.values(adAggregates);

    const { error: insertError } = await supabase
      .from('daily_aggregates')
      .insert(records);

    if (insertError) {
      console.error(`   ❌ 삽입 실패:`, insertError.message);
      if (insertError.message.includes('numeric')) {
        console.error(`   💡 DECIMAL overflow 문제일 가능성 있음`);
        console.error(`   샘플 데이터:`, JSON.stringify(records[0], null, 2));
      }
      errorCount++;
    } else {
      console.log(`   ✅ 성공 (${records.length}개 광고)`);
      successCount++;
    }
  }

  console.log('\n━'.repeat(60));
  console.log('📊 집계 결과:');
  console.log('━'.repeat(60));
  console.log(`   성공: ${successCount}일`);
  console.log(`   실패: ${errorCount}일`);
  console.log();

  if (successCount > 0) {
    // 4. 결과 확인
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

    console.log('📅 날짜별 집계 결과:');
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
  }

  console.log('✅ 집계 완료!');
}

main();
