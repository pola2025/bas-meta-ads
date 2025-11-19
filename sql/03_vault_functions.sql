-- ============================================================================
-- Vault Functions - Secret 관리 함수
-- ============================================================================

-- Vault에서 Secret 조회 함수
CREATE OR REPLACE FUNCTION vault_read_secret(
  secret_id UUID
) RETURNS JSON AS $$
DECLARE
  secret_value TEXT;
BEGIN
  SELECT decrypted_secret INTO secret_value
  FROM vault.decrypted_secrets
  WHERE id = secret_id;

  IF secret_value IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN json_build_object('secret', secret_value);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 함수 권한 설정
GRANT EXECUTE ON FUNCTION vault_read_secret(UUID) TO service_role;

-- 테스트: Access Token 조회
SELECT vault_read_secret('8d930f47-392b-4f17-b88a-8ff532f162f0'::UUID);

COMMENT ON FUNCTION vault_read_secret IS
'Retrieves a decrypted secret from Supabase Vault by UUID';
