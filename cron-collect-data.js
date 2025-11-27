#!/usr/bin/env node

/**
 * Cron Job: 일일 데이터 수집
 *
 * Railway Cron Schedule: 0 18 * * * (UTC 18:00 = KST 03:00)
 *
 * 작업:
 * - 모든 활성 클라이언트의 데이터를 Meta API에서 수집
 * - raw_data 테이블에 저장 (VIEW가 자동 집계)
 * - Redis 없이 직접 실행
 *
 * 환경변수:
 * - DATA_DAYS: 수집 기간 (기본 7일)
 */

require('dotenv').config();

const DATA_DAYS = parseInt(process.env.DATA_DAYS || '7', 10);

async function main() {
  console.log('==========================================');
  console.log('🕐 Cron Job: 일일 데이터 수집 시작');
  console.log(`📅 실행 시각: ${new Date().toISOString()}`);
  console.log(`📊 수집 일수: ${DATA_DAYS}일`);
  console.log('==========================================');
  console.log('');

  // collect-all-clients.js 실행
  const { spawn } = require('child_process');

  const child = spawn('node', ['collect-all-clients.js'], {
    env: { ...process.env, DATA_DAYS: DATA_DAYS.toString() },
    stdio: 'inherit',
    cwd: __dirname
  });

  child.on('close', (code) => {
    console.log('');
    console.log('==========================================');
    if (code === 0) {
      console.log('✅ 데이터 수집 완료');
    } else {
      console.error(`❌ 데이터 수집 실패 (exit code: ${code})`);
    }
    console.log('==========================================');
    process.exit(code);
  });

  child.on('error', (error) => {
    console.error('==========================================');
    console.error('❌ 실행 오류:', error.message);
    console.error('==========================================');
    process.exit(1);
  });
}

main();
