-- ============================================================================
-- Create daily_aggregates table if not exists
-- ============================================================================
-- 목적: 일별 광고 성과 집계 테이블 생성
-- 데이터 소스: raw_data (파티션 테이블)
-- ============================================================================

-- 1. 테이블 생성
CREATE TABLE IF NOT EXISTS public.daily_aggregates (
    id BIGSERIAL PRIMARY KEY,
    date DATE NOT NULL,
    client_id TEXT NOT NULL,
    ad_id TEXT NOT NULL,
    ad_name TEXT,
    campaign_id TEXT,
    campaign_name TEXT,
    adset_id TEXT,
    adset_name TEXT,

    -- 성과 지표
    impressions INTEGER DEFAULT 0,
    clicks INTEGER DEFAULT 0,
    leads INTEGER DEFAULT 0,
    spend DECIMAL(10,2) DEFAULT 0,

    -- 계산된 지표 (미리 계산하지 않음, 쿼리 시 SUM 후 계산)
    ctr DECIMAL(5,2),  -- 참고용 (사용 시 주의)
    cpl DECIMAL(10,2), -- 참고용 (사용 시 주의)
    conversion_rate DECIMAL(5,2), -- 참고용 (사용 시 주의)

    -- 메타데이터
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    -- 유니크 제약조건 (날짜별 + 광고별)
    UNIQUE(date, client_id, ad_id)
);

-- 2. 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_daily_aggregates_date ON public.daily_aggregates(date);
CREATE INDEX IF NOT EXISTS idx_daily_aggregates_client ON public.daily_aggregates(client_id);
CREATE INDEX IF NOT EXISTS idx_daily_aggregates_ad ON public.daily_aggregates(ad_id);
CREATE INDEX IF NOT EXISTS idx_daily_aggregates_campaign ON public.daily_aggregates(campaign_id);
CREATE INDEX IF NOT EXISTS idx_daily_aggregates_date_client ON public.daily_aggregates(date, client_id);

-- 3. RLS 활성화
ALTER TABLE public.daily_aggregates ENABLE ROW LEVEL SECURITY;

-- 4. Service Role Policy
DROP POLICY IF EXISTS "Service role has full access" ON public.daily_aggregates;
CREATE POLICY "Service role has full access" ON public.daily_aggregates
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 5. 코멘트
COMMENT ON TABLE public.daily_aggregates IS '일별 광고 성과 집계 테이블 (raw_data에서 생성)';
COMMENT ON COLUMN public.daily_aggregates.ctr IS 'Click-Through Rate (%) - 주의: 평균의 함정, 쿼리 시 SUM 후 계산 필요';
COMMENT ON COLUMN public.daily_aggregates.cpl IS 'Cost Per Lead ($) - 주의: 평균의 함정, 쿼리 시 SUM 후 계산 필요';
COMMENT ON COLUMN public.daily_aggregates.conversion_rate IS 'Conversion Rate (%) - 주의: 평균의 함정, 쿼리 시 SUM 후 계산 필요';

-- ============================================================================
-- 6. 초기 데이터 채우기 (옵션)
-- ============================================================================
-- raw_data에서 daily_aggregates로 집계 (최근 30일)
/*
INSERT INTO public.daily_aggregates (
    date, client_id, ad_id, ad_name, campaign_id, campaign_name, adset_id, adset_name,
    impressions, clicks, leads, spend, ctr, cpl, conversion_rate
)
SELECT
    date_trunc('day', created_at)::date as date,
    'default_client' as client_id,  -- 실제 client_id로 변경 필요
    ad_id,
    ad_name,
    campaign_id,
    campaign_name,
    adset_id,
    adset_name,
    SUM(impressions) as impressions,
    SUM(clicks) as clicks,
    SUM(leads) as leads,
    SUM(spend) as spend,
    CASE
        WHEN SUM(impressions) > 0 THEN (SUM(clicks)::decimal / SUM(impressions) * 100)
        ELSE 0
    END as ctr,
    CASE
        WHEN SUM(leads) > 0 THEN (SUM(spend) / SUM(leads))
        ELSE 0
    END as cpl,
    CASE
        WHEN SUM(clicks) > 0 THEN (SUM(leads)::decimal / SUM(clicks) * 100)
        ELSE 0
    END as conversion_rate
FROM public.raw_data
WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY date, ad_id, ad_name, campaign_id, campaign_name, adset_id, adset_name
ON CONFLICT (date, client_id, ad_id) DO UPDATE SET
    ad_name = EXCLUDED.ad_name,
    campaign_id = EXCLUDED.campaign_id,
    campaign_name = EXCLUDED.campaign_name,
    adset_id = EXCLUDED.adset_id,
    adset_name = EXCLUDED.adset_name,
    impressions = EXCLUDED.impressions,
    clicks = EXCLUDED.clicks,
    leads = EXCLUDED.leads,
    spend = EXCLUDED.spend,
    ctr = EXCLUDED.ctr,
    cpl = EXCLUDED.cpl,
    conversion_rate = EXCLUDED.conversion_rate,
    updated_at = NOW();
*/

-- ============================================================================
-- 7. 검증
-- ============================================================================

-- 데이터 개수 확인
SELECT COUNT(*) as total_rows FROM public.daily_aggregates;

-- 최근 데이터 샘플
SELECT date, ad_name, impressions, clicks, leads, spend
FROM public.daily_aggregates
ORDER BY date DESC
LIMIT 5;

-- 테이블 정보 확인 (컬럼 목록)
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'daily_aggregates'
ORDER BY ordinal_position;
