-- ============================================================================
-- 데이터 확인 스크립트
-- Supabase SQL Editor에서 실행하세요
-- ============================================================================

-- 1. raw_data 테이블 존재 확인
SELECT tablename
FROM pg_tables
WHERE schemaname = 'public'
AND tablename LIKE 'raw_data%'
ORDER BY tablename;

-- 2. 각 테이블의 데이터 개수 확인
SELECT 'raw_data_2025_09' as table_name, COUNT(*) as row_count FROM raw_data_2025_09
UNION ALL
SELECT 'raw_data_2025_10', COUNT(*) FROM raw_data_2025_10
UNION ALL
SELECT 'raw_data_2025_11', COUNT(*) FROM raw_data_2025_11;

-- 3. 최근 데이터 날짜 확인
SELECT
  MIN(date) as earliest_date,
  MAX(date) as latest_date,
  COUNT(*) as total_rows
FROM raw_data_2025_11;

-- 4. 뷰에서 데이터 확인
SELECT COUNT(*) as row_count FROM v_daily_trend_7d;

-- 5. 실제 데이터 샘플 확인 (v_daily_trend_7d)
SELECT * FROM v_daily_trend_7d ORDER BY date DESC LIMIT 3;

-- 6. 플랫폼별 데이터 확인
SELECT * FROM v_platform_performance_30d;

-- 7. Top 광고 확인
SELECT * FROM v_top_ads_7d LIMIT 3;
