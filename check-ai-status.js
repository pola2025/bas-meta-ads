#!/usr/bin/env node
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function check() {
  const { data } = await supabase
    .from('telegram_reports')
    .select('client_id, ai_insights, total_leads, total_spend')
    .eq('week_start', '2025-12-08')
    .eq('week_end', '2025-12-14')
    .eq('report_type', 'weekly');

  const { data: clients } = await supabase
    .from('clients')
    .select('id, client_name')
    .eq('is_active', true);

  const clientMap = {};
  clients.forEach(c => clientMap[c.id] = c.client_name);

  console.log('12/8~14 주간 리포트 AI 인사이트 상태:');
  console.log('='.repeat(60));

  data.forEach(r => {
    const name = clientMap[r.client_id] || 'Unknown';
    const hasAI = r.ai_insights && r.ai_insights.indexOf('비활성화') === -1;
    const status = hasAI ? '✅ AI 있음' : '❌ AI 없음';
    console.log(name.padEnd(20), status, '| L:', r.total_leads, '| $' + (r.total_spend || 0).toFixed(0));
  });

  // 리포트 없는 클라이언트 확인
  const reportedIds = data.map(r => r.client_id);
  const missing = clients.filter(c => !reportedIds.includes(c.id));
  if (missing.length > 0) {
    console.log('\n리포트 없음 (광고 중단):');
    missing.forEach(c => console.log('  ⚪', c.client_name));
  }
}
check();
