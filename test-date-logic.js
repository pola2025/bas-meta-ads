#!/usr/bin/env node
// 오늘 날짜 기준 주간 날짜 계산 테스트

function getWeekDates() {
  const now = new Date();
  console.log('현재 시간 (UTC):', now.toISOString());
  console.log('현재 시간 (로컬):', now.toString());

  const dayOfWeek = now.getDay(); // 0=일, 1=월, 2=화, ...
  console.log('요일 (0=일):', dayOfWeek);

  // 가장 최근 일요일 (이번 주 마지막 날)
  // 오늘이 일요일(0)이면 오늘, 아니면 지난 일요일
  const lastSunday = new Date(now);
  lastSunday.setDate(now.getDate() - dayOfWeek);

  // 이번 주 월요일 (일요일 - 6일)
  const thisWeekStart = new Date(lastSunday);
  thisWeekStart.setDate(lastSunday.getDate() - 6);

  // 지난 주 일요일 (이번 주 월요일 - 1일)
  const lastWeekEnd = new Date(thisWeekStart);
  lastWeekEnd.setDate(thisWeekStart.getDate() - 1);

  // 지난 주 월요일 (지난 주 일요일 - 6일)
  const lastWeekStart = new Date(lastWeekEnd);
  lastWeekStart.setDate(lastWeekEnd.getDate() - 6);

  // 날짜 포맷팅 (YYYY-MM-DD)
  const formatDate = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  return {
    thisWeekStart: formatDate(thisWeekStart),
    thisWeekEnd: formatDate(lastSunday),
    lastWeekStart: formatDate(lastWeekStart),
    lastWeekEnd: formatDate(lastWeekEnd)
  };
}

const dates = getWeekDates();
console.log('\n계산된 날짜:');
console.log('이번 주:', dates.thisWeekStart, '~', dates.thisWeekEnd);
console.log('지난 주:', dates.lastWeekStart, '~', dates.lastWeekEnd);
