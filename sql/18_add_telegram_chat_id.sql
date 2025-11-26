-- ============================================================================
-- clients 테이블에 telegram_chat_id 컬럼 추가
-- ============================================================================
-- 목적: 클라이언트별 텔레그램 채팅 ID 저장
-- 날짜: 2025-11-26
-- ============================================================================

-- telegram_chat_id 컬럼 추가
ALTER TABLE clients
ADD COLUMN IF NOT EXISTS telegram_chat_id VARCHAR(50);

-- 인덱스 추가 (텔레그램 발송 시 조회용)
CREATE INDEX IF NOT EXISTS idx_clients_telegram_chat_id ON clients(telegram_chat_id);

-- 코멘트
COMMENT ON COLUMN clients.telegram_chat_id IS '텔레그램 채팅 ID (리포트 발송용)';

-- 확인
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'clients'
ORDER BY ordinal_position;
