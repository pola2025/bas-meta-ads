#!/usr/bin/env node
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function preview() {
  const clientName = '솔트 기업성장연구소';

  const { data: client } = await supabase
    .from('clients')
    .select('*')
    .eq('client_name', clientName)
    .single();

  if (!client) {
    console.log('클라이언트를 찾을 수 없습니다');
    return;
  }

  const thisWeekStart = '2025-11-17';
  const thisWeekEnd = '2025-11-23';
  const lastWeekStart = '2025-11-10';
  const lastWeekEnd = '2025-11-16';

  const { data: thisWeekData } = await supabase
    .from('ads_insights_daily')
    .select('*')
    .eq('client_id', client.id)
    .gte('date', thisWeekStart)
    .lte('date', thisWeekEnd)
    .order('date');

  const { data: lastWeekData } = await supabase
    .from('ads_insights_daily')
    .select('*')
    .eq('client_id', client.id)
    .gte('date', lastWeekStart)
    .lte('date', lastWeekEnd)
    .order('date');

  const calcStats = (data) => {
    if (!data || data.length === 0) return { impressions: 0, clicks: 0, leads: 0, spend: 0, ctr: 0, cpl: 0 };
    const totals = data.reduce((acc, row) => {
      acc.impressions += row.impressions || 0;
      acc.clicks += row.clicks || 0;
      acc.leads += row.leads || 0;
      acc.spend += parseFloat(row.spend) || 0;
      return acc;
    }, { impressions: 0, clicks: 0, leads: 0, spend: 0 });
    return {
      ...totals,
      ctr: totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0,
      cpl: totals.leads > 0 ? totals.spend / totals.leads : 0
    };
  };

  const thisStats = calcStats(thisWeekData);
  const lastStats = calcStats(lastWeekData);

  const change = (curr, prev) => {
    if (!prev || prev === 0) return curr > 0 ? '+100%' : '-';
    const pct = ((curr - prev) / prev) * 100;
    return (pct >= 0 ? '+' : '') + pct.toFixed(1) + '%';
  };

  console.log('═'.repeat(60));
  console.log('📊 솔트 기업성장연구소 주간 리포트 미리보기');
  console.log('   (이번 주 월요일 09:00에 발송되었어야 할 내용)');
  console.log('═'.repeat(60));
  console.log();
  console.log('📅 이번 주: ' + thisWeekStart + ' ~ ' + thisWeekEnd);
  console.log('📅 지난 주: ' + lastWeekStart + ' ~ ' + lastWeekEnd);
  console.log();
  console.log('━'.repeat(60));
  console.log('📊 주간 성과 비교');
  console.log('━'.repeat(60));
  console.log();
  console.log('노출수: ' + lastStats.impressions.toLocaleString() + ' → ' + thisStats.impressions.toLocaleString() + ' (' + change(thisStats.impressions, lastStats.impressions) + ')');
  console.log('클릭수: ' + lastStats.clicks + ' → ' + thisStats.clicks + ' (' + change(thisStats.clicks, lastStats.clicks) + ')');
  console.log('리드: ' + lastStats.leads + '건 → ' + thisStats.leads + '건 (' + change(thisStats.leads, lastStats.leads) + ')');
  console.log('지출: $' + lastStats.spend.toFixed(2) + ' → $' + thisStats.spend.toFixed(2) + ' (' + change(thisStats.spend, lastStats.spend) + ')');
  console.log('CPL: $' + lastStats.cpl.toFixed(2) + ' → $' + thisStats.cpl.toFixed(2) + ' (' + change(thisStats.cpl, lastStats.cpl) + ')');
  console.log('CTR: ' + lastStats.ctr.toFixed(2) + '% → ' + thisStats.ctr.toFixed(2) + '%');
  console.log();

  console.log('━'.repeat(60));
  console.log('📅 일별 상세 성과');
  console.log('━'.repeat(60));
  console.log();

  const dailyStats = {};
  thisWeekData.forEach(row => {
    if (!dailyStats[row.date]) {
      dailyStats[row.date] = { leads: 0, spend: 0 };
    }
    dailyStats[row.date].leads += row.leads || 0;
    dailyStats[row.date].spend += parseFloat(row.spend) || 0;
  });

  const days = ['일', '월', '화', '수', '목', '금', '토'];
  Object.keys(dailyStats).sort().forEach(date => {
    const stats = dailyStats[date];
    const cpl = stats.leads > 0 ? stats.spend / stats.leads : 0;
    const d = new Date(date);
    const dayKr = days[d.getDay()];
    const dateFormatted = date.substring(5).replace('-', '/');
    const bar = '🟩'.repeat(Math.min(stats.leads, 10));

    console.log(dayKr + ' ' + dateFormatted + '  ' + stats.leads + '건 | ' + bar);
    console.log('CPL: ' + (stats.leads > 0 ? '$' + cpl.toFixed(2) : '-') + ' │ 지출: $' + stats.spend.toFixed(2));
    console.log();
  });

  console.log('━'.repeat(60));
  console.log('🏆 광고별 성과');
  console.log('━'.repeat(60));
  console.log();

  const adStats = {};
  thisWeekData.forEach(row => {
    const adKey = row.ad_id || 'unknown';
    if (!adStats[adKey]) {
      adStats[adKey] = { ad_name: row.ad_name || 'Unknown', impressions: 0, clicks: 0, leads: 0, spend: 0 };
    }
    adStats[adKey].impressions += row.impressions || 0;
    adStats[adKey].clicks += row.clicks || 0;
    adStats[adKey].leads += row.leads || 0;
    adStats[adKey].spend += parseFloat(row.spend) || 0;
  });

  const topAds = Object.values(adStats)
    .filter(a => a.leads > 0)
    .map(a => ({ ...a, cpl: a.spend / a.leads, ctr: a.impressions > 0 ? (a.clicks / a.impressions) * 100 : 0 }))
    .sort((a, b) => a.cpl - b.cpl);

  topAds.forEach((ad, idx) => {
    console.log((idx + 1) + '. ' + ad.ad_name);
    console.log('   💰 지출: $' + ad.spend.toFixed(2));
    console.log('   🎯 리드: ' + ad.leads + '건');
    console.log('   💵 CPL: $' + ad.cpl.toFixed(2));
    console.log('   📊 CTR: ' + ad.ctr.toFixed(2) + '%');
    console.log();
  });

  console.log('━'.repeat(60));
  console.log('📌 설정 확인');
  console.log('━'.repeat(60));
  console.log('✅ 텔레그램 chat_id: ' + client.telegram_chat_id);
  console.log('✅ 텔레그램 활성화: ' + client.telegram_enabled);
  console.log('✅ slug: ' + (client.slug || '❌ 미설정 - 대시보드 링크 오류 가능'));
  console.log('━'.repeat(60));
}

preview().catch(console.error);
