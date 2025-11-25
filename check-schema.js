#!/usr/bin/env node
/**
 * daily_aggregates 테이블 스키마 확인
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function main() {
  console.log('🔍 daily_aggregates 스키마 확인 중...\n');

  // Supabase RPC로 스키마 정보 가져오기
  const { data, error } = await supabase.rpc('exec_sql', {
    sql: `
      SELECT column_name, data_type, numeric_precision, numeric_scale
      FROM information_schema.columns
      WHERE table_name = 'daily_aggregates'
      AND data_type = 'numeric'
      ORDER BY ordinal_position;
    `
  });

  if (error) {
    console.error('❌ RPC 실패. SQL로 직접 확인 필요:', error.message);
    console.log('\n💡 Supabase SQL Editor에서 실행:');
    console.log(`
SELECT column_name, data_type, numeric_precision, numeric_scale
FROM information_schema.columns
WHERE table_name = 'daily_aggregates'
AND data_type = 'numeric'
ORDER BY ordinal_position;
    `);
    return;
  }

  if (!data || data.length === 0) {
    console.log('❌ NUMERIC 컬럼 없음 또는 테이블이 존재하지 않음\n');
    return;
  }

  console.log('📊 NUMERIC/DECIMAL 컬럼:');
  console.log('─'.repeat(70));
  console.log('컬럼명\t\t\t타입\t\t\tPrecision\tScale');
  console.log('─'.repeat(70));

  data.forEach(col => {
    const name = col.column_name.padEnd(20);
    const type = col.data_type.padEnd(15);
    const prec = col.numeric_precision || '-';
    const scale = col.numeric_scale || '-';
    console.log(`${name}\t${type}\t${prec}\t\t${scale}`);

    // 문제 체크
    if (col.numeric_precision === 5 && col.numeric_scale === 4) {
      console.log(`  ⚠️  DECIMAL(5,4) → 최대값 9.9999 (overflow 위험!)`);
    }
  });

  console.log('─'.repeat(70));
  console.log('\n✅ 확인 완료');
}

main();
