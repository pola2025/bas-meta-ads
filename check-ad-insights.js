const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

(async () => {
  // daily_insights 테이블 확인
  const { data, error } = await supabase
    .from('daily_insights')
    .select('date_start, client_id, leads, spend')
    .gte('date_start', '2025-12-01')
    .lte('date_start', '2025-12-07')
    .limit(200);

  if (error) {
    console.log('ad_insights 에러:', error.message);
    return;
  }

  console.log('ad_insights 12월 1-7일 데이터:', data?.length || 0, '건');

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

    console.log('\n클라이언트별 데이터:');
    Object.entries(byClient).forEach(([cid, rows]) => {
      const totalLeads = rows.reduce((sum, r) => sum + (r.leads || 0), 0);
      const dates = [...new Set(rows.map(r => r.date_start))].sort();
      console.log(`  ${clientMap[cid] || cid}: ${rows.length}건, leads=${totalLeads}`);
      console.log(`    날짜: ${dates.join(', ')}`);
    });
  }
})();
