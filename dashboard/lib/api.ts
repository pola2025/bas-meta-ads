import { supabase } from './supabase';
import { DailyTrend, PlatformPerformance, KPISummary, TopAd } from '@/types/analytics';

// 필터 인터페이스
export interface Filters {
  startDate?: string | null;
  endDate?: string | null;
  platforms?: string[];
  campaigns?: string[];
  clientId?: string;
}

// 전체 일별 트렌드 (필터 없이 모든 데이터)
export async function getAllDailyTrend(clientId?: string): Promise<DailyTrend[]> {
  try {
    console.log('📈 getAllDailyTrend called - fetching ALL data, clientId:', clientId);

    // 페이지네이션으로 모든 데이터 가져오기 (Supabase 1000개 제한 우회)
    const allData: any[] = [];
    let offset = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      let query = supabase
        .from('ads_insights_daily')
        .select('date, impressions, clicks, leads, spend, avg_watch_time');

      if (clientId) {
        query = query.eq('client_id', clientId);
      }

      const { data, error } = await query
        .order('date', { ascending: true })
        .range(offset, offset + pageSize - 1);

      if (error) {
        console.error('Error fetching all daily trend:', error);
        return [];
      }

      if (data && data.length > 0) {
        allData.push(...data);
        offset += pageSize;
        hasMore = data.length === pageSize;
      } else {
        hasMore = false;
      }
    }

    console.log('📈 getAllDailyTrend: Total rows:', allData.length);
    const data = allData;

    // 날짜별로 집계
    const aggregated = (data || []).reduce((acc: Record<string, DailyTrend & { _watchTimeSum: number; _watchTimeCount: number }>, row: any) => {
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
          cpl: 0,
          avg_watch_time: 0,
          _watchTimeSum: 0,
          _watchTimeCount: 0
        };
      }
      acc[date].impressions += row.impressions || 0;
      acc[date].clicks += row.clicks || 0;
      acc[date].leads += row.leads || 0;
      acc[date].spend += row.spend || 0;
      if (row.avg_watch_time) {
        acc[date]._watchTimeSum += row.avg_watch_time;
        acc[date]._watchTimeCount += 1;
      }
      return acc;
    }, {});

    // 집계된 데이터에서 비율 계산
    const result = Object.values(aggregated).map((item) => ({
      date: item.date,
      impressions: item.impressions,
      clicks: item.clicks,
      leads: item.leads,
      spend: item.spend,
      ctr: item.impressions > 0 ? (item.clicks / item.impressions) * 100 : 0,
      cvr: item.clicks > 0 ? (item.leads / item.clicks) * 100 : 0,
      cpl: item.leads > 0 ? item.spend / item.leads : 0,
      avg_watch_time: item._watchTimeCount > 0 ? item._watchTimeSum / item._watchTimeCount : 0
    }));

    return result.sort((a, b) => a.date.localeCompare(b.date));
  } catch (error) {
    console.error('Unexpected error in getAllDailyTrend:', error);
    return [];
  }
}

