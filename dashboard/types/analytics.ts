// 일별 트렌드
export interface DailyTrend {
  date: string;
  impressions: number;
  clicks: number;
  leads: number;
  spend: number;
  ctr: number;
  cvr: number;
  cpl: number;
}

// 플랫폼별 성과
export interface PlatformPerformance {
  platform: string;
  impressions: number;
  clicks: number;
  leads: number;
  spend: number;
  ctr: number;
  cvr: number;
  cpl: number;
  percentage: number;
}

// KPI 요약
export interface KPISummary {
  total_leads: number;
  total_spend: number;
  avg_cpl: number;
  avg_ctr: number;
  total_impressions: number;
  total_clicks: number;
  avg_cvr: number;
  dataPoints?: number; // 실제 조회된 행 수
}

// Top 광고
export interface TopAd {
  ad_id: string;
  ad_name: string;
  campaign_name: string;
  platform: string;
  leads: number;
  spend: number;
  cpl: number;
  clicks: number;
  ctr: number;
  cpc: number;
  cvr: number;
  impressions: number;
}

// 필터
export interface Filters {
  startDate?: string | null;
  endDate?: string | null;
  platforms?: string[];
  campaigns?: string[];
}
