#!/usr/bin/env node
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function check() {
  // 전체 월별 데이터 분포
  console.log('=== 월별 데이터 분포 ===\n');

  const { data: all } = await supabase
    .from('daily_aggregates')
    .select('date, leads, spend, impressions, clicks');

  if (!all || all.length === 0) {
    console.log('데이터 없음');
    return;
  }

  const byMonth = {};
  all.forEach(r => {
    const month = r.date.substring(0, 7);
    if (!byMonth[month]) {
      byMonth[month] = {
        leads: 0,
        spend: 0,
        impressions: 0,
        clicks: 0,
        days: new Set()
      };
    }
    byMonth[month].leads += r.leads || 0;
    byMonth[month].spend += parseFloat(r.spend || 0);
    byMonth[month].impressions += r.impressions || 0;
    byMonth[month].clicks += r.clicks || 0;
    byMonth[month].days.add(r.date);
  });

  console.log('월\t\t일수\t리드\t지출\t\tCPL\t\tCTR');
  console.log('─'.repeat(70));

  Object.keys(byMonth).sort().forEach(m => {
    const d = byMonth[m];
    const cpl = d.leads > 0 ? d.spend / d.leads : 0;
    const ctr = d.impressions > 0 ? (d.clicks / d.impressions * 100) : 0;
    console.log(
      `${m}\t\t${d.days.size}일\t${d.leads}건\t$${d.spend.toFixed(2)}\t\t$${cpl.toFixed(2)}\t\t${ctr.toFixed(2)}%`
    );
  });

  // 5월 상세
  console.log('\n=== 5월 상세 (주별) ===\n');
  const may = all.filter(r => r.date.startsWith('2025-05'));
  if (may.length > 0) {
    const byWeek = {};
    may.forEach(r => {
      const date = new Date(r.date);
      const weekNum = Math.ceil(date.getDate() / 7);
      const key = `W${weekNum}`;
      if (!byWeek[key]) byWeek[key] = { leads: 0, spend: 0, days: [] };
      byWeek[key].leads += r.leads || 0;
      byWeek[key].spend += parseFloat(r.spend || 0);
      if (!byWeek[key].days.includes(r.date)) byWeek[key].days.push(r.date);
    });

    Object.keys(byWeek).sort().forEach(w => {
      const d = byWeek[w];
      const cpl = d.leads > 0 ? d.spend / d.leads : 0;
      console.log(`${w}: ${d.days.length}일, 리드 ${d.leads}건, $${d.spend.toFixed(2)}, CPL $${cpl.toFixed(2)}`);
    });
  } else {
    console.log('5월 데이터 없음');
  }

  // 6월 상세
  console.log('\n=== 6월 상세 (주별) ===\n');
  const jun = all.filter(r => r.date.startsWith('2025-06'));
  if (jun.length > 0) {
    const byWeek = {};
    jun.forEach(r => {
      const date = new Date(r.date);
      const weekNum = Math.ceil(date.getDate() / 7);
      const key = `W${weekNum}`;
      if (!byWeek[key]) byWeek[key] = { leads: 0, spend: 0, days: [] };
      byWeek[key].leads += r.leads || 0;
      byWeek[key].spend += parseFloat(r.spend || 0);
      if (!byWeek[key].days.includes(r.date)) byWeek[key].days.push(r.date);
    });

    Object.keys(byWeek).sort().forEach(w => {
      const d = byWeek[w];
      const cpl = d.leads > 0 ? d.spend / d.leads : 0;
      console.log(`${w}: ${d.days.length}일, 리드 ${d.leads}건, $${d.spend.toFixed(2)}, CPL $${cpl.toFixed(2)}`);
    });
  } else {
    console.log('6월 데이터 없음');
  }
}

check();
