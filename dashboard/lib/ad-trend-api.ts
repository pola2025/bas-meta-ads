import { supabase } from './supabase';
import { Filters } from './api';

// 특정 광고의 일별 추이 데이터
export async function getAdDailyTrend(
  adName: string,
  filters?: Filters
): Promise<Array<{ date: string; leads: number; spend: number; cpl: number }>> {
  try {
    let query = supabase
      .from('ads_insights_daily')
      .select('date, leads, spend')
      .eq('ad_name', adName);

    // 필터 적용
    if (filters?.startDate) {
      query = query.gte('date', filters.startDate);
    }
    if (filters?.endDate) {
      query = query.lte('date', filters.endDate);
    }
    if (filters?.platforms && filters.platforms.length > 0) {
      query = query.in('platform', filters.platforms);
    }
    if (filters?.campaigns && filters.campaigns.length > 0) {
      query = query.in('campaign_name', filters.campaigns);
    }

    const { data, error } = await query.order('date', { ascending: true });

    if (error) {
      console.error('Error fetching ad daily trend:', error);
      return [];
    }

    // 날짜별로 집계
    const aggregated = (data || []).reduce((acc: Record<string, any>, row: any) => {
      const date = row.date;
      if (!acc[date]) {
        acc[date] = {
          date,
          leads: 0,
          spend: 0
        };
      }
      acc[date].leads += row.leads || 0;
      acc[date].spend += row.spend || 0;
      return acc;
    }, {});

    // CPL 계산
    const result = Object.values(aggregated).map((item: any) => ({
      date: item.date,
      leads: item.leads,
      spend: item.spend,
      cpl: item.leads > 0 ? item.spend / item.leads : 0
    }));

    return result.sort((a, b) => a.date.localeCompare(b.date));
  } catch (error) {
    console.error('Unexpected error in getAdDailyTrend:', error);
    return [];
  }
}
