-- ============================================================================
-- Vault Token Management - Meta Access Token 저장/조회 함수
-- ============================================================================

-- 1. Vault에 Secret 저장 함수
CREATE OR REPLACE FUNCTION vault_store_secret(
  p_secret_name TEXT,
  p_secret_value TEXT,
  p_description TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_secret_id UUID;
BEGIN
  -- Vault에 secret 저장
  INSERT INTO vault.secrets (name, secret, description)
  VALUES (p_secret_name, p_secret_value, p_description)
  RETURNING id INTO v_secret_id;

  RETURN v_secret_id;
EXCEPTION
  WHEN unique_violation THEN
    -- 이미 존재하면 업데이트
    UPDATE vault.secrets
    SET secret = p_secret_value,
        description = p_description,
        updated_at = NOW()
    WHERE name = p_secret_name
    RETURNING id INTO v_secret_id;

    RETURN v_secret_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Vault에서 Secret 삭제 함수
CREATE OR REPLACE FUNCTION vault_delete_secret(
  p_secret_id UUID
) RETURNS BOOLEAN AS $$
BEGIN
  DELETE FROM vault.secrets WHERE id = p_secret_id;
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. 클라이언트용 Meta Access Token 저장 함수
CREATE OR REPLACE FUNCTION store_client_meta_token(
  p_client_id UUID,
  p_access_token TEXT
) RETURNS UUID AS $$
DECLARE
  v_secret_id UUID;
  v_secret_name TEXT;
  v_old_token_id UUID;
BEGIN
  -- 기존 토큰 ID 조회
  SELECT meta_access_token_id INTO v_old_token_id
  FROM clients
  WHERE id = p_client_id;

  -- 기존 토큰이 있으면 삭제
  IF v_old_token_id IS NOT NULL THEN
    DELETE FROM vault.secrets WHERE id = v_old_token_id;
  END IF;

  -- 새 토큰 저장
  v_secret_name := 'meta_token_' || p_client_id::TEXT;

  INSERT INTO vault.secrets (name, secret, description)
  VALUES (
    v_secret_name,
    p_access_token,
    'Meta Access Token for client ' || p_client_id::TEXT
  )
  RETURNING id INTO v_secret_id;

  -- clients 테이블 업데이트
  UPDATE clients
  SET
    meta_access_token_id = v_secret_id,
    auth_status = 'active',
    updated_at = NOW()
  WHERE id = p_client_id;

  RETURN v_secret_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. 클라이언트의 Meta Access Token 조회 함수
CREATE OR REPLACE FUNCTION get_client_meta_token(
  p_client_id UUID
) RETURNS TEXT AS $$
DECLARE
  v_token_id UUID;
  v_token TEXT;
BEGIN
  -- 클라이언트의 토큰 ID 조회
  SELECT meta_access_token_id INTO v_token_id
  FROM clients
  WHERE id = p_client_id AND is_active = true;

  IF v_token_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Vault에서 복호화된 토큰 조회
  SELECT decrypted_secret INTO v_token
  FROM vault.decrypted_secrets
  WHERE id = v_token_id;

  RETURN v_token;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. 모든 활성 클라이언트의 토큰 조회 함수 (Worker용)
CREATE OR REPLACE FUNCTION get_all_client_tokens()
RETURNS TABLE (
  client_id UUID,
  client_name VARCHAR(100),
  meta_ad_account_id VARCHAR(50),
  access_token TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id AS client_id,
    c.client_name,
    c.meta_ad_account_id,
    v.decrypted_secret AS access_token
  FROM clients c
  LEFT JOIN vault.decrypted_secrets v ON c.meta_access_token_id = v.id
  WHERE c.is_active = true
    AND c.meta_ad_account_id IS NOT NULL
    AND c.meta_access_token_id IS NOT NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 권한 설정
GRANT EXECUTE ON FUNCTION vault_store_secret(TEXT, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION vault_delete_secret(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION store_client_meta_token(UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION get_client_meta_token(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION get_all_client_tokens() TO service_role;

-- 코멘트
COMMENT ON FUNCTION store_client_meta_token IS '클라이언트의 Meta Access Token을 Vault에 안전하게 저장';
COMMENT ON FUNCTION get_client_meta_token IS '클라이언트의 Meta Access Token을 Vault에서 복호화하여 조회';
COMMENT ON FUNCTION get_all_client_tokens IS '모든 활성 클라이언트의 토큰 정보 조회 (Worker용)';

SELECT 'Vault token management functions created! 🔐' AS message;
