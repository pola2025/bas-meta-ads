/**
 * 전체 리포트 테스트 (telegram-cron.js 로직 사용)
 */

// telegram-cron.js에서 주요 함수들 가져오기
const path = require('path');
require('dotenv').config();

// 지난 주 계산 함수
function getLastWeekRange() {
  // 오늘을 2025-11-24 (월요일)로 가정
  const today = new Date('2025-11-24');
  const dayOfWeek = today.getDay(); // 1 (월요일)

  // 지난 일요일
  const lastSunday = new Date(today);
  lastSunday.setDate(today.getDate() - dayOfWeek - 7); // 2025-11-16

  // 지난 월요일
  const lastMonday = new Date(lastSunday);
  lastMonday.setDate(lastSunday.getDate() - 6); // 2025-11-10

  return {
    weekStart: lastMonday.toISOString().split('T')[0],
    weekEnd: lastSunday.toISOString().split('T')[0]
  };
}

// 메인 실행
(async () => {
  const { createClient } = require('@supabase/supabase-js');

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );

  console.log("\n🚀 Starting Full Telegram Report Test...");
  console.log(`   Simulating: Monday 2025-11-24 09:00 KST`);

  const { weekStart, weekEnd } = getLastWeekRange();
  console.log(`   Report period: ${weekStart} ~ ${weekEnd}`);

  // telegram-cron.js의 sendTelegramReport 함수 로직 사용
  const telegram = require('./telegram-cron.js');

  // 바로 실행되므로 프로세스 종료
  setTimeout(() => {
    console.log("\n✅ Test completed - check Telegram for message");
    process.exit(0);
  }, 5000);
})();
