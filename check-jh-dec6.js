const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

(async () => {
  // JH 경영지원센터 client_id
  const clientId = '4617bad3-3eb8-419d-a186-057907c2a1ce';

  // ads_insights_daily VIEW에서 date 컬럼으로 조회
  const { data, error } = await supabase
    .from('ads_insights_daily')
    .select('date, ad_name, leads, spend, impressions')
    .eq('client_id', clientId)
    .gte('date', '2025-12-01')
    .lte('date', '2025-12-07')
    .order('date');

  if (error) {
    console.log('에러:', error.message);
    return;
  }

  console.log('=== JH 경영지원센터 12월 1-7일 데이터 ===\n');

  // 날짜별 그룹핑
  const byDate = {};
  data.forEach(d => {
    if (!byDate[d.date]) byDate[d.date] = { leads: 0, spend: 0, count: 0 };
    byDate[d.date].leads += d.leads || 0;
    byDate[d.date].spend += parseFloat(d.spend) || 0;
    byDate[d.date].count++;
  });

  const dates = ['2025-12-01','2025-12-02','2025-12-03','2025-12-04','2025-12-05','2025-12-06','2025-12-07'];
  dates.forEach(date => {
    const d = byDate[date];
    if (d) {
      console.log(`${date}: ✅ 레코드=${d.count}, leads=${d.leads}, spend=$${d.spend.toFixed(2)}`);
    } else {
      console.log(`${date}: ❌ 데이터 없음`);
    }
  });

  console.log('\n총 레코드:', data.length);
})();
