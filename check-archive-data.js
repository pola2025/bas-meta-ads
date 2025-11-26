/**
 * 리포트 아카이브 생성 전 데이터 확인 스크립트
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function check() {
  console.log('=== 리포트 아카이브 데이터 확인 ===\n');

  // 먼저 ads_insights_daily에서 날짜 범위 확인
  const { data: dateRange } = await supabase
    .from('ads_insights_daily')
    .select('date')
    .order('date', { ascending: true })
    .limit(1);

  const { data: dateRangeEnd } = await supabase
    .from('ads_insights_daily')
    .select('date')
    .order('date', { ascending: false })
    .limit(1);

  console.log('[ads_insights_daily 데이터 범위]');
  if (dateRange && dateRange.length > 0) {
    console.log('첫 날짜:', dateRange[0].date);
    console.log('마지막 날짜:', dateRangeEnd[0].date);
  } else {
    console.log('데이터 없음');
  }

  // 최신 데이터 날짜 기준으로 조회
  const startDate = dateRange && dateRange[0] ? dateRange[0].date : '2024-10-01';
  const endDate = dateRangeEnd && dateRangeEnd[0] ? dateRangeEnd[0].date : '2024-11-24';

  // daily_aggregates 데이터 확인
  const { data: dailyAgg, error: e1 } = await supabase
    .from('daily_aggregates')
    .select('date, leads, spend')
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date');

  if (e1) {
    console.log('daily_aggregates 에러:', e1.message);
    return;
  }

  console.log('[daily_aggregates 데이터]');
  console.log('총 개수:', dailyAgg.length);

  if (dailyAgg.length > 0) {
    console.log('첫 날짜:', dailyAgg[0].date);
    console.log('마지막 날짜:', dailyAgg[dailyAgg.length - 1].date);

    // 10월, 11월 별 집계 (2025년 데이터)
    const oct = dailyAgg.filter(d => d.date.startsWith('2025-10'));
    const nov = dailyAgg.filter(d => d.date.startsWith('2025-11'));

    console.log('\n2025년 10월 데이터:', oct.length, '일');
    console.log('  리드 합계:', oct.reduce((s, d) => s + (d.leads || 0), 0));
    console.log('  지출 합계: $' + oct.reduce((s, d) => s + parseFloat(d.spend || 0), 0).toFixed(2));

    console.log('\n2025년 11월 데이터:', nov.length, '일');
    console.log('  리드 합계:', nov.reduce((s, d) => s + (d.leads || 0), 0));
    console.log('  지출 합계: $' + nov.reduce((s, d) => s + parseFloat(d.spend || 0), 0).toFixed(2));

    // 주차별 데이터 확인 (2025년)
    console.log('\n[주차별 데이터 확인 - 2025년]');
    const weeks = [
      { week: 41, start: '2025-10-06', end: '2025-10-12' },
      { week: 42, start: '2025-10-13', end: '2025-10-19' },
      { week: 43, start: '2025-10-20', end: '2025-10-26' },
      { week: 44, start: '2025-10-27', end: '2025-11-02' },
      { week: 45, start: '2025-11-03', end: '2025-11-09' },
      { week: 46, start: '2025-11-10', end: '2025-11-16' },
      { week: 47, start: '2025-11-17', end: '2025-11-23' },
      { week: 48, start: '2025-11-24', end: '2025-11-30' }
    ];

    weeks.forEach(w => {
      const weekData = dailyAgg.filter(d => d.date >= w.start && d.date <= w.end);
      const leads = weekData.reduce((s, d) => s + (d.leads || 0), 0);
      const spend = weekData.reduce((s, d) => s + parseFloat(d.spend || 0), 0);
      console.log('W' + w.week + ' (' + w.start + ' ~ ' + w.end + '): ' + weekData.length + '일, 리드 ' + leads + '건, $' + spend.toFixed(0));
    });
  }

  // 기존 telegram_reports 확인
  const { data: reports, error: e2 } = await supabase
    .from('telegram_reports')
    .select('id, report_type, week_start, week_end, total_leads, total_spend')
    .order('week_start', { ascending: false })
    .limit(20);

  console.log('\n[기존 telegram_reports]');
  if (e2) {
    console.log('에러:', e2.message);
  } else {
    console.log('총 개수:', reports.length);
    if (reports.length > 0) {
      reports.forEach(r => {
        const type = r.report_type.padEnd(8);
        const period = r.week_start + ' ~ ' + r.week_end;
        const leads = r.total_leads || 0;
        const spend = r.total_spend ? r.total_spend.toFixed(0) : 0;
        console.log(type + ' | ' + period + ' | 리드:' + leads + ' | $' + spend);
      });
    } else {
      console.log('(없음)');
    }
  }
}

check().catch(console.error);
