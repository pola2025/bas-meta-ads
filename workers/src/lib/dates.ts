import type { WeekDates } from '../types';

// 날짜 계산 (매주 월요일 발송 기준)
// 발송일이 11/25(월)이면 → 이번주(=지난주): 11/18~24 (월~일), 비교주(=그 전주): 11/11~17 (월~일)
export function getWeekDates(): WeekDates {
  const now = new Date();

  // 오늘의 요일 (0=일요일, 1=월요일, ..., 6=토요일)
  const dayOfWeek = now.getDay();

  // 오늘이 월요일(1)이면 → 어제(일요일)가 지난주 마지막 날
  // 월요일 기준: 어제까지가 "지난 주"
  const daysToLastSunday = dayOfWeek === 0 ? 0 : dayOfWeek; // 일요일이면 0, 월요일이면 1

  // 지난주 일요일 (이번 주 기준점)
  const thisWeekEndDate = new Date(now);
  thisWeekEndDate.setDate(now.getDate() - daysToLastSunday);

  // 지난주 월요일 (일요일 - 6일)
  const thisWeekStartDate = new Date(thisWeekEndDate);
  thisWeekStartDate.setDate(thisWeekEndDate.getDate() - 6);

  // 그 전주 일요일 (지난주 월요일 - 1일)
  const lastWeekEndDate = new Date(thisWeekStartDate);
  lastWeekEndDate.setDate(thisWeekStartDate.getDate() - 1);

  // 그 전주 월요일 (그 전주 일요일 - 6일)
  const lastWeekStartDate = new Date(lastWeekEndDate);
  lastWeekStartDate.setDate(lastWeekEndDate.getDate() - 6);

  return {
    thisWeekStart: formatDate(thisWeekStartDate),
    thisWeekEnd: formatDate(thisWeekEndDate),
    lastWeekStart: formatDate(lastWeekStartDate),
    lastWeekEnd: formatDate(lastWeekEndDate),
  };
}

// 날짜 포맷팅 (YYYY-MM-DD)
function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// MarkdownV2 이스케이프 (Telegram용)
export function escapeMd(text: string | number | null | undefined): string {
  if (!text) return '';
  return text.toString().replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&');
}
