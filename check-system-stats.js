const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function check() {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const since = sevenDaysAgo.toISOString().split('T')[0];

  const { data } = await supabase
    .from('raw_data')
    .select('client_id, impressions, clicks, leads, spend')
    .gte('date', since);

  const byClient = {};
  let total = { impressions: 0, clicks: 0, leads: 0, spend: 0 };

  data.forEach(function(row) {
    const cid = row.client_id;
    if (!byClient[cid]) byClient[cid] = { impressions: 0, clicks: 0, leads: 0, spend: 0 };
    byClient[cid].impressions += row.impressions || 0;
    byClient[cid].clicks += row.clicks || 0;
    byClient[cid].leads += row.leads || 0;
    byClient[cid].spend += parseFloat(row.spend) || 0;

    total.impressions += row.impressions || 0;
    total.clicks += row.clicks || 0;
    total.leads += row.leads || 0;
    total.spend += parseFloat(row.spend) || 0;
  });

  const { data: clients } = await supabase.from('clients').select('id, client_name');
  const nameMap = {};
  clients.forEach(function(c) { nameMap[c.id] = c.client_name; });

  console.log('=== 7일 데이터 클라이언트별 집계 ===');
  Object.keys(byClient).forEach(function(cid) {
    const c = byClient[cid];
    console.log(nameMap[cid] + ': ' + c.leads + '리드, $' + c.spend.toFixed(2));
  });
  console.log('');
  console.log('=== 전체 합계 (시스템현황 표시값) ===');
  console.log('도달: ' + total.impressions.toLocaleString());
  console.log('리드: ' + total.leads);
  console.log('지출: $' + total.spend.toFixed(2));
  console.log('CPL: $' + (total.leads > 0 ? (total.spend / total.leads).toFixed(2) : 0));
}
check();
