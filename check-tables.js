#!/usr/bin/env node
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  const clientId = '79e35fc6-a817-4ccc-9d5d-9a93c1ad4515'; // 비즈액터스쿨
  const startDate = '2025-12-15';
  const endDate = '2025-12-21';

  console.log('=== 테이블별 데이터 현황 (12/15~12/21) ===\n');

  // 1. raw_data
  try {
    const { rows: rawData } = await pool.query(
      `SELECT COUNT(*) as cnt, SUM(leads) as leads, SUM(spend::numeric) as spend
       FROM raw_data WHERE client_id = $1 AND date >= $2 AND date <= $3`,
      [clientId, startDate, endDate]
    );
    console.log(`raw_data: ${rawData[0].cnt}건, ${rawData[0].leads || 0}리드, $${parseFloat(rawData[0].spend || 0).toFixed(2)}`);
  } catch (e) {
    console.log(`raw_data: ERROR - ${e.message}`);
  }

  // 2. raw_meta_insights
  try {
    const { rows: rawMeta } = await pool.query(
      `SELECT COUNT(*) as cnt, SUM(leads) as leads, SUM(spend::numeric) as spend
       FROM raw_meta_insights WHERE client_id = $1 AND date >= $2 AND date <= $3`,
      [clientId, startDate, endDate]
    );
    console.log(`raw_meta_insights: ${rawMeta[0].cnt}건, ${rawMeta[0].leads || 0}리드, $${parseFloat(rawMeta[0].spend || 0).toFixed(2)}`);
  } catch (e) {
    console.log(`raw_meta_insights: ERROR - ${e.message}`);
  }

  // 3. daily_aggregates
  try {
    const { rows: dailyAgg } = await pool.query(
      `SELECT COUNT(*) as cnt, SUM(leads) as leads, SUM(spend::numeric) as spend
       FROM daily_aggregates WHERE client_id = $1 AND date >= $2 AND date <= $3`,
      [clientId, startDate, endDate]
    );
    console.log(`daily_aggregates: ${dailyAgg[0].cnt}건, ${dailyAgg[0].leads || 0}리드, $${parseFloat(dailyAgg[0].spend || 0).toFixed(2)}`);
  } catch (e) {
    console.log(`daily_aggregates: ERROR - ${e.message}`);
  }

  // 4. ads_insights_daily (VIEW)
  try {
    const { rows: adsDaily } = await pool.query(
      `SELECT COUNT(*) as cnt, SUM(leads) as leads, SUM(spend::numeric) as spend
       FROM ads_insights_daily WHERE client_id = $1 AND date >= $2 AND date <= $3`,
      [clientId, startDate, endDate]
    );
    console.log(`ads_insights_daily: ${adsDaily[0].cnt}건, ${adsDaily[0].leads || 0}리드, $${parseFloat(adsDaily[0].spend || 0).toFixed(2)}`);
  } catch (e) {
    console.log(`ads_insights_daily: ERROR - ${e.message}`);
  }

  // 5. ads_insights_daily VIEW 정의 확인
  console.log('\n=== ads_insights_daily VIEW 정의 ===');
  try {
    const { rows: viewDef } = await pool.query(
      `SELECT pg_get_viewdef('ads_insights_daily', true) as definition`
    );
    console.log(viewDef[0]?.definition || 'VIEW 정의를 찾을 수 없음');
  } catch (e) {
    // VIEW가 아니라 TABLE일 수 있음
    try {
      const { rows: tableCheck } = await pool.query(
        `SELECT table_type FROM information_schema.tables WHERE table_name = 'ads_insights_daily'`
      );
      console.log(`테이블 타입: ${tableCheck[0]?.table_type || 'NOT FOUND'}`);
    } catch (e2) {
      console.log(`ERROR: ${e.message}`);
    }
  }

  await pool.end();
}

main().catch(console.error);
