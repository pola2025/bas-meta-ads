-- ============================================================================
-- daily_aggregates 테이블 - 일별 집계 데이터 (분석용 원본)
-- ============================================================================
-- 목적: raw_data를 일별로 집계하여 분석 성능 향상 및 데이터 품질 확보
-- 업데이트: 매일 자동 (Worker 또는 Cron)
-- ============================================================================

CREATE TABLE IF NOT EXISTS daily_aggregates (
  id BIGSERIAL PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  date DATE NOT NULL,

  -- 광고 정보
  ad_id VARCHAR(50) NOT NULL,
  ad_name VARCHAR(200),
  campaign_id VARCHAR(50),
  campaign_name VARCHAR(200),

  -- 기본 성과 지표
  impressions INTEGER DEFAULT 0,
  reach INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  leads INTEGER DEFAULT 0,
  spend DECIMAL(10,2) DEFAULT 0,

  -- 동영상 지표
  video_views INTEGER DEFAULT 0,
  avg_watch_time DECIMAL(5,1) DEFAULT 0,
  video_p25_watched INTEGER DEFAULT 0,
  video_p50_watched INTEGER DEFAULT 0,
  video_p75_watched INTEGER DEFAULT 0,
  video_p100_watched INTEGER DEFAULT 0,

  -- 계산된 지표 (성능 최적화)
  ctr DECIMAL(5,4) GENERATED ALWAYS AS (
    CASE WHEN impressions > 0
    THEN ROUND((clicks::NUMERIC / impressions::NUMERIC) * 100, 4)
    ELSE 0 END
  ) STORED,

  cpl DECIMAL(10,2) GENERATED ALWAYS AS (
    CASE WHEN leads > 0
    THEN ROUND(spend::NUMERIC / leads::NUMERIC, 2)
    ELSE 0 END
  ) STORED,

  cpc DECIMAL(10,2) GENERATED ALWAYS AS (
    CASE WHEN clicks > 0
    THEN ROUND(spend::NUMERIC / clicks::NUMERIC, 2)
    ELSE 0 END
  ) STORED,

  conversion_rate DECIMAL(5,4) GENERATED ALWAYS AS (
    CASE WHEN clicks > 0
    THEN ROUND((leads::NUMERIC / clicks::NUMERIC) * 100, 4)
    ELSE 0 END
  ) STORED,

  cost_per_video_view DECIMAL(10,6) GENERATED ALWAYS AS (
    CASE WHEN video_views > 0
    THEN ROUND(spend::NUMERIC / video_views::NUMERIC, 6)
    ELSE 0 END
  ) STORED,

  -- 메타데이터
  aggregated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- 고유 제약조건
  CONSTRAINT daily_aggregates_unique UNIQUE(client_id, date, ad_id)
);

-- 인덱스 생성 (쿼리 성능 최적화)
CREATE INDEX idx_daily_agg_client_date ON daily_aggregates(client_id, date DESC);
CREATE INDEX idx_daily_agg_ad_id ON daily_aggregates(ad_id);
CREATE INDEX idx_daily_agg_campaign_id ON daily_aggregates(campaign_id);
CREATE INDEX idx_daily_agg_date ON daily_aggregates(date DESC);
CREATE INDEX idx_daily_agg_cpl ON daily_aggregates(cpl) WHERE leads > 0;
CREATE INDEX idx_daily_agg_ctr ON daily_aggregates(ctr);

-- 코멘트
COMMENT ON TABLE daily_aggregates IS '일별 집계 데이터 - 분석 및 리포트의 핵심 원본';
COMMENT ON COLUMN daily_aggregates.ctr IS '클릭률 (자동 계산, 저장)';
COMMENT ON COLUMN daily_aggregates.cpl IS '리드당 비용 (자동 계산, 저장)';
COMMENT ON COLUMN daily_aggregates.conversion_rate IS '전환율 (자동 계산, 저장)';

-- ============================================================================
-- 자동 집계 함수 (raw_data → daily_aggregates)
-- ============================================================================

CREATE OR REPLACE FUNCTION aggregate_daily_data(
  p_client_id UUID,
  p_date DATE
) RETURNS TABLE (
  success BOOLEAN,
  rows_affected INTEGER,
  message TEXT
) AS $$
DECLARE
  v_rows_inserted INTEGER := 0;
  v_rows_updated INTEGER := 0;