// 일별 트렌드 (필터 적용)
export async function getDailyTrend(filters?: Filters): Promise<DailyTrend[]> {
  try {
    console.log('📈 getDailyTrend called with filters:', JSON.stringify(filters, null, 2));

    let query = supabase
      .from('ads_insights_daily')
      .select('date, impressions, clicks, leads, spend, ctr, cvr, cpl, avg_watch_time');

    // 필터 적용
    if (filters?.clientId) {
      console.log('✅ Applying clientId filter:', filters.clientId);
      query = query.eq('client_id', filters.clientId);
    }
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
      // platform 필터 생략 (daily_aggregates에 컬럼 없음)
    }
    if (filters?.campaigns && filters.campaigns.length > 0) {
      query = query.in('campaign_name', filters.campaigns);
    }

    const { data, error } = await query.order('date', { ascending: true }).range(0, 5000);

    if (error) {
      console.error('Error fetching daily trend:', error);
      return [];
    }

    console.log('📈 getDailyTrend: Rows returned before aggregation:', data?.length || 0);

    // 날짜별로 집계
    const aggregated = (data || []).reduce((acc: Record<string, DailyTrend & { _watchTimeSum: number; _watchTimeCount: number }>, row: any) => {
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
          cpl: 0,
          avg_watch_time: 0,
          _watchTimeSum: 0,
          _watchTimeCount: 0
        };
      }
      acc[date].impressions += row.impressions || 0;
      acc[date].clicks += row.clicks || 0;
      acc[date].leads += row.leads || 0;
      acc[date].spend += row.spend || 0;
      if (row.avg_watch_time) {
        acc[date]._watchTimeSum += row.avg_watch_time;
        acc[date]._watchTimeCount += 1;
      }
      return acc;
    }, {});

    // 집계된 데이터에서 비율 계산
    const result = Object.values(aggregated).map((item) => ({
      date: item.date,
      impressions: item.impressions,
      clicks: item.clicks,
      leads: item.leads,
      spend: item.spend,
      ctr: item.impressions > 0 ? (item.clicks / item.impressions) * 100 : 0,
      cvr: item.clicks > 0 ? (item.leads / item.clicks) * 100 : 0,
      cpl: item.leads > 0 ? item.spend / item.leads : 0,
      avg_watch_time: item._watchTimeCount > 0 ? item._watchTimeSum / item._watchTimeCount : 0
    }));

    return result.sort((a, b) => a.date.localeCompare(b.date));
  } catch (error) {
    console.error('Unexpected error in getDailyTrend:', error);
    return [];
  }
}

// 플랫폼별 성과 (필터 적용) - raw_data에서 직접 조회 (facebook/instagram 구분)
export async function getPlatformPerformance(filters?: Filters): Promise<PlatformPerformance[]> {
  try {
    // raw_data에서 플랫폼별 데이터 조회 (facebook, instagram 구분 가능)
    let query = supabase
      .from('raw_data')
      .select('platform, impressions, clicks, leads, spend');

    // client_id 필터 적용 (필수)
    if (filters?.clientId) {
      query = query.eq('client_id', filters.clientId);
    }

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

    const { data, error } = await query.range(0, 10000);

    if (error) {
      console.error('Error fetching platform performance:', error);
      return [];
    }

    // 플랫폼별로 집계
    const aggregated = (data || []).reduce((acc: Record<string, PlatformPerformance>, row: any) => {
      const platform = row.platform || 'unknown';
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
      .select('impressions, clicks, leads, spend, date, avg_watch_time');

    // 필터 적용
    if (filters?.clientId) {
      console.log('✅ Applying clientId filter:', filters.clientId);
      query = query.eq('client_id', filters.clientId);
    }
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
      // platform 필터 생략 (daily_aggregates에 컬럼 없음)
    }
    if (filters?.campaigns && filters.campaigns.length > 0) {
      console.log('✅ Applying campaign filter:', filters.campaigns);
      query = query.in('campaign_name', filters.campaigns);
    }

    const { data, error } = await query.range(0, 5000);

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

    // 평균 시청시간 계산 (가중 평균)
    const watchTimeData = data.filter(d => d.avg_watch_time && d.avg_watch_time > 0);
    const avg_watch_time = watchTimeData.length > 0
      ? watchTimeData.reduce((sum, d) => sum + (d.avg_watch_time || 0), 0) / watchTimeData.length
      : 0;

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
      avg_watch_time,
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
      avg_watch_time: 0,
      dataPoints: 0
    };
  }
}

// ===== Phase 2 신규 API =====

// 클라이언트 목표값 조회
export interface ClientTargets {
  target_leads: number | null;
  target_spend: number | null;
  target_cpl: number | null;
  target_ctr: number | null;
}

