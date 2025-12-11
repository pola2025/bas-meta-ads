require('dotenv').config();
const { Client } = require('pg');

// Use direct connection (not pooler)
const connectionString = `postgresql://postgres:${process.env.SUPABASE_DB_PASSWORD}@db.mpljqcuqrrfwzamfyxnz.supabase.co:5432/postgres`;

const client = new Client({ connectionString });

const partitions = [
  { name: 'raw_data_2025_01', start: '2025-01-01', end: '2025-02-01' },
  { name: 'raw_data_2025_02', start: '2025-02-01', end: '2025-03-01' },
  { name: 'raw_data_2025_03', start: '2025-03-01', end: '2025-04-01' },
  { name: 'raw_data_2025_04', start: '2025-04-01', end: '2025-05-01' },
  { name: 'raw_data_2025_05', start: '2025-05-01', end: '2025-06-01' },
  { name: 'raw_data_2025_06', start: '2025-06-01', end: '2025-07-01' },
  { name: 'raw_data_2025_07', start: '2025-07-01', end: '2025-08-01' },
  { name: 'raw_data_2025_08', start: '2025-08-01', end: '2025-09-01' },
  { name: 'raw_data_2025_09', start: '2025-09-01', end: '2025-10-01' },
  { name: 'raw_data_2025_10', start: '2025-10-01', end: '2025-11-01' }
];

async function createPartitions() {
  console.log('🚀 Creating historical partitions for raw_data table\n');

  await client.connect();

  for (const partition of partitions) {
    const sql = `CREATE TABLE IF NOT EXISTS ${partition.name} PARTITION OF raw_data FOR VALUES FROM ('${partition.start}') TO ('${partition.end}')`;

    try {
      await client.query(sql);
      console.log(`✅ Created partition: ${partition.name} (${partition.start} ~ ${partition.end})`);
    } catch (error) {
      if (error.message.includes('already exists')) {
        console.log(`⚠️  Partition already exists: ${partition.name}`);
      } else {
        console.error(`❌ Error creating ${partition.name}:`, error.message);
      }
    }
  }

  // Verify partitions
  console.log('\n📊 Verifying partitions...\n');
  const result = await client.query(`
    SELECT
      schemaname,
      tablename,
      pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
    FROM pg_tables
    WHERE tablename LIKE 'raw_data_2025_%'
    ORDER BY tablename
  `);

  console.table(result.rows);

  await client.end();
  console.log('\n✅ Partition creation completed');
}

createPartitions().catch(console.error);
