-- ============================================================================
-- Enable Row Level Security (RLS) for all tables
-- ============================================================================
-- 목적: Supabase 보안 경고 해결 및 Service Role 접근 권한 설정
-- ============================================================================

-- 1. RLS 활성화
ALTER TABLE IF EXISTS public.chart_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.meta_raw_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.daily_aggregates ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.weekly_summary ENABLE ROW LEVEL SECURITY;

-- 2. Service Role 전체 접근 Policy 생성
-- Service Role Key를 사용하는 백엔드 스크립트는 모든 데이터에 접근 가능

-- chart_cache
DROP POLICY IF EXISTS "Service role has full access" ON public.chart_cache;
CREATE POLICY "Service role has full access" ON public.chart_cache
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- clients
DROP POLICY IF EXISTS "Service role has full access" ON public.clients;
CREATE POLICY "Service role has full access" ON public.clients
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- meta_raw_data
DROP POLICY IF EXISTS "Service role has full access" ON public.meta_raw_data;
CREATE POLICY "Service role has full access" ON public.meta_raw_data
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- daily_aggregates
DROP POLICY IF EXISTS "Service role has full access" ON public.daily_aggregates;
CREATE POLICY "Service role has full access" ON public.daily_aggregates
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- weekly_summary
DROP POLICY IF EXISTS "Service role has full access" ON public.weekly_summary;
CREATE POLICY "Service role has full access" ON public.weekly_summary
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- 검증
-- ============================================================================

-- RLS 활성화 확인
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('chart_cache', 'clients', 'meta_raw_data', 'daily_aggregates', 'weekly_summary');

-- Policy 확인
SELECT schemaname, tablename, policyname, roles, cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('chart_cache', 'clients', 'meta_raw_data', 'daily_aggregates', 'weekly_summary');
