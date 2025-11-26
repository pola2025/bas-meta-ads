-- ============================================================================
-- Telegram Enabled Column - 텔레그램 발송 ON/OFF
-- ============================================================================

-- clients 테이블에 텔레그램 발송 여부 컬럼 추가
ALTER TABLE clients
ADD COLUMN IF NOT EXISTS telegram_enabled BOOLEAN DEFAULT true;

-- 컬럼 설명 추가
COMMENT ON COLUMN clients.telegram_enabled IS '텔레그램 리포트 발송 여부 (true=발송, false=미발송)';

SELECT 'telegram_enabled column added! 📱' AS message;
