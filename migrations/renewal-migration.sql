-- 연장관리 시스템 마이그레이션
-- Supabase SQL Editor에서 실행

-- 1. clients 테이블에 컬럼 추가
ALTER TABLE clients ADD COLUMN IF NOT EXISTS service_end_date DATE;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS contact_phone VARCHAR(20);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS contact_name VARCHAR(50);

-- 2. sms_logs 테이블 생성 (clients.id가 UUID 타입)
CREATE TABLE IF NOT EXISTS sms_logs (
  id SERIAL PRIMARY KEY,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  message_type VARCHAR(20) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  request_id VARCHAR(100),
  error TEXT,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_sms_logs_client_id ON sms_logs(client_id);
CREATE INDEX IF NOT EXISTS idx_sms_logs_sent_at ON sms_logs(sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_clients_end_date ON clients(service_end_date);

-- 4. 기존 클라이언트 기본 종료일 설정 (시작일 + 3개월)
UPDATE clients
SET service_end_date = service_start_date + INTERVAL '3 months'
WHERE service_end_date IS NULL AND service_start_date IS NOT NULL;

-- 5. 시작일이 없는 경우 오늘 + 3개월
UPDATE clients
SET service_end_date = CURRENT_DATE + INTERVAL '3 months'
WHERE service_end_date IS NULL;

-- 확인
SELECT id, client_name, service_start_date, service_end_date, contact_phone, contact_name
FROM clients
ORDER BY service_end_date;
