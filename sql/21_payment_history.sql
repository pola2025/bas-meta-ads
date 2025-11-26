-- 결제 히스토리 테이블
CREATE TABLE IF NOT EXISTS payment_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  payment_date DATE NOT NULL,
  amount DECIMAL(10, 2),
  payment_type VARCHAR(50) DEFAULT 'monthly', -- monthly, yearly, one-time
  payment_method VARCHAR(50), -- card, transfer, cash 등
  memo TEXT,
  service_months INTEGER DEFAULT 3, -- 결제로 추가되는 서비스 기간 (월)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by VARCHAR(100) DEFAULT 'admin'
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_payment_history_client_id ON payment_history(client_id);
CREATE INDEX IF NOT EXISTS idx_payment_history_payment_date ON payment_history(payment_date DESC);

-- RLS 정책
ALTER TABLE payment_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for service role" ON payment_history
  FOR ALL
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE payment_history IS '클라이언트 결제 히스토리';
COMMENT ON COLUMN payment_history.payment_date IS '결제일';
COMMENT ON COLUMN payment_history.amount IS '결제 금액';
COMMENT ON COLUMN payment_history.payment_type IS '결제 유형 (monthly/yearly/one-time)';
COMMENT ON COLUMN payment_history.service_months IS '결제로 추가되는 서비스 기간 (월)';
