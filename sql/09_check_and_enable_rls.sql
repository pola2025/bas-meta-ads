-- ============================================================================
-- Check existing tables and enable RLS
-- ============================================================================

-- 1. 먼저 현재 존재하는 테이블 확인
SELECT schemaname, tablename
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- ============================================================================
-- 2. 존재하는 테이블에만 RLS 활성화
-- ============================================================================

-- chart_cache (존재하는 경우)
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'chart_cache') THEN
        ALTER TABLE public.chart_cache ENABLE ROW LEVEL SECURITY;

        DROP POLICY IF EXISTS "Service role has full access" ON public.chart_cache;
        CREATE POLICY "Service role has full access" ON public.chart_cache
          FOR ALL
          TO service_role
          USING (true)
          WITH CHECK (true);

        RAISE NOTICE 'RLS enabled for chart_cache';
    END IF;
END $$;

-- clients (존재하는 경우)
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'clients') THEN
        ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

        DROP POLICY IF EXISTS "Service role has full access" ON public.clients;
        CREATE POLICY "Service role has full access" ON public.clients
          FOR ALL
          TO service_role
          USING (true)
          WITH CHECK (true);

        RAISE NOTICE 'RLS enabled for clients';
    END IF;
END $$;

-- daily_aggregates (존재하는 경우)
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'daily_aggregates') THEN
        ALTER TABLE public.daily_aggregates ENABLE ROW LEVEL SECURITY;

        DROP POLICY IF EXISTS "Service role has full access" ON public.daily_aggregates;
        CREATE POLICY "Service role has full access" ON public.daily_aggregates
          FOR ALL
          TO service_role
          USING (true)
          WITH CHECK (true);

        RAISE NOTICE 'RLS enabled for daily_aggregates';
    END IF;
END $$;

-- weekly_summary (존재하는 경우)
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'weekly_summary') THEN
        ALTER TABLE public.weekly_summary ENABLE ROW LEVEL SECURITY;

        DROP POLICY IF EXISTS "Service role has full access" ON public.weekly_summary;
        CREATE POLICY "Service role has full access" ON public.weekly_summary
          FOR ALL
          TO service_role
          USING (true)
          WITH CHECK (true);

        RAISE NOTICE 'RLS enabled for weekly_summary';
    END IF;
END $$;

-- daily_insights (존재하는 경우)
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'daily_insights') THEN
        ALTER TABLE public.daily_insights ENABLE ROW LEVEL SECURITY;

        DROP POLICY IF EXISTS "Service role has full access" ON public.daily_insights;
        CREATE POLICY "Service role has full access" ON public.daily_insights
          FOR ALL
          TO service_role
          USING (true)
          WITH CHECK (true);

        RAISE NOTICE 'RLS enabled for daily_insights';
    END IF;
END $$;

-- ============================================================================
-- 3. 검증
-- ============================================================================

-- RLS 활성화 확인
SELECT
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- Policy 확인
SELECT
    schemaname,
    tablename,
    policyname,
    roles::text[],
    cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
