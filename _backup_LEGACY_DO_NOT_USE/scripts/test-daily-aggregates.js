require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

/**
 * ============================================================================
 * Daily Aggregates 테스트 스크립트
 * ============================================================================
 *
 * 테스트 항목:
 * 1. aggregate_daily_data_range 함수 호출
 * 2. daily_aggregates 테이블 데이터 확인
 * 3. 집계 결과 통계 출력
 *
 * ============================================================================
 */

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function testDailyAggregates() {
  console.log('🧪 Daily Aggregates 테스트 시작\n');

  try {
    // 1. 테스트용 클라이언트 ID 조회
    const { data: clients, error: clientError } = await supabase
      .from('clients')
      .select('id, client_name')
      .eq('is_active', true)
      .limit(1);

    if (clientError || !clients || clients.length === 0) {
      console.error('❌ 활성 클라이언트를 찾을 수 없습니다:', clientError);
      return;
    }

    const testClient = clients[0];
    console.log(`📋 테스트 클라이언트: ${testClient.client_name} (${testClient.id})\n`);

    // 2. 테스트 기간 설정 (최근 7일)
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);

    const weekStart = startDate.toISOString().split('T')[0];
    const weekEnd = endDate.toISOString().split('T')[0];

    console.log(`📅 집계 기간: ${weekStart} ~ ${weekEnd}\n`);

    // 3. Daily Aggregates 생성 (SQL 함수 호출)
    console.log('⚙️ Daily Aggregates 생성 중...');
    const { data: aggregateResult, error: aggregateError } = await supabase
      .rpc('aggregate_daily_data_range', {
        p_client_id: testClient.id,
        p_start_date: weekStart,
        p_end_date: weekEnd
      });

    if (aggregateError) {
      console.error('❌ 집계 실패:', aggregateError);
      return;
    }

    console.log('✅ 집계 완료\n');

    // 4. 집계 결과 출력
    console.log('📊 집계 결과:');
    console.log('─'.repeat(60));

    let totalRows = 0;
    aggregateResult.forEach(row => {
      const status = row.success ? '✅' : '❌';
      console.log(`${status} ${row.date}: ${row.rows_affected} rows`);
      totalRows += row.rows_affected || 0;
    });

    console.log('─'.repeat(60));
    console.log(`📈 총 집계 행 수: ${totalRows}\n`);

    // 5. daily_aggregates 테이블 데이터 확인
    const { data: dailyData, error: dailyError } = await supabase
      .from('daily_aggregates')
      .select('*')
      .eq('client_id', testClient.id)
      .gte('date', weekStart)
      .lte('date', weekEnd)
      .order('date', { ascending: false })
      .limit(10);

    if (dailyError) {
      console.error('❌ 데이터 조회 실패:', dailyError);
      return;
    }

    console.log(`📋 daily_aggregates 테이블 데이터 (최근 10개):`);
    console.log('─'.repeat(80));
    console.log('날짜       | 광고명                | 노출수  | 클릭 | 리드 | 지출    | CPL    ');
    console.log('─'.repeat(80));

    dailyData.forEach(row => {
      const date = row.date;
      const adName = (row.ad_name || 'Unknown').substring(0, 20).padEnd(20);
      const impressions = String(row.impressions || 0).padStart(7);
      const clicks = String(row.clicks || 0).padStart(4);
      const leads = String(row.leads || 0).padStart(4);
      const spend = String((row.spend || 0).toFixed(2)).padStart(7);
      const cpl = String((row.cpl || 0).toFixed(2)).padStart(6);

      console.log(`${date} | ${adName} | ${impressions} | ${clicks} | ${leads} | ${spend} | ${cpl}`);
    });

    console.log('─'.repeat(80));

    // 6. 집계 통계 출력
    if (dailyData.length > 0) {
      const stats = dailyData.reduce((acc, row) => ({
        totalImpressions: acc.totalImpressions + (row.impressions || 0),
        totalClicks: acc.totalClicks + (row.clicks || 0),
        totalLeads: acc.totalLeads + (row.leads || 0),
        totalSpend: acc.totalSpend + parseFloat(row.spend || 0)
      }), { totalImpressions: 0, totalClicks: 0, totalLeads: 0, totalSpend: 0 });

      console.log('\n📊 집계 통계:');
      console.log(`- 총 노출수: ${stats.totalImpressions.toLocaleString()}`);
      console.log(`- 총 클릭수: ${stats.totalClicks.toLocaleString()}`);
      console.log(`- 총 리드: ${stats.totalLeads.toLocaleString()}`);
      console.log(`- 총 지출: $${stats.totalSpend.toFixed(2)}`);
      console.log(`- 평균 CPL: $${(stats.totalLeads > 0 ? stats.totalSpend / stats.totalLeads : 0).toFixed(2)}`);
      console.log(`- 평균 CTR: ${(stats.totalImpressions > 0 ? (stats.totalClicks / stats.totalImpressions * 100) : 0).toFixed(2)}%`);
    }

    console.log('\n✅ 테스트 완료');

  } catch (error) {
    console.error('❌ 테스트 실패:', error);
  }
}

// 실행
testDailyAggregates();
