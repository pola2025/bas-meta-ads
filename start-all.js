#!/usr/bin/env node

/**
 * Railway 통합 시작 스크립트
 * 주간/월간 리포트 크론 스케줄러
 *
 * - 주간 리포트: 매주 월요일 09:00 KST
 * - 월간 리포트: 매월 1일 09:00 KST
 * - 일일 수집: bas-meta-cron-collector 서비스 (별도)
 * - 백필: /api/backfill API (별도)
 */

require('dotenv').config();
const cron = require('node-cron');
const { spawn } = require('child_process');

console.log('🚀 BAS Meta Ads Analytics - Report Scheduler');
console.log(`📅 Started at: ${new Date().toISOString()}`);
console.log(`🔧 DRY_RUN: ${process.env.DRY_RUN === 'true' ? 'ON (발송 안함)' : 'OFF (실제 발송)'}`);
console.log('');

// 주간 리포트 실행 함수
function runWeeklyReport() {
  console.log(`\n⏰ [${new Date().toISOString()}] 주간 리포트 실행 시작...`);

  const child = spawn('node', ['send-weekly-report.js'], {
    stdio: 'inherit',
    env: process.env
  });

  child.on('error', (error) => {
    console.error('❌ 주간 리포트 실행 오류:', error.message);
  });

  child.on('exit', (code) => {
    if (code === 0) {
      console.log(`✅ [${new Date().toISOString()}] 주간 리포트 완료`);
    } else {
      console.error(`❌ [${new Date().toISOString()}] 주간 리포트 실패 (code: ${code})`);
    }
  });
}

// 월간 리포트 실행 함수
function runMonthlyReport() {
  console.log(`\n⏰ [${new Date().toISOString()}] 월간 리포트 실행 시작...`);

  const child = spawn('node', ['send-monthly-report.js'], {
    stdio: 'inherit',
    env: process.env
  });

  child.on('error', (error) => {
    console.error('❌ 월간 리포트 실행 오류:', error.message);
  });

  child.on('exit', (code) => {
    if (code === 0) {
      console.log(`✅ [${new Date().toISOString()}] 월간 리포트 완료`);
    } else {
      console.error(`❌ [${new Date().toISOString()}] 월간 리포트 실패 (code: ${code})`);
    }
  });
}

// 크론 스케줄 설정
// 주간 리포트: 매주 월요일 09:00 KST (UTC 00:00)
cron.schedule('0 0 * * 1', runWeeklyReport, {
  timezone: 'Asia/Seoul'
});

// 월간 리포트: 매월 1일 09:00 KST
cron.schedule('0 9 1 * *', runMonthlyReport, {
  timezone: 'Asia/Seoul'
});

console.log('✅ Cron jobs scheduled:');
console.log('   📅 Weekly:  Every Monday at 09:00 KST');
console.log('   📅 Monthly: 1st of every month at 09:00 KST');
console.log('');

// 시작 시 즉시 실행 옵션 (테스트용)
if (process.env.RUN_NOW === 'weekly') {
  console.log('🔄 RUN_NOW=weekly - 즉시 주간 리포트 실행');
  runWeeklyReport();
} else if (process.env.RUN_NOW === 'monthly') {
  console.log('🔄 RUN_NOW=monthly - 즉시 월간 리포트 실행');
  runMonthlyReport();
}

// 프로세스 유지
process.on('SIGTERM', () => {
  console.log('\n⚠️ SIGTERM received, shutting down...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('\n⚠️ SIGINT received, shutting down...');
  process.exit(0);
});

console.log('🔄 Scheduler running... (Press Ctrl+C to stop)');
