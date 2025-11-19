-- ============================================================================
-- Timezone-aware SQL Functions
-- All time calculations use 'Asia/Seoul' timezone
-- ============================================================================

-- 1. 파티션 자동 생성 함수 (Timezone 개선) ⭐
CREATE OR REPLACE FUNCTION create_next_month_partition()
RETURNS VOID AS $$
DECLARE
  partition_name TEXT;
  start_date DATE;
  end_date DATE;
  current_time_kst TIMESTAMPTZ;
BEGIN
  -- 현재 시각을 KST로 변환 ⭐
  current_time_kst := NOW() AT TIME ZONE 'Asia/Seoul';

  -- 다음 달 1일 (KST 기준)
  start_date := DATE_TRUNC('month', current_time_kst + INTERVAL '1 month')::DATE;

  -- 다음다음 달 1일
  end_date := DATE_TRUNC('month', current_time_kst + INTERVAL '2 month')::DATE;

  -- 파티션 이름: raw_data_2025_12
  partition_name := 'raw_data_' || TO_CHAR(start_date, 'YYYY_MM');

  -- 파티션 생성 (이미 존재하면 무시)
  BEGIN
    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS %I PARTITION OF raw_data
       FOR VALUES FROM (%L) TO (%L)',
      partition_name,
      start_date,
      end_date
    );

    RAISE NOTICE 'Partition % created for period % to %',
      partition_name, start_date, end_date;

  EXCEPTION
    WHEN duplicate_table THEN
      RAISE NOTICE 'Partition % already exists', partition_name;
    WHEN OTHERS THEN
      RAISE WARNING 'Failed to create partition %: %', partition_name, SQLERRM;
  END;
END;
$$ LANGUAGE plpgsql;

-- 2. 월간 집계 함수 (Timezone 개선) ⭐
CREATE OR REPLACE FUNCTION generate_monthly_summary(
  p_client_id UUID,
  p_year INTEGER,
  p_month INTEGER
) RETURNS VOID AS $$
DECLARE
  month_start_kst DATE;
  month_end_kst DATE;
BEGIN
  -- KST 기준으로 해당 월의 시작일과 종료일 계산 ⭐
  month_start_kst := MAKE_DATE(p_year, p_month, 1);
  month_end_kst := (MAKE_DATE(p_year, p_month, 1) + INTERVAL '1 month')::DATE;

  -- raw_data에서 직접 집계 (weekly_summary 의존 X) ⭐
  INSERT INTO monthly_summary (
    client_id, year, month,
    ad_id, ad_name, campaign_id, campaign_name,
    total_impressions, total_reach, total_clicks, total_leads, total_spend,
    avg_ctr, avg_cpl, week_count,
    created_at
  )
  SELECT
    p_client_id,
    p_year,
    p_month,
    ad_id,
    MAX(ad_name) as ad_name,
    MAX(campaign_id) as campaign_id,
    MAX(campaign_name) as campaign_name,
    SUM(impressions) as total_impressions,
    SUM(reach) as total_reach,
    SUM(clicks) as total_clicks,
    SUM(leads) as total_leads,
    SUM(spend) as total_spend,
    CASE
      WHEN SUM(impressions) > 0
      THEN (SUM(clicks)::DECIMAL / SUM(impressions) * 100)
      ELSE 0
    END as avg_ctr,
    CASE
      WHEN SUM(leads) > 0
      THEN (SUM(spend) / SUM(leads))
      ELSE 0
    END as avg_cpl,
    COUNT(DISTINCT EXTRACT(WEEK FROM date)) as week_count,
    NOW() AT TIME ZONE 'Asia/Seoul' as created_at
  FROM raw_data
  WHERE
    client_id = p_client_id
    AND date >= month_start_kst
    AND date < month_end_kst
  GROUP BY ad_id

  ON CONFLICT (client_id, year, month, ad_id)
  DO UPDATE SET
    total_impressions = EXCLUDED.total_impressions,
    total_reach = EXCLUDED.total_reach,
    total_clicks = EXCLUDED.total_clicks,
    total_leads = EXCLUDED.total_leads,
    total_spend = EXCLUDED.total_spend,
    avg_ctr = EXCLUDED.avg_ctr,
    avg_cpl = EXCLUDED.avg_cpl,
    week_count = EXCLUDED.week_count,
    created_at = EXCLUDED.created_at;

  RAISE NOTICE 'Monthly summary generated for client % (% rows)',
    p_client_id,
    (SELECT COUNT(*) FROM monthly_summary WHERE client_id = p_client_id AND year = p_year AND month = p_month);
