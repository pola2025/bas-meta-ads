-- ============================================================================
-- Create Historical Partitions for raw_data (Jan-Oct 2025)
-- ============================================================================

-- January 2025
CREATE TABLE IF NOT EXISTS raw_data_2025_01 PARTITION OF raw_data
  FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');

-- February 2025
CREATE TABLE IF NOT EXISTS raw_data_2025_02 PARTITION OF raw_data
  FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');

-- March 2025
CREATE TABLE IF NOT EXISTS raw_data_2025_03 PARTITION OF raw_data
  FOR VALUES FROM ('2025-03-01') TO ('2025-04-01');

-- April 2025
CREATE TABLE IF NOT EXISTS raw_data_2025_04 PARTITION OF raw_data
  FOR VALUES FROM ('2025-04-01') TO ('2025-05-01');

-- May 2025
CREATE TABLE IF NOT EXISTS raw_data_2025_05 PARTITION OF raw_data
  FOR VALUES FROM ('2025-05-01') TO ('2025-06-01');

-- June 2025
CREATE TABLE IF NOT EXISTS raw_data_2025_06 PARTITION OF raw_data
  FOR VALUES FROM ('2025-06-01') TO ('2025-07-01');

-- July 2025
CREATE TABLE IF NOT EXISTS raw_data_2025_07 PARTITION OF raw_data
  FOR VALUES FROM ('2025-07-01') TO ('2025-08-01');

-- August 2025
CREATE TABLE IF NOT EXISTS raw_data_2025_08 PARTITION OF raw_data
  FOR VALUES FROM ('2025-08-01') TO ('2025-09-01');

-- September 2025
CREATE TABLE IF NOT EXISTS raw_data_2025_09 PARTITION OF raw_data
  FOR VALUES FROM ('2025-09-01') TO ('2025-10-01');

-- October 2025
CREATE TABLE IF NOT EXISTS raw_data_2025_10 PARTITION OF raw_data
  FOR VALUES FROM ('2025-10-01') TO ('2025-11-01');

-- Verify partitions
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE tablename LIKE 'raw_data_2025_%'
ORDER BY tablename;
