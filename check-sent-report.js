#!/usr/bin/env node
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function check() {
  // 12월 7일 발송된 리포트 확인
  const { data: reports, error } = await supabase
    .from('telegram_reports')
    .select('*')
    .gte('sent_at', '2025-12-07')
    .order('sent_at', { ascending: false });

  if (error) {
    console.error('Error:', error.message);
    return;
  }

  console.log('12월 7일 이후 발송된 리포트:');
  console.log('='.repeat(80));

  for (const r of reports) {
    // 클라이언트 이름 조회
    const { data: client } = await supabase
      .from('clients')
      .select('client_name')
      .eq('id', r.client_id)
      .single();

    console.log(`\n[${r.sent_at}] ${client?.client_name || 'Unknown'}`);
    console.log(`기간: ${r.week_start} ~ ${r.week_end}`);
    console.log(`report_type: ${r.report_type}`);

    // 메시지 요약
    if (r.messages) {
      const msgs = typeof r.messages === 'string' ? JSON.parse(r.messages) : r.messages;
      console.log(`메시지 수: ${msgs.length}개`);

      // 첫 번째 메시지 처음 200자
      if (msgs[0]) {
        const preview = msgs[0].substring(0, 300).replace(/\\([_*[\]()~`>#+\-=|{}.!])/g, '$1');
        console.log(`\n메시지 미리보기:\n${preview}...`);
      }
    }

    // 데이터 요약
    if (r.this_week_stats) {
      const stats = typeof r.this_week_stats === 'string' ? JSON.parse(r.this_week_stats) : r.this_week_stats;
      console.log(`\n통계: 리드=${stats.leads}, 지출=$${stats.spend?.toFixed(2)}, CPL=$${stats.cpl?.toFixed(2)}`);
    }

    console.log('\n' + '='.repeat(80));
  }
}
check();
