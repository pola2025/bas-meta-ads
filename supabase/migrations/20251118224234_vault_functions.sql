-- Vault Functions - Secret management
-- Migration: 20251118224234_vault_functions

-- Function to retrieve secrets from Vault
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

-- Grant permissions
GRANT EXECUTE ON FUNCTION vault_read_secret(UUID) TO service_role;

-- Add description
COMMENT ON FUNCTION vault_read_secret IS
'Retrieves a decrypted secret from Supabase Vault by UUID';
