-- FIX: Resolve week_year ambiguous column reference error
-- Changed variable names from week_year/week_number to v_week_year/v_week_number
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
    p_client_id, v_week_year, v_week_number;
END;
$$ LANGUAGE plpgsql;
