/**
 * ad_cache 테이블 마이그레이션 실행
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function runMigration() {
  console.log('=== ad_cache 테이블 마이그레이션 시작 ===\n');

  try {
    // SQL 파일 읽기
    const sqlPath = path.join(__dirname, 'create-ad-cache-table.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    // SQL 실행 (각 명령어 분리)
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    for (const statement of statements) {
      if (statement.length < 10) continue;

      console.log(`실행: ${statement.substring(0, 60)}...`);

      const { error } = await supabase.rpc('exec_sql', {
        sql_query: statement + ';'
      });

      if (error) {
        // rpc가 없으면 직접 실행 시도
        if (error.message.includes('function') || error.message.includes('does not exist')) {
          console.log('  → RPC 없음, 수동 실행 필요');
        } else {
          console.error(`  → 오류: ${error.message}`);
        }
      } else {
        console.log('  → 성공');
      }
    }

    // 테이블 존재 확인
    const { data, error: checkError } = await supabase
      .from('ad_cache')
      .select('client_id')
      .limit(1);

    if (checkError) {
      console.log('\n⚠️ 테이블이 아직 없습니다. Supabase 대시보드에서 SQL을 직접 실행해주세요.');
      console.log('\nSQL 파일 경로:', sqlPath);
    } else {
      console.log('\n✅ ad_cache 테이블 확인 완료');
    }

  } catch (err) {
    console.error('마이그레이션 오류:', err);
  }
}

runMigration();
