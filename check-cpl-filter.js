const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function check() {
  // 비즈액터스쿨 클라이언트 ID 조회
  const { data: bizClients } = await supabase
    .from('clients')
    .select('id, client_name')
    .ilike('client_name', '%비즈액터스쿨%');

  const bizIds = bizClients?.map(c => c.id) || [];
  console.log('비즈액터스쿨 클라이언트:', bizClients?.map(c => c.client_name));

  const { data } = await supabase
    .from('raw_data')
    .select('date, leads, spend, client_id')
    .gte('date', '2025-11-01')
    .lte('date', '2025-11-30');

  // 일반고객 집계
  const general = {};
  const bizactor = {};

  data?.forEach(r => {
    const isBiz = bizIds.includes(r.client_id);
    const target = isBiz ? bizactor : general;
    if (!target[r.date]) target[r.date] = { leads: 0, spend: 0 };
    target[r.date].leads += r.leads || 0;
    target[r.date].spend += parseFloat(r.spend) || 0;
  });

  console.log('\n=== 일반고객 CPL >= $20 ===');
  let found = false;
  Object.entries(general).sort().forEach(([date, d]) => {
    if (d.leads > 0) {
      const cpl = d.spend / d.leads;
      if (cpl >= 20) {
        console.log(date, 'CPL: $' + cpl.toFixed(2));
        found = true;
      }
    }
  });
  if (!found) console.log('없음');

  console.log('\n=== 비즈액터스쿨 CPL >= $20 ===');
  found = false;
  Object.entries(bizactor).sort().forEach(([date, d]) => {
    if (d.leads > 0) {
      const cpl = d.spend / d.leads;
      if (cpl >= 20) {
        console.log(date, 'CPL: $' + cpl.toFixed(2));
        found = true;
      }
    }
  });
  if (!found) console.log('없음');
}
check();