END;
$$ LANGUAGE plpgsql;

-- 3. 모든 클라이언트 월간 집계 실행 (KST 기준) ⭐
CREATE OR REPLACE FUNCTION generate_monthly_summary_all_clients()
RETURNS TABLE(client_id UUID, client_name VARCHAR, status TEXT, record_count INTEGER) AS $$
DECLARE
  client_record RECORD;
  last_month_year INTEGER;
  last_month_month INTEGER;
  current_time_kst TIMESTAMPTZ;
  rec_count INTEGER;
BEGIN
  -- 현재 시각을 KST로 변환 ⭐
  current_time_kst := NOW() AT TIME ZONE 'Asia/Seoul';

  -- 지난달 계산 (KST 기준)
  last_month_year := EXTRACT(YEAR FROM current_time_kst - INTERVAL '1 month');
  last_month_month := EXTRACT(MONTH FROM current_time_kst - INTERVAL '1 month');

  RAISE NOTICE 'Generating monthly summary for all clients (Year: %, Month: %)',
    last_month_year, last_month_month;

  -- 모든 활성 클라이언트에 대해 월간 집계 생성
  FOR client_record IN
    SELECT c.id, c.client_name FROM clients c WHERE c.is_active = true
  LOOP
    BEGIN
      PERFORM generate_monthly_summary(
        client_record.id,
        last_month_year,
        last_month_month
      );

      -- 생성된 레코드 수 확인
      SELECT COUNT(*) INTO rec_count
      FROM monthly_summary
      WHERE monthly_summary.client_id = client_record.id
        AND year = last_month_year
        AND month = last_month_month;

      client_id := client_record.id;
      client_name := client_record.client_name;
      status := 'success';
      record_count := rec_count;

      RETURN NEXT;

    EXCEPTION
      WHEN OTHERS THEN
        client_id := client_record.id;
        client_name := client_record.client_name;
        status := 'failed: ' || SQLERRM;
        record_count := 0;

        RETURN NEXT;

        RAISE WARNING 'Failed to generate monthly summary for client %: %',
          client_record.client_name, SQLERRM;
    END;
  END LOOP;

  RAISE NOTICE 'Monthly summary generation completed';
END;
$$ LANGUAGE plpgsql;

-- 4. 토큰 만료 모니터링 함수 (KST 기준) ⭐
CREATE OR REPLACE FUNCTION check_expiring_tokens()
RETURNS TABLE(
  client_id UUID,
  client_name VARCHAR,
  token_expires_at TIMESTAMPTZ,
  days_until_expiry NUMERIC
) AS $$
DECLARE
  current_time_kst TIMESTAMPTZ;
BEGIN
  -- 현재 시각을 KST로 변환
  current_time_kst := NOW() AT TIME ZONE 'Asia/Seoul';

  RETURN QUERY
  SELECT
    c.id,
    c.client_name,
    c.token_expires_at,
    EXTRACT(EPOCH FROM (c.token_expires_at - current_time_kst)) / 86400 as days_until_expiry
  FROM clients c
  WHERE
    c.is_active = true
    AND c.token_expires_at IS NOT NULL
    AND c.token_expires_at < current_time_kst + INTERVAL '7 days'
  ORDER BY c.token_expires_at ASC;
END;
$$ LANGUAGE plpgsql;

-- 5. 주간 집계 함수 (Timezone 개선) ⭐
CREATE OR REPLACE FUNCTION generate_weekly_summary(
  p_client_id UUID,
  p_week_start DATE,
  p_week_end DATE
) RETURNS VOID AS $$
DECLARE
  week_year INTEGER;
  week_number INTEGER;
