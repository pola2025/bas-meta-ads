-- ============================================================================
-- 분석용 뷰 및 함수 (오늘의 성과 제외)
-- ============================================================================
-- 작성일: 2025-11-19
-- 목적: Meta 광고 데이터 분석을 위한 SQL 뷰 및 함수
-- ============================================================================

-- ============================================================================
-- 1. 최근 7일 일별 트렌드
-- ============================================================================
CREATE OR REPLACE VIEW v_daily_trend_7d AS
SELECT
  date,
  SUM(impressions) as impressions,
  SUM(reach) as reach,
  SUM(clicks) as clicks,
  SUM(leads) as leads,
  SUM(spend) as spend,
  SUM(video_views) as video_views,
  -- KPI 계산
  ROUND((SUM(clicks)::DECIMAL / NULLIF(SUM(impressions), 0) * 100), 2) as ctr,
  ROUND((SUM(leads)::DECIMAL / NULLIF(SUM(clicks), 0) * 100), 2) as cvr,
  ROUND((SUM(spend) / NULLIF(SUM(leads), 0)), 0) as cpl,
  ROUND((SUM(spend) / NULLIF(SUM(clicks), 0)), 0) as cpc,
  ROUND((SUM(spend) / NULLIF(SUM(impressions), 0) * 1000), 0) as cpm,
  ROUND((SUM(impressions)::DECIMAL / NULLIF(SUM(reach), 0)), 2) as frequency
FROM raw_data
WHERE date >= CURRENT_DATE - INTERVAL '7 days'
  AND date < CURRENT_DATE
GROUP BY date
ORDER BY date;

COMMENT ON VIEW v_daily_trend_7d IS '최근 7일 일별 성과 트렌드 (오늘 제외)';

-- ============================================================================
-- 2. 최근 30일 일별 트렌드
-- ============================================================================
CREATE OR REPLACE VIEW v_daily_trend_30d AS
SELECT
  date,
  SUM(impressions) as impressions,
  SUM(reach) as reach,
  SUM(clicks) as clicks,
  SUM(leads) as leads,
  SUM(spend) as spend,
  SUM(video_views) as video_views,
  -- KPI 계산
  ROUND((SUM(clicks)::DECIMAL / NULLIF(SUM(impressions), 0) * 100), 2) as ctr,
  ROUND((SUM(leads)::DECIMAL / NULLIF(SUM(clicks), 0) * 100), 2) as cvr,
  ROUND((SUM(spend) / NULLIF(SUM(leads), 0)), 0) as cpl,
  ROUND((SUM(spend) / NULLIF(SUM(clicks), 0)), 0) as cpc,
  ROUND((SUM(spend) / NULLIF(SUM(impressions), 0) * 1000), 0) as cpm,
  ROUND((SUM(impressions)::DECIMAL / NULLIF(SUM(reach), 0)), 2) as frequency
FROM raw_data
WHERE date >= CURRENT_DATE - INTERVAL '30 days'
  AND date < CURRENT_DATE
GROUP BY date
ORDER BY date;

COMMENT ON VIEW v_daily_trend_30d IS '최근 30일 일별 성과 트렌드 (오늘 제외)';

-- ============================================================================
-- 3. 플랫폼별 비교 (최근 30일)
-- ============================================================================
CREATE OR REPLACE VIEW v_platform_performance_30d AS
SELECT
  platform,
  SUM(impressions) as impressions,
  SUM(reach) as reach,
  SUM(clicks) as clicks,
  SUM(leads) as leads,
  SUM(spend) as spend,
  SUM(video_views) as video_views,
  -- KPI 계산
  ROUND((SUM(clicks)::DECIMAL / NULLIF(SUM(impressions), 0) * 100), 2) as ctr,
  ROUND((SUM(leads)::DECIMAL / NULLIF(SUM(clicks), 0) * 100), 2) as cvr,
  ROUND((SUM(spend) / NULLIF(SUM(leads), 0)), 0) as cpl,
  ROUND((SUM(spend) / NULLIF(SUM(clicks), 0)), 0) as cpc,
  ROUND((SUM(spend) / NULLIF(SUM(impressions), 0) * 1000), 0) as cpm,
  -- 비중 계산
  ROUND((SUM(spend)::DECIMAL / NULLIF(SUM(SUM(spend)) OVER (), 0) * 100), 1) as spend_share,
  ROUND((SUM(leads)::DECIMAL / NULLIF(SUM(SUM(leads)) OVER (), 0) * 100), 1) as lead_share