BEGIN
  -- raw_data에서 일별 집계
  INSERT INTO daily_aggregates (
    client_id,
    date,
    ad_id,
    ad_name,
    campaign_id,
    campaign_name,
    impressions,
    reach,
    clicks,
    leads,
    spend,
    video_views,
    avg_watch_time,
    video_p25_watched,
    video_p50_watched,
    video_p75_watched,
    video_p100_watched,
    aggregated_at
  )
  SELECT
    client_id,
    date,
    ad_id,
    MAX(ad_name) as ad_name,
    MAX(campaign_id) as campaign_id,
    MAX(campaign_name) as campaign_name,
    SUM(impressions) as impressions,
    SUM(reach) as reach,
    SUM(clicks) as clicks,
    SUM(leads) as leads,
    SUM(spend) as spend,
    SUM(video_views) as video_views,
    ROUND(
      CASE
        WHEN SUM(video_views) > 0
        THEN SUM(avg_watch_time * video_views) / SUM(video_views)
        ELSE 0
      END,
    1) as avg_watch_time,
    SUM(video_p25_watched) as video_p25_watched,
    SUM(video_p50_watched) as video_p50_watched,
    SUM(video_p75_watched) as video_p75_watched,
    SUM(video_p100_watched) as video_p100_watched,
    NOW()
  FROM raw_data
  WHERE client_id = p_client_id
    AND date = p_date
  GROUP BY client_id, date, ad_id
  ON CONFLICT (client_id, date, ad_id)
  DO UPDATE SET
    ad_name = EXCLUDED.ad_name,
    campaign_id = EXCLUDED.campaign_id,
    campaign_name = EXCLUDED.campaign_name,
    impressions = EXCLUDED.impressions,
    reach = EXCLUDED.reach,
    clicks = EXCLUDED.clicks,
    leads = EXCLUDED.leads,
    spend = EXCLUDED.spend,
    video_views = EXCLUDED.video_views,
    avg_watch_time = EXCLUDED.avg_watch_time,
    video_p25_watched = EXCLUDED.video_p25_watched,
    video_p50_watched = EXCLUDED.video_p50_watched,
    video_p75_watched = EXCLUDED.video_p75_watched,
    video_p100_watched = EXCLUDED.video_p100_watched,
    updated_at = NOW();

  GET DIAGNOSTICS v_rows_inserted = ROW_COUNT;

  RETURN QUERY SELECT
    TRUE as success,
    v_rows_inserted as rows_affected,
    format('Aggregated %s rows for date %s', v_rows_inserted, p_date) as message;

EXCEPTION WHEN OTHERS THEN
  RETURN QUERY SELECT
    FALSE as success,
    0 as rows_affected,
    format('Error: %s', SQLERRM) as message;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION aggregate_daily_data IS 'raw_data를 daily_aggregates로 집계 (UPSERT)';

-- ============================================================================
-- 전체 클라이언트 일별 집계 함수
-- ============================================================================

CREATE OR REPLACE FUNCTION aggregate_all_clients_daily(
  p_date DATE DEFAULT CURRENT_DATE - INTERVAL '1 day'
) RETURNS TABLE (
  client_id UUID,
  client_name TEXT,
  success BOOLEAN,
  rows_affected INTEGER,
  message TEXT
) AS $$
DECLARE
  v_client RECORD;
BEGIN
  FOR v_client IN
    SELECT id, client_name
    FROM clients
    WHERE is_active = TRUE
  LOOP
    RETURN QUERY
    SELECT
      v_client.id,
      v_client.client_name,
      r.success,
      r.rows_affected,
      r.message
    FROM aggregate_daily_data(v_client.id, p_date) r;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION aggregate_all_clients_daily IS '모든 활성 클라이언트의 일별 데이터 집계';

-- ============================================================================
-- 범위 집계 함수 (히스토리 데이터 처리용)
-- ============================================================================

CREATE OR REPLACE FUNCTION aggregate_daily_data_range(
  p_client_id UUID,
  p_start_date DATE,
  p_end_date DATE
) RETURNS TABLE (
  date DATE,
  success BOOLEAN,
  rows_affected INTEGER
) AS $$
DECLARE
  v_date DATE;
BEGIN
  FOR v_date IN
    SELECT generate_series(p_start_date, p_end_date, '1 day'::interval)::DATE
  LOOP
    RETURN QUERY
    SELECT
      v_date,
      r.success,
      r.rows_affected
    FROM aggregate_daily_data(p_client_id, v_date) r;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION aggregate_daily_data_range IS '특정 기간의 일별 데이터 일괄 집계';

-- ============================================================================
-- 사용 예시
-- ============================================================================

-- 1. 특정 날짜 집계
-- SELECT * FROM aggregate_daily_data(
--   '79e35fc6-a817-4ccc-9d5d-9a93c1ad4515',
--   '2025-11-17'
-- );

-- 2. 모든 클라이언트 어제 데이터 집계
-- SELECT * FROM aggregate_all_clients_daily(CURRENT_DATE - INTERVAL '1 day');

-- 3. 특정 기간 일괄 집계
-- SELECT * FROM aggregate_daily_data_range(
--   '79e35fc6-a817-4ccc-9d5d-9a93c1ad4515',
--   '2025-11-17',
--   '2025-11-23'
-- );
