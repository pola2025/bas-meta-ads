-- Rate Limit 쿨다운 컬럼 추가
-- Meta API Rate Limit 발생 시 30분간 API 호출 차단

ALTER TABLE ad_cache
ADD COLUMN IF NOT EXISTS rate_limit_until TIMESTAMPTZ DEFAULT NULL;

-- 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_ad_cache_rate_limit_until ON ad_cache(rate_limit_until);

COMMENT ON COLUMN ad_cache.rate_limit_until IS 'Rate Limit 쿨다운 종료 시간 (NULL이면 쿨다운 아님)';
