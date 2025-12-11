require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

/**
 * Supabase JS 클라이언트를 통해 파티션 생성
 *
 * 2025 최신 방법:
 * - Supabase RPC 함수 사용
 * - Service Role Key로 관리자 권한 실행
 */

async function createPartitions() {
  console.log('🚀 Creating partitions for 2025-01 to 2025-10...\n');

  const partitions = [
    { month: '01', start: '2025-01-01', end: '2025-02-01' },
    { month: '02', start: '2025-02-01', end: '2025-03-01' },
    { month: '03', start: '2025-03-01', end: '2025-04-01' },
    { month: '04', start: '2025-04-01', end: '2025-05-01' },
    { month: '05', start: '2025-05-01', end: '2025-06-01' },
    { month: '06', start: '2025-06-01', end: '2025-07-01' },
    { month: '07', start: '2025-07-01', end: '2025-08-01' },
    { month: '08', start: '2025-08-01', end: '2025-09-01' },
    { month: '09', start: '2025-09-01', end: '2025-10-01' },
    { month: '10', start: '2025-10-01', end: '2025-11-01' }
  ];

  for (const partition of partitions) {
    const tableName = `raw_data_2025_${partition.month}`;
    const sql = `CREATE TABLE IF NOT EXISTS ${tableName} PARTITION OF raw_data FOR VALUES FROM ('${partition.start}') TO ('${partition.end}')`;

    console.log(`Creating ${tableName}...`);

    try {
      // Supabase에서는 직접 SQL 실행을 위해 RPC 또는 SQL Editor 사용 필요
      // 여기서는 PostgreSQL 함수를 만들어서 실행하는 방법 시도

      const { data, error } = await supabase.rpc('exec_sql', {
        sql_query: sql
      });

      if (error) {
        console.log(`  ⚠️  RPC 방식 실패, 대체 방법 필요: ${error.message}`);
        console.log(`  💡 Supabase SQL Editor에서 직접 실행하세요:\n     ${sql}\n`);
      } else {
        console.log(`  ✅ ${tableName} created\n`);
      }
    } catch (err) {
      console.log(`  ❌ Error: ${err.message}`);
      console.log(`  💡 Supabase SQL Editor에서 직접 실행하세요:\n     ${sql}\n`);
    }
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('\n📊 결론:');
  console.log('Supabase JS 클라이언트로는 DDL 실행이 제한됩니다.');
  console.log('\n✅ 권장 방법: Supabase SQL Editor 사용');
  console.log('   1. https://supabase.com/dashboard/project/mpljqcuqrrfwzamfyxnz 접속');
  console.log('   2. SQL Editor 탭 클릭');
  console.log('   3. 아래 SQL 복사 → 붙여넣기 → Run');
  console.log('\n');
  console.log('-- 2025년 1~10월 파티션 생성 SQL:');
  console.log('CREATE TABLE IF NOT EXISTS raw_data_2025_01 PARTITION OF raw_data FOR VALUES FROM (\'2025-01-01\') TO (\'2025-02-01\');');
  console.log('CREATE TABLE IF NOT EXISTS raw_data_2025_02 PARTITION OF raw_data FOR VALUES FROM (\'2025-02-01\') TO (\'2025-03-01\');');
  console.log('CREATE TABLE IF NOT EXISTS raw_data_2025_03 PARTITION OF raw_data FOR VALUES FROM (\'2025-03-01\') TO (\'2025-04-01\');');
  console.log('CREATE TABLE IF NOT EXISTS raw_data_2025_04 PARTITION OF raw_data FOR VALUES FROM (\'2025-04-01\') TO (\'2025-05-01\');');
  console.log('CREATE TABLE IF NOT EXISTS raw_data_2025_05 PARTITION OF raw_data FOR VALUES FROM (\'2025-05-01\') TO (\'2025-06-01\');');
  console.log('CREATE TABLE IF NOT EXISTS raw_data_2025_06 PARTITION OF raw_data FOR VALUES FROM (\'2025-06-01\') TO (\'2025-07-01\');');
  console.log('CREATE TABLE IF NOT EXISTS raw_data_2025_07 PARTITION OF raw_data FOR VALUES FROM (\'2025-07-01\') TO (\'2025-08-01\');');
  console.log('CREATE TABLE IF NOT EXISTS raw_data_2025_08 PARTITION OF raw_data FOR VALUES FROM (\'2025-08-01\') TO (\'2025-09-01\');');
  console.log('CREATE TABLE IF NOT EXISTS raw_data_2025_09 PARTITION OF raw_data FOR VALUES FROM (\'2025-09-01\') TO (\'2025-10-01\');');
  console.log('CREATE TABLE IF NOT EXISTS raw_data_2025_10 PARTITION OF raw_data FOR VALUES FROM (\'2025-10-01\') TO (\'2025-11-01\');');
  console.log('\n');
}

createPartitions().catch(console.error);