BEGIN
  -- ISO Week Number 계산
  week_year := EXTRACT(ISOYEAR FROM p_week_start);
  week_number := EXTRACT(WEEK FROM p_week_start);

  -- raw_data에서 주간 집계
  INSERT INTO weekly_summary (
    client_id, week_year, week_number, week_start, week_end,
    ad_id, ad_name, campaign_id, campaign_name,
    total_impressions, total_reach, total_clicks, total_leads,
    total_spend, total_video_views,
    created_at
  )
  SELECT
    p_client_id,
    week_year,
    week_number,
    p_week_start,
    p_week_end,
    ad_id,
    MAX(ad_name),
    MAX(campaign_id),
    MAX(campaign_name),
    SUM(impressions),
    SUM(reach),
    SUM(clicks),
    SUM(leads),
    SUM(spend),
    SUM(video_views),
    NOW() AT TIME ZONE 'Asia/Seoul'
  FROM raw_data
  WHERE
    client_id = p_client_id
    AND date BETWEEN p_week_start AND p_week_end
  GROUP BY ad_id

  ON CONFLICT (client_id, week_year, week_number, ad_id)
  DO UPDATE SET
    total_impressions = EXCLUDED.total_impressions,
    total_reach = EXCLUDED.total_reach,
    total_clicks = EXCLUDED.total_clicks,
    total_leads = EXCLUDED.total_leads,
    total_spend = EXCLUDED.total_spend,
    total_video_views = EXCLUDED.total_video_views,
    created_at = EXCLUDED.created_at;

  RAISE NOTICE 'Weekly summary generated for client % (week %-%)',
    p_client_id, week_year, week_number;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- pg_cron 스케줄 등록 (Timezone 명시)
-- ============================================================================

-- Extension 활성화
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 기존 스케줄 제거 (재실행 시) - 존재하는 경우만
DO $$
BEGIN
  -- 기존 스케줄 삭제 (존재하는 경우만)
  PERFORM cron.unschedule(jobname)
  FROM cron.job
  WHERE jobname IN ('create-next-month-partition', 'generate-monthly-summary', 'check-expiring-tokens');
END $$;

-- ⚠️ 주의: pg_cron은 UTC 기준으로 동작합니다!
-- KST = UTC + 9시간 (예: UTC 00:00 = KST 09:00)

-- 1. 매월 1일 KST 09:00 (UTC 00:00)에 다음 달 파티션 생성
SELECT cron.schedule(
  'create-next-month-partition',
  '0 0 1 * *',  -- UTC 00:00 = KST 09:00
  $$ SELECT create_next_month_partition(); $$
);

-- 2. 매월 1일 KST 10:00 (UTC 01:00)에 지난달 월간 집계 실행
SELECT cron.schedule(
  'generate-monthly-summary',
  '0 1 1 * *',  -- UTC 01:00 = KST 10:00
  $$ SELECT * FROM generate_monthly_summary_all_clients(); $$
);

-- 3. 매일 KST 08:00 (UTC 23:00 전날)에 만료 예정 토큰 확인
SELECT cron.schedule(
  'check-expiring-tokens',
  '0 23 * * *',  -- UTC 23:00 = 다음날 KST 08:00
  $$
  DO $body$
  DECLARE
    expiring_count INTEGER;
    token_record RECORD;
    alert_message TEXT;
  BEGIN
    SELECT COUNT(*) INTO expiring_count
    FROM check_expiring_tokens();

    IF expiring_count > 0 THEN
      RAISE NOTICE '⚠️ % tokens expiring within 7 days', expiring_count;

      -- 만료 예정 토큰 목록 생성
      alert_message := '⚠️ Token Expiry Alert\n\n';

      FOR token_record IN
        SELECT * FROM check_expiring_tokens()
      LOOP
        alert_message := alert_message ||
          token_record.client_name ||
          ': ' ||
          ROUND(token_record.days_until_expiry::NUMERIC, 1) ||
          ' days\n';
      END LOOP;

      -- TODO: Admin 알림 전송 (pg_net 또는 외부 Function)
      -- PERFORM send_admin_alert(alert_message);

      RAISE NOTICE '%', alert_message;
    ELSE
      RAISE NOTICE '✅ All tokens are valid (>7 days until expiry)';
    END IF;
  END $body$;
  $$
);

-- 스케줄 확인
SELECT * FROM cron.job;

COMMENT ON FUNCTION create_next_month_partition IS
'Automatically creates next month partition for raw_data table (KST timezone)';

COMMENT ON FUNCTION generate_monthly_summary IS
'Generates monthly summary for a specific client and month (KST timezone)';

COMMENT ON FUNCTION generate_monthly_summary_all_clients IS
'Generates monthly summary for all active clients (KST timezone)';

COMMENT ON FUNCTION check_expiring_tokens IS
'Returns list of clients with tokens expiring within 7 days (KST timezone)';
