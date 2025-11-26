-- ============================================================================
-- ads_insights_daily VIEW 수정 (raw_data 기반으로 복원)
-- ============================================================================
-- 날짜: 2025-11-26
-- 목적: 백필 데이터가 대시보드에 자동 반영되도록 VIEW를 raw_data 기반으로 변경
--
-- 문제:
-- - 기존 VIEW가 daily_aggregates 테이블 참조
-- - 백필 API는 raw_data에만 저장
-- - 결과: 백필해도 대시보드에 안 보임
--
-- 해결:
-- - VIEW를 raw_data 기반으로 변경
-- - client_id 컬럼 추가 (멀티 클라이언트 지원)
-- ============================================================================

-- 기존 뷰 삭제
DROP VIEW IF EXISTS ads_insights_daily;

-- 새 뷰 생성 (raw_data 기반)
CREATE OR REPLACE VIEW ads_insights_daily AS
SELECT
  client_id,
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
GROUP BY client_id, date, platform, campaign_name, ad_name
ORDER BY date DESC, spend DESC;

COMMENT ON VIEW ads_insights_daily IS '일별 광고 성과 집계 뷰 (raw_data 기반, 2025-11-26 수정)';

-- 인덱스 확인 (raw_data 테이블 성능 최적화)
CREATE INDEX IF NOT EXISTS idx_raw_data_client_date ON raw_data(client_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_raw_data_date ON raw_data(date DESC);
CREATE INDEX IF NOT EXISTS idx_raw_data_platform ON raw_data(platform);
CREATE INDEX IF NOT EXISTS idx_raw_data_campaign_name ON raw_data(campaign_name);
CREATE INDEX IF NOT EXISTS idx_raw_data_ad_name ON raw_data(ad_name);
