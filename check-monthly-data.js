require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

(async () => {
  const clientId = '79e35fc6-a817-4ccc-9d5d-9a93c1ad4515';

  console.log('📊 Checking monthly_summary table...\n');

  // 최근 2개월 데이터 조회
  const { data, error } = await supabase
    .from('monthly_summary')
    .select('*')
    .eq('client_id', clientId)
    .order('month_start', { ascending: false })
    .limit(2);

  if (error) {
    console.log('Error:', error.message);

    // weekly_summary에서 월간 데이터 생성
    console.log('\n📊 Generating monthly data from weekly_summary...\n');

    const { data: weeklyData } = await supabase
      .from('weekly_summary')
      .select('*')
      .eq('client_id', clientId)
      .gte('week_start', '2025-10-01')
      .order('week_start', { ascending: true });

    if (weeklyData && weeklyData.length > 0) {
      // 10월 데이터 집계
      const octoberData = weeklyData.filter(d => d.week_start.startsWith('2025-10'));
      const octTotal = octoberData.reduce((acc, d) => ({
        impressions: acc.impressions + (d.total_impressions || 0),
        clicks: acc.clicks + (d.total_clicks || 0),
        spend: acc.spend + (d.total_spend || 0),
        leads: acc.leads + (d.total_leads || 0)
      }), { impressions: 0, clicks: 0, spend: 0, leads: 0 });

      // 11월 데이터 집계
      const novemberData = weeklyData.filter(d => d.week_start.startsWith('2025-11'));
      const novTotal = novemberData.reduce((acc, d) => ({
        impressions: acc.impressions + (d.total_impressions || 0),
        clicks: acc.clicks + (d.total_clicks || 0),
        spend: acc.spend + (d.total_spend || 0),
        leads: acc.leads + (d.total_leads || 0)
      }), { impressions: 0, clicks: 0, spend: 0, leads: 0 });

      console.log('📊 월간 리포트 데이터 (From weekly_summary):\n');
      console.log('━'.repeat(80));

      // 10월 리포트
      if (octTotal.leads > 0) {
        const octCpl = octTotal.spend / octTotal.leads;
        const octCtr = octTotal.impressions > 0 ? (octTotal.clicks / octTotal.impressions * 100) : 0;

        console.log('📅 2025년 10월');
        console.log('━'.repeat(80));
        console.log(`💰 총 지출: $${octTotal.spend.toFixed(2)}`);
        console.log(`🎯 총 리드: ${octTotal.leads}건`);
        console.log(`💵 평균 CPL: $${octCpl.toFixed(2)}`);
        console.log(`📊 평균 CTR: ${octCtr.toFixed(2)}%`);
        console.log(`👁️  노출수: ${octTotal.impressions.toLocaleString()}회`);
        console.log(`👆 클릭수: ${octTotal.clicks}회`);
        console.log(`📦 주간 리포트 수: ${octoberData.length / 9}주 (광고 ${octoberData.length}개)\n`);
      }

      // 11월 리포트
      if (novTotal.leads > 0) {
        const novCpl = novTotal.spend / novTotal.leads;
        const novCtr = novTotal.impressions > 0 ? (novTotal.clicks / novTotal.impressions * 100) : 0;

        console.log('📅 2025년 11월 (현재)');
        console.log('━'.repeat(80));
        console.log(`💰 총 지출: $${novTotal.spend.toFixed(2)}`);
        console.log(`🎯 총 리드: ${novTotal.leads}건`);
        console.log(`💵 평균 CPL: $${novCpl.toFixed(2)}`);
        console.log(`📊 평균 CTR: ${novCtr.toFixed(2)}%`);
        console.log(`👁️  노출수: ${novTotal.impressions.toLocaleString()}회`);
        console.log(`👆 클릭수: ${novTotal.clicks}회`);
        console.log(`📦 주간 리포트 수: ${novemberData.length / 9}주 (광고 ${novemberData.length}개)\n`);

        // 전월 대비
        if (octTotal.leads > 0) {
          const octCpl = octTotal.spend / octTotal.leads;
          const leadChange = ((novTotal.leads - octTotal.leads) / octTotal.leads * 100);
          const cplChange = ((novCpl - octCpl) / octCpl * 100);
          const spendChange = ((novTotal.spend - octTotal.spend) / octTotal.spend * 100);

          console.log('📊 전월 대비 변화');
          console.log('━'.repeat(80));
          console.log(`리드: ${leadChange >= 0 ? '▲' : '▼'} ${Math.abs(leadChange).toFixed(1)}%`);
          console.log(`CPL: ${cplChange >= 0 ? '▲' : '▼'} ${Math.abs(cplChange).toFixed(1)}%`);
          console.log(`지출: ${spendChange >= 0 ? '▲' : '▼'} ${Math.abs(spendChange).toFixed(1)}%`);
        }
      }

      console.log('\n━'.repeat(80));
      console.log('✅ 월간 리포트 데이터 시뮬레이션 완료');
      console.log('📌 이 데이터를 기반으로 매월 1일 09:00에 월간 리포트 발송');
    }

    process.exit(0);
    return;
  }

  if (!data || data.length === 0) {
    console.log('❌ No monthly data found');
    console.log('Note: monthly_summary table may need backfill');
    process.exit(0);
    return;
  }

  console.log('📊 Monthly Summary Data Available:');
  console.log(JSON.stringify(data, null, 2));

  process.exit(0);
})();
