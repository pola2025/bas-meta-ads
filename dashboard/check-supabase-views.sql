-- Supabase 뷰 확인 스크립트
-- Supabase SQL Editor에서 실행하세요

-- 1. 모든 뷰 목록 확인
SELECT
    schemaname,
    viewname,
    viewowner
FROM pg_views
WHERE schemaname = 'public'
ORDER BY viewname;

-- 2. v_daily_trend_7d 뷰 존재 확인
SELECT EXISTS (
    SELECT 1
    FROM pg_views
    WHERE schemaname = 'public'
    AND viewname = 'v_daily_trend_7d'
) AS view_exists;

-- 3. v_platform_performance_30d 뷰 존재 확인
SELECT EXISTS (
    SELECT 1
    FROM pg_views
    WHERE schemaname = 'public'
    AND viewname = 'v_platform_performance_30d'
) AS view_exists;

-- 4. v_top_ads_7d 뷰 존재 확인
SELECT EXISTS (
    SELECT 1
    FROM pg_views
    WHERE schemaname = 'public'
    AND viewname = 'v_top_ads_7d'
) AS view_exists;

-- 5. 각 뷰의 데이터 확인
SELECT 'v_daily_trend_7d' AS view_name, COUNT(*) AS row_count
FROM v_daily_trend_7d
UNION ALL
SELECT 'v_platform_performance_30d', COUNT(*)
FROM v_platform_performance_30d
UNION ALL
SELECT 'v_top_ads_7d', COUNT(*)
FROM v_top_ads_7d;

-- 6. RLS (Row Level Security) 정책 확인
SELECT
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN ('v_daily_trend_7d', 'v_platform_performance_30d', 'v_top_ads_7d');
