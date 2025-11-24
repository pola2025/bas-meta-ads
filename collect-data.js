/**
 * 데이터 수집 스크립트 (Producer 실행)
 */

// 환경변수 설정
process.env.MODE = 'producer';
process.env.DATA_DAYS = process.argv[2] || '7'; // 기본 7일

console.log(`📊 데이터 수집 시작 (최근 ${process.env.DATA_DAYS}일)`);
console.log(`   MODE: ${process.env.MODE}\n`);

// index.js 실행
require('./index.js');
