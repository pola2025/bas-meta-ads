-- ============================================================================
-- Enable Row Level Security (RLS) for ALL existing tables
-- ============================================================================
-- 목적: Supabase 보안 경고 해결 및 Service Role 접근 권한 설정
-- 기준: 2025-11-24 현재 존재하는 테이블 목록
-- ============================================================================

-- 1. RLS 활성화 (rowsecurity = false인 테이블들)
ALTER TABLE public.chart_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_aggregates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.producer_errors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.producer_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.raw_data_2025_01 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.raw_data_2025_02 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.raw_data_2025_03 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.raw_data_2025_04 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.raw_data_2025_05 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.raw_data_2025_06 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.raw_data_2025_07 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.raw_data_2025_08 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.raw_data_2025_09 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.raw_data_2025_10 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.raw_data_2025_11 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.raw_data_2025_12 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.token_refresh_logs ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 2. Service Role 전체 접근 Policy 생성
-- ============================================================================
-- Service Role Key를 사용하는 백엔드 스크립트는 모든 데이터에 접근 가능

-- chart_cache
DROP POLICY IF EXISTS "Service role has full access" ON public.chart_cache;
CREATE POLICY "Service role has full access" ON public.chart_cache
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- clients
DROP POLICY IF EXISTS "Service role has full access" ON public.clients;
CREATE POLICY "Service role has full access" ON public.clients
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- daily_aggregates
DROP POLICY IF EXISTS "Service role has full access" ON public.daily_aggregates;
CREATE POLICY "Service role has full access" ON public.daily_aggregates
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- monthly_summary
DROP POLICY IF EXISTS "Service role has full access" ON public.monthly_summary;
CREATE POLICY "Service role has full access" ON public.monthly_summary
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- producer_errors
DROP POLICY IF EXISTS "Service role has full access" ON public.producer_errors;
CREATE POLICY "Service role has full access" ON public.producer_errors
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- producer_executions
DROP POLICY IF EXISTS "Service role has full access" ON public.producer_executions;
CREATE POLICY "Service role has full access" ON public.producer_executions
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- raw_data
DROP POLICY IF EXISTS "Service role has full access" ON public.raw_data;
CREATE POLICY "Service role has full access" ON public.raw_data
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- raw_data_2025_01 ~ 12 (파티션 테이블)
DROP POLICY IF EXISTS "Service role has full access" ON public.raw_data_2025_01;
CREATE POLICY "Service role has full access" ON public.raw_data_2025_01
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role has full access" ON public.raw_data_2025_02;
CREATE POLICY "Service role has full access" ON public.raw_data_2025_02
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role has full access" ON public.raw_data_2025_03;
CREATE POLICY "Service role has full access" ON public.raw_data_2025_03
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role has full access" ON public.raw_data_2025_04;
CREATE POLICY "Service role has full access" ON public.raw_data_2025_04
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role has full access" ON public.raw_data_2025_05;
CREATE POLICY "Service role has full access" ON public.raw_data_2025_05
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role has full access" ON public.raw_data_2025_06;
CREATE POLICY "Service role has full access" ON public.raw_data_2025_06
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role has full access" ON public.raw_data_2025_07;
CREATE POLICY "Service role has full access" ON public.raw_data_2025_07
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role has full access" ON public.raw_data_2025_08;
CREATE POLICY "Service role has full access" ON public.raw_data_2025_08
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role has full access" ON public.raw_data_2025_09;
CREATE POLICY "Service role has full access" ON public.raw_data_2025_09
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role has full access" ON public.raw_data_2025_10;
CREATE POLICY "Service role has full access" ON public.raw_data_2025_10
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role has full access" ON public.raw_data_2025_11;
CREATE POLICY "Service role has full access" ON public.raw_data_2025_11
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role has full access" ON public.raw_data_2025_12;
CREATE POLICY "Service role has full access" ON public.raw_data_2025_12
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- token_refresh_logs
DROP POLICY IF EXISTS "Service role has full access" ON public.token_refresh_logs;
CREATE POLICY "Service role has full access" ON public.token_refresh_logs
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- weekly_summary
DROP POLICY IF EXISTS "Service role has full access" ON public.weekly_summary;
CREATE POLICY "Service role has full access" ON public.weekly_summary
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================================
-- 3. 검증
-- ============================================================================

-- RLS 활성화 확인 (모두 true여야 함)
SELECT
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- Policy 개수 확인 (각 테이블마다 1개씩)
SELECT
    schemaname,
    tablename,
    COUNT(*) as policy_count
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY schemaname, tablename
ORDER BY tablename;
