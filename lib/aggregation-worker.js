/**
 * Daily Aggregation Worker
 * raw_data → daily_aggregates 자동 집계
 *
 * 실행 방식: Queue 기반 (Bull/BullMQ)
 * 트리거: 데이터 수집 완료 후 또는 Cron
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

/**
 * 일별 집계 실행 (Lookback Window 적용)
 *
 * @param {string} clientId - 클라이언트 UUID
 * @param {number} lookbackDays - 과거 재집계 일수 (기본 3일)
 */
async function runDailyAggregation(clientId, lookbackDays = 3) {
  console.log(`\n📊 Daily Aggregation Started`);
  console.log(`   Client: ${clientId}`);
  console.log(`   Lookback: ${lookbackDays} days\n`);

  try {
    // 1. 날짜 범위 계산 (명시적, KST 기준)
    const kstNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));

    const endDate = new Date(kstNow);
    endDate.setDate(kstNow.getDate() - 1); // 어제

    const startDate = new Date(endDate);
    startDate.setDate(endDate.getDate() - (lookbackDays - 1)); // lookbackDays 일 전

    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];

    console.log(`📅 Period: ${startDateStr} ~ ${endDateStr} (${lookbackDays} days)`);

    // 2. SQL 함수 호출 (범위 집계)
    const { data, error } = await supabase.rpc('aggregate_daily_data_range', {
      p_client_id: clientId,
      p_start_date: startDateStr,
      p_end_date: endDateStr
    });

    if (error) {
      throw new Error(`Aggregation failed: ${error.message}`);
    }

    // 3. 결과 요약
    const totalRows = data.reduce((sum, d) => sum + d.rows_affected, 0);
    const successCount = data.filter(d => d.success).length;

    console.log(`\n✅ Aggregation Completed`);
    console.log(`   Success: ${successCount}/${data.length} days`);
    console.log(`   Records: ${totalRows}\n`);

    return {
      success: true,
      clientId,
      startDate: startDateStr,
      endDate: endDateStr,
      daysProcessed: data.length,
      recordsAggregated: totalRows
    };

  } catch (error) {
    console.error(`❌ Aggregation failed:`, error);
    throw error;
  }
}

/**
 * 모든 활성 클라이언트 집계
 */
async function aggregateAllClients(lookbackDays = 3) {
  console.log('\n🔄 Aggregating all active clients...\n');

  // 1. 활성 클라이언트 조회
  const { data: clients, error } = await supabase
    .from('clients')
    .select('id, client_name')
    .eq('is_active', true);

  if (error) {
    throw new Error(`Failed to fetch clients: ${error.message}`);
  }

  console.log(`Found ${clients.length} active clients\n`);

  // 2. 각 클라이언트 순차 집계
  const results = [];

  for (const client of clients) {
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`Processing: ${client.client_name}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

    try {
      const result = await runDailyAggregation(client.id, lookbackDays);
      results.push({ ...result, clientName: client.client_name });
    } catch (error) {
      console.error(`Failed for ${client.client_name}:`, error.message);
      results.push({
        success: false,
        clientId: client.id,
        clientName: client.client_name,
        error: error.message
      });
    }
  }

  // 3. 전체 요약
  const successCount = results.filter(r => r.success).length;

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`📊 All Clients Aggregation Summary`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`✅ Success: ${successCount}/${clients.length}`);
  console.log(`❌ Failed: ${clients.length - successCount}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  return results;
}

module.exports = {
  runDailyAggregation,
  aggregateAllClients
};

// CLI 실행 지원
if (require.main === module) {
  const lookbackDays = parseInt(process.env.LOOKBACK_DAYS) || 3;

  aggregateAllClients(lookbackDays)
    .then(results => {
      const hasErrors = results.some(r => !r.success);
      process.exit(hasErrors ? 1 : 0);
    })
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}
