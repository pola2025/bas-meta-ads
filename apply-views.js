import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import 'dotenv/config';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ SUPABASE_URL or SUPABASE_SERVICE_KEY not found in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function applyViews() {
  console.log('📊 Applying analysis views to Supabase...\n');

  // SQL 파일 읽기
  const sql = fs.readFileSync('sql/03_analysis_views.sql', 'utf-8');

  // SQL을 개별 문장으로 분리 (세미콜론 기준)
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  console.log(`📝 Found ${statements.length} SQL statements\n`);

  let successCount = 0;
  let errorCount = 0;
  const errors = [];

  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i];

    // 문장 타입 확인
    let type = 'UNKNOWN';
    if (statement.toUpperCase().includes('CREATE OR REPLACE VIEW')) {
      type = 'VIEW';
    } else if (statement.toUpperCase().includes('CREATE OR REPLACE FUNCTION')) {
      type = 'FUNCTION';
    } else if (statement.toUpperCase().includes('CREATE INDEX')) {
      type = 'INDEX';
    } else if (statement.toUpperCase().includes('COMMENT ON')) {
      type = 'COMMENT';
    } else if (statement.toUpperCase().includes('SELECT')) {
      type = 'QUERY';
    }

    // VIEW나 FUNCTION일 때 이름 추출
    let name = '';
    if (type === 'VIEW') {
      const match = statement.match(/CREATE OR REPLACE VIEW\s+(\w+)/i);
      name = match ? match[1] : '';
    } else if (type === 'FUNCTION') {
      const match = statement.match(/CREATE OR REPLACE FUNCTION\s+(\w+)/i);
      name = match ? match[1] : '';
    } else if (type === 'INDEX') {
      const match = statement.match(/CREATE INDEX(?:\s+IF NOT EXISTS)?\s+(\w+)/i);
      name = match ? match[1] : '';
    }

    process.stdout.write(`[${i + 1}/${statements.length}] ${type}${name ? ` ${name}` : ''}... `);

    try {
      const { data, error } = await supabase.rpc('exec_sql', {
        sql_query: statement + ';'
      });

      if (error) {
        // exec_sql RPC가 없을 수 있으므로 직접 실행 시도
        const { error: directError } = await supabase
          .from('_temp')
          .select('*')
          .limit(0)
          .single();

        // 대신 pg_stat_statements 사용
        throw new Error(
          error.message ||
            'Cannot execute SQL directly. Please use Supabase Dashboard SQL Editor.'
        );
      }

      console.log('✅');
      successCount++;
    } catch (err) {
      console.log('❌');
      errorCount++;
      errors.push({
        statement: statement.substring(0, 100) + '...',
        error: err.message
      });
    }

    // 짧은 대기 (rate limit 방지)
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 FINAL REPORT');
  console.log('='.repeat(60));
  console.log(`✅ Success: ${successCount}`);
  console.log(`❌ Failed: ${errorCount}`);

  if (errors.length > 0) {
    console.log('\n❌ Errors:');
    errors.forEach((e, i) => {
      console.log(`\n${i + 1}. ${e.statement}`);
      console.log(`   Error: ${e.error}`);
    });

    console.log(
      '\n⚠️  Please apply the SQL manually via Supabase Dashboard → SQL Editor'
    );
    console.log('   File: sql/03_analysis_views.sql');
  } else {
    console.log('\n✅ All views, functions, and indexes applied successfully!');
  }
}

applyViews().catch(err => {
  console.error('\n❌ Fatal error:', err.message);
  console.log('\n⚠️  Falling back to manual method:');
  console.log('   1. Go to Supabase Dashboard → SQL Editor');
  console.log('   2. Copy contents of sql/03_analysis_views.sql');
  console.log('   3. Paste and Run');
  process.exit(1);
});