FROM raw_data
WHERE date >= CURRENT_DATE - INTERVAL '30 days'
  AND date < CURRENT_DATE
GROUP BY platform
ORDER BY spend DESC;

COMMENT ON VIEW v_platform_performance_30d IS '플랫폼별 성과 비교 (최근 30일)';

-- ============================================================================
-- 4. 디바이스별 비교 (최근 30일)
-- ============================================================================
CREATE OR REPLACE VIEW v_device_performance_30d AS
SELECT
  device,
  SUM(impressions) as impressions,
  SUM(reach) as reach,
  SUM(clicks) as clicks,
  SUM(leads) as leads,
  SUM(spend) as spend,
  SUM(video_views) as video_views,
  -- KPI 계산
  ROUND((SUM(clicks)::DECIMAL / NULLIF(SUM(impressions), 0) * 100), 2) as ctr,
  ROUND((SUM(leads)::DECIMAL / NULLIF(SUM(clicks), 0) * 100), 2) as cvr,
  ROUND((SUM(spend) / NULLIF(SUM(leads), 0)), 0) as cpl,
  ROUND((SUM(spend) / NULLIF(SUM(clicks), 0)), 0) as cpc,
  ROUND((SUM(spend) / NULLIF(SUM(impressions), 0) * 1000), 0) as cpm,
  -- 비중 계산
  ROUND((SUM(spend)::DECIMAL / NULLIF(SUM(SUM(spend)) OVER (), 0) * 100), 1) as spend_share,
  ROUND((SUM(leads)::DECIMAL / NULLIF(SUM(SUM(leads)) OVER (), 0) * 100), 1) as lead_share
FROM raw_data
WHERE date >= CURRENT_DATE - INTERVAL '30 days'
  AND date < CURRENT_DATE
GROUP BY device
ORDER BY spend DESC;

COMMENT ON VIEW v_device_performance_30d IS '디바이스별 성과 비교 (최근 30일)';

-- ============================================================================
-- 5. Top 10 캠페인 (CPL 낮은 순, 최근 30일)
-- ============================================================================
CREATE OR REPLACE VIEW v_top_campaigns_30d AS
SELECT
  campaign_name,
  COUNT(DISTINCT ad_id) as ad_count,
  SUM(impressions) as impressions,
  SUM(reach) as reach,
  SUM(clicks) as clicks,
  SUM(leads) as leads,
  SUM(spend) as spend,
  SUM(video_views) as video_views,
  -- KPI 계산
  ROUND((SUM(clicks)::DECIMAL / NULLIF(SUM(impressions), 0) * 100), 2) as ctr,
  ROUND((SUM(leads)::DECIMAL / NULLIF(SUM(clicks), 0) * 100), 2) as cvr,
  ROUND((SUM(spend) / NULLIF(SUM(leads), 0)), 0) as cpl,
  ROUND((SUM(spend) / NULLIF(SUM(clicks), 0)), 0) as cpc
FROM raw_data
WHERE date >= CURRENT_DATE - INTERVAL '30 days'
  AND date < CURRENT_DATE
  AND leads > 0
GROUP BY campaign_name
ORDER BY cpl ASC
LIMIT 10;

COMMENT ON VIEW v_top_campaigns_30d IS 'Top 10 캠페인 (CPL 낮은 순, 최근 30일)';

