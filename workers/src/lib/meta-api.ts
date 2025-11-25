import type { Env } from '../types';

// Meta Graph API Insights 데이터 구조
export interface MetaInsight {
  ad_id: string;
  ad_name: string;
  campaign_id: string;
  campaign_name: string;
  date_start: string;
  date_stop: string;
  impressions: string;
  clicks: string;
  spend: string;
  actions?: Array<{
    action_type: string;
    value: string;
  }>;
}

// Daily Aggregate 데이터 구조
export interface DailyAggregate {
  date: string;
  ad_id: string;
  ad_name: string;
  campaign_id: string;
  campaign_name: string;
  impressions: number;
  clicks: number;
  spend: number;
  leads: number;
}

/**
 * Meta Graph API에서 Insights 데이터 조회
 * @param env - 환경변수
 * @param startDate - 시작일 (YYYY-MM-DD)
 * @param endDate - 종료일 (YYYY-MM-DD)
 * @returns Meta Insights 데이터 배열
 */
export async function fetchMetaInsights(
  env: Env,
  startDate: string,
  endDate: string
): Promise<MetaInsight[]> {
  const url = `https://graph.facebook.com/v21.0/${env.META_AD_ACCOUNT_ID}/insights`;

  const params = new URLSearchParams({
    access_token: env.META_ACCESS_TOKEN,
    level: 'ad',
    time_range: JSON.stringify({ since: startDate, until: endDate }),
    fields: 'ad_id,ad_name,campaign_id,campaign_name,impressions,clicks,spend,actions',
    time_increment: '1', // 일별 데이터
    limit: '1000', // 페이지당 최대 1000개
  });

  console.log(`📞 Meta API 호출: ${startDate} ~ ${endDate}`);

  try {
    const response = await fetch(`${url}?${params}`);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Meta API Error (${response.status}): ${errorText}`);
    }

    const result = await response.json();
    const data = result.data || [];

    console.log(`✅ Meta API 응답: ${data.length}건`);
    return data;
  } catch (error) {
    console.error('❌ Meta API 호출 실패:', error);
    throw error;
  }
}

/**
 * actions 배열에서 리드 수 추출
 * @param actions - Meta API actions 배열
 * @returns 리드 수
 */
function extractLeads(actions?: Array<{ action_type: string; value: string }>): number {
  if (!actions || actions.length === 0) return 0;

  const leadAction = actions.find((a) => a.action_type === 'lead');
  return leadAction ? parseInt(leadAction.value, 10) : 0;
}

/**
 * Meta Insights 데이터를 daily_aggregates 형식으로 변환
 * @param insightsData - Meta API에서 받은 Insights 데이터
 * @returns DailyAggregate 배열
 */
export function transformMetaData(insightsData: MetaInsight[]): DailyAggregate[] {
  console.log(`🔄 데이터 변환 시작: ${insightsData.length}건`);

  const transformed = insightsData.map((row) => ({
    date: row.date_start,
    ad_id: row.ad_id,
    ad_name: row.ad_name,
    campaign_id: row.campaign_id,
    campaign_name: row.campaign_name,
    impressions: parseInt(row.impressions, 10) || 0,
    clicks: parseInt(row.clicks, 10) || 0,
    spend: parseFloat(row.spend) || 0,
    leads: extractLeads(row.actions),
  }));

  // 통계 출력
  const totalLeads = transformed.reduce((sum, item) => sum + item.leads, 0);
  const totalSpend = transformed.reduce((sum, item) => sum + item.spend, 0);
  console.log(`✅ 변환 완료: 리드 ${totalLeads}건, 지출 ₩${totalSpend.toLocaleString()}`);

  return transformed;
}

/**
 * Meta API에서 데이터 수집 및 변환 (통합 함수)
 * @param env - 환경변수
 * @param startDate - 시작일
 * @param endDate - 종료일
 * @returns DailyAggregate 배열
 */
export async function collectMetaData(
  env: Env,
  startDate: string,
  endDate: string
): Promise<DailyAggregate[]> {
  console.log(`🚀 Meta 데이터 수집 시작: ${startDate} ~ ${endDate}`);

  // 1. Meta API 호출
  const insights = await fetchMetaInsights(env, startDate, endDate);

  if (insights.length === 0) {
    console.warn('⚠️ Meta API에서 데이터를 가져올 수 없습니다');
    return [];
  }

  // 2. 데이터 변환
  const aggregates = transformMetaData(insights);

  return aggregates;
}
