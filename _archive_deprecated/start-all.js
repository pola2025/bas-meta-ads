#!/usr/bin/env node

/**
 * Railway 리포트 스케줄러
 *
 * - 수집 헬스체크: 매일 08:00 KST (새벽 3시 수집 검증)
 * - 주간 리포트: 매주 월요일 09:00 KST
 * - 월간 리포트: 매월 1일 09:00 KST
 *
 * 데이터 수집은 bas-meta-cron-collector 서비스에서 전담 (매일 03:00 KST)
 */

require('dotenv').config();
const cron = require('node-cron');
const { spawn } = require('child_process');

console.log('🚀 BAS Meta Ads - Report Scheduler');
console.log(`📅 Started at: ${new Date().toISOString()}`);
console.log(`🔧 DRY_RUN: ${process.env.DRY_RUN === 'true' ? 'ON (발송 안함)' : 'OFF (실제 발송)'}`);
console.log('');

// 수집 헬스체크 실행 함수
function runCollectionHealthCheck() {
  console.log(`\n⏰ [${new Date().toISOString()}] 수집 헬스체크 시작...`);

  const child = spawn('node', ['check-collection-health.js'], {
    stdio: 'inherit',
    env: process.env
  });

  child.on('error', (error) => {
    console.error('❌ 헬스체크 실행 오류:', error.message);
  });

  child.on('exit', (code) => {
    if (code === 0) {
      console.log(`✅ [${new Date().toISOString()}] 헬스체크 완료`);
    } else {
      console.error(`❌ [${new Date().toISOString()}] 헬스체크 실패 (code: ${code})`);
    }
  });
}

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
// 수집 헬스체크: 매일 08:00 KST (새벽 3시 수집이 됐는지 확인)
cron.schedule('0 8 * * *', runCollectionHealthCheck, {
  timezone: 'Asia/Seoul'
});

// 주간 리포트: 매주 월요일 09:00 KST
cron.schedule('0 9 * * 1', runWeeklyReport, {
  timezone: 'Asia/Seoul'
});

// 월간 리포트: 매월 1일 09:00 KST
cron.schedule('0 9 1 * *', runMonthlyReport, {
  timezone: 'Asia/Seoul'
});

console.log('✅ Cron jobs scheduled:');
console.log('   🔍 Health:  Every day at 08:00 KST (collection check)');
console.log('   📅 Weekly:  Every Monday at 09:00 KST');
console.log('   📅 Monthly: 1st of every month at 09:00 KST');
console.log('');

// 수동 실행 지원
if (process.env.RUN_NOW === 'weekly') {
  console.log('🔄 RUN_NOW=weekly - 즉시 주간 리포트 실행');
  runWeeklyReport();
} else if (process.env.RUN_NOW === 'monthly') {
  console.log('🔄 RUN_NOW=monthly - 즉시 월간 리포트 실행');
  runMonthlyReport();
} else if (process.env.RUN_NOW === 'health') {
  console.log('🔄 RUN_NOW=health - 즉시 헬스체크 실행');
  runCollectionHealthCheck();
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
