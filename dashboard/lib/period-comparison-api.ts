import { supabase } from './supabase';
import { Filters } from './api';

// 주간 비교 데이터
export interface WeeklyComparison {
  week_label: string; // "2025-W45 (11/04~11/10)"
  week_start: string;
  week_end: string;
  facebook_leads: number;
  facebook_spend: number;
  facebook_cpl: number;
  instagram_leads: number;
  instagram_spend: number;
  instagram_cpl: number;
  total_leads: number;
  total_spend: number;
  total_cpl: number;
}

// 월간 비교 데이터
export interface MonthlyComparison {
  month_label: string; // "2025년 11월"
  month_start: string;
  month_end: string;
  facebook_leads: number;
  facebook_spend: number;
  facebook_cpl: number;
  instagram_leads: number;
  instagram_spend: number;
  instagram_cpl: number;
  total_leads: number;
  total_spend: number;
  total_cpl: number;
}

/**
 * 주간 비교 데이터 조회 (최근 N주)
 * @param weeks 조회할 주 수 (기본 4주)
 * @param filters 추가 필터 (캠페인 등)
 */
export async function getWeeklyComparison(weeks: number = 4, filters?: Filters): Promise<WeeklyComparison[]> {
  try {
    // 최근 N주 시작일/종료일 계산
    const today = new Date();
    const endDate = new Date(today);
    endDate.setDate(today.getDate() - today.getDay()); // 이번 주 일요일

    const startDate = new Date(endDate);
    startDate.setDate(endDate.getDate() - (weeks * 7) + 1); // N주 전 월요일

    let query = supabase
      .from('ads_insights_daily')
      .select('date, platform, leads, spend')
      .gte('date', startDate.toISOString().split('T')[0])
      .lte('date', endDate.toISOString().split('T')[0]);

    // 추가 필터 적용
    if (filters?.campaigns && filters.campaigns.length > 0) {
      query = query.in('campaign_name', filters.campaigns);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching weekly comparison:', error);
      return [];
    }

    // 주차별로 집계
    const weeklyData: Record<string, WeeklyComparison> = {};

    (data || []).forEach((row: any) => {
      const date = new Date(row.date);
      const dayOfWeek = date.getDay();
      const monday = new Date(date);
      monday.setDate(date.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);

      const weekKey = monday.toISOString().split('T')[0];

      if (!weeklyData[weekKey]) {
        const weekNum = getWeekNumber(monday);
        weeklyData[weekKey] = {
          week_label: `${monday.getFullYear()}-W${weekNum.toString().padStart(2, '0')} (${formatDateShort(monday)}~${formatDateShort(sunday)})`,
          week_start: monday.toISOString().split('T')[0],
          week_end: sunday.toISOString().split('T')[0],
          facebook_leads: 0,
          facebook_spend: 0,
          facebook_cpl: 0,
          instagram_leads: 0,
          instagram_spend: 0,
          instagram_cpl: 0,
          total_leads: 0,
          total_spend: 0,
          total_cpl: 0
        };
      }

      const platform = row.platform?.toLowerCase();
      const leads = row.leads || 0;
      const spend = row.spend || 0;

      if (platform === 'facebook') {
        weeklyData[weekKey].facebook_leads += leads;
        weeklyData[weekKey].facebook_spend += spend;
      } else if (platform === 'instagram') {
        weeklyData[weekKey].instagram_leads += leads;
        weeklyData[weekKey].instagram_spend += spend;
      }

      weeklyData[weekKey].total_leads += leads;
      weeklyData[weekKey].total_spend += spend;
    });

    // CPL 계산
    const result = Object.values(weeklyData).map(week => ({
      ...week,
      facebook_cpl: week.facebook_leads > 0 ? week.facebook_spend / week.facebook_leads : 0,
      instagram_cpl: week.instagram_leads > 0 ? week.instagram_spend / week.instagram_leads : 0,
      total_cpl: week.total_leads > 0 ? week.total_spend / week.total_leads : 0
    }));

    return result.sort((a, b) => a.week_start.localeCompare(b.week_start));
  } catch (error) {
    console.error('Unexpected error in getWeeklyComparison:', error);
    return [];
  }
}

/**
 * 월간 비교 데이터 조회 (최근 N개월)
 * @param months 조회할 월 수 (기본 3개월)
 * @param filters 추가 필터 (캠페인 등)
 */
export async function getMonthlyComparison(months: number = 3, filters?: Filters): Promise<MonthlyComparison[]> {
  try {
    // 최근 N개월 계산
    const today = new Date();
    const endMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0); // 이번 달 말일
    const startMonth = new Date(today.getFullYear(), today.getMonth() - months + 1, 1); // N개월 전 1일

    let query = supabase
      .from('ads_insights_daily')
      .select('date, platform, leads, spend')
      .gte('date', startMonth.toISOString().split('T')[0])
      .lte('date', endMonth.toISOString().split('T')[0]);

    // 추가 필터 적용
    if (filters?.campaigns && filters.campaigns.length > 0) {
      query = query.in('campaign_name', filters.campaigns);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching monthly comparison:', error);
      return [];
    }

    // 월별로 집계
    const monthlyData: Record<string, MonthlyComparison> = {};

    (data || []).forEach((row: any) => {
      const date = new Date(row.date);
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      const monthKey = `${year}-${month.toString().padStart(2, '0')}`;

      const monthStart = new Date(year, month - 1, 1);
      const monthEnd = new Date(year, month, 0);

      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = {
          month_label: `${year}년 ${month}월`,
          month_start: monthStart.toISOString().split('T')[0],
          month_end: monthEnd.toISOString().split('T')[0],
          facebook_leads: 0,
          facebook_spend: 0,
          facebook_cpl: 0,
          instagram_leads: 0,
          instagram_spend: 0,
          instagram_cpl: 0,
          total_leads: 0,
          total_spend: 0,
          total_cpl: 0
        };
      }

      const platform = row.platform?.toLowerCase();
      const leads = row.leads || 0;
      const spend = row.spend || 0;

      if (platform === 'facebook') {
        monthlyData[monthKey].facebook_leads += leads;
        monthlyData[monthKey].facebook_spend += spend;
      } else if (platform === 'instagram') {
        monthlyData[monthKey].instagram_leads += leads;
        monthlyData[monthKey].instagram_spend += spend;
      }

      monthlyData[monthKey].total_leads += leads;
      monthlyData[monthKey].total_spend += spend;
    });

    // CPL 계산
    const result = Object.values(monthlyData).map(month => ({
      ...month,
      facebook_cpl: month.facebook_leads > 0 ? month.facebook_spend / month.facebook_leads : 0,
      instagram_cpl: month.instagram_leads > 0 ? month.instagram_spend / month.instagram_leads : 0,
      total_cpl: month.total_leads > 0 ? month.total_spend / month.total_leads : 0
    }));

    return result.sort((a, b) => a.month_start.localeCompare(b.month_start));
  } catch (error) {
    console.error('Unexpected error in getMonthlyComparison:', error);
    return [];
  }
}

// 헬퍼 함수: 주차 번호 계산
function getWeekNumber(date: Date): number {
  const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
  const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
  return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
}

// 헬퍼 함수: 날짜 짧게 포맷 (MM/DD)
function formatDateShort(date: Date): string {
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${month}/${day}`;
}
