-- ============================================================================
-- ads_insights_daily VIEW 수정 (ad_id, campaign_id 추가)
-- ============================================================================
-- 날짜: 2025-12-01
-- 목적: 월간 리포트와 호환성을 위해 ad_id, campaign_id 컬럼 추가
--
-- 배경:
-- - send-monthly-report.js에서 ad_id, campaign_id 사용
-- - 기존 VIEW에는 이 컬럼이 없어서 호환성 문제 발생
-- - GROUP BY에 ad_id 추가하여 해결
-- ============================================================================

-- 기존 뷰 삭제
DROP VIEW IF EXISTS ads_insights_daily;

-- 새 뷰 생성 (ad_id, campaign_id 포함)
CREATE OR REPLACE VIEW ads_insights_daily AS
SELECT
  client_id,
  date,
  ad_id,           -- 추가
  campaign_id,     -- 추가
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
GROUP BY client_id, date, ad_id, campaign_id, platform, campaign_name, ad_name
ORDER BY date DESC, spend DESC;

COMMENT ON VIEW ads_insights_daily IS '일별 광고 성과 집계 뷰 (raw_data 기반, 2025-12-01 ad_id/campaign_id 추가)';
