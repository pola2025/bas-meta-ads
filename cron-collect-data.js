#!/usr/bin/env node

/**
 * Cron Job: 데이터 수집
 *
 * 매일 새벽 3시(KST)에 실행
 * Railway Cron Schedule: 0 18 * * * (UTC 18:00 = KST 03:00)
 *
 * 작업 순서:
 * 1. 모든 클라이언트의 데이터 수집 작업을 큐에 추가
 * 2. 완료 후 종료 (Worker가 별도로 처리)
 */

require('dotenv').config();

const { enqueueDataCollectionJobs } = require('./lib/producer.js');

const DATA_DAYS = parseInt(process.env.DATA_DAYS || '7', 10);

async function main() {
  console.log('==========================================');
  console.log('🕐 Cron Job: 데이터 수집 시작');
  console.log(`📅 실행 시각: ${new Date().toISOString()}`);
  console.log(`📊 수집 일수: ${DATA_DAYS}일`);
  console.log('==========================================');
  console.log('');

  try {
    const result = await enqueueDataCollectionJobs();

    console.log('');
    console.log('==========================================');
    console.log('✅ 데이터 수집 작업 큐 추가 완료');
    console.log(`📋 결과:`, result);
    console.log('==========================================');

    process.exit(0);
  } catch (error) {
    console.error('');
    console.error('==========================================');
    console.error('❌ 데이터 수집 작업 추가 실패');
    console.error(`🔴 에러:`, error.message);
    console.error('==========================================');

    process.exit(1);
  }
}

main();
