-- ============================================================================
-- ads_insights_daily 뷰 생성
-- ============================================================================
-- 목적: 대시보드 API에서 사용하는 일별 집계 뷰
-- 테이블: raw_data
-- ============================================================================

CREATE OR REPLACE VIEW ads_insights_daily AS
SELECT
  date,
  platform,
  campaign_name,
  ad_name,
  SUM(impressions) as impressions,
  SUM(reach) as reach,
  SUM(clicks) as clicks,
  SUM(leads) as leads,
  SUM(spend) as spend,
  SUM(video_views) as video_views,
  AVG(avg_watch_time) as avg_watch_time,
  -- KPI 계산
  CASE
    WHEN SUM(impressions) > 0 THEN ROUND((SUM(clicks)::DECIMAL / SUM(impressions) * 100), 2)
    ELSE 0
  END as ctr,
  CASE
    WHEN SUM(clicks) > 0 THEN ROUND((SUM(leads)::DECIMAL / SUM(clicks) * 100), 2)
    ELSE 0
  END as cvr,
  CASE
    WHEN SUM(leads) > 0 THEN ROUND((SUM(spend) / SUM(leads)), 2)
    ELSE 0
  END as cpl,
  CASE
    WHEN SUM(clicks) > 0 THEN ROUND((SUM(spend) / SUM(clicks)), 2)
    ELSE 0
  END as cpc,
  CASE
    WHEN SUM(impressions) > 0 THEN ROUND((SUM(spend) / SUM(impressions) * 1000), 2)
    ELSE 0
  END as cpm
FROM raw_data
GROUP BY date, platform, campaign_name, ad_name
ORDER BY date DESC, spend DESC;

COMMENT ON VIEW ads_insights_daily IS '일별 광고 성과 집계 뷰 (대시보드용)';

-- 인덱스 확인 (raw_data 테이블)
CREATE INDEX IF NOT EXISTS idx_raw_data_date ON raw_data(date DESC);
CREATE INDEX IF NOT EXISTS idx_raw_data_platform ON raw_data(platform);
CREATE INDEX IF NOT EXISTS idx_raw_data_campaign_name ON raw_data(campaign_name);
CREATE INDEX IF NOT EXISTS idx_raw_data_ad_name ON raw_data(ad_name);
