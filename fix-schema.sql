-- ============================================================================
-- daily_aggregates 스키마 수정 (DECIMAL overflow 해결)
-- ============================================================================
-- Supabase SQL Editor에서 실행하세요
-- ============================================================================

-- 1단계: 현재 스키마 확인
SELECT column_name, data_type, numeric_precision, numeric_scale
FROM information_schema.columns
WHERE table_name = 'daily_aggregates'
AND data_type = 'numeric'
ORDER BY ordinal_position;

-- 예상 결과:
--   ctr: DECIMAL(5,4) - 문제 있을 수 있음
--   cpl: DECIMAL(10,2) - OK
--   cpc: DECIMAL(10,2) - OK
--   conversion_rate: DECIMAL(5,4) - OK

-- ============================================================================
-- 2단계: GENERATED 컬럼 재생성
-- ============================================================================

-- ctr, cpl, cpc, conversion_rate 컬럼 삭제 후 재생성
-- GENERATED 컬럼은 ALTER COLUMN이 안 되므로 DROP → ADD 필요

ALTER TABLE daily_aggregates DROP COLUMN IF EXISTS ctr;
ALTER TABLE daily_aggregates DROP COLUMN IF EXISTS cpl;
ALTER TABLE daily_aggregates DROP COLUMN IF EXISTS cpc;
ALTER TABLE daily_aggregates DROP COLUMN IF EXISTS conversion_rate;
ALTER TABLE daily_aggregates DROP COLUMN IF EXISTS cost_per_video_view;

-- ctr: CTR은 보통 0~10% 사이, 최대 100% → DECIMAL(7,4)로 변경
ALTER TABLE daily_aggregates
ADD COLUMN ctr DECIMAL(7,4) GENERATED ALWAYS AS (
  CASE WHEN impressions > 0
  THEN ROUND((clicks::NUMERIC / impressions::NUMERIC) * 100, 4)
  ELSE 0 END
) STORED;

-- cpl: 리드당 비용은 수백 달러까지 가능 → DECIMAL(12,2)
ALTER TABLE daily_aggregates
ADD COLUMN cpl DECIMAL(12,2) GENERATED ALWAYS AS (
  CASE WHEN leads > 0
  THEN ROUND(spend::NUMERIC / leads::NUMERIC, 2)
  ELSE 0 END
) STORED;

-- cpc: 클릭당 비용은 보통 $0.1~$10 → DECIMAL(12,2)
ALTER TABLE daily_aggregates
ADD COLUMN cpc DECIMAL(12,2) GENERATED ALWAYS AS (
  CASE WHEN clicks > 0
  THEN ROUND(spend::NUMERIC / clicks::NUMERIC, 2)
  ELSE 0 END
) STORED;

-- conversion_rate: 전환율은 0~100% → DECIMAL(7,4)
ALTER TABLE daily_aggregates
ADD COLUMN conversion_rate DECIMAL(7,4) GENERATED ALWAYS AS (
  CASE WHEN clicks > 0
  THEN ROUND((leads::NUMERIC / clicks::NUMERIC) * 100, 4)
  ELSE 0 END
) STORED;

-- cost_per_video_view: 동영상 조회당 비용 → DECIMAL(12,6)
ALTER TABLE daily_aggregates
ADD COLUMN cost_per_video_view DECIMAL(12,6) GENERATED ALWAYS AS (
  CASE WHEN video_views > 0
  THEN ROUND(spend::NUMERIC / video_views::NUMERIC, 6)
  ELSE 0 END
) STORED;

-- ============================================================================
-- 3단계: 인덱스 재생성
-- ============================================================================

DROP INDEX IF EXISTS idx_daily_agg_cpl;
DROP INDEX IF EXISTS idx_daily_agg_ctr;

CREATE INDEX idx_daily_agg_cpl ON daily_aggregates(cpl) WHERE leads > 0;
CREATE INDEX idx_daily_agg_ctr ON daily_aggregates(ctr);

-- ============================================================================
-- 4단계: 스키마 확인
-- ============================================================================

SELECT column_name, data_type, numeric_precision, numeric_scale
FROM information_schema.columns
WHERE table_name = 'daily_aggregates'
AND data_type = 'numeric'
ORDER BY ordinal_position;

-- 예상 결과:
--   spend: DECIMAL(10,2)
--   avg_watch_time: DECIMAL(5,1)
--   ctr: DECIMAL(7,4) ← 수정됨
--   cpl: DECIMAL(12,2) ← 수정됨
--   cpc: DECIMAL(12,2) ← 수정됨
--   conversion_rate: DECIMAL(7,4) ← 수정됨
--   cost_per_video_view: DECIMAL(12,6) ← 수정됨

-- ============================================================================
-- 완료!
-- ============================================================================

-- 이제 다시 집계 스크립트를 실행하세요:
-- node aggregate-from-raw.js
