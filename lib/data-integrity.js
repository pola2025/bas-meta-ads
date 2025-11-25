#!/usr/bin/env node
/**
 * Data Integrity Module
 * raw_data ↔ daily_aggregates 정합성 자동 관리
 *
 * 기능:
 * 1. raw_data 저장 후 자동으로 daily_aggregates 동기화
 * 2. 정합성 검증 (raw vs aggregates 비교)
 * 3. 불일치 시 자동 재집계 + 알림
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

/**
 * raw_data에서 daily_aggregates로 직접 집계 (RPC 없이)
 * @param {string} clientId - 클라이언트 UUID
 * @param {string} startDate - 시작일 (YYYY-MM-DD)
 * @param {string} endDate - 종료일 (YYYY-MM-DD)
 */
async function aggregateFromRaw(clientId, startDate, endDate) {
  console.log(`📊 Aggregating: ${startDate} ~ ${endDate}`);

  // 1. raw_data에서 해당 기간 데이터 조회
  const { data: rawData, error: rawError } = await supabase
    .from('raw_data')
    .select('*')
    .eq('client_id', clientId)
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date');

  if (rawError) {
    throw new Error(`raw_data 조회 실패: ${rawError.message}`);
  }

  if (!rawData || rawData.length === 0) {
    console.log(`   ⚠️ 해당 기간 raw_data 없음`);
    return { success: true, recordsAggregated: 0 };
  }

  // 2. 날짜+광고별로 집계 (중복 레코드 합산)
  const aggregates = {};

  rawData.forEach(row => {
    const key = `${row.date}_${row.ad_id}`;

    if (!aggregates[key]) {
      aggregates[key] = {
        client_id: clientId,
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

    // 모든 중복 레코드 합산
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

  // 3. 기존 데이터 삭제 후 삽입 (upsert 대신 delete+insert로 확실한 동기화)
  const { error: deleteError } = await supabase
    .from('daily_aggregates')
    .delete()
    .eq('client_id', clientId)
    .gte('date', startDate)
    .lte('date', endDate);

  if (deleteError) {
    throw new Error(`기존 데이터 삭제 실패: ${deleteError.message}`);
  }

  // 4. 새 데이터 삽입
  if (records.length > 0) {
    const { error: insertError } = await supabase
      .from('daily_aggregates')
      .insert(records);

    if (insertError) {
      throw new Error(`데이터 삽입 실패: ${insertError.message}`);
    }
  }

  console.log(`   ✅ ${records.length}개 레코드 집계 완료`);

  return {
    success: true,
    recordsAggregated: records.length,
    rawRecords: rawData.length
  };
}

/**
 * 정합성 검증 (raw_data vs daily_aggregates)
 * @param {string} clientId - 클라이언트 UUID
 * @param {string} startDate - 시작일
 * @param {string} endDate - 종료일
 * @returns {object} { isValid, mismatches }
 */
async function verifyIntegrity(clientId, startDate, endDate) {
  console.log(`🔍 Verifying integrity: ${startDate} ~ ${endDate}`);

  // 1. raw_data 날짜별 합계
  const { data: rawData } = await supabase
    .from('raw_data')
    .select('date, leads, spend')
    .eq('client_id', clientId)
    .gte('date', startDate)
    .lte('date', endDate);

  const rawByDate = {};
  (rawData || []).forEach(row => {
    if (!rawByDate[row.date]) {
      rawByDate[row.date] = { leads: 0, spend: 0 };
    }
    rawByDate[row.date].leads += row.leads || 0;
    rawByDate[row.date].spend += parseFloat(row.spend) || 0;
  });

  // 2. daily_aggregates 날짜별 합계
  const { data: aggData } = await supabase
    .from('daily_aggregates')
    .select('date, leads, spend')
    .eq('client_id', clientId)
    .gte('date', startDate)
    .lte('date', endDate);

  const aggByDate = {};
  (aggData || []).forEach(row => {
    if (!aggByDate[row.date]) {
      aggByDate[row.date] = { leads: 0, spend: 0 };
    }
    aggByDate[row.date].leads += row.leads || 0;
    aggByDate[row.date].spend += parseFloat(row.spend) || 0;
  });

  // 3. 비교
  const allDates = [...new Set([...Object.keys(rawByDate), ...Object.keys(aggByDate)])].sort();
  const mismatches = [];

  allDates.forEach(date => {
    const raw = rawByDate[date] || { leads: 0, spend: 0 };
    const agg = aggByDate[date] || { leads: 0, spend: 0 };

    const leadMatch = raw.leads === agg.leads;
    const spendMatch = Math.abs(raw.spend - agg.spend) < 0.01;

    if (!leadMatch || !spendMatch) {
      mismatches.push({
        date,
        raw: { leads: raw.leads, spend: raw.spend.toFixed(2) },
        agg: { leads: agg.leads, spend: agg.spend.toFixed(2) },
        issue: !leadMatch ? 'leads_mismatch' : 'spend_mismatch'
      });
    }
  });

  const isValid = mismatches.length === 0;

  if (isValid) {
    console.log(`   ✅ 정합성 검증 통과 (${allDates.length}일)`);
  } else {
    console.log(`   ❌ 정합성 불일치 ${mismatches.length}건 발견`);
    mismatches.forEach(m => {
      console.log(`      ${m.date}: raw(${m.raw.leads}건, $${m.raw.spend}) vs agg(${m.agg.leads}건, $${m.agg.spend})`);
    });
  }

  return { isValid, mismatches, datesChecked: allDates.length };
}

/**
 * 집계 + 정합성 검증 + 자동 복구 (통합 함수)
 * Worker에서 이 함수 하나만 호출하면 됨
 */
async function syncAndVerify(clientId, startDate, endDate) {
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`🔄 Data Sync & Verify: ${startDate} ~ ${endDate}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  // 1. 집계 실행
  const aggResult = await aggregateFromRaw(clientId, startDate, endDate);

  // 2. 정합성 검증
  const verifyResult = await verifyIntegrity(clientId, startDate, endDate);

  // 3. 불일치 시 한 번 더 재집계 시도
  if (!verifyResult.isValid) {
    console.log(`\n⚠️ 정합성 불일치 발견 → 재집계 시도...\n`);

    await aggregateFromRaw(clientId, startDate, endDate);
    const reVerify = await verifyIntegrity(clientId, startDate, endDate);

    if (!reVerify.isValid) {
      console.error(`\n❌ 재집계 후에도 정합성 불일치!`);
      console.error(`   → 수동 확인 필요\n`);

      // TODO: 텔레그램 알림 발송
      return {
        success: false,
        error: 'integrity_mismatch_after_retry',
        mismatches: reVerify.mismatches
      };
    }
  }

  console.log(`\n✅ Data Sync 완료! (${aggResult.recordsAggregated}개 레코드)\n`);

  return {
    success: true,
    recordsAggregated: aggResult.recordsAggregated,
    datesVerified: verifyResult.datesChecked
  };
}

/**
 * 전체 날짜 범위 정합성 체크 및 자동 복구
 * @param {string} clientId
 */
async function fullIntegrityCheck(clientId) {
  console.log(`\n🔧 Full Integrity Check for client: ${clientId}\n`);

  // raw_data의 모든 날짜 범위 조회 (DISTINCT date만 가져옴)
  // Supabase 기본 1000개 제한 우회를 위해 여러 쿼리로 분할
  let allDates = [];
  let offset = 0;
  const limit = 1000;

  while (true) {
    const { data: batch, error } = await supabase
      .from('raw_data')
      .select('date')
      .eq('client_id', clientId)
      .order('date')
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Error fetching dates:', error.message);
      return { success: false, error: error.message };
    }

    if (!batch || batch.length === 0) break;

    allDates = allDates.concat(batch.map(r => r.date));
    offset += limit;

    if (batch.length < limit) break;
  }

  if (!allDates || allDates.length === 0) {
    console.log('No raw_data found');
    return { success: true, message: 'No data to check' };
  }

  const dates = [...new Set(allDates)].sort();

  // 연속되지 않은 날짜 범위 그룹화 (갭 있으면 분리)
  const dateGroups = [];
  let currentGroup = [dates[0]];

  for (let i = 1; i < dates.length; i++) {
    const prevDate = new Date(dates[i - 1]);
    const currDate = new Date(dates[i]);
    const diffDays = (currDate - prevDate) / (1000 * 60 * 60 * 24);

    if (diffDays > 7) {
      // 7일 이상 갭이 있으면 새 그룹
      dateGroups.push({
        start: currentGroup[0],
        end: currentGroup[currentGroup.length - 1]
      });
      currentGroup = [dates[i]];
    } else {
      currentGroup.push(dates[i]);
    }
  }

  // 마지막 그룹 추가
  dateGroups.push({
    start: currentGroup[0],
    end: currentGroup[currentGroup.length - 1]
  });

  console.log(`Found ${dateGroups.length} date groups:`);
  dateGroups.forEach((g, i) => {
    console.log(`  ${i + 1}. ${g.start} ~ ${g.end}`);
  });
  console.log();

  // 각 그룹별로 집계
  let totalRecords = 0;
  let totalDates = 0;

  for (const group of dateGroups) {
    const result = await syncAndVerify(clientId, group.start, group.end);
    if (result.success) {
      totalRecords += result.recordsAggregated;
      totalDates += result.datesVerified;
    }
  }

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`✅ Full Integrity Check 완료!`);
  console.log(`   총 ${totalDates}일, ${totalRecords}개 레코드`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  return { success: true, recordsAggregated: totalRecords, datesVerified: totalDates };
}

module.exports = {
  aggregateFromRaw,
  verifyIntegrity,
  syncAndVerify,
  fullIntegrityCheck
};

// CLI 실행 지원
if (require.main === module) {
  const clientId = process.env.CLIENT_ID || '79e35fc6-a817-4ccc-9d5d-9a93c1ad4515';

  fullIntegrityCheck(clientId)
    .then(result => {
      console.log('\nResult:', result);
      process.exit(result.success ? 0 : 1);
    })
    .catch(error => {
      console.error('Error:', error);
      process.exit(1);
    });
}
