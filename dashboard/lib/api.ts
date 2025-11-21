import { supabase } from './supabase';
import { DailyTrend, PlatformPerformance, KPISummary, TopAd } from '@/types/analytics';

// 필터 인터페이스
export interface Filters {
  startDate?: string | null;
  endDate?: string | null;
  platforms?: string[];
  campaigns?: string[];
}

// 일별 트렌드 (필터 적용)
export async function getDailyTrend(filters?: Filters): Promise<DailyTrend[]> {
  try {
    console.log('📈 getDailyTrend called with filters:', JSON.stringify(filters, null, 2));

    let query = supabase
      .from('ads_insights_daily')
      .select('date, impressions, clicks, leads, spend, ctr, cvr, cpl');

    // 필터 적용
    if (filters?.startDate) {
      console.log('✅ Applying startDate filter:', filters.startDate);
      query = query.gte('date', filters.startDate);
    } else {
      console.warn('⚠️ getDailyTrend: No startDate filter!');
    }
    if (filters?.endDate) {
      console.log('✅ Applying endDate filter:', filters.endDate);
      query = query.lte('date', filters.endDate);
    } else {
      console.warn('⚠️ getDailyTrend: No endDate filter!');
    }
    if (filters?.platforms && filters.platforms.length > 0) {
      query = query.in('platform', filters.platforms);
    }
    if (filters?.campaigns && filters.campaigns.length > 0) {
      query = query.in('campaign_name', filters.campaigns);
    }

    const { data, error } = await query.order('date', { ascending: true });

    if (error) {
      console.error('Error fetching daily trend:', error);
      return [];
    }

    console.log('📈 getDailyTrend: Rows returned before aggregation:', data?.length || 0);

    // 날짜별로 집계
    const aggregated = (data || []).reduce((acc: Record<string, DailyTrend>, row: any) => {
      const date = row.date;
      if (!acc[date]) {
        acc[date] = {
          date,
          impressions: 0,
          clicks: 0,
          leads: 0,
          spend: 0,
          ctr: 0,
          cvr: 0,
          cpl: 0
        };
      }
      acc[date].impressions += row.impressions || 0;
      acc[date].clicks += row.clicks || 0;
      acc[date].leads += row.leads || 0;
      acc[date].spend += row.spend || 0;
      return acc;
    }, {});

    // 집계된 데이터에서 비율 계산
    const result = Object.values(aggregated).map((item) => ({
      ...item,
      ctr: item.impressions > 0 ? (item.clicks / item.impressions) * 100 : 0,
      cvr: item.clicks > 0 ? (item.leads / item.clicks) * 100 : 0,
      cpl: item.leads > 0 ? item.spend / item.leads : 0
    }));

    return result.sort((a, b) => a.date.localeCompare(b.date));
  } catch (error) {
    console.error('Unexpected error in getDailyTrend:', error);
    return [];
  }
}

// 플랫폼별 성과 (필터 적용)
export async function getPlatformPerformance(filters?: Filters): Promise<PlatformPerformance[]> {
  try {
    let query = supabase
      .from('ads_insights_daily')
      .select('platform, impressions, clicks, leads, spend');

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

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching platform performance:', error);
      return [];
    }

    // 플랫폼별로 집계
    const aggregated = (data || []).reduce((acc: Record<string, PlatformPerformance>, row: any) => {
      const platform = row.platform;
      if (!acc[platform]) {
        acc[platform] = {
          platform,
          impressions: 0,
          clicks: 0,
          leads: 0,
          spend: 0,
          ctr: 0,
          cvr: 0,
          cpl: 0,
          percentage: 0
        };
      }
      acc[platform].impressions += row.impressions || 0;
      acc[platform].clicks += row.clicks || 0;
      acc[platform].leads += row.leads || 0;
      acc[platform].spend += row.spend || 0;
      return acc;
    }, {});

    // 집계된 데이터에서 비율 계산
    const result = Object.values(aggregated).map((item) => ({
      ...item,
      ctr: item.impressions > 0 ? (item.clicks / item.impressions) * 100 : 0,
      cvr: item.clicks > 0 ? (item.leads / item.clicks) * 100 : 0,
      cpl: item.leads > 0 ? item.spend / item.leads : 0
    }));

    return result.sort((a, b) => b.spend - a.spend);
  } catch (error) {
    console.error('Unexpected error in getPlatformPerformance:', error);
    return [];
  }
}

