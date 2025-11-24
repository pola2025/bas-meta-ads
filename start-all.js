#!/usr/bin/env node

/**
 * Railway 통합 시작 스크립트
 * Producer (web), Worker, Cron을 모두 실행
 */

require('dotenv').config();
const { spawn } = require('child_process');

console.log('🚀 BAS Meta Ads Analytics - All Services Starting...');
console.log(`📅 Started at: ${new Date().toISOString()}`);
console.log('');

// 1. Worker 시작 (백그라운드)
console.log('⚙️  Starting Worker...');
const worker = spawn('node', ['lib/worker.js'], {
  env: { ...process.env, MODE: 'worker' },
  stdio: 'inherit'
});

worker.on('error', (error) => {
  console.error('❌ Worker error:', error);
});

worker.on('exit', (code) => {
  console.log(`⚠️ Worker exited with code ${code}`);
  if (code !== 0) {
    console.log('🔄 Restarting Worker in 5 seconds...');
    setTimeout(() => {
      spawn('node', ['lib/worker.js'], {
        env: { ...process.env, MODE: 'worker' },
        stdio: 'inherit'
      });
    }, 5000);
  }
});

// 2. Cron 시작 (백그라운드)
console.log('⏰ Starting Cron Scheduler...');
const cron = spawn('node', ['telegram-cron-v2.js'], {
  stdio: 'inherit'
});

cron.on('error', (error) => {
  console.error('❌ Cron error:', error);
});

cron.on('exit', (code) => {
  console.log(`⚠️ Cron exited with code ${code}`);
});

// 3. 프로세스 유지
process.on('SIGTERM', () => {
  console.log('\n⚠️ SIGTERM received, shutting down...');
  worker.kill();
  cron.kill();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('\n⚠️ SIGINT received, shutting down...');
  worker.kill();
  cron.kill();
  process.exit(0);
});

console.log('');
console.log('✅ All services started successfully!');
console.log('   - Worker: Processing queue jobs');
console.log('   - Cron: Weekly reports (Monday 09:00 KST)');
console.log('');
console.log('Press Ctrl+C to stop all services');