-- ============================================================================
-- 6. Top 10 광고 (리드 많은 순, 최근 7일)
-- ============================================================================
CREATE OR REPLACE VIEW v_top_ads_7d AS
SELECT
  ad_name,
  campaign_name,
  SUM(impressions) as impressions,
  SUM(reach) as reach,
  SUM(clicks) as clicks,
  SUM(leads) as leads,
  SUM(spend) as spend,
  SUM(video_views) as video_views,
  AVG(avg_watch_time) as avg_watch_time,
  -- KPI 계산
  ROUND((SUM(clicks)::DECIMAL / NULLIF(SUM(impressions), 0) * 100), 2) as ctr,
  ROUND((SUM(leads)::DECIMAL / NULLIF(SUM(clicks), 0) * 100), 2) as cvr,
  ROUND((SUM(spend) / NULLIF(SUM(leads), 0)), 0) as cpl,
  ROUND((SUM(spend) / NULLIF(SUM(clicks), 0)), 0) as cpc
FROM raw_data
WHERE date >= CURRENT_DATE - INTERVAL '7 days'
  AND date < CURRENT_DATE
  AND leads > 0
GROUP BY ad_name, campaign_name
ORDER BY leads DESC
LIMIT 10;

COMMENT ON VIEW v_top_ads_7d IS 'Top 10 광고 (리드 많은 순, 최근 7일)';

-- ============================================================================
-- 7. 저성과 광고 (리드 0건, 지출 10만원 이상, 최근 7일)
-- ============================================================================
CREATE OR REPLACE VIEW v_low_performance_ads_7d AS
SELECT
  ad_name,
  campaign_name,
  SUM(impressions) as impressions,
  SUM(reach) as reach,
  SUM(clicks) as clicks,
  SUM(spend) as spend,
  -- KPI 계산
  ROUND((SUM(clicks)::DECIMAL / NULLIF(SUM(impressions), 0) * 100), 2) as ctr,
  ROUND((SUM(spend) / NULLIF(SUM(clicks), 0)), 0) as cpc,
  -- 경고 레벨
  CASE
    WHEN SUM(clicks) = 0 THEN '🔴 클릭 없음'
    WHEN ROUND((SUM(clicks)::DECIMAL / NULLIF(SUM(impressions), 0) * 100), 2) < 0.5 THEN '🟠 CTR 매우 낮음'
    ELSE '🟡 전환 없음'
  END as warning_level
FROM raw_data
WHERE date >= CURRENT_DATE - INTERVAL '7 days'
  AND date < CURRENT_DATE
GROUP BY ad_name, campaign_name
HAVING SUM(leads) = 0 AND SUM(spend) >= 100000
ORDER BY spend DESC;

COMMENT ON VIEW v_low_performance_ads_7d IS '저성과 광고 (리드 0건, 지출 10만원 이상, 최근 7일)';

-- ============================================================================
-- 8. 빈도 분석 (최근 7일)
-- ============================================================================
CREATE OR REPLACE VIEW v_frequency_analysis_7d AS
SELECT
  CASE
    WHEN (SUM(impressions)::DECIMAL / NULLIF(SUM(reach), 0)) < 2 THEN '1.0-1.9'
    WHEN (SUM(impressions)::DECIMAL / NULLIF(SUM(reach), 0)) < 3 THEN '2.0-2.9'
    WHEN (SUM(impressions)::DECIMAL / NULLIF(SUM(reach), 0)) < 4 THEN '3.0-3.9'
    WHEN (SUM(impressions)::DECIMAL / NULLIF(SUM(reach), 0)) < 5 THEN '4.0-4.9'
    ELSE '5.0+'
  END as frequency_range,
  COUNT(*) as data_points,
  SUM(impressions) as total_impressions,
  SUM(reach) as total_reach,
  SUM(clicks) as total_clicks,
  SUM(leads) as total_leads,
  SUM(spend) as total_spend,
  -- KPI 계산
  ROUND((SUM(clicks)::DECIMAL / NULLIF(SUM(impressions), 0) * 100), 2) as ctr,
  ROUND((SUM(leads)::DECIMAL / NULLIF(SUM(clicks), 0) * 100), 2) as cvr,
  ROUND((SUM(spend) / NULLIF(SUM(leads), 0)), 0) as cpl
FROM raw_data
WHERE date >= CURRENT_DATE - INTERVAL '7 days'
  AND date < CURRENT_DATE
  AND reach > 0
GROUP BY frequency_range
ORDER BY frequency_range;

