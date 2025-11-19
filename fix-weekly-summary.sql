-- 5. 주간 집계 함수 (Timezone 개선) ⭐ FIX: week_year ambiguous 에러 해결
CREATE OR REPLACE FUNCTION generate_weekly_summary(
  p_client_id UUID,
  p_week_start DATE,
  p_week_end DATE
) RETURNS VOID AS $$
DECLARE
  v_week_year INTEGER;      -- v_ 접두사로 변수임을 명확히
  v_week_number INTEGER;    -- v_ 접두사로 변수임을 명확히
BEGIN
  -- ISO Week Number 계산
  v_week_year := EXTRACT(ISOYEAR FROM p_week_start);
  v_week_number := EXTRACT(WEEK FROM p_week_start);

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
    v_week_year,          -- v_ 접두사 사용
    v_week_number,        -- v_ 접두사 사용
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
