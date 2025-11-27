require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function runMigration() {
  console.log('=== Supabase Migration for slug column ===\n');

  // 1. 먼저 현재 클라이언트 데이터 확인
  const { data: before, error: beforeError } = await supabase
    .from('clients')
    .select('*')
    .single();

  if (beforeError) {
    console.error('Error fetching client:', beforeError);
    return;
  }

  console.log('Current client data:');
  console.log(JSON.stringify(before, null, 2));

  // slug 컬럼이 이미 있는지 확인
  if (before.hasOwnProperty('slug')) {
    console.log('\n✅ slug 컬럼이 이미 존재합니다.');
    
    if (before.slug) {
      console.log(`   현재 slug 값: ${before.slug}`);
    } else {
      // slug가 null이면 업데이트
      console.log('   slug가 null입니다. 업데이트합니다...');
      
      const { error: updateError } = await supabase
        .from('clients')
        .update({ slug: 'bas-k92m7x' })
        .eq('id', before.id);
      
      if (updateError) {
        console.error('Update error:', updateError);
      } else {
        console.log('   ✅ slug를 bas-k92m7x로 업데이트했습니다.');
      }
    }
  } else {
    console.log('\n⚠️ slug 컬럼이 없습니다.');
    console.log('\nSupabase SQL Editor에서 다음 SQL을 실행하세요:\n');
    console.log('----------------------------------------');
    console.log(`ALTER TABLE clients ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE;

UPDATE clients
SET slug = 'bas-k92m7x'
WHERE client_name = '비즈액터스쿨' AND slug IS NULL;

CREATE INDEX IF NOT EXISTS idx_clients_slug ON clients(slug);

SELECT id, client_name, slug FROM clients;`);
    console.log('----------------------------------------');
  }
}

runMigration();