COMMENT ON VIEW v_frequency_analysis_7d IS '빈도 구간별 성과 분석 (최근 7일)';

-- ============================================================================
-- 9. 월별 성과 비교 (2025년 전체)
-- ============================================================================
CREATE OR REPLACE VIEW v_monthly_performance_2025 AS
SELECT
  TO_CHAR(date, 'YYYY-MM') as month,
  SUM(impressions) as impressions,
  SUM(reach) as reach,
  SUM(clicks) as clicks,
  SUM(leads) as leads,
  SUM(spend) as spend,
  SUM(video_views) as video_views,
  -- KPI 계산
  ROUND((SUM(clicks)::DECIMAL / NULLIF(SUM(impressions), 0) * 100), 2) as ctr,
  ROUND((SUM(leads)::DECIMAL / NULLIF(SUM(clicks), 0) * 100), 2) as cvr,
  ROUND((SUM(spend) / NULLIF(SUM(leads), 0)), 0) as cpl,
  ROUND((SUM(spend) / NULLIF(SUM(clicks), 0)), 0) as cpc,
  ROUND((SUM(spend) / NULLIF(SUM(impressions), 0) * 1000), 0) as cpm,
  -- 전월 대비 증감률 계산
  ROUND(
    (SUM(leads)::DECIMAL - LAG(SUM(leads)) OVER (ORDER BY TO_CHAR(date, 'YYYY-MM'))) /
    NULLIF(LAG(SUM(leads)) OVER (ORDER BY TO_CHAR(date, 'YYYY-MM')), 0) * 100,
    1
  ) as lead_growth_rate,
  ROUND(
    (SUM(spend) - LAG(SUM(spend)) OVER (ORDER BY TO_CHAR(date, 'YYYY-MM'))) /
    NULLIF(LAG(SUM(spend)) OVER (ORDER BY TO_CHAR(date, 'YYYY-MM')), 0) * 100,
    1
  ) as spend_growth_rate
FROM raw_data
WHERE date >= '2025-01-01' AND date < CURRENT_DATE
GROUP BY month
ORDER BY month;

COMMENT ON VIEW v_monthly_performance_2025 IS '월별 성과 비교 및 성장률 (2025년)';

-- ============================================================================
-- 10. 비디오 광고 성과 (최근 30일)
-- ============================================================================
CREATE OR REPLACE VIEW v_video_ads_performance_30d AS
SELECT
  ad_name,
  campaign_name,
  platform,
  device,
  SUM(impressions) as impressions,
  SUM(video_views) as video_views,
  AVG(avg_watch_time) as avg_watch_time,
  SUM(clicks) as clicks,
  SUM(leads) as leads,
  SUM(spend) as spend,
  -- 비디오 KPI 계산
  ROUND((SUM(video_views)::DECIMAL / NULLIF(SUM(impressions), 0) * 100), 2) as vtr,
  ROUND((SUM(spend) / NULLIF(SUM(video_views), 0)), 0) as cpv,
  ROUND((SUM(clicks)::DECIMAL / NULLIF(SUM(impressions), 0) * 100), 2) as ctr,
  ROUND((SUM(spend) / NULLIF(SUM(leads), 0)), 0) as cpl
FROM raw_data
WHERE date >= CURRENT_DATE - INTERVAL '30 days'
  AND date < CURRENT_DATE
  AND video_views > 0
GROUP BY ad_name, campaign_name, platform, device
ORDER BY video_views DESC
LIMIT 20;

COMMENT ON VIEW v_video_ads_performance_30d IS '비디오 광고 성과 Top 20 (최근 30일)';

-- ============================================================================
-- 유틸리티 함수: KPI 계산
-- ============================================================================

-- CTR 계산 함수
CREATE OR REPLACE FUNCTION calc_ctr(clicks BIGINT, impressions BIGINT)
RETURNS DECIMAL AS $$
BEGIN
  RETURN ROUND((clicks::DECIMAL / NULLIF(impressions, 0) * 100), 2);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION calc_ctr IS 'CTR (Click-Through Rate) 계산: (Clicks / Impressions) * 100';

