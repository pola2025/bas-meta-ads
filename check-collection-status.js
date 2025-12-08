const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function check() {
  // 최근 producer 실행 이력
  const { data: executions } = await supabase
    .from('producer_executions')
    .select('*')
    .order('started_at', { ascending: false })
    .limit(10);

  console.log('=== 최근 Producer 실행 이력 ===');
  if (executions && executions.length > 0) {
    executions.forEach(e => {
      const started = new Date(e.started_at).toLocaleString('ko-KR', {timeZone: 'Asia/Seoul'});
      console.log(`${started} | ${e.status} | 클라이언트: ${e.total_clients} | 성공: ${e.enqueued_count} | 실패: ${e.failed_count}`);
    });
  } else {
    console.log('실행 이력 없음');
  }

  // 최근 수집된 데이터 확인
  console.log('\n=== 날짜별 수집 데이터 (최근 7일) ===');
  const { data: recent } = await supabase
    .from('raw_data')
    .select('date')
    .gte('date', '2025-11-27')
    .order('date', { ascending: false });

  if (recent && recent.length > 0) {
    const byDate = {};
    recent.forEach(r => {
      byDate[r.date] = (byDate[r.date] || 0) + 1;
    });
    Object.entries(byDate).sort().reverse().forEach(([date, count]) => {
      console.log(`${date}: ${count}건`);
    });
  } else {
    console.log('최근 데이터 없음');
  }

  // 클라이언트별 최신 데이터 날짜
  console.log('\n=== 클라이언트별 최신 데이터 날짜 ===');
  const { data: clients } = await supabase
    .from('clients')
    .select('id, client_name, auth_status, is_active');

  for (const client of clients || []) {
    const { data: latest } = await supabase
      .from('raw_data')
      .select('date')
      .eq('client_id', client.id)
      .order('date', { ascending: false })
      .limit(1)
      .single();

    const status = client.auth_status === 'active' ? '✅' : '⚠️';
    console.log(`${status} ${client.client_name}: ${latest?.date || 'N/A'} (${client.auth_status})`);
  }

  // 12월 데이터 상세
  console.log('\n=== 12월 데이터 상세 ===');
  const { data: dec } = await supabase
    .from('raw_data')
    .select('date, client_id')
    .gte('date', '2025-12-01');

  if (dec && dec.length > 0) {
    const clientIds = [...new Set(dec.map(d => d.client_id))];
    console.log(`12월 총 ${dec.length}건, 클라이언트 ${clientIds.length}개`);

    // 클라이언트별
    for (const cid of clientIds) {
      const client = clients.find(c => c.id === cid);
      const count = dec.filter(d => d.client_id === cid).length;
      console.log(`  - ${client?.client_name || cid}: ${count}건`);
    }
  } else {
    console.log('12월 데이터 없음');
  }
}

check().catch(console.error);
