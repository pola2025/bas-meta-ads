#!/usr/bin/env node
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function main() {
  // 1. 모든 활성 클라이언트 조회
  const { data: clients } = await supabase
    .from('clients')
    .select('id, client_name, is_active, telegram_enabled')
    .eq('is_active', true)
    .order('client_name');

  console.log('=== 활성 클라이언트 및 광고 현황 ===\n');

  for (const client of clients) {
    // 2. 각 클라이언트의 활성 광고 계정 확인
    const { data: adAccounts } = await supabase
      .from('ad_accounts')
      .select('id, account_name, is_active')
      .eq('client_id', client.id);

    const activeAccounts = adAccounts?.filter(a => a.is_active) || [];

    // 3. 이번 주 데이터 확인 (12/15~12/21)
    const { data: weekData } = await supabase
      .from('ads_insights_daily')
      .select('date, leads, spend')
      .eq('client_id', client.id)
      .gte('date', '2025-12-15')
      .lte('date', '2025-12-21');

    const totalLeads = weekData?.reduce((sum, r) => sum + (r.leads || 0), 0) || 0;
    const totalSpend = weekData?.reduce((sum, r) => sum + (parseFloat(r.spend) || 0), 0) || 0;
    const daysWithData = new Set(weekData?.map(r => r.date)).size;

    // 4. 이번 주 weekly_reports 확인
    const { data: report } = await supabase
      .from('weekly_reports')
      .select('id, ai_insights, created_at')
      .eq('client_id', client.id)
      .eq('week_start', '2025-12-15')
      .eq('week_end', '2025-12-21')
      .single();

    // 5. telegram_reports 확인
    const { data: telegramReport } = await supabase
      .from('telegram_reports')
      .select('id, sent_at')
      .eq('client_id', client.id)
      .eq('week_start', '2025-12-15')
      .eq('week_end', '2025-12-21')
      .eq('report_type', 'weekly')
      .single();

    // 출력
    const adStatus = activeAccounts.length > 0 ? 'ON' : 'OFF';
    const dataStatus = totalLeads > 0 || totalSpend > 0 ? 'OK' : 'NO_DATA';
    const reportStatus = report ? 'GENERATED' : 'NOT_GENERATED';
    const aiStatus = report?.ai_insights ? 'AI_OK' : 'NO_AI';
    const sentStatus = telegramReport ? 'SENT' : 'NOT_SENT';

    console.log(`[${client.client_name}]`);
    console.log(`  광고계정: ${adStatus} (${activeAccounts.length}개)`);
    console.log(`  이번주 데이터: ${dataStatus} (${daysWithData}일, ${totalLeads}건, $${totalSpend.toFixed(0)})`);
    console.log(`  리포트: ${reportStatus} | AI: ${aiStatus} | 발송: ${sentStatus}`);
    console.log('');
  }
}

main().catch(console.error);