export async function getClientTargets(clientId?: string, month?: string): Promise<ClientTargets | null> {
  try {
    const targetMonth = month || new Date().toISOString().slice(0, 7) + '-01';

    let query = supabase
      .from('client_targets')
      .select('target_leads, target_spend, target_cpl, target_ctr')
      .eq('target_month', targetMonth);

    if (clientId) {
      query = query.eq('client_id', clientId);
    }

    const { data, error } = await query.single();

    if (error) {
      console.log('No targets found for month:', targetMonth);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error fetching client targets:', error);
    return null;
  }
}

// 광고별 누적 통계 조회 (순위, 변동 포함)
export interface AdCumulativeStats {
  ad_id: string;
  ad_name: string;
  campaign_name: string;
  total_leads: number;
  total_spend: number;
  total_impressions?: number;
  total_clicks?: number;
  lifetime_cpl: number | null;
  lifetime_ctr: number | null;
  lifetime_cvr?: number | null;
  cpl_rank: number | null;
  leads_rank: number | null;
  first_seen_date: string;
  last_seen_date: string;
  active_days: number;
}

export async function getAdCumulativeStats(clientId?: string, limit: number = 10): Promise<AdCumulativeStats[]> {
  try {
    let query = supabase
      .from('ad_cumulative_stats')
      .select('*')
      .gt('total_leads', 0)
      .order('lifetime_cpl', { ascending: true, nullsFirst: false })
      .limit(limit);

    if (clientId) {
      query = query.eq('client_id', clientId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching cumulative stats:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Unexpected error in getAdCumulativeStats:', error);
    return [];
  }
}

// 광고별 일별 스냅샷 (순위 변동 추적)
export interface AdDailySnapshot {
  snapshot_date: string;
  ad_id: string;
  cumulative_leads: number;
  cumulative_cpl: number | null;
  cpl_rank: number | null;
  rank_change: number | null;
  leads_change: number | null;
}

export async function getAdDailySnapshots(
  adId: string,
  clientId?: string,
  days: number = 7
): Promise<AdDailySnapshot[]> {
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    let query = supabase
      .from('ad_daily_snapshot')
      .select('*')
      .eq('ad_id', adId)
      .gte('snapshot_date', startDate.toISOString().split('T')[0])
      .order('snapshot_date', { ascending: true });

    if (clientId) {
      query = query.eq('client_id', clientId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching ad snapshots:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Unexpected error in getAdDailySnapshots:', error);
    return [];
  }
}

// KPI 스파크라인용 일별 데이터 (최근 7일)
export async function getKPISparklineData(filters?: Filters): Promise<{
  leads: number[];
  spend: number[];
  cpl: number[];
  ctr: number[];
}> {
  try {
    const trendData = await getDailyTrend(filters);

    // 최근 7일만 추출
    const last7Days = trendData.slice(-7);

    return {
      leads: last7Days.map(d => d.leads),
      spend: last7Days.map(d => d.spend),
      cpl: last7Days.map(d => d.cpl),
      ctr: last7Days.map(d => d.ctr)
    };
  } catch (error) {
    console.error('Error getting sparkline data:', error);
    return { leads: [], spend: [], cpl: [], ctr: [] };
  }
}

// 개별 광고 상세 프로필 조회
export interface AdProfile {
  ad: TopAd;
  cumulative: AdCumulativeStats | null;
  snapshots: AdDailySnapshot[];
  avgCplComparison: {
    avgCpl: number;
    percentDiff: number;
    rank: number | null;
    totalAds: number;
  } | null;
}

export async function getAdProfile(
  adId: string,
  adName: string,
  clientId?: string,
  days: number = 14
): Promise<AdProfile | null> {
  try {
    // 병렬로 데이터 조회
    const [cumulativeData, snapshots, allAds] = await Promise.all([
      getAdCumulativeStats(clientId, 100),
      getAdDailySnapshots(adId || adName, clientId, days),
      getAdCumulativeStats(clientId, 100)  // 전체 광고 평균 계산용
    ]);

    // 해당 광고의 누적 통계 찾기
    const cumulative = cumulativeData.find(
      c => c.ad_id === adId || c.ad_name === adName
    ) || null;

    // 평균 CPL 계산 및 비교
    let avgCplComparison = null;
    if (allAds.length > 0) {
      const adsWithLeads = allAds.filter(a => a.total_leads > 0);
      const avgCpl = adsWithLeads.reduce((sum, a) => sum + (a.lifetime_cpl || 0), 0) / adsWithLeads.length;

      if (cumulative?.lifetime_cpl) {
        avgCplComparison = {
          avgCpl,
          percentDiff: ((cumulative.lifetime_cpl - avgCpl) / avgCpl) * 100,
          rank: cumulative.cpl_rank,
          totalAds: adsWithLeads.length
        };
      }
    }

    // TopAd 형식으로 변환 (cumulative 데이터 기반)
    const ad: TopAd = {
      ad_id: adId,
      ad_name: adName,
      campaign_name: cumulative?.campaign_name || '',
      platform: 'Meta',
      leads: cumulative?.total_leads || 0,
      spend: cumulative?.total_spend || 0,
      clicks: 0,  // 누적 데이터에 없음
      impressions: cumulative?.total_impressions || 0,
      ctr: cumulative?.lifetime_ctr || 0,
      cpc: 0,
      cvr: cumulative?.lifetime_cvr || 0,
      cpl: cumulative?.lifetime_cpl || 0
    };

    return {
      ad,
      cumulative,
      snapshots,
      avgCplComparison
    };
  } catch (error) {
    console.error('Error fetching ad profile:', error);
    return null;
  }
}

// 광고별 일별 데이터 조회 (기간 필터 적용)
export async function getAdDailyData(
  adName: string,
  filters?: Filters
): Promise<{date: string; leads: number; spend: number; cpl: number; ctr: number}[]> {
  try {
    console.log('📊 getAdDailyData called:', { adName, filters });

    let query = supabase
      .from('ads_insights_daily')
      .select('date, leads, spend, clicks, impressions')
      .eq('ad_name', adName);

    // ⚠️ 클라이언트별 데이터 분리 - 필수!
    if (filters?.clientId) {
      query = query.eq('client_id', filters.clientId);
    }

    if (filters?.startDate) {
      query = query.gte('date', filters.startDate);
    }
    if (filters?.endDate) {
      query = query.lte('date', filters.endDate);
    }

    const { data, error } = await query.order('date', { ascending: true });

    if (error) {
      console.error('Error fetching ad daily data:', error);
      return [];
    }

    console.log('📊 getAdDailyData result:', data?.length || 0, 'rows');

    // 날짜별로 집계 (같은 날짜에 여러 레코드가 있을 수 있음)
    const aggregated = (data || []).reduce((acc: Record<string, any>, row: any) => {
      const date = row.date;
      if (!acc[date]) {
        acc[date] = {
          date,
          leads: 0,
          spend: 0,
          clicks: 0,
          impressions: 0
        };
      }
      acc[date].leads += row.leads || 0;
      acc[date].spend += row.spend || 0;
      acc[date].clicks += row.clicks || 0;
      acc[date].impressions += row.impressions || 0;
      return acc;
    }, {});

    return Object.values(aggregated)
      .sort((a: any, b: any) => a.date.localeCompare(b.date))
      .map((row: any) => ({
        date: row.date,
        leads: row.leads,
        spend: row.spend,
        cpl: row.leads > 0 ? row.spend / row.leads : 0,
        ctr: row.impressions > 0 ? (row.clicks / row.impressions) * 100 : 0
      }));
  } catch (error) {
    console.error('Unexpected error in getAdDailyData:', error);
    return [];
  }
}

// Top 광고 (필터 적용)
export async function getTopAds(filters?: Filters, limit: number = 10): Promise<TopAd[]> {
  try {
    let query = supabase
      .from('ads_insights_daily')
      .select('ad_name, campaign_name, platform, leads, spend, clicks, impressions, avg_watch_time');

    // 필터 적용
    if (filters?.clientId) {
      query = query.eq('client_id', filters.clientId);
    }
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

    const { data, error } = await query.range(0, 5000);

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
          cpl: 0,
          _watchTimeSum: 0,
          _watchTimeCount: 0
        };
      }
      acc[key].leads += row.leads || 0;
      acc[key].spend += row.spend || 0;
      acc[key].clicks += row.clicks || 0;
      acc[key].impressions += row.impressions || 0;
      if (row.avg_watch_time) {
        acc[key]._watchTimeSum += row.avg_watch_time;
        acc[key]._watchTimeCount += 1;
      }
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
      cpl: item.leads > 0 ? item.spend / item.leads : 0,
      avg_watch_time: item._watchTimeCount > 0 ? item._watchTimeSum / item._watchTimeCount : 0
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

// 전체 광고 목록 (활성/비활성 상태 포함)
export interface AdWithStatus extends TopAd {
  isActive: boolean;
  lastActiveDate: string;
  firstActiveDate: string;
}

export async function getAllAdsWithStatus(clientId?: string): Promise<AdWithStatus[]> {
  try {
    // 모든 광고 데이터 조회 (날짜 포함)
    let query = supabase
      .from('ads_insights_daily')
      .select('ad_name, campaign_name, platform, leads, spend, clicks, impressions, date, avg_watch_time')
      .order('date', { ascending: false })
      .range(0, 5000);

    // ⚠️ 클라이언트별 데이터 분리 - 필수!
    if (clientId) {
      query = query.eq('client_id', clientId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching all ads:', error);
      return [];
    }

    // 오늘 날짜 (활성 판단 기준: 최근 3일 이내 데이터 있으면 활성)
    const today = new Date();
    const threeDaysAgo = new Date(today);
    threeDaysAgo.setDate(today.getDate() - 3);
    const threeDaysAgoStr = threeDaysAgo.toISOString().split('T')[0];

    // 광고별로 집계
    const aggregated = (data || []).reduce((acc: Record<string, any>, row: any) => {
      const key = row.ad_name;
      if (!acc[key]) {
        acc[key] = {
          ad_id: key,
          ad_name: row.ad_name,
          campaign_name: row.campaign_name,
          platform: row.platform,
          leads: 0,
          spend: 0,
          clicks: 0,
          impressions: 0,
          lastActiveDate: row.date,
          firstActiveDate: row.date,
          _watchTimeSum: 0,
          _watchTimeCount: 0
        };
      }
      acc[key].leads += row.leads || 0;
      acc[key].spend += row.spend || 0;
      acc[key].clicks += row.clicks || 0;
      acc[key].impressions += row.impressions || 0;
      if (row.avg_watch_time) {
        acc[key]._watchTimeSum += row.avg_watch_time;
        acc[key]._watchTimeCount += 1;
      }
      // 날짜 업데이트
      if (row.date > acc[key].lastActiveDate) acc[key].lastActiveDate = row.date;
      if (row.date < acc[key].firstActiveDate) acc[key].firstActiveDate = row.date;
      return acc;
    }, {});

    // 집계된 데이터에서 비율 계산 및 활성 상태 판단
    const result: AdWithStatus[] = Object.values(aggregated).map((item: any) => ({
      ad_id: item.ad_id,
      ad_name: item.ad_name,
      campaign_name: item.campaign_name,
      platform: item.platform || 'Meta',
      leads: item.leads,
      spend: item.spend,
      clicks: item.clicks,
      impressions: item.impressions,
      ctr: item.impressions > 0 ? (item.clicks / item.impressions) * 100 : 0,
      cpc: item.clicks > 0 ? item.spend / item.clicks : 0,
      cvr: item.clicks > 0 ? (item.leads / item.clicks) * 100 : 0,
      cpl: item.leads > 0 ? item.spend / item.leads : 0,
      avg_watch_time: item._watchTimeCount > 0 ? item._watchTimeSum / item._watchTimeCount : 0,
      isActive: item.lastActiveDate >= threeDaysAgoStr,
      lastActiveDate: item.lastActiveDate,
      firstActiveDate: item.firstActiveDate
    }));

    // 활성 광고 먼저, 그 다음 리드 순 정렬
    return result.sort((a, b) => {
      if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
      return b.leads - a.leads;
    });
  } catch (error) {
    console.error('Unexpected error in getAllAdsWithStatus:', error);
    return [];
  }
}

// 마지막 데이터 수집일 조회
export async function getLastDataCollectionDate(clientId?: string): Promise<string | null> {
  try {
    let query = supabase
      .from('raw_data')
      .select('date')
      .order('date', { ascending: false })
      .limit(1);

    if (clientId) {
      query = query.eq('client_id', clientId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching last collection date:', error);
      return null;
    }

    return data && data.length > 0 ? data[0].date : null;
  } catch (error) {
    console.error('Unexpected error in getLastDataCollectionDate:', error);
    return null;
  }
}
