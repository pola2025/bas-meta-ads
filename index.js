#!/usr/bin/env node

/**
 * BAS Meta Ads Analytics - Main Entry Point
 *
 * 기본 동작: start-all.js 실행 (리포트 스케줄러)
 * 데이터 수집: cron-collect-data.js (별도 서비스)
 */

require('dotenv').config();

console.log('🚀 Starting BAS Meta Ads Analytics');
console.log(`📅 Started at: ${new Date().toISOString()}`);
console.log('');

// start-all.js로 리다이렉트
require('./start-all.js');
