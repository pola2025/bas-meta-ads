-- ============================================================================
-- 텔레그램 리포트 아카이브 테이블 (단순 버전)
-- ============================================================================
-- 목적: 텔레그램으로 발송된 주간/월간 리포트를 저장하여 대시보드에서 조회
-- 생성일: 2025-11-25
-- ============================================================================

-- 기존 테이블 삭제 (주의: 데이터 손실)
DROP TABLE IF EXISTS telegram_reports CASCADE;

CREATE TABLE telegram_reports (
  -- 기본 정보
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID DEFAULT '79e35fc6-a817-4ccc-9d5d-9a93c1ad4515', -- 기본 클라이언트 ID

  -- 리포트 기간
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,

  -- 리포트 내용
  report_type VARCHAR(20) DEFAULT 'weekly' CHECK (report_type IN ('weekly', 'monthly')),
  message_text TEXT NOT NULL, -- 텔레그램 메시지 전문

  -- 핵심 성과 (빠른 조회용)
  total_spend DECIMAL(10,2),
  total_leads INTEGER,
  avg_cpl DECIMAL(10,2),
  avg_ctr DECIMAL(5,2),
  total_impressions INTEGER,
  total_clicks INTEGER,

  -- 전주/전월 대비 변화
  spend_change DECIMAL(5,2), -- %
  leads_change DECIMAL(5,2), -- %
  cpl_change DECIMAL(5,2), -- %
  ctr_change DECIMAL(5,2), -- %

  -- AI 분석 결과
  ai_insights TEXT, -- Gemini AI 분석 내용

  -- 발송 정보
  telegram_message_id INTEGER, -- 텔레그램 메시지 ID
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- 메타데이터
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스
CREATE INDEX idx_telegram_reports_client ON telegram_reports(client_id);
CREATE INDEX idx_telegram_reports_date ON telegram_reports(week_start DESC, week_end DESC);
CREATE INDEX idx_telegram_reports_type ON telegram_reports(report_type);
CREATE UNIQUE INDEX idx_telegram_reports_unique ON telegram_reports(client_id, week_start, week_end, report_type);

-- RLS 정책
ALTER TABLE telegram_reports ENABLE ROW LEVEL SECURITY;

-- 모든 사용자 읽기 허용
CREATE POLICY "Enable read access for all users" ON telegram_reports
  FOR SELECT USING (true);

-- 모든 사용자 삽입 허용 (anon key로도 가능)
CREATE POLICY "Enable insert for all users" ON telegram_reports
  FOR INSERT WITH CHECK (true);

-- 모든 사용자 업데이트 허용
CREATE POLICY "Enable update for all users" ON telegram_reports
  FOR UPDATE USING (true);

-- 코멘트
COMMENT ON TABLE telegram_reports IS '텔레그램으로 발송된 주간/월간 리포트 아카이브';
COMMENT ON COLUMN telegram_reports.message_text IS '텔레그램 메시지 전문 (마크다운 포맷)';
COMMENT ON COLUMN telegram_reports.ai_insights IS 'Gemini AI가 생성한 분석 내용';
COMMENT ON COLUMN telegram_reports.telegram_message_id IS '텔레그램에서 발송된 메시지 ID';

-- ============================================================================
-- 확인
-- ============================================================================
SELECT 'telegram_reports 테이블 생성 완료' as status;
