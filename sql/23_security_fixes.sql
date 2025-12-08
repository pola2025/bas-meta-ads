-- ============================================================================
-- Supabase Security Advisor 보안 문제 수정
-- ============================================================================
-- 생성일: 2025-12-03
-- 목적: Security Advisor에서 경고한 7개 보안 문제 해결
-- 프로젝트: META_ prefix (mpljqcuqrrfwzamfyxnz)
-- ============================================================================

-- ============================================================================
-- 1. notification_logs 테이블 RLS 활성화 및 정책 추가
-- ============================================================================
-- 문제: RLS가 활성화되지 않음
-- 해결: RLS 활성화 + service_role 전용 접근 정책

ALTER TABLE notification_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role has full access" ON notification_logs;
CREATE POLICY "Service role has full access" ON notification_logs
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================================
-- 2. raw_data anon 접근 정책 수정 (USING true → 조건부)
-- ============================================================================
-- 문제: anon 키로 모든 raw_data 접근 가능 (USING (true))
-- 해결: anon 접근 정책 제거, authenticated + service_role만 허용
-- 참고: 대시보드는 service_role 키 사용하도록 변경 필요

-- 기존 위험한 정책 제거
DROP POLICY IF EXISTS "Allow anon read access for raw_data" ON raw_data;

-- anon 접근 완전 차단 (읽기 전용도 불가)
-- 대시보드 API는 service_role 키를 사용해야 함

-- ============================================================================
-- 3. payment_history RLS 정책 수정 (TO 절 추가)
-- ============================================================================
-- 문제: CREATE POLICY에 TO 절이 없어 모든 role에 적용됨
-- 해결: service_role에만 적용

DROP POLICY IF EXISTS "Allow all for service role" ON payment_history;
CREATE POLICY "Service role has full access" ON payment_history
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================================
-- 4. SECURITY DEFINER 함수 보안 강화
-- ============================================================================
-- 문제: SECURITY DEFINER 함수는 정의자 권한으로 실행되어 위험
-- 해결: search_path 고정 + 권한 제한

-- vault_read_secret 함수 재정의 (보안 강화)
CREATE OR REPLACE FUNCTION vault_read_secret(
  secret_id UUID
) RETURNS JSON AS $$
DECLARE
  secret_value TEXT;
BEGIN
  -- 호출자가 service_role인지 확인
  IF NOT (SELECT rolname FROM pg_roles WHERE oid = pg_backend_pid()) = 'service_role' THEN
    RAISE EXCEPTION 'Access denied: service_role only';
  END IF;

  SELECT decrypted_secret INTO secret_value
  FROM vault.decrypted_secrets
  WHERE id = secret_id;

  IF secret_value IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN json_build_object('secret', secret_value);
END;
$$ LANGUAGE plpgsql
   SECURITY DEFINER
   SET search_path = public, vault;

-- 권한 재설정 (service_role만)
REVOKE ALL ON FUNCTION vault_read_secret(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION vault_read_secret(UUID) TO service_role;

-- cleanup_old_notification_logs 함수 보안 강화
CREATE OR REPLACE FUNCTION cleanup_old_notification_logs()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM notification_logs
  WHERE sent_at < NOW() - INTERVAL '30 days';

  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql
   SECURITY DEFINER
   SET search_path = public;

REVOKE ALL ON FUNCTION cleanup_old_notification_logs() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION cleanup_old_notification_logs() TO service_role;

-- ============================================================================
-- 5. 2026년 파티션 테이블 RLS 적용 (미리 준비)
-- ============================================================================
-- 2026년 파티션이 생성되면 자동으로 RLS 적용되도록
-- 현재 존재하는 테이블만 처리

DO $$
DECLARE
  partition_name TEXT;
BEGIN
  FOR partition_name IN
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public'
    AND tablename LIKE 'raw_data_2026_%'
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', partition_name);
    EXECUTE format('DROP POLICY IF EXISTS "Service role has full access" ON %I', partition_name);
    EXECUTE format('CREATE POLICY "Service role has full access" ON %I FOR ALL TO service_role USING (true) WITH CHECK (true)', partition_name);
    RAISE NOTICE 'RLS enabled for %', partition_name;
  END LOOP;
END;
$$;

-- ============================================================================
-- 6. telegram_reports 테이블 RLS 확인 및 적용
-- ============================================================================

-- telegram_reports 테이블이 존재하면 RLS 적용
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'telegram_reports') THEN
    EXECUTE 'ALTER TABLE telegram_reports ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "Service role has full access" ON telegram_reports';
    EXECUTE 'CREATE POLICY "Service role has full access" ON telegram_reports FOR ALL TO service_role USING (true) WITH CHECK (true)';
    RAISE NOTICE 'telegram_reports RLS enabled';
  END IF;
END;
$$;

-- ============================================================================
-- 7. 모든 테이블 RLS 상태 검증
-- ============================================================================

-- RLS가 비활성화된 테이블 목록 (이 쿼리 결과가 비어있어야 함)
SELECT
  schemaname,
  tablename,
  'RLS DISABLED - SECURITY RISK!' as status
FROM pg_tables
WHERE schemaname = 'public'
  AND NOT rowsecurity
  AND tablename NOT LIKE 'pg_%'
  AND tablename NOT IN ('schema_migrations', 'spatial_ref_sys')
ORDER BY tablename;

-- ============================================================================
-- 8. 정책 현황 확인
-- ============================================================================

-- 각 테이블의 정책 개수 확인
SELECT
  t.tablename,
  t.rowsecurity as rls_enabled,
  COALESCE(p.policy_count, 0) as policy_count,
  CASE
    WHEN NOT t.rowsecurity THEN '❌ RLS 비활성화'
    WHEN COALESCE(p.policy_count, 0) = 0 THEN '⚠️ 정책 없음'
    ELSE '✅ 정상'
  END as status
FROM pg_tables t
LEFT JOIN (
  SELECT tablename, COUNT(*) as policy_count
  FROM pg_policies
  WHERE schemaname = 'public'
  GROUP BY tablename
) p ON t.tablename = p.tablename
WHERE t.schemaname = 'public'
  AND t.tablename NOT LIKE 'pg_%'
ORDER BY t.tablename;

-- ============================================================================
-- 완료
-- ============================================================================
SELECT '✅ Security fixes applied successfully!' AS message;
