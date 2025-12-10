-- 광고 메타데이터 캐시 테이블
-- Meta API 호출 최소화를 위한 캐시 저장소

CREATE TABLE IF NOT EXISTS ad_cache (
  client_id UUID PRIMARY KEY REFERENCES clients(id) ON DELETE CASCADE,

  -- 광고별 메타데이터 (status, effective_status, objective, thumbnail_url, daily_budget)
  -- { "ad_id": { status, effective_status, objective, thumbnail_url, daily_budget, campaign_id, campaign_name } }
  ads_data JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- 캐시 메타정보
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- 캐시 만료 시간 (24시간 후)
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours')
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_ad_cache_expires_at ON ad_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_ad_cache_updated_at ON ad_cache(updated_at);

-- updated_at 자동 갱신 트리거
CREATE OR REPLACE FUNCTION update_ad_cache_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  NEW.expires_at = NOW() + INTERVAL '24 hours';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_ad_cache_updated_at ON ad_cache;
CREATE TRIGGER trigger_update_ad_cache_updated_at
  BEFORE UPDATE ON ad_cache
  FOR EACH ROW
  EXECUTE FUNCTION update_ad_cache_updated_at();

-- RLS 정책 (서비스 롤은 모든 접근 가능)
ALTER TABLE ad_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage ad_cache"
  ON ad_cache
  FOR ALL
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE ad_cache IS '광고 메타데이터 캐시 - Meta API 호출 최소화';
COMMENT ON COLUMN ad_cache.ads_data IS '광고별 메타데이터 JSON (status, effective_status, objective, thumbnail_url, daily_budget)';
COMMENT ON COLUMN ad_cache.expires_at IS '캐시 만료 시간 (기본 24시간)';
