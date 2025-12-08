#!/usr/bin/env node
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function check() {
  // 12/1~12/7 기간 리포트 확인
  const { data: reports, error } = await supabase
    .from('telegram_reports')
    .select('*')
    .eq('week_start', '2025-12-01')
    .eq('week_end', '2025-12-07');

  if (error) {
    console.error('Error:', error.message);
    return;
  }

  console.log('2025-12-01 ~ 2025-12-07 기간 리포트:');
  console.log('='.repeat(80));

  if (reports.length === 0) {
    console.log('발송된 리포트가 없습니다.');
  }

  for (const r of reports) {
    const { data: client } = await supabase
      .from('clients')
      .select('client_name')
      .eq('id', r.client_id)
      .single();

    console.log(`\n클라이언트: ${client?.client_name || 'Unknown'}`);
    console.log(`발송 시간: ${r.sent_at}`);
    console.log(`리포트 타입: ${r.report_type}`);

    if (r.this_week_stats) {
      const stats = r.this_week_stats;
      console.log(`통계: 리드=${stats.leads}, 지출=$${stats.spend?.toFixed(2)}, CPL=$${stats.cpl?.toFixed(2)}`);
    }
  }

  // 활성 클라이언트 중 발송되지 않은 클라이언트 확인
  const { data: clients } = await supabase
    .from('clients')
    .select('id, client_name')
    .eq('is_active', true);

  const sentClientIds = reports.map(r => r.client_id);
  const notSent = clients.filter(c => !sentClientIds.includes(c.id));

  console.log('\n\n발송되지 않은 클라이언트:');
  console.log('='.repeat(80));
  notSent.forEach(c => {
    console.log(`- ${c.client_name}`);
  });
}
check();
