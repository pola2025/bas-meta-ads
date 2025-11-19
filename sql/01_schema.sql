-- ============================================================================
-- BAS Meta Ads Analytics - Database Schema
-- ============================================================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_cron";

-- Supabase Vault 활성화 (Supabase 대시보드에서 먼저 활성화 필요)
-- Dashboard → Database → Extensions → "vault" 검색 후 활성화
-- 주석: Vault는 Supabase 프로젝트에서 수동으로 활성화해야 합니다.

-- ============================================================================
-- 1. clients 테이블 - 고객 정보
-- ============================================================================
CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id VARCHAR(50) UNIQUE NOT NULL,
  client_name VARCHAR(100) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  meta_ad_account_id VARCHAR(50),
  meta_access_token_id UUID, -- Vault reference
  meta_refresh_token_id UUID, -- Vault reference
  token_expires_at TIMESTAMPTZ,
  auth_status VARCHAR(20) DEFAULT 'active', -- active, auth_required, token_expired
  plan_type VARCHAR(20) DEFAULT 'free',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_clients_email ON clients(email);
CREATE INDEX idx_clients_client_id ON clients(client_id);
CREATE INDEX idx_clients_is_active ON clients(is_active);
CREATE INDEX idx_clients_token_expiry ON clients(token_expires_at);

COMMENT ON TABLE clients IS '고객 정보 (멀티 클라이언트 지원)';
COMMENT ON COLUMN clients.meta_access_token_id IS 'Supabase Vault에 저장된 Access Token ID';
COMMENT ON COLUMN clients.meta_refresh_token_id IS 'Supabase Vault에 저장된 Refresh Token ID';

-- ============================================================================
-- 2. raw_data 테이블 (파티셔닝) - 일자별 원본 데이터
-- ============================================================================
CREATE TABLE raw_data (
  id BIGSERIAL,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  ad_id VARCHAR(50) NOT NULL,
  ad_name VARCHAR(200),
  campaign_id VARCHAR(50),
  campaign_name VARCHAR(200),
  platform VARCHAR(20),
  device VARCHAR(20),
  currency VARCHAR(3) DEFAULT 'KRW', -- 통화 코드 (KRW, USD 등)
  impressions INTEGER DEFAULT 0,
  reach INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  leads INTEGER DEFAULT 0,
  spend DECIMAL(10,2) DEFAULT 0,
  video_views INTEGER DEFAULT 0,
  avg_watch_time DECIMAL(5,1) DEFAULT 0,
  cost_per_video_view DECIMAL(10,6) DEFAULT 0,
  cost_per_lead DECIMAL(10,6) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(client_id, date, ad_id, platform, device)
) PARTITION BY RANGE (date);

-- 초기 파티션 생성 (2025년 11월)
CREATE TABLE raw_data_2025_11 PARTITION OF raw_data
  FOR VALUES FROM ('2025-11-01') TO ('2025-12-01');

-- 2025년 12월 파티션 (미리 생성)
CREATE TABLE raw_data_2025_12 PARTITION OF raw_data
  FOR VALUES FROM ('2025-12-01') TO ('2026-01-01');

CREATE INDEX idx_raw_data_client_id ON raw_data(client_id);
CREATE INDEX idx_raw_data_date ON raw_data(date);
CREATE INDEX idx_raw_data_ad_id ON raw_data(ad_id);

COMMENT ON TABLE raw_data IS '일자별 원본 광고 데이터 (월별 파티션)';

-- ============================================================================
-- 3. weekly_summary 테이블 - 주간 집계
-- ============================================================================
CREATE TABLE weekly_summary (
  id BIGSERIAL PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  week_year INTEGER NOT NULL,
  week_number INTEGER NOT NULL,
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  ad_id VARCHAR(50) NOT NULL,
  ad_name VARCHAR(200),
  campaign_id VARCHAR(50),
  campaign_name VARCHAR(200),
  total_impressions INTEGER DEFAULT 0,
  total_reach INTEGER DEFAULT 0,
  total_clicks INTEGER DEFAULT 0,
  total_leads INTEGER DEFAULT 0,
  total_spend DECIMAL(10,2) DEFAULT 0,
  total_video_views INTEGER DEFAULT 0,
  avg_ctr DECIMAL(5,2) GENERATED ALWAYS AS (
    CASE WHEN total_impressions > 0
    THEN (total_clicks::DECIMAL / total_impressions * 100)
    ELSE 0 END
  ) STORED,
  avg_cpl DECIMAL(10,2) GENERATED ALWAYS AS (
    CASE WHEN total_leads > 0
    THEN (total_spend / total_leads)
    ELSE 0 END
  ) STORED,
  efficiency_grade CHAR(1) GENERATED ALWAYS AS (
    CASE
      WHEN total_leads = 0 THEN 'F'
      WHEN (total_spend / NULLIF(total_leads, 0)) <= 3.00 THEN 'S'
      WHEN (total_spend / NULLIF(total_leads, 0)) <= 5.00 THEN 'A'
      WHEN (total_spend / NULLIF(total_leads, 0)) <= 8.00 THEN 'B'
      WHEN (total_spend / NULLIF(total_leads, 0)) <= 12.00 THEN 'C'
      ELSE 'D'
    END
  ) STORED,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(client_id, week_year, week_number, ad_id)
);

