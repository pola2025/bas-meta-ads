require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function runSQL(filePath) {
  console.log(`Reading SQL file: ${filePath}`);
  const sql = fs.readFileSync(filePath, 'utf-8');

  // Split by semicolon and filter empty statements
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s && !s.startsWith('--') && s.length > 0);

  console.log(`Found ${statements.length} SQL statements\n`);

  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i];

    // Skip comments and SELECT statements
    if (statement.startsWith('--') || statement.toUpperCase().startsWith('SELECT')) {
      if (statement.toUpperCase().startsWith('SELECT')) {
        console.log(`\nVerifying partitions...`);
        const { data, error } = await supabase.rpc('exec_sql', {
          sql_query: statement
        });

        if (error) {
          console.log(`Executing via pg client directly...`);
          // Fallback: Execute using pg client
          const { Client } = require('pg');
          const client = new Client({
            connectionString: `postgresql://postgres.mpljqcuqrrfwzamfyxnz:${process.env.SUPABASE_DB_PASSWORD}@aws-0-us-east-1.pooler.supabase.com:6543/postgres`
          });

          await client.connect();
          const result = await client.query(statement);
          console.table(result.rows);
          await client.end();
        } else {
          console.log('Result:', data);
        }
      }
      continue;
    }

    console.log(`[${i + 1}/${statements.length}] Executing: ${statement.substring(0, 100)}...`);

    // Use Supabase client to execute
    const { Client } = require('pg');
    const client = new Client({
      connectionString: `postgresql://postgres.mpljqcuqrrfwzamfyxnz:${process.env.SUPABASE_DB_PASSWORD}@aws-0-us-east-1.pooler.supabase.com:6543/postgres`
    });

    try {
      await client.connect();
      await client.query(statement);
      console.log(`  ✓ Success\n`);
      await client.end();
    } catch (error) {
      if (error.message.includes('already exists')) {
        console.log(`  ⚠️  Already exists (skipped)\n`);
      } else {
        console.error(`  ❌ Error:`, error.message, '\n');
      }
      await client.end();
    }
  }

  console.log('✅ SQL execution completed');
}

// Run
const sqlFile = process.argv[2] || 'create-historical-partitions.sql';
runSQL(sqlFile).catch(console.error);
