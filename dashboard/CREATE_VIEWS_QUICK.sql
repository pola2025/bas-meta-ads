-- ============================================================================
-- Supabase 분석 뷰 빠른 생성 스크립트
-- ============================================================================
-- Supabase SQL Editor에 붙여넣고 실행하세요
-- ============================================================================

-- 1. 최근 7일 일별 트렌드 (대시보드 메인 차트용)
CREATE OR REPLACE VIEW v_daily_trend_7d AS
SELECT
  date,
  SUM(impressions) as impressions,
  SUM(reach) as reach,
  SUM(clicks) as clicks,
  SUM(leads) as leads,
  SUM(spend) as spend,
  ROUND((SUM(clicks)::DECIMAL / NULLIF(SUM(impressions), 0) * 100), 2) as ctr,
  ROUND((SUM(leads)::DECIMAL / NULLIF(SUM(clicks), 0) * 100), 2) as cvr,
  ROUND((SUM(spend) / NULLIF(SUM(leads), 0)), 0) as cpl
FROM raw_data
WHERE date >= CURRENT_DATE - INTERVAL '7 days'
  AND date < CURRENT_DATE
GROUP BY date
ORDER BY date;

-- 2. 플랫폼별 성과 (최근 30일)
CREATE OR REPLACE VIEW v_platform_performance_30d AS
SELECT
  platform,
  SUM(impressions) as impressions,
  SUM(reach) as reach,
  SUM(clicks) as clicks,
  SUM(leads) as leads,
  SUM(spend) as spend,
  ROUND((SUM(clicks)::DECIMAL / NULLIF(SUM(impressions), 0) * 100), 2) as ctr,
  ROUND((SUM(leads)::DECIMAL / NULLIF(SUM(clicks), 0) * 100), 2) as cvr,
  ROUND((SUM(spend) / NULLIF(SUM(leads), 0)), 0) as cpl
FROM raw_data
WHERE date >= CURRENT_DATE - INTERVAL '30 days'
  AND date < CURRENT_DATE
GROUP BY platform
ORDER BY spend DESC;

-- 3. Top 10 광고 (리드 많은 순, 최근 7일)
CREATE OR REPLACE VIEW v_top_ads_7d AS
SELECT
  ad_name,
  campaign_name,
  SUM(impressions) as impressions,
  SUM(clicks) as clicks,
  SUM(leads) as leads,
  SUM(spend) as spend,
  ROUND((SUM(clicks)::DECIMAL / NULLIF(SUM(impressions), 0) * 100), 2) as ctr,
  ROUND((SUM(spend) / NULLIF(SUM(leads), 0)), 0) as cpl
FROM raw_data
WHERE date >= CURRENT_DATE - INTERVAL '7 days'
  AND date < CURRENT_DATE
  AND leads > 0
GROUP BY ad_name, campaign_name
ORDER BY leads DESC
LIMIT 10;

-- ============================================================================
-- 생성 확인
-- ============================================================================
SELECT viewname
FROM pg_views
WHERE schemaname = 'public'
AND viewname IN ('v_daily_trend_7d', 'v_platform_performance_30d', 'v_top_ads_7d')
ORDER BY viewname;