-- CVR 계산 함수
CREATE OR REPLACE FUNCTION calc_cvr(leads BIGINT, clicks BIGINT)
RETURNS DECIMAL AS $$
BEGIN
  RETURN ROUND((leads::DECIMAL / NULLIF(clicks, 0) * 100), 2);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION calc_cvr IS 'CVR (Conversion Rate) 계산: (Leads / Clicks) * 100';

-- CPL 계산 함수
CREATE OR REPLACE FUNCTION calc_cpl(spend DECIMAL, leads BIGINT)
RETURNS DECIMAL AS $$
BEGIN
  RETURN ROUND((spend / NULLIF(leads, 0)), 0);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION calc_cpl IS 'CPL (Cost Per Lead) 계산: Spend / Leads';

-- CPC 계산 함수
CREATE OR REPLACE FUNCTION calc_cpc(spend DECIMAL, clicks BIGINT)
RETURNS DECIMAL AS $$
BEGIN
  RETURN ROUND((spend / NULLIF(clicks, 0)), 0);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION calc_cpc IS 'CPC (Cost Per Click) 계산: Spend / Clicks';

-- CPM 계산 함수
CREATE OR REPLACE FUNCTION calc_cpm(spend DECIMAL, impressions BIGINT)
RETURNS DECIMAL AS $$
BEGIN
  RETURN ROUND((spend / NULLIF(impressions, 0) * 1000), 0);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION calc_cpm IS 'CPM (Cost Per Mille) 계산: (Spend / Impressions) * 1000';

-- Frequency 계산 함수
CREATE OR REPLACE FUNCTION calc_frequency(impressions BIGINT, reach BIGINT)
RETURNS DECIMAL AS $$
BEGIN
  RETURN ROUND((impressions::DECIMAL / NULLIF(reach, 0)), 2);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION calc_frequency IS 'Frequency (빈도) 계산: Impressions / Reach';

-- VTR 계산 함수
CREATE OR REPLACE FUNCTION calc_vtr(video_views BIGINT, impressions BIGINT)
RETURNS DECIMAL AS $$
BEGIN
  RETURN ROUND((video_views::DECIMAL / NULLIF(impressions, 0) * 100), 2);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION calc_vtr IS 'VTR (View-Through Rate) 계산: (Video_Views / Impressions) * 100';

-- CPV 계산 함수
CREATE OR REPLACE FUNCTION calc_cpv(spend DECIMAL, video_views BIGINT)
RETURNS DECIMAL AS $$
BEGIN
  RETURN ROUND((spend / NULLIF(video_views, 0)), 0);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION calc_cpv IS 'CPV (Cost Per View) 계산: Spend / Video_Views';

-- ============================================================================
-- 인덱스 추가 (분석 쿼리 성능 최적화)
-- ============================================================================

-- 날짜 범위 쿼리 최적화
CREATE INDEX IF NOT EXISTS idx_raw_data_date_range ON raw_data(date) WHERE date >= CURRENT_DATE - INTERVAL '30 days';

-- 플랫폼별 분석 최적화
CREATE INDEX IF NOT EXISTS idx_raw_data_platform_date ON raw_data(platform, date);

-- 디바이스별 분석 최적화
CREATE INDEX IF NOT EXISTS idx_raw_data_device_date ON raw_data(device, date);

-- 캠페인별 분석 최적화
CREATE INDEX IF NOT EXISTS idx_raw_data_campaign_date ON raw_data(campaign_name, date);

-- 광고별 분석 최적화
CREATE INDEX IF NOT EXISTS idx_raw_data_ad_date ON raw_data(ad_name, date);

-- 비디오 광고 분석 최적화
CREATE INDEX IF NOT EXISTS idx_raw_data_video_views ON raw_data(video_views) WHERE video_views > 0;

-- ============================================================================
-- 완료
-- ============================================================================

-- 생성된 뷰 목록 확인
SELECT
  schemaname,
  viewname,
  viewowner
FROM pg_views
WHERE schemaname = 'public'
  AND viewname LIKE 'v_%'
ORDER BY viewname;
