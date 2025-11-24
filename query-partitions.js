require('dotenv').config();
const { Client } = require('pg');

const client = new Client({
  connectionString: `postgresql://postgres.mpljqcuqrrfwzamfyxnz:${process.env.SUPABASE_DB_PASSWORD}@aws-0-us-east-1.pooler.supabase.com:6543/postgres`,
  ssl: { rejectUnauthorized: false }
});

async function queryPartitions() {
  try {
    await client.connect();
    console.log('✅ Connected to Supabase\n');

    console.log('📊 Checking partitions...\n');

    const result = await client.query(`
      SELECT
        tablename,
        pg_size_pretty(pg_total_relation_size('public.' || tablename)) AS size
      FROM pg_tables
      WHERE schemaname = 'public'
        AND tablename LIKE 'raw_data_2025%'
      ORDER BY tablename;
    `);

    if (result.rows.length === 0) {
      console.log('❌ No partitions found!\n');
    } else {
      console.log(`✅ Found ${result.rows.length} partitions:\n`);
      console.table(result.rows);
    }

    // Check data counts
    console.log('\n📈 Checking data counts...\n');

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
        // Partition doesn't exist - skip silently
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

queryPartitions();
