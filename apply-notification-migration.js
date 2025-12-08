/**
 * notification_logs 테이블 마이그레이션 적용
 */
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function applyMigration() {
  console.log('📦 Applying notification_logs migration...');

  const sqlPath = path.join(__dirname, 'sql', '19_notification_logs.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  // SQL을 개별 문장으로 분리
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s && !s.startsWith('--') && !s.startsWith('SELECT cron'));

  let successCount = 0;
  let errorCount = 0;

  for (const statement of statements) {
    if (!statement) continue;

    try {
      const { error } = await supabase.rpc('exec_sql', {
        sql_query: statement + ';'
      });

      if (error) {
        // 이미 존재하는 객체는 무시
        if (error.message.includes('already exists')) {
          console.log(`⏭️ Already exists, skipping...`);
          successCount++;
        } else {
          console.error(`❌ Error:`, error.message);
          errorCount++;
        }
      } else {
        successCount++;
      }
    } catch (err) {
      // exec_sql 함수가 없으면 직접 실행 시도
      if (err.message?.includes('function') || err.message?.includes('does not exist')) {
        console.log('⚠️ exec_sql function not available, trying direct execution...');
        break;
      }
      console.error(`❌ Statement error:`, err.message);
      errorCount++;
    }
  }

  // 테이블 존재 확인
  const { data, error } = await supabase
    .from('notification_logs')
    .select('id')
    .limit(1);

  if (error && error.message.includes('does not exist')) {
    console.log('⚠️ Table does not exist. Please run SQL manually in Supabase Dashboard.');
    console.log('\n📋 SQL file: sql/19_notification_logs.sql');
    return;
  }

  console.log('\n✅ Migration check completed');
  console.log(`  - Success: ${successCount}`);
  console.log(`  - Errors: ${errorCount}`);
}

applyMigration()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
