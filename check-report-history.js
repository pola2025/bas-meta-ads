#!/usr/bin/env node
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function check() {
  // 최근 발송된 리포트 확인
  const { data: reports, error } = await supabase
    .from('telegram_reports')
    .select('*')
    .eq('report_type', 'weekly')
    .order('sent_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error('Error:', error.message);
    return;
  }

  console.log('최근 주간 리포트 발송 기록:');
  console.log('='.repeat(80));
  for (const r of reports) {
    console.log(`[${r.sent_at}] client_id: ${r.client_id}`);
    console.log(`  기간: ${r.week_start} ~ ${r.week_end}`);
    console.log('');
  }

  // 클라이언트 목록 확인
  const { data: clients } = await supabase
    .from('clients')
    .select('id, client_name, telegram_chat_id, telegram_enabled')
    .eq('is_active', true)
    .order('client_name');

  console.log('활성 클라이언트:');
  console.log('='.repeat(80));
  for (const c of clients) {
    console.log(`${c.client_name}: chat_id=${c.telegram_chat_id || 'NULL'}, enabled=${c.telegram_enabled}`);
  }
}
check();
