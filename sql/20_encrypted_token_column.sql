-- ============================================================================
-- Encrypted Token Column - Vault 대신 AES 암호화 토큰 저장
-- ============================================================================

-- 1. clients 테이블에 암호화된 토큰 컬럼 추가
ALTER TABLE clients
ADD COLUMN IF NOT EXISTS encrypted_access_token TEXT;

-- 컬럼 설명 추가
COMMENT ON COLUMN clients.encrypted_access_token IS 'AES-256-CBC로 암호화된 Meta Access Token (Node.js에서 암호화/복호화)';

-- 2. 기존 Vault 관련 컬럼은 유지 (호환성)
-- meta_access_token_id, meta_refresh_token_id는 그대로 두고
-- 새로운 encrypted_access_token 컬럼 사용

-- 3. 인덱스 추가 (토큰 존재 여부 빠른 확인)
CREATE INDEX IF NOT EXISTS idx_clients_has_token
ON clients ((encrypted_access_token IS NOT NULL));

SELECT 'encrypted_access_token column added! 🔐' AS message;
