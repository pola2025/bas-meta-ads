#!/usr/bin/env node

/**
 * BAS Meta Ads Analytics - Main Entry Point
 *
 * 환경 변수 MODE에 따라 다른 프로세스 실행:
 * - MODE=producer: 데이터 수집 작업을 큐에 추가
 * - MODE=worker: 큐에서 작업을 가져와 처리 (기본값)
 */

require('dotenv').config();

const mode = process.env.MODE || 'worker';

console.log(`🚀 Starting BAS Meta Ads Analytics in ${mode.toUpperCase()} mode`);
console.log(`📅 Started at: ${new Date().toISOString()}`);
console.log('');

if (mode === 'producer') {
  console.log('📊 Running Producer - Adding data collection jobs to queue');
  const { enqueueDataCollectionJobs } = require('./lib/producer.js');
  enqueueDataCollectionJobs()
    .then((result) => {
      console.log('✅ Producer completed:', result);
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Producer failed:', error);
      process.exit(1);
    });
} else if (mode === 'worker') {
  console.log('⚙️  Running Worker - Processing jobs from queue');
  require('./lib/worker.js');
} else {
  console.error(`❌ Unknown MODE: ${mode}`);
  console.error('   Valid modes: producer, worker');
  process.exit(1);
}
