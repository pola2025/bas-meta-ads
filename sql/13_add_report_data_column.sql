-- ============================================================================
-- telegram_reports 테이블에 report_data JSON 컬럼 추가
-- ============================================================================
-- 목적: 구조화된 리포트 데이터 저장 (광고별, 캠페인별, 일별/주별 데이터)
-- 생성일: 2025-11-25
-- ============================================================================

-- report_data JSON 컬럼 추가
ALTER TABLE telegram_reports
ADD COLUMN IF NOT EXISTS report_data JSONB;

-- 코멘트
COMMENT ON COLUMN telegram_reports.report_data IS '구조화된 리포트 데이터 (JSON): 광고별, 캠페인별, 일별/주별 상세 데이터';

-- ============================================================================
-- report_data JSON 구조 예시
-- ============================================================================
/*
{
  "summary": {
    "impressions": 50000,
    "clicks": 1075,
    "leads": 86,
    "spend": 1410.63,
    "cpl": 16.40,
    "ctr": 2.15,
    "conversion_rate": 8.0
  },
  "comparison": {
    "prev_impressions": 48000,
    "prev_clicks": 980,
    "prev_leads": 80,
    "prev_spend": 1424.82,
    "prev_cpl": 17.81,
    "prev_ctr": 2.04
  },
  "daily_stats": [
    { "date": "2025-05-01", "leads": 3, "spend": 45.20, "cpl": 15.07 },
    { "date": "2025-05-02", "leads": 4, "spend": 52.30, "cpl": 13.08 },
    ...
  ],
  "weekly_stats": [
    { "week": 1, "label": "05/01~05/07", "leads": 24, "spend": 340.80, "cpl": 14.20 },
    { "week": 2, "label": "05/08~05/14", "leads": 18, "spend": 333.00, "cpl": 18.50 },
    ...
  ],
  "day_of_week_stats": [
    { "day": "월", "leads": 14, "percent": 16.3 },
    { "day": "화", "leads": 15, "percent": 17.4 },
    ...
  ],
  "ad_performance": [
    {
      "ad_id": "123456",
      "ad_name": "20250510_무료상담_A",
      "leads": 22,
      "spend": 280.45,
      "cpl": 12.75,
      "ctr": 2.85,
      "spend_percent": 19.9,
      "lead_percent": 25.6
    },
    ...
  ],
  "campaign_performance": [
    {
      "campaign_id": "789",
      "campaign_name": "비즈액터스쿨_리드확보",
      "leads": 62,
      "spend": 950.45,
      "cpl": 15.33,
      "spend_percent": 67.4,
      "lead_percent": 72.1
    },
    ...
  ]
}
*/

SELECT 'report_data 컬럼 추가 완료' as status;
