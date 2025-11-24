require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

(async () => {
  console.log('📊 Creating telegram_reports table...\n');

  // 테이블 생성 SQL을 개별 실행
  const createTableSQL = `
    CREATE TABLE IF NOT EXISTS telegram_reports (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      client_id UUID NOT NULL REFERENCES clients(client_id) ON DELETE CASCADE,
      week_start DATE NOT NULL,
      week_end DATE NOT NULL,
      report_type VARCHAR(20) DEFAULT 'weekly' CHECK (report_type IN ('weekly', 'monthly')),
      message_text TEXT NOT NULL,
      total_spend DECIMAL(10,2),
      total_leads INTEGER,
      avg_cpl DECIMAL(10,2),
      avg_ctr DECIMAL(5,2),
      total_impressions INTEGER,
      total_clicks INTEGER,
      spend_change DECIMAL(5,2),
      leads_change DECIMAL(5,2),
      cpl_change DECIMAL(5,2),
      ctr_change DECIMAL(5,2),
      ai_insights TEXT,
      telegram_message_id INTEGER,
      sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `;

  console.log('✅ Please run the following SQL in Supabase Dashboard:\n');
  console.log('━'.repeat(80));
  console.log(createTableSQL);
  console.log('━'.repeat(80));
  console.log('\n📌 After creating the table, run:');
  console.log('   node verify-telegram-reports-table.js\n');

  process.exit(0);
})();
