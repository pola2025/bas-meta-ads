#!/usr/bin/env node
/**
 * 모든 클라이언트의 daily_aggregates 동기화
 * raw_data → daily_aggregates 집계
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { fullIntegrityCheck } = require('./lib/data-integrity');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function syncAllClients() {
  console.log('═'.repeat(70));
  console.log('🔄 모든 클라이언트 daily_aggregates 동기화');
  console.log('═'.repeat(70));
  console.log();

  // 1. 모든 활성 클라이언트 조회
  const { data: clients, error } = await supabase
    .from('clients')
    .select('id, client_name')
    .eq('is_active', true)
    .order('client_name');

  if (error) {
    console.error('❌ 클라이언트 조회 실패:', error.message);
    return;
  }

  console.log(`👥 대상 클라이언트: ${clients.length}개\n`);

  // 2. 각 클라이언트별 집계
  const results = [];

  for (const client of clients) {
    console.log('━'.repeat(70));
    console.log(`📊 ${client.client_name}`);
    console.log('━'.repeat(70));

    try {
      const result = await fullIntegrityCheck(client.id);
      results.push({
        client: client.client_name,
        success: result.success,
        records: result.recordsAggregated || 0,
        dates: result.datesVerified || 0
      });
    } catch (err) {
      console.error(`❌ ${client.client_name} 집계 실패:`, err.message);
      results.push({
        client: client.client_name,
        success: false,
        error: err.message
      });
    }

    console.log();
  }

  // 3. 결과 요약
  console.log('═'.repeat(70));
  console.log('📊 집계 결과 요약');
  console.log('═'.repeat(70));
  console.log();

  const success = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  const totalRecords = results.reduce((sum, r) => sum + (r.records || 0), 0);

  console.log(`✅ 성공: ${success}개`);
  console.log(`❌ 실패: ${failed}개`);
  console.log(`📊 총 집계 레코드: ${totalRecords}개`);
  console.log();

  results.forEach(r => {
    const icon = r.success ? '✅' : '❌';
    const detail = r.success ? `${r.records}레코드, ${r.dates}일` : r.error;
    console.log(`${icon} ${r.client}: ${detail}`);
  });

  console.log();
  console.log('═'.repeat(70));
}

syncAllClients().catch(console.error);
