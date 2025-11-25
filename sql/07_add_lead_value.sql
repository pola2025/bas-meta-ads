-- ============================================================================
-- Add lead_value column to clients table
-- ============================================================================
-- 목적: 클라이언트별 리드 가치 설정하여 맞춤 ROI 계산
-- 기본값: 100 (USD)
-- ============================================================================

ALTER TABLE clients
ADD COLUMN IF NOT EXISTS lead_value DECIMAL(10,2) DEFAULT 100.00;

COMMENT ON COLUMN clients.lead_value IS '리드당 가치 (USD) - ROI 계산에 사용';

-- 기존 데이터에 기본값 설정
UPDATE clients
SET lead_value = 100.00
WHERE lead_value IS NULL;

-- ============================================================================
-- 사용 예시
-- ============================================================================

-- 클라이언트별 리드 가치 설정
-- UPDATE clients SET lead_value = 50.00 WHERE client_id = 'client_A';
-- UPDATE clients SET lead_value = 200.00 WHERE client_id = 'client_B';
