-- Check existing partitions
SELECT tablename
FROM pg_tables
WHERE tablename LIKE 'raw_data_2025%'
ORDER BY tablename;
