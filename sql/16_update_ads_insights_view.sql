-- ============================================================================
-- ads_insights_daily 뷰 업데이트
-- ============================================================================
-- 목적: 대시보드에서 사용하는 일별 집계 뷰를 daily_aggregates 기반으로 변경
--
-- 변경 이유:
-- - 기존: raw_data 테이블 기반 (1월~6월 초 데이터만 있음)
-- - 변경: daily_aggregates 테이블 기반 (1월~6월 + 11월 데이터 포함)
--
-- 데이터 현황 (2025-11-25):
-- - raw_data: 153일 (1월~6월 초)
-- - daily_aggregates: 168일 (1월~6월 초 + 11월 9일~23일)
-- - 누락 구간: 159일 (6월 3일~11월 8일) - 백필 예정
--
-- 주의: daily_aggregates에는 platform/device 컬럼이 없음
--       플랫폼별 분석 기능은 별도 처리 필요
-- ============================================================================

-- 기존 뷰 삭제
DROP VIEW IF EXISTS ads_insights_daily;

-- 새 뷰 생성 (daily_aggregates 기반)
CREATE OR REPLACE VIEW ads_insights_daily AS
SELECT
  date,
  'Meta' as platform,  -- daily_aggregates에 platform 없어서 기본값 설정
  campaign_name,
  ad_name,
  ad_id,
  client_id,
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
FROM daily_aggregates
GROUP BY date, campaign_name, ad_name, ad_id, client_id
ORDER BY date DESC, spend DESC;

COMMENT ON VIEW ads_insights_daily IS '일별 광고 성과 집계 뷰 (대시보드용) - daily_aggregates 기반, 2025-11-25 업데이트';

-- 인덱스 확인 (daily_aggregates 테이블)
CREATE INDEX IF NOT EXISTS idx_daily_aggregates_date ON daily_aggregates(date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_aggregates_campaign_name ON daily_aggregates(campaign_name);
CREATE INDEX IF NOT EXISTS idx_daily_aggregates_ad_name ON daily_aggregates(ad_name);
CREATE INDEX IF NOT EXISTS idx_daily_aggregates_client_id ON daily_aggregates(client_id);