// KPI 요약 (필터 적용)
export async function getKPISummary(filters?: Filters): Promise<KPISummary> {
  try {
    // 🔍 DEBUG: 필터 정보 로깅
    console.log('📊 getKPISummary called with filters:', JSON.stringify(filters, null, 2));

    let query = supabase
      .from('ads_insights_daily')
      .select('impressions, clicks, leads, spend, date');

    // 필터 적용
    if (filters?.startDate) {
      console.log('✅ Applying startDate filter:', filters.startDate);
      query = query.gte('date', filters.startDate);
    } else {
      console.warn('⚠️ No startDate filter applied - will return ALL data!');
    }
    if (filters?.endDate) {
      console.log('✅ Applying endDate filter:', filters.endDate);
      query = query.lte('date', filters.endDate);
    } else {
      console.warn('⚠️ No endDate filter applied - will return ALL data!');
    }
    if (filters?.platforms && filters.platforms.length > 0) {
      console.log('✅ Applying platform filter:', filters.platforms);
      query = query.in('platform', filters.platforms);
    }
    if (filters?.campaigns && filters.campaigns.length > 0) {
      console.log('✅ Applying campaign filter:', filters.campaigns);
      query = query.in('campaign_name', filters.campaigns);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching KPI summary:', error);
      return {
        total_leads: 0,
        total_spend: 0,
        avg_cpl: 0,
        avg_ctr: 0,
        total_impressions: 0,
        total_clicks: 0,
        avg_cvr: 0,
        dataPoints: 0
      };
    }

    if (!data || data.length === 0) {
      console.log('📭 No data returned from query');
      return {
        total_leads: 0,
        total_spend: 0,
        avg_cpl: 0,
        avg_ctr: 0,
        total_impressions: 0,
        total_clicks: 0,
        avg_cvr: 0,
        dataPoints: 0
      };
    }

    // 🔍 DEBUG: 반환된 데이터 분석
    console.log('📈 Rows returned:', data.length);

    // 날짜 범위 확인
    const dates = data.map(d => d.date).filter(Boolean).sort();
    if (dates.length > 0) {
      console.log('📅 Date range in returned data:', dates[0], '~', dates[dates.length - 1]);
    }

    // 집계 계산
    const total_impressions = data.reduce((sum, d) => sum + (d.impressions || 0), 0);
    const total_clicks = data.reduce((sum, d) => sum + (d.clicks || 0), 0);
    const total_leads = data.reduce((sum, d) => sum + (d.leads || 0), 0);
    const total_spend = data.reduce((sum, d) => sum + (d.spend || 0), 0);

    // 🔍 DEBUG: 집계 결과
    console.log('💰 Total spend:', total_spend);
    console.log('🎯 Total leads:', total_leads);
    console.log('👁️ Total impressions:', total_impressions);

    return {
      total_leads,
      total_spend,
      avg_cpl: total_leads > 0 ? total_spend / total_leads : 0,
      avg_ctr: total_impressions > 0 ? (total_clicks / total_impressions) * 100 : 0,
      total_impressions,
      total_clicks,
      avg_cvr: total_clicks > 0 ? (total_leads / total_clicks) * 100 : 0,
      dataPoints: data.length
    };
  } catch (error) {
    console.error('Unexpected error in getKPISummary:', error);
    return {
      total_leads: 0,
      total_spend: 0,
      avg_cpl: 0,
      avg_ctr: 0,
      total_impressions: 0,
      total_clicks: 0,
      avg_cvr: 0,
      dataPoints: 0
    };
  }
}

// Top 광고 (필터 적용)
export async function getTopAds(filters?: Filters, limit: number = 10): Promise<TopAd[]> {
  try {
    let query = supabase
      .from('ads_insights_daily')
      .select('ad_name, campaign_name, leads, spend, clicks, impressions');

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

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching top ads:', error);
      return [];
    }

    // 광고별로 집계 (impressions 포함)
    const aggregated = (data || []).reduce((acc: Record<string, any>, row: any) => {
      const key = `${row.ad_name}_${row.campaign_name}`;
      if (!acc[key]) {
        acc[key] = {
          ad_id: row.ad_id || key,
          ad_name: row.ad_name,
          campaign_name: row.campaign_name,
          platform: row.platform,
          leads: 0,
          spend: 0,
          clicks: 0,
          impressions: 0,
          ctr: 0,
          cpl: 0
        };
      }
      acc[key].leads += row.leads || 0;
      acc[key].spend += row.spend || 0;
      acc[key].clicks += row.clicks || 0;
      acc[key].impressions += row.impressions || 0;
      return acc;
    }, {});

    // 집계된 데이터에서 비율 계산
    const result: TopAd[] = Object.values(aggregated).map((item: any) => ({
      ad_id: item.ad_id,
      ad_name: item.ad_name,
      campaign_name: item.campaign_name,
      platform: item.platform || 'Unknown',
      leads: item.leads,
      spend: item.spend,
      clicks: item.clicks,
      impressions: item.impressions,
      ctr: item.impressions > 0 ? (item.clicks / item.impressions) * 100 : 0,
      cpc: item.clicks > 0 ? item.spend / item.clicks : 0,
      cvr: item.clicks > 0 ? (item.leads / item.clicks) * 100 : 0,
      cpl: item.leads > 0 ? item.spend / item.leads : 0
    }));

    // leads 기준 내림차순 정렬 후 limit 적용
    return result
      .sort((a, b) => b.leads - a.leads)
      .slice(0, limit);
  } catch (error) {
    console.error('Unexpected error in getTopAds:', error);
    return [];
  }
}
