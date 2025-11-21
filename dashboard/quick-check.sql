-- 빠른 데이터 확인
SELECT COUNT(*) as count FROM v_daily_trend_7d;
SELECT COUNT(*) as count FROM v_platform_performance_30d;
SELECT COUNT(*) as count FROM v_top_ads_7d;

-- 샘플 데이터
SELECT * FROM v_daily_trend_7d LIMIT 1;
