#!/usr/bin/env node
/**
 * 리포트 데이터 문제 진단 스크립트
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// 분석 대상 클라이언트
const TARGET_CLIENTS = [
  '솔트',
  '성공K',
  '비즈액터스쿨',
  '부자성공파트너',
  '내일채움',
  'JH 경영지원센터'
];

async function diagnose() {
  console.log('═'.repeat(70));
  console.log('📊 리포트 데이터 문제 진단');
  console.log('═'.repeat(70));
  console.log();

  // 1. 모든 클라이언트 조회
  const { data: clients } = await supabase
    .from('clients')
    .select('id, client_name, is_active, auth_status')
    .eq('is_active', true);

  for (const client of clients) {
    // 대상 클라이언트만 상세 분석
    const isTarget = TARGET_CLIENTS.some(t => client.client_name.includes(t));
    if (!isTarget) continue;

    console.log('━'.repeat(70));
    console.log(`📌 ${client.client_name} (${client.auth_status})`);
    console.log('━'.repeat(70));

    // 2. raw_data 날짜별 현황
    const { data: rawDates } = await supabase
      .from('raw_data')
      .select('date')
      .eq('client_id', client.id)
      .order('date', { ascending: false })
      .limit(100);

    const uniqueRawDates = [...new Set(rawDates?.map(r => r.date) || [])].sort().reverse();

    console.log('\n📁 raw_data 최근 날짜 (최신 15일):');
    if (uniqueRawDates.length > 0) {
      const last15 = uniqueRawDates.slice(0, 15);
      console.log('   ' + last15.join(', '));

      // 11월 데이터 체크
      const novDates = uniqueRawDates.filter(d => d.startsWith('2025-11'));
      console.log(`\n   11월 데이터: ${novDates.length}일`);

      // 누락 날짜 체크 (11월 1일~30일)
      const nov24to30 = ['2025-11-24', '2025-11-25', '2025-11-26', '2025-11-27', '2025-11-28', '2025-11-29', '2025-11-30'];
      const missing = nov24to30.filter(d => !novDates.includes(d));
      if (missing.length > 0) {
        console.log(`   ⚠️ 누락된 날짜 (11/24~30): ${missing.join(', ')}`);
      } else {
        console.log(`   ✅ 11/24~30 데이터 모두 있음`);
      }
    } else {
      console.log('   ❌ 데이터 없음');
    }

    // 3. 주간 리포트 확인
    const { data: weeklyReports } = await supabase
      .from('telegram_reports')
      .select('id, week_start, week_end, total_leads, total_spend, report_data')
      .eq('client_id', client.id)
      .eq('report_type', 'weekly')
      .order('week_start', { ascending: false })
      .limit(5);

    console.log('\n📅 최근 주간 리포트:');
    if (weeklyReports && weeklyReports.length > 0) {
      for (const report of weeklyReports) {
        const hasData = report.report_data && report.report_data.daily_stats;
        const dailyDates = hasData ? report.report_data.daily_stats.map(d => d.date.substring(5)) : [];
        console.log(`   ${report.week_start} ~ ${report.week_end}: 리드 ${report.total_leads}건, $${report.total_spend?.toFixed(2)}`);
        if (hasData) {
          console.log(`      일별 데이터: ${dailyDates.join(', ') || '없음'}`);
          // 누락 체크
          const startDate = new Date(report.week_start);
          const endDate = new Date(report.week_end);
          const expectedDays = [];
          for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
            expectedDays.push(d.toISOString().split('T')[0]);
          }
          const actualDates = report.report_data.daily_stats.map(d => d.date);
          const missingDays = expectedDays.filter(d => !actualDates.includes(d));
          if (missingDays.length > 0) {
            console.log(`      ⚠️ 누락: ${missingDays.map(d => d.substring(5)).join(', ')}`);
          }
        } else {
          console.log(`      ⚠️ report_data.daily_stats 없음`);
        }
      }
    } else {
      console.log('   ❌ 주간 리포트 없음');
    }

    // 4. 월간 리포트 확인
    const { data: monthlyReports } = await supabase
      .from('telegram_reports')
      .select('id, week_start, week_end, total_leads, total_spend, report_data')
      .eq('client_id', client.id)
      .eq('report_type', 'monthly')
      .order('week_start', { ascending: false })
      .limit(3);

    console.log('\n📆 최근 월간 리포트:');
    if (monthlyReports && monthlyReports.length > 0) {
      for (const report of monthlyReports) {
        const hasWeekly = report.report_data && report.report_data.weekly_stats;
        console.log(`   ${report.week_start} ~ ${report.week_end}: 리드 ${report.total_leads}건, $${report.total_spend?.toFixed(2)}`);
        if (hasWeekly) {
          const weeks = report.report_data.weekly_stats.map(w => `W${w.week}(${w.leads})`);
          console.log(`      주별 데이터: ${weeks.join(', ')}`);
        } else {
          console.log(`      ⚠️ report_data.weekly_stats 없음`);
        }
      }
    } else {
      console.log('   ❌ 월간 리포트 없음');
    }

    // 5. ads_insights_daily 확인 (최근 데이터)
    const { data: adsData } = await supabase
      .from('ads_insights_daily')
      .select('date, leads, spend')
      .eq('client_id', client.id)
      .gte('date', '2025-11-24')
      .order('date', { ascending: true });

    console.log('\n📈 ads_insights_daily (11/24 이후):');
    if (adsData && adsData.length > 0) {
      const grouped = {};
      adsData.forEach(row => {
        if (!grouped[row.date]) grouped[row.date] = { leads: 0, spend: 0 };
        grouped[row.date].leads += row.leads || 0;
        grouped[row.date].spend += parseFloat(row.spend) || 0;
      });

      Object.keys(grouped).sort().forEach(date => {
        const d = grouped[date];
        console.log(`   ${date}: 리드 ${d.leads}건, $${d.spend.toFixed(2)}`);
      });
    } else {
      console.log('   ❌ 데이터 없음');
    }

    console.log();
  }

  console.log('═'.repeat(70));
  console.log('진단 완료');
  console.log('═'.repeat(70));
}

diagnose().catch(console.error);
