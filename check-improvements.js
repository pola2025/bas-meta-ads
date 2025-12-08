#!/usr/bin/env node
require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function check() {
  console.log('🔍 개선 필요 항목 점검\n');
  console.log('='.repeat(60));

  // 1. raw_data vs daily_aggregates 전체 정합성
  console.log('\n1. 12월 데이터 정합성 체크');
  const { rows: rawSum } = await pool.query(
    "SELECT SUM(leads) as leads, SUM(spend::numeric) as spend FROM raw_data WHERE date >= '2025-12-01'"
  );
  const { rows: aggSum } = await pool.query(
    "SELECT SUM(leads) as leads, SUM(spend::numeric) as spend FROM daily_aggregates WHERE date >= '2025-12-01'"
  );

  console.log('   raw_data: 리드', rawSum[0].leads, ', 지출 $' + parseFloat(rawSum[0].spend).toFixed(2));
  console.log('   daily_agg: 리드', aggSum[0].leads, ', 지출 $' + parseFloat(aggSum[0].spend).toFixed(2));

  const leadsDiff = parseInt(rawSum[0].leads) - parseInt(aggSum[0].leads);
  const spendDiff = parseFloat(rawSum[0].spend) - parseFloat(aggSum[0].spend);

  if (leadsDiff !== 0 || Math.abs(spendDiff) > 0.1) {
    console.log('   ⚠️ 불일치: 리드 ' + leadsDiff + ', 지출 $' + spendDiff.toFixed(2));
  } else {
    console.log('   ✅ 정합성 OK');
  }

  // 2. 클라이언트별 토큰 만료 체크
  console.log('\n2. 토큰 만료 체크');
  const { rows: clients } = await pool.query(
    "SELECT client_name, token_expires_at FROM clients WHERE is_active = true"
  );

  const now = new Date();
  clients.forEach(c => {
    if (c.token_expires_at) {
      const expires = new Date(c.token_expires_at);
      const daysLeft = Math.floor((expires - now) / (1000 * 60 * 60 * 24));
      if (daysLeft < 7) {
        console.log('   ⚠️ ' + c.client_name + ': ' + daysLeft + '일 남음');
      } else {
        console.log('   ✅ ' + c.client_name + ': ' + daysLeft + '일 남음');
      }
    } else {
      console.log('   ❓ ' + c.client_name + ': 만료일 미설정');
    }
  });

  // 3. 최근 7일 데이터 수집 누락 체크
  console.log('\n3. 최근 7일 데이터 수집 현황');
  const { rows: recentData } = await pool.query(`
    SELECT c.client_name, COUNT(DISTINCT r.date) as days
    FROM clients c
    LEFT JOIN raw_data r ON c.id = r.client_id AND r.date >= CURRENT_DATE - INTERVAL '7 days'
    WHERE c.is_active = true
    GROUP BY c.client_name
    ORDER BY c.client_name
  `);

  recentData.forEach(r => {
    if (parseInt(r.days) < 7) {
      console.log('   ⚠️ ' + r.client_name + ': ' + r.days + '/7일');
    } else {
      console.log('   ✅ ' + r.client_name + ': ' + r.days + '/7일');
    }
  });

  // 4. telegram_reports 중복 체크
  console.log('\n4. 리포트 중복 체크 (같은 기간 2개 이상)');
  const { rows: duplicates } = await pool.query(`
    SELECT client_id, week_start, week_end, report_type, COUNT(*) as cnt
    FROM telegram_reports
    GROUP BY client_id, week_start, week_end, report_type
    HAVING COUNT(*) > 1
  `);

  if (duplicates.length === 0) {
    console.log('   ✅ 중복 리포트 없음');
  } else {
    console.log('   ⚠️ 중복 ' + duplicates.length + '건 발견');
    duplicates.forEach(d => {
      console.log('      - ' + d.week_start + '~' + d.week_end + ' (' + d.report_type + '): ' + d.cnt + '개');
    });
  }

  // 5. 에러 로그 체크 (최근 24시간)
  console.log('\n5. 최근 에러 체크');
  try {
    const { rows: errors } = await pool.query(`
      SELECT COUNT(*) as cnt FROM collection_logs
      WHERE status = 'error' AND created_at >= NOW() - INTERVAL '24 hours'
    `);
    if (parseInt(errors[0].cnt) > 0) {
      console.log('   ⚠️ 최근 24시간 에러: ' + errors[0].cnt + '건');
    } else {
      console.log('   ✅ 에러 없음');
    }
  } catch (e) {
    console.log('   ❓ collection_logs 테이블 없음 (정상)');
  }

  console.log('\n' + '='.repeat(60));
  pool.end();
}

check().catch(err => {
  console.error('Error:', err.message);
  pool.end();
});
