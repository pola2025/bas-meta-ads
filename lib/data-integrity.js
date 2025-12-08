#!/usr/bin/env node
/**
 * Data Integrity Module
 * raw_data ↔ daily_aggregates 정합성 자동 관리
 *
 * pg 라이브러리로 직접 PostgreSQL 연결 (Supabase row 제한 우회)
 *
 * 기능:
 * 1. raw_data 저장 후 자동으로 daily_aggregates 동기화
 * 2. 정합성 검증 (raw vs aggregates 비교)
 * 3. 불일치 시 자동 재집계 + 알림
 */

require('dotenv').config();
const { Pool } = require('pg');

// PostgreSQL 직접 연결 (row 제한 없음)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

/**
 * raw_data에서 daily_aggregates로 직접 집계 (RPC 없이)
 * @param {string} clientId - 클라이언트 UUID
 * @param {string} startDate - 시작일 (YYYY-MM-DD)
 * @param {string} endDate - 종료일 (YYYY-MM-DD)
 */
async function aggregateFromRaw(clientId, startDate, endDate) {
  console.log(`📊 Aggregating: ${startDate} ~ ${endDate}`);

  // 1. raw_data에서 해당 기간 데이터 조회 (pg - 제한 없음)
  const { rows: rawData } = await pool.query(
    `SELECT * FROM raw_data
     WHERE client_id = $1 AND date >= $2 AND date <= $3
     ORDER BY date`,
    [clientId, startDate, endDate]
  );

  if (!rawData || rawData.length === 0) {
    console.log(`   ⚠️ 해당 기간 raw_data 없음`);
    return { success: true, recordsAggregated: 0 };
  }

  console.log(`   📥 raw_data ${rawData.length}건 조회됨`);

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
  await pool.query(
    `DELETE FROM daily_aggregates
     WHERE client_id = $1 AND date >= $2 AND date <= $3`,
    [clientId, startDate, endDate]
  );

  // 4. 새 데이터 삽입 (배치로)
  if (records.length > 0) {
    for (const record of records) {
      await pool.query(
        `INSERT INTO daily_aggregates
         (client_id, date, ad_id, ad_name, campaign_id, campaign_name,
          impressions, reach, clicks, leads, spend,
          video_views, video_p25_watched, video_p50_watched, video_p75_watched, video_p100_watched)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
        [
          record.client_id, record.date, record.ad_id, record.ad_name,
          record.campaign_id, record.campaign_name,
          record.impressions, record.reach, record.clicks, record.leads, record.spend,
          record.video_views, record.video_p25_watched, record.video_p50_watched,
          record.video_p75_watched, record.video_p100_watched
        ]
      );
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
  const { rows: rawData } = await pool.query(
    `SELECT date, leads, spend FROM raw_data
     WHERE client_id = $1 AND date >= $2 AND date <= $3`,
    [clientId, startDate, endDate]
  );

  const rawByDate = {};
  (rawData || []).forEach(row => {
    if (!rawByDate[row.date]) {
      rawByDate[row.date] = { leads: 0, spend: 0 };
    }
    rawByDate[row.date].leads += row.leads || 0;
    rawByDate[row.date].spend += parseFloat(row.spend) || 0;
  });

  // 2. daily_aggregates 날짜별 합계
  const { rows: aggData } = await pool.query(
    `SELECT date, leads, spend FROM daily_aggregates
     WHERE client_id = $1 AND date >= $2 AND date <= $3`,
    [clientId, startDate, endDate]
  );

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
    mismatches.slice(0, 10).forEach(m => {
      console.log(`      ${m.date}: raw(${m.raw.leads}건, $${m.raw.spend}) vs agg(${m.agg.leads}건, $${m.agg.spend})`);
    });
    if (mismatches.length > 10) {
      console.log(`      ... 외 ${mismatches.length - 10}건`);
    }
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

  // raw_data의 모든 날짜 범위 조회 (pg - 제한 없음)
  const { rows } = await pool.query(
    `SELECT DISTINCT date FROM raw_data WHERE client_id = $1 ORDER BY date`,
    [clientId]
  );

  if (!rows || rows.length === 0) {
    console.log('No raw_data found');
    return { success: true, message: 'No data to check' };
  }

  // PostgreSQL date는 Date 객체로 반환 - KST 기준으로 변환 필요
  const formatDate = (d) => {
    if (typeof d === 'string') return d;
    // KST (UTC+9) 기준 날짜로 변환
    const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
    return kst.toISOString().split('T')[0];
  };
  const dates = rows.map(r => formatDate(r.date)).sort();
  console.log(`   📅 총 ${dates.length}개 날짜 발견`);

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

/**
 * 날짜 완전성 검증 - 기간 내 모든 날짜에 데이터가 있는지 확인
 * @param {string} clientId
 * @param {string} startDate
 * @param {string} endDate
 * @returns {object} { isComplete, missingDates, coverage }
 */
async function checkDateCompleteness(clientId, startDate, endDate) {
  console.log(`📅 날짜 완전성 검증: ${startDate} ~ ${endDate}`);

  // 기간 내 모든 날짜 생성
  const allDates = [];
  const start = new Date(startDate);
  const end = new Date(endDate);
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    allDates.push(d.toISOString().split('T')[0]);
  }

  // raw_data에서 실제 데이터가 있는 날짜 조회
  const { rows } = await pool.query(
    `SELECT DISTINCT date FROM raw_data
     WHERE client_id = $1 AND date >= $2 AND date <= $3`,
    [clientId, startDate, endDate]
  );

  // PostgreSQL date는 Date 객체로 반환 - KST 기준으로 변환 필요
  const formatDateStr = (d) => {
    if (typeof d === 'string') return d;
    const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
    return kst.toISOString().split('T')[0];
  };
  const existingDates = new Set((rows || []).map(r => formatDateStr(r.date)));
  const missingDates = allDates.filter(d => !existingDates.has(d));
  const coverage = ((allDates.length - missingDates.length) / allDates.length * 100).toFixed(1);

  if (missingDates.length === 0) {
    console.log(`   ✅ 완전성 100% (${allDates.length}일)`);
  } else {
    console.log(`   ⚠️ 커버리지 ${coverage}% (누락: ${missingDates.length}일)`);
    if (missingDates.length <= 5) {
      console.log(`      누락 날짜: ${missingDates.join(', ')}`);
    }
  }

  return {
    isComplete: missingDates.length === 0,
    missingDates,
    coverage: parseFloat(coverage),
    totalDays: allDates.length,
    existingDays: allDates.length - missingDates.length
  };
}

/**
 * 이상치 감지 - 전주 대비 급격한 변화 감지
 * @param {string} clientId
 * @param {string} date - 체크할 날짜
 * @param {number} threshold - 변화율 임계값 (기본 200%)
 * @returns {object} { hasAnomaly, details }
 */
async function checkAnomalies(clientId, date, threshold = 200) {
  // 해당 주와 전주 데이터 비교
  const targetDate = new Date(date);
  const weekStart = new Date(targetDate);
  weekStart.setDate(targetDate.getDate() - targetDate.getDay()); // 이번 주 일요일

  const prevWeekStart = new Date(weekStart);
  prevWeekStart.setDate(weekStart.getDate() - 7);
  const prevWeekEnd = new Date(weekStart);
  prevWeekEnd.setDate(weekStart.getDate() - 1);

  const formatDate = (d) => d.toISOString().split('T')[0];

  // 이번 주 데이터
  const { rows: thisWeek } = await pool.query(
    `SELECT leads, spend FROM raw_data
     WHERE client_id = $1 AND date >= $2 AND date <= $3`,
    [clientId, formatDate(weekStart), date]
  );

  // 전주 데이터
  const { rows: prevWeek } = await pool.query(
    `SELECT leads, spend FROM raw_data
     WHERE client_id = $1 AND date >= $2 AND date <= $3`,
    [clientId, formatDate(prevWeekStart), formatDate(prevWeekEnd)]
  );

  const sumLeads = (arr) => (arr || []).reduce((s, r) => s + (r.leads || 0), 0);
  const sumSpend = (arr) => (arr || []).reduce((s, r) => s + parseFloat(r.spend || 0), 0);

  const thisLeads = sumLeads(thisWeek);
  const prevLeads = sumLeads(prevWeek);
  const thisSpend = sumSpend(thisWeek);
  const prevSpend = sumSpend(prevWeek);

  const anomalies = [];

  // 리드 변화율
  if (prevLeads > 0) {
    const leadChange = ((thisLeads - prevLeads) / prevLeads) * 100;
    if (Math.abs(leadChange) > threshold) {
      anomalies.push({
        metric: 'leads',
        change: leadChange.toFixed(1),
        prev: prevLeads,
        current: thisLeads
      });
    }
  }

  // 지출 변화율
  if (prevSpend > 0) {
    const spendChange = ((thisSpend - prevSpend) / prevSpend) * 100;
    if (Math.abs(spendChange) > threshold) {
      anomalies.push({
        metric: 'spend',
        change: spendChange.toFixed(1),
        prev: prevSpend.toFixed(2),
        current: thisSpend.toFixed(2)
      });
    }
  }

  return {
    hasAnomaly: anomalies.length > 0,
    anomalies,
    thisWeek: { leads: thisLeads, spend: thisSpend },
    prevWeek: { leads: prevLeads, spend: prevSpend }
  };
}

/**
 * 리포트 생성 전 통합 검증
 * @param {string} clientId
 * @param {string} startDate
 * @param {string} endDate
 * @returns {object} 검증 결과
 */
async function validateBeforeReport(clientId, startDate, endDate) {
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`🔍 리포트 생성 전 검증: ${startDate} ~ ${endDate}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  const results = {
    passed: true,
    checks: [],
    warnings: [],
    errors: []
  };

  // 1. 날짜 완전성 검증
  const completeness = await checkDateCompleteness(clientId, startDate, endDate);
  results.checks.push({
    name: 'dateCompleteness',
    passed: completeness.coverage >= 80, // 80% 이상이면 통과
    details: completeness
  });
  if (completeness.coverage < 80) {
    results.warnings.push(`날짜 커버리지 ${completeness.coverage}% (권장: 80%+)`);
  }

  // 2. 정합성 검증 (raw vs aggregates)
  const integrity = await verifyIntegrity(clientId, startDate, endDate);
  results.checks.push({
    name: 'dataIntegrity',
    passed: integrity.isValid,
    details: integrity
  });
  if (!integrity.isValid) {
    results.errors.push(`정합성 불일치 ${integrity.mismatches.length}건`);
    results.passed = false;
  }

  // 3. 최소 데이터 확인
  const { rows: minData } = await pool.query(
    `SELECT leads, spend FROM raw_data
     WHERE client_id = $1 AND date >= $2 AND date <= $3`,
    [clientId, startDate, endDate]
  );

  const totalLeads = (minData || []).reduce((s, r) => s + (r.leads || 0), 0);
  const totalSpend = (minData || []).reduce((s, r) => s + parseFloat(r.spend || 0), 0);

  const hasMinData = totalLeads > 0 || totalSpend > 0;
  results.checks.push({
    name: 'minimumData',
    passed: hasMinData,
    details: { totalLeads, totalSpend }
  });
  if (!hasMinData) {
    results.errors.push('리드와 지출 모두 0 - 리포트 생성 불가');
    results.passed = false;
  }

  // 4. 이상치 감지 (경고만, 차단하지 않음)
  const anomalyCheck = await checkAnomalies(clientId, endDate);
  results.checks.push({
    name: 'anomalyDetection',
    passed: !anomalyCheck.hasAnomaly,
    details: anomalyCheck
  });
  if (anomalyCheck.hasAnomaly) {
    anomalyCheck.anomalies.forEach(a => {
      results.warnings.push(`${a.metric} 급격한 변화: ${a.change}%`);
    });
  }

  // 최종 결과 출력
  console.log(`\n📋 검증 결과 요약:`);
  console.log(`   ✅ 통과: ${results.checks.filter(c => c.passed).length}/${results.checks.length}`);
  if (results.warnings.length > 0) {
    console.log(`   ⚠️ 경고: ${results.warnings.join(', ')}`);
  }
  if (results.errors.length > 0) {
    console.log(`   ❌ 오류: ${results.errors.join(', ')}`);
  }
  console.log(`   → 리포트 생성: ${results.passed ? '가능' : '불가'}\n`);

  return results;
}

module.exports = {
  aggregateFromRaw,
  verifyIntegrity,
  syncAndVerify,
  fullIntegrityCheck,
  // 새로 추가된 함수들
  checkDateCompleteness,
  checkAnomalies,
  validateBeforeReport,
  // pg pool 내보내기 (다른 모듈에서 사용 가능)
  pool
};

// CLI 실행 지원
if (require.main === module) {
  const clientId = process.env.CLIENT_ID || '79e35fc6-a817-4ccc-9d5d-9a93c1ad4515';

  fullIntegrityCheck(clientId)
    .then(result => {
      console.log('\nResult:', result);
      pool.end();
      process.exit(result.success ? 0 : 1);
    })
    .catch(error => {
      console.error('Error:', error);
      pool.end();
      process.exit(1);
    });
}
