#!/usr/bin/env node
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function main() {
  // 클라이언트 목록
  const { data: clients } = await supabase.from('clients').select('id, client_name, slug, telegram_chat_id, telegram_enabled, is_active').order('client_name');

  console.log('=== 전체 클라이언트 ===');
  clients.forEach(c => {
    const active = c.is_active ? 'ACT' : 'OFF';
    const chat = c.telegram_chat_id ? 'CHAT' : 'NO_CHAT';
    const enabled = c.telegram_enabled !== false ? 'ON' : 'MUTE';
    console.log(`  [${active}] [${chat}] [${enabled}] ${c.client_name} (slug: ${c.slug || 'NONE'})`);
  });

  // 최근 telegram_reports
  const { data: reports } = await supabase
    .from('telegram_reports')
    .select('id, client_id, week_start, week_end, sent_at, report_type')
    .order('sent_at', { ascending: false })
    .limit(15);

  console.log('\n=== 최근 텔레그램 리포트 ===');
  for (const r of reports || []) {
    const client = clients.find(c => c.id === r.client_id);
    const sentDate = r.sent_at ? r.sent_at.slice(0, 16) : 'N/A';
    console.log(`  ${r.week_start} ~ ${r.week_end} | ${(client?.client_name || r.client_id).substring(0, 12)} | ${r.report_type} | ${sentDate}`);
  }

  // 오늘 날짜와 이번 주 계산
  const now = new Date();
  const dayOfWeek = now.getDay();
  const lastSunday = new Date(now);
  lastSunday.setDate(now.getDate() - dayOfWeek);
  const thisWeekStart = new Date(lastSunday);
  thisWeekStart.setDate(lastSunday.getDate() - 6);

  const fmt = d => d.toISOString().slice(0, 10);
  console.log('\n=== 이번 주 계산 ===');
  console.log(`Today: ${fmt(now)} (dayOfWeek: ${dayOfWeek})`);
  console.log(`This week: ${fmt(thisWeekStart)} ~ ${fmt(lastSunday)}`);

  // 이번 주 리포트 발송 현황
  const thisWeekStartStr = fmt(thisWeekStart);
  const thisWeekEndStr = fmt(lastSunday);

  console.log('\n=== 이번 주 리포트 발송 현황 ===');
  const activeClients = clients.filter(c => c.is_active);
  for (const c of activeClients) {
    const { data: report } = await supabase
      .from('telegram_reports')
      .select('id, sent_at')
      .eq('client_id', c.id)
      .eq('week_start', thisWeekStartStr)
      .eq('week_end', thisWeekEndStr)
      .eq('report_type', 'weekly')
      .single();

    const status = report ? `SENT (${report.sent_at?.slice(0, 16)})` : 'NOT_SENT';
    console.log(`  [${status}] ${c.client_name}`);
  }
}

main().catch(console.error);
