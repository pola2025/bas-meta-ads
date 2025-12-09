const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

(async () => {
  // ads_insights_daily VIEW에서 date 컬럼으로 조회
  const { data, error } = await supabase
    .from('ads_insights_daily')
    .select('date, client_id, leads, spend, impressions')
    .gte('date', '2025-12-01')
    .lte('date', '2025-12-07')
    .limit(300);

  if (error) {
    console.log('에러:', error.message);
    return;
  }

  console.log('ads_insights_daily 12월 1-7일 데이터:', data?.length || 0, '건\n');

  if (data && data.length > 0) {
    // client_id별 그룹핑
    const byClient = {};
    data.forEach(d => {
      if (!byClient[d.client_id]) byClient[d.client_id] = [];
      byClient[d.client_id].push(d);
    });

    // 클라이언트 이름 가져오기
    const { data: clients } = await supabase
      .from('clients')
      .select('id, client_name');
    const clientMap = {};
    clients.forEach(c => clientMap[c.id] = c.client_name);

    console.log('클라이언트별 데이터:');
    Object.entries(byClient).forEach(([cid, rows]) => {
      const totalLeads = rows.reduce((sum, r) => sum + (r.leads || 0), 0);
      const dates = [...new Set(rows.map(r => r.date))].sort();
      console.log(`\n${clientMap[cid] || cid}:`);
      console.log(`  레코드: ${rows.length}건, 총 leads=${totalLeads}`);
      console.log(`  날짜: ${dates.join(', ')}`);
    });
  }
})();