CREATE INDEX idx_weekly_client_week ON weekly_summary(client_id, week_year, week_number);
CREATE INDEX idx_weekly_grade ON weekly_summary(efficiency_grade);

COMMENT ON TABLE weekly_summary IS '주간 집계 데이터 (자동 계산 컬럼 포함)';
COMMENT ON COLUMN weekly_summary.efficiency_grade IS 'CPL 기반 효율 등급 (S/A/B/C/D/F)';

-- ============================================================================
-- 4. monthly_summary 테이블 - 월간 집계
-- ============================================================================
CREATE TABLE monthly_summary (
  id BIGSERIAL PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  ad_id VARCHAR(50) NOT NULL,
  ad_name VARCHAR(200),
  campaign_id VARCHAR(50),
  campaign_name VARCHAR(200),
  total_impressions INTEGER DEFAULT 0,
  total_reach INTEGER DEFAULT 0,
  total_clicks INTEGER DEFAULT 0,
  total_leads INTEGER DEFAULT 0,
  total_spend DECIMAL(10,2) DEFAULT 0,
  avg_ctr DECIMAL(5,2),
  avg_cpl DECIMAL(10,2),
  week_count INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(client_id, year, month, ad_id)
);

CREATE INDEX idx_monthly_client_period ON monthly_summary(client_id, year, month);

COMMENT ON TABLE monthly_summary IS '월간 집계 데이터 (raw_data 기반)';

-- ============================================================================
-- 5. producer_executions 테이블 - Producer 실행 추적
-- ============================================================================
CREATE TABLE producer_executions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  total_clients INTEGER NOT NULL,
  enqueued_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  status VARCHAR(20) NOT NULL,
  error_message TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_producer_exec_started ON producer_executions(started_at DESC);
CREATE INDEX idx_producer_exec_status ON producer_executions(status);

COMMENT ON TABLE producer_executions IS 'Producer 실행 이력 (원자성 보장)';

-- ============================================================================
-- 6. producer_errors 테이블 - Producer 에러 로그
-- ============================================================================
CREATE TABLE producer_errors (
  id BIGSERIAL PRIMARY KEY,
  execution_id UUID REFERENCES producer_executions(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_producer_errors_execution ON producer_errors(execution_id);

COMMENT ON TABLE producer_errors IS 'Producer 개별 클라이언트 실패 로그';

-- ============================================================================
-- 7. token_refresh_logs 테이블 - 토큰 갱신 이력
-- ============================================================================
CREATE TABLE token_refresh_logs (
  id BIGSERIAL PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  refreshed_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ,
  success BOOLEAN DEFAULT true,
  error_message TEXT
);

CREATE INDEX idx_token_refresh_client ON token_refresh_logs(client_id, refreshed_at DESC);

COMMENT ON TABLE token_refresh_logs IS 'OAuth Token 갱신 이력';

-- ============================================================================
-- 8. chart_cache 테이블 - 차트 캐싱
-- ============================================================================
CREATE TABLE chart_cache (
  id BIGSERIAL PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  chart_type VARCHAR(20) NOT NULL,
  data_params_hash VARCHAR(32) NOT NULL,
  file_url TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_chart_cache_lookup ON chart_cache(client_id, chart_type, data_params_hash, created_at DESC);

COMMENT ON TABLE chart_cache IS '차트 이미지 캐시 (1시간)';

-- ============================================================================
-- Row Level Security (RLS) 활성화
-- ============================================================================
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE raw_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_summary ENABLE ROW LEVEL SECURITY;

-- RLS 정책: 사용자는 자신의 데이터만 조회 가능
CREATE POLICY "Users can view own data" ON clients
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can view own raw_data" ON raw_data
  FOR SELECT USING (
    client_id IN (SELECT id FROM clients WHERE id = auth.uid())
  );

CREATE POLICY "Users can view own weekly_summary" ON weekly_summary
  FOR SELECT USING (
    client_id IN (SELECT id FROM clients WHERE id = auth.uid())
  );

CREATE POLICY "Users can view own monthly_summary" ON monthly_summary
  FOR SELECT USING (
    client_id IN (SELECT id FROM clients WHERE id = auth.uid())
  );

-- ============================================================================
-- 완료 메시지
-- ============================================================================
SELECT 'Schema created successfully! 🎉' AS message;
