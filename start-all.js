#!/usr/bin/env node

/**
 * Railway 통합 시작 스크립트
 * Cron (주간 리포트)만 실행
 *
 * - Worker 제거됨 (Redis 미사용)
 * - 일일 수집: bas-meta-cron-collector 서비스
 * - 백필: /api/backfill API
 */

require('dotenv').config();
const { spawn } = require('child_process');

console.log('🚀 BAS Meta Ads Analytics - Starting...');
console.log(`📅 Started at: ${new Date().toISOString()}`);
console.log('');

// Cron 시작 (주간 리포트)
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

// 프로세스 유지
process.on('SIGTERM', () => {
  console.log('\n⚠️ SIGTERM received, shutting down...');
  cron.kill();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('\n⚠️ SIGINT received, shutting down...');
  cron.kill();
  process.exit(0);
});

console.log('');
console.log('✅ Service started!');
console.log('   - Cron: Weekly reports (Monday 09:00 KST)');
console.log('');
console.log('Press Ctrl+C to stop');
