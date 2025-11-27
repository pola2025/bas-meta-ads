const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function check() {
  // 11월 데이터 확인
  const { data } = await supabase
    .from('raw_data')
    .select('date, leads, spend')
    .gte('date', '2024-11-01')
    .lte('date', '2024-11-30');

  // 일별 집계
  const daily = {};
  data?.forEach(r => {
    if (!daily[r.date]) daily[r.date] = { leads: 0, spend: 0 };
    daily[r.date].leads += r.leads || 0;
    daily[r.date].spend += parseFloat(r.spend) || 0;
  });

  // CPL 계산 및 $20 이상 찾기
  console.log('=== CPL >= $20 인 날짜 ===');
  let found = false;
  Object.entries(daily).sort().forEach(([date, d]) => {
    if (d.leads > 0) {
      const cpl = d.spend / d.leads;
      if (cpl >= 20) {
        console.log(date, 'CPL:', cpl.toFixed(2), 'leads:', d.leads, 'spend:', d.spend.toFixed(2));
        found = true;
      }
    }
  });
  if (!found) console.log('없음');

  console.log('\n=== 최근 CPL 현황 ===');
  Object.entries(daily).sort().slice(-10).forEach(([date, d]) => {
    const cpl = d.leads > 0 ? d.spend / d.leads : 0;
    console.log(date, 'CPL:', cpl.toFixed(2), 'leads:', d.leads);
  });
}
check();
