-- ============================================================================
-- Phase 1: 대시보드 시각화 개선을 위한 데이터 기반 마련
-- ============================================================================
-- 목적: 광고별 누적 데이터, 일별 스냅샷, KPI 목표값 관리
-- 버전: v1.0
-- 작성일: 2025-11-25
-- 참조: docs/대시보드_시각화_개선_기획서_v1.md
-- ============================================================================

-- ============================================================================
-- 1. ad_cumulative_stats (광고별 누적 통계)
-- ============================================================================
-- 목적: 광고 전체 기간 성과 집계 (lifetime stats)
-- 업데이트: 데이터 수집 배치 완료 후 자동 실행

CREATE TABLE IF NOT EXISTS ad_cumulative_stats (
  id BIGSERIAL PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  ad_id VARCHAR(50) NOT NULL,
  ad_name VARCHAR(200),
  campaign_id VARCHAR(50),
  campaign_name VARCHAR(200),
  platform VARCHAR(20) DEFAULT 'facebook',

  -- 누적 지표
  total_impressions BIGINT DEFAULT 0,
  total_clicks BIGINT DEFAULT 0,
  total_leads INTEGER DEFAULT 0,
  total_spend DECIMAL(12,2) DEFAULT 0,

  -- 계산된 누적 지표 (GENERATED COLUMNS)
  lifetime_cpl DECIMAL(10,2) GENERATED ALWAYS AS (
    CASE WHEN total_leads > 0 THEN total_spend / total_leads ELSE NULL END
  ) STORED,
  lifetime_ctr DECIMAL(5,4) GENERATED ALWAYS AS (
    CASE WHEN total_impressions > 0 THEN (total_clicks::DECIMAL / total_impressions) * 100 ELSE NULL END
  ) STORED,
  lifetime_cvr DECIMAL(5,4) GENERATED ALWAYS AS (
    CASE WHEN total_clicks > 0 THEN (total_leads::DECIMAL / total_clicks) * 100 ELSE NULL END
  ) STORED,

  -- 메타 정보
  first_seen_date DATE,          -- 최초 데이터 날짜
  last_seen_date DATE,           -- 마지막 데이터 날짜
  active_days INTEGER DEFAULT 0, -- 실제 운영 일수

  -- 순위 정보 (일별 업데이트)
  cpl_rank INTEGER,              -- CPL 순위 (낮을수록 좋음)
  leads_rank INTEGER,            -- 리드 순위 (높을수록 좋음)

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- 고유 제약조건
  CONSTRAINT ad_cumulative_stats_unique UNIQUE(client_id, ad_id)
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_ad_cumulative_client ON ad_cumulative_stats(client_id);
CREATE INDEX IF NOT EXISTS idx_ad_cumulative_cpl ON ad_cumulative_stats(lifetime_cpl) WHERE total_leads > 0;
CREATE INDEX IF NOT EXISTS idx_ad_cumulative_leads ON ad_cumulative_stats(total_leads DESC);
CREATE INDEX IF NOT EXISTS idx_ad_cumulative_last_seen ON ad_cumulative_stats(last_seen_date DESC);

-- 코멘트
COMMENT ON TABLE ad_cumulative_stats IS '광고별 누적 성과 통계 - 전체 기간 lifetime 데이터';
COMMENT ON COLUMN ad_cumulative_stats.lifetime_cpl IS '누적 CPL (자동 계산)';
COMMENT ON COLUMN ad_cumulative_stats.cpl_rank IS 'CPL 기준 순위 (1=최저, 가장 효율적)';
COMMENT ON COLUMN ad_cumulative_stats.leads_rank IS '리드수 기준 순위 (1=최다)';


-- ============================================================================
-- 2. ad_daily_snapshot (일별 스냅샷)
-- ============================================================================
-- 목적: 광고별 일별 누적값 및 순위 변동 추적
-- 용도: 순위 변동 표시, 추이 스파크라인

CREATE TABLE IF NOT EXISTS ad_daily_snapshot (
  id BIGSERIAL PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,
  ad_id VARCHAR(50) NOT NULL,

  -- 해당 일자 기준 누적값
  cumulative_leads INTEGER,
  cumulative_spend DECIMAL(12,2),
  cumulative_cpl DECIMAL(10,2),

  -- 해당 일자 순위
  cpl_rank INTEGER,
  leads_rank INTEGER,

  -- 전일 대비 변화
  leads_change INTEGER,          -- 전일 대비 리드 증감
  cpl_change DECIMAL(10,2),      -- 전일 대비 CPL 변화
  rank_change INTEGER,           -- 전일 대비 순위 변화 (양수=상승)

  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- 고유 제약조건
  CONSTRAINT ad_daily_snapshot_unique UNIQUE(client_id, snapshot_date, ad_id)
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_snapshot_client_date ON ad_daily_snapshot(client_id, snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_snapshot_ad ON ad_daily_snapshot(ad_id, snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_snapshot_date ON ad_daily_snapshot(snapshot_date DESC);

-- 코멘트
COMMENT ON TABLE ad_daily_snapshot IS '광고별 일별 스냅샷 - 순위 변동 및 추이 추적용';
COMMENT ON COLUMN ad_daily_snapshot.rank_change IS '순위 변화 (양수=상승, 음수=하락)';


-- ============================================================================
-- 3. client_targets (KPI 목표값)
-- ============================================================================
-- 목적: 클라이언트별 월별 KPI 목표 관리
-- 용도: KPI 카드에서 목표 대비 달성률 표시

CREATE TABLE IF NOT EXISTS client_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,

  -- 월별 목표값
  target_month DATE NOT NULL,              -- 해당 월 (예: 2025-11-01)

  -- KPI 목표
  target_leads INTEGER,                    -- 목표 리드 수
  target_spend DECIMAL(10,2),              -- 예산 상한
  target_cpl DECIMAL(10,2),                -- 목표 CPL (이하)
  target_ctr DECIMAL(5,2),                 -- 목표 CTR (이상)

  -- 자동 설정 옵션
  auto_set_from_previous BOOLEAN DEFAULT true,  -- 전월 대비 자동 설정
  auto_increase_percent INTEGER DEFAULT 10,     -- 자동 증가율 (%)

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- 고유 제약조건
  CONSTRAINT client_targets_unique UNIQUE(client_id, target_month)
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_targets_client ON client_targets(client_id);
CREATE INDEX IF NOT EXISTS idx_targets_month ON client_targets(target_month DESC);

-- 코멘트
COMMENT ON TABLE client_targets IS '클라이언트별 월간 KPI 목표값';
COMMENT ON COLUMN client_targets.target_cpl IS '목표 CPL (이 값 이하가 목표)';
COMMENT ON COLUMN client_targets.auto_set_from_previous IS 'true면 전월 실적 기반 자동 설정';


-- ============================================================================
-- 4. 집계 함수: update_ad_cumulative_stats
-- ============================================================================
-- 목적: daily_aggregates 기반으로 누적 통계 업데이트

CREATE OR REPLACE FUNCTION update_ad_cumulative_stats(p_client_id UUID)
RETURNS TABLE (
  success BOOLEAN,
  rows_affected INTEGER,
  message TEXT
) AS $$
DECLARE
  v_rows_affected INTEGER := 0;
BEGIN
  -- 누적 통계 UPSERT
  INSERT INTO ad_cumulative_stats (
    client_id, ad_id, ad_name, campaign_id, campaign_name, platform,
    total_impressions, total_clicks, total_leads, total_spend,
    first_seen_date, last_seen_date, active_days
  )
  SELECT
    client_id,
    ad_id,
    MAX(ad_name),
    MAX(campaign_id),
    MAX(campaign_name),
    'facebook',  -- 현재 Meta만 지원
    SUM(impressions),
    SUM(clicks),
    SUM(leads),
    SUM(spend),
    MIN(date),
    MAX(date),
    COUNT(DISTINCT date)
  FROM daily_aggregates
  WHERE client_id = p_client_id
  GROUP BY client_id, ad_id
  ON CONFLICT (client_id, ad_id) DO UPDATE SET
    ad_name = EXCLUDED.ad_name,
    campaign_id = EXCLUDED.campaign_id,
    campaign_name = EXCLUDED.campaign_name,
    total_impressions = EXCLUDED.total_impressions,
    total_clicks = EXCLUDED.total_clicks,
    total_leads = EXCLUDED.total_leads,
    total_spend = EXCLUDED.total_spend,
    first_seen_date = EXCLUDED.first_seen_date,
    last_seen_date = EXCLUDED.last_seen_date,
    active_days = EXCLUDED.active_days,
    updated_at = NOW();

  GET DIAGNOSTICS v_rows_affected = ROW_COUNT;

  -- 순위 업데이트 (리드 > 0인 광고만)
  WITH ranked AS (
    SELECT
      id,
      ROW_NUMBER() OVER (ORDER BY lifetime_cpl ASC NULLS LAST) as cpl_r,
      ROW_NUMBER() OVER (ORDER BY total_leads DESC) as leads_r
    FROM ad_cumulative_stats
    WHERE client_id = p_client_id AND total_leads > 0
  )
  UPDATE ad_cumulative_stats a
  SET cpl_rank = r.cpl_r, leads_rank = r.leads_r
  FROM ranked r
  WHERE a.id = r.id;

  RETURN QUERY SELECT
    TRUE,
    v_rows_affected,
    format('Updated %s cumulative stats for client', v_rows_affected);

EXCEPTION WHEN OTHERS THEN
  RETURN QUERY SELECT FALSE, 0, format('Error: %s', SQLERRM);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_ad_cumulative_stats IS '광고별 누적 통계 업데이트 (daily_aggregates → ad_cumulative_stats)';


-- ============================================================================
-- 5. 집계 함수: save_daily_snapshot
-- ============================================================================
-- 목적: 특정 날짜의 누적값과 순위 스냅샷 저장

CREATE OR REPLACE FUNCTION save_daily_snapshot(p_client_id UUID, p_date DATE)
RETURNS TABLE (
  success BOOLEAN,
  rows_affected INTEGER,
  message TEXT
) AS $$
DECLARE
  v_rows_affected INTEGER := 0;
BEGIN
  -- 스냅샷 UPSERT
  INSERT INTO ad_daily_snapshot (
    client_id, snapshot_date, ad_id,
    cumulative_leads, cumulative_spend, cumulative_cpl,
    cpl_rank, leads_rank
  )
  SELECT
    client_id,
    p_date,
    ad_id,
    total_leads,
    total_spend,
    lifetime_cpl,
    cpl_rank,
    leads_rank
  FROM ad_cumulative_stats
  WHERE client_id = p_client_id
  ON CONFLICT (client_id, snapshot_date, ad_id) DO UPDATE SET
    cumulative_leads = EXCLUDED.cumulative_leads,
    cumulative_spend = EXCLUDED.cumulative_spend,
    cumulative_cpl = EXCLUDED.cumulative_cpl,
    cpl_rank = EXCLUDED.cpl_rank,
    leads_rank = EXCLUDED.leads_rank;

  GET DIAGNOSTICS v_rows_affected = ROW_COUNT;

  -- 전일 대비 변화 계산
  UPDATE ad_daily_snapshot curr
  SET
    leads_change = curr.cumulative_leads - prev.cumulative_leads,
    cpl_change = curr.cumulative_cpl - prev.cumulative_cpl,
    rank_change = prev.cpl_rank - curr.cpl_rank  -- 순위 상승이면 양수
  FROM ad_daily_snapshot prev
  WHERE curr.client_id = p_client_id
    AND curr.snapshot_date = p_date
    AND prev.client_id = curr.client_id
    AND prev.ad_id = curr.ad_id
    AND prev.snapshot_date = p_date - INTERVAL '1 day';

  RETURN QUERY SELECT
    TRUE,
    v_rows_affected,
    format('Saved %s snapshots for date %s', v_rows_affected, p_date);

EXCEPTION WHEN OTHERS THEN
  RETURN QUERY SELECT FALSE, 0, format('Error: %s', SQLERRM);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION save_daily_snapshot IS '일별 스냅샷 저장 (순위 변동 추적용)';


-- ============================================================================
-- 6. 집계 함수: set_default_targets
-- ============================================================================
-- 목적: 전월 실적 기반 목표값 자동 설정

CREATE OR REPLACE FUNCTION set_default_targets(p_client_id UUID, p_month DATE)
RETURNS TABLE (
  success BOOLEAN,
  target_leads INTEGER,
  target_cpl DECIMAL,
  message TEXT
) AS $$
DECLARE
  v_prev_leads INTEGER;
  v_prev_cpl DECIMAL;
  v_target_leads INTEGER;
  v_target_cpl DECIMAL;
BEGIN
  -- 전월 실적 조회
  SELECT
    SUM(leads),
    CASE WHEN SUM(leads) > 0 THEN SUM(spend) / SUM(leads) ELSE NULL END
  INTO v_prev_leads, v_prev_cpl
  FROM daily_aggregates
  WHERE client_id = p_client_id
    AND date >= (p_month - INTERVAL '1 month')
    AND date < p_month;

  -- 목표값 계산 (전월 대비 10% 증가 / CPL 5% 감소)
  v_target_leads := COALESCE(ROUND(v_prev_leads * 1.1), 100)::INTEGER;
  v_target_cpl := COALESCE(ROUND(v_prev_cpl * 0.95, 2), 50);

  -- 목표값 삽입
  INSERT INTO client_targets (
    client_id, target_month, target_leads, target_cpl
  )
  VALUES (
    p_client_id,
    p_month,
    v_target_leads,
    v_target_cpl
  )
  ON CONFLICT (client_id, target_month) DO NOTHING;

  RETURN QUERY SELECT
    TRUE,
    v_target_leads,
    v_target_cpl,
    format('Target set: %s leads, $%s CPL for %s', v_target_leads, v_target_cpl, p_month);

EXCEPTION WHEN OTHERS THEN
  RETURN QUERY SELECT FALSE, 0, 0::DECIMAL, format('Error: %s', SQLERRM);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION set_default_targets IS '전월 실적 기반 월간 목표값 자동 설정';


-- ============================================================================
-- 7. 집계 함수: run_daily_aggregation
-- ============================================================================
-- 목적: 배치 스크립트에서 호출할 통합 집계 함수

CREATE OR REPLACE FUNCTION run_daily_aggregation(p_client_id UUID, p_date DATE DEFAULT CURRENT_DATE)
RETURNS TABLE (
  step TEXT,
  success BOOLEAN,
  rows_affected INTEGER,
  message TEXT
) AS $$
BEGIN
  -- Step 1: 누적 통계 업데이트
  RETURN QUERY
  SELECT
    'update_cumulative_stats'::TEXT,
    r.success,
    r.rows_affected,
    r.message
  FROM update_ad_cumulative_stats(p_client_id) r;

  -- Step 2: 일별 스냅샷 저장
  RETURN QUERY
  SELECT
    'save_daily_snapshot'::TEXT,
    r.success,
    r.rows_affected,
    r.message
  FROM save_daily_snapshot(p_client_id, p_date) r;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION run_daily_aggregation IS '일일 집계 통합 실행 (누적 통계 + 스냅샷)';


-- ============================================================================
-- 8. RLS (Row Level Security) 설정
-- ============================================================================

ALTER TABLE ad_cumulative_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_daily_snapshot ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_targets ENABLE ROW LEVEL SECURITY;

-- 서비스 역할용 정책 (service_role은 전체 접근)
CREATE POLICY "Service role has full access to ad_cumulative_stats"
  ON ad_cumulative_stats FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role has full access to ad_daily_snapshot"
  ON ad_daily_snapshot FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role has full access to client_targets"
  ON client_targets FOR ALL
  USING (true)
  WITH CHECK (true);


-- ============================================================================
-- 사용 예시
-- ============================================================================

-- 1. 특정 클라이언트 누적 통계 업데이트
-- SELECT * FROM update_ad_cumulative_stats('79e35fc6-a817-4ccc-9d5d-9a93c1ad4515');

-- 2. 특정 날짜 스냅샷 저장
-- SELECT * FROM save_daily_snapshot('79e35fc6-a817-4ccc-9d5d-9a93c1ad4515', '2025-11-25');

-- 3. 통합 집계 실행 (권장)
-- SELECT * FROM run_daily_aggregation('79e35fc6-a817-4ccc-9d5d-9a93c1ad4515', '2025-11-25');

-- 4. 월간 목표값 설정
-- SELECT * FROM set_default_targets('79e35fc6-a817-4ccc-9d5d-9a93c1ad4515', '2025-12-01');

-- 5. 누적 통계 조회
-- SELECT ad_name, total_leads, total_spend, lifetime_cpl, cpl_rank
-- FROM ad_cumulative_stats
-- WHERE client_id = '79e35fc6-a817-4ccc-9d5d-9a93c1ad4515'
-- ORDER BY cpl_rank;

-- 6. 순위 변동 조회 (최근 7일)
-- SELECT s.snapshot_date, a.ad_name, s.cpl_rank, s.rank_change
-- FROM ad_daily_snapshot s
-- JOIN ad_cumulative_stats a ON s.ad_id = a.ad_id AND s.client_id = a.client_id
-- WHERE s.client_id = '79e35fc6-a817-4ccc-9d5d-9a93c1ad4515'
--   AND s.snapshot_date >= CURRENT_DATE - INTERVAL '7 days'
-- ORDER BY s.ad_id, s.snapshot_date;
