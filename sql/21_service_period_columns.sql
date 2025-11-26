-- ============================================================================
-- Service Period Columns - 서비스 기간 관리
-- ============================================================================

-- 1. clients 테이블에 시작일/종료일 컬럼 추가
ALTER TABLE clients
ADD COLUMN IF NOT EXISTS service_start_date DATE,
ADD COLUMN IF NOT EXISTS service_end_date DATE;

-- 컬럼 설명 추가
COMMENT ON COLUMN clients.service_start_date IS '서비스 시작일';
COMMENT ON COLUMN clients.service_end_date IS '서비스 종료일 (시작일 + 3개월 - 1일)';

-- 2. 기존 활성 클라이언트에 기본값 설정 (오늘 시작, 3개월 후 종료)
UPDATE clients
SET
  service_start_date = CURRENT_DATE,
  service_end_date = (CURRENT_DATE + INTERVAL '3 months' - INTERVAL '1 day')::DATE
WHERE service_start_date IS NULL AND is_active = true;

-- 3. 서비스 만료 확인용 인덱스
CREATE INDEX IF NOT EXISTS idx_clients_service_end_date
ON clients (service_end_date);

SELECT 'service_start_date, service_end_date columns added! 📅' AS message;
