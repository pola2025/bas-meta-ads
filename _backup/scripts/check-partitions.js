import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  connectionString: `postgresql://postgres.mpljqcuqrrfwzamfyxnz:${process.env.SUPABASE_DB_PASSWORD}@aws-0-us-east-1.pooler.supabase.com:6543/postgres`,
  ssl: { rejectUnauthorized: false }
});

async function checkPartitions() {
  const client = await pool.connect();

  try {
    console.log('📊 Checking raw_data partitions...\n');

    // 파티션 목록 조회
    const result = await client.query(`
      SELECT
        schemaname,
        tablename,
        pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
      FROM pg_tables
      WHERE tablename LIKE 'raw_data_2025%'
      ORDER BY tablename;
    `);

    console.log('✅ Existing partitions:');
    console.table(result.rows);

    // 각 파티션의 데이터 개수 확인
    console.log('\n📈 Row counts per partition:');
    const months = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];

    for (const month of months) {
      const tableName = `raw_data_2025_${month}`;
      try {
        const countResult = await client.query(`SELECT COUNT(*) FROM ${tableName}`);
        const count = parseInt(countResult.rows[0].count);
        if (count > 0) {
          console.log(`   ${tableName}: ${count.toLocaleString()} rows`);
        }
      } catch (err) {
        // 파티션이 없으면 스킵
        if (!err.message.includes('does not exist')) {
          console.log(`   ${tableName}: Error - ${err.message}`);
        }
      }
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

checkPartitions();
