-- ============================================================================
-- 알림 로그 테이블 (토큰 만료 알림 중복 방지용)
-- ============================================================================
-- 생성일: 2024-12-01
-- 목적: 동일 알림 중복 발송 방지 및 알림 이력 관리
-- ============================================================================

CREATE TABLE IF NOT EXISTS notification_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  notification_type VARCHAR(50) NOT NULL,
  -- 알림 유형: token_expiry_critical, token_expiry_warning, token_expiry_notice, auth_required, etc.
  message TEXT,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 인덱스: 클라이언트별 알림 조회
CREATE INDEX IF NOT EXISTS idx_notification_logs_client_id ON notification_logs(client_id);

-- 인덱스: 알림 유형별 조회
CREATE INDEX IF NOT EXISTS idx_notification_logs_type ON notification_logs(notification_type);

-- 인덱스: 발송 시간별 조회 (최근 알림 확인용)
CREATE INDEX IF NOT EXISTS idx_notification_logs_sent_at ON notification_logs(sent_at DESC);

-- 복합 인덱스: 오늘 특정 유형 알림 확인용
CREATE INDEX IF NOT EXISTS idx_notification_logs_client_type_date
  ON notification_logs(client_id, notification_type, sent_at);

-- 코멘트
COMMENT ON TABLE notification_logs IS '텔레그램 알림 발송 이력 (중복 방지 및 추적용)';
COMMENT ON COLUMN notification_logs.notification_type IS '알림 유형: token_expiry_critical, token_expiry_warning, token_expiry_notice, auth_required';
COMMENT ON COLUMN notification_logs.sent_at IS '알림 발송 시각';

-- 30일 이상 된 로그 자동 정리 함수
CREATE OR REPLACE FUNCTION cleanup_old_notification_logs()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM notification_logs
  WHERE sent_at < NOW() - INTERVAL '30 days';

  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_old_notification_logs IS '30일 이상 된 알림 로그 정리';

-- ============================================================================
-- pg_cron 작업 등록 (선택적 - Supabase Pro 플랜 필요)
-- ============================================================================
-- 매일 00:00 KST에 오래된 로그 정리
-- SELECT cron.schedule('cleanup-notification-logs', '0 15 * * *',
--   'SELECT cleanup_old_notification_logs()');
