require('dotenv').config();
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function executeSqlFile(filePath) {
  const client = new Client({
    host: `db.${process.env.SUPABASE_PROJECT_REF}.supabase.co`,
    port: 5432,
    database: 'postgres',
    user: 'postgres',
    password: process.env.SUPABASE_DB_PASSWORD,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    await client.connect();
    console.log('✅ Connected to Supabase PostgreSQL');

    const sql = fs.readFileSync(filePath, 'utf8');
    console.log(`📄 Executing ${path.basename(filePath)}...`);

    await client.query(sql);
    console.log('✅ SQL executed successfully');
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  } finally {
    await client.end();
  }
}

const sqlFile = process.argv[2] || 'sql/02_functions_timezone.sql';
executeSqlFile(sqlFile);
