-- FIX: weekly_summary should use week_start and week_end as part of unique constraint
-- Problem: Different date ranges with same ISO week number were conflicting

-- Step 1: Drop existing constraint
ALTER TABLE weekly_summary DROP CONSTRAINT IF EXISTS weekly_summary_client_id_week_year_week_number_ad_id_key;

-- Step 2: Add new constraint with week_start and week_end
ALTER TABLE weekly_summary
  ADD CONSTRAINT weekly_summary_client_id_week_start_week_end_ad_id_key
  UNIQUE (client_id, week_start, week_end, ad_id);

-- Step 3: Update generate_weekly_summary function
CREATE OR REPLACE FUNCTION generate_weekly_summary(
  p_client_id UUID,
  p_week_start DATE,
  p_week_end DATE
) RETURNS VOID AS $$
DECLARE
  v_week_year INTEGER;
  v_week_number INTEGER;
BEGIN
  -- Calculate ISO Week Number
  v_week_year := EXTRACT(ISOYEAR FROM p_week_start);
  v_week_number := EXTRACT(WEEK FROM p_week_start);

  -- Aggregate weekly data from raw_data
  INSERT INTO weekly_summary (
    client_id, week_year, week_number, week_start, week_end,
    ad_id, ad_name, campaign_id, campaign_name,
    total_impressions, total_reach, total_clicks, total_leads,
    total_spend, total_video_views,
    created_at
  )
  SELECT
    p_client_id,
    v_week_year,
    v_week_number,
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

  -- FIXED: Use week_start and week_end instead of week_year and week_number
  ON CONFLICT (client_id, week_start, week_end, ad_id)
  DO UPDATE SET
    week_year = EXCLUDED.week_year,
    week_number = EXCLUDED.week_number,
    ad_name = EXCLUDED.ad_name,
    campaign_id = EXCLUDED.campaign_id,
    campaign_name = EXCLUDED.campaign_name,
    total_impressions = EXCLUDED.total_impressions,
    total_reach = EXCLUDED.total_reach,
    total_clicks = EXCLUDED.total_clicks,
    total_leads = EXCLUDED.total_leads,
    total_spend = EXCLUDED.total_spend,
    total_video_views = EXCLUDED.total_video_views,
    created_at = EXCLUDED.created_at;

  RAISE NOTICE 'Weekly summary generated for client % (% ~ %)',
    p_client_id, p_week_start, p_week_end;
END;
$$ LANGUAGE plpgsql;
