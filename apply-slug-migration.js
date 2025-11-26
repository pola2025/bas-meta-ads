require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function applyMigration() {
  console.log('Applying slug migration...\n');

  // 1. slug 컬럼 추가 시도 (RPC 사용)
  const { error: alterError } = await supabase.rpc('exec_sql', {
    sql: 'ALTER TABLE clients ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE'
  });

  if (alterError) {
    console.log('Note: Cannot run ALTER via client (expected)');
    console.log('Please run the following SQL in Supabase SQL Editor:');
    console.log('');
    console.log('ALTER TABLE clients ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE;');
    console.log("UPDATE clients SET slug = 'bas-k92m7x' WHERE client_name = '비즈액터스쿨' AND slug IS NULL;");
    console.log('CREATE INDEX IF NOT EXISTS idx_clients_slug ON clients(slug);');
    console.log('');
  }

  // 2. 현재 slug 컬럼 상태 확인
  const { data, error } = await supabase
    .from('clients')
    .select('id, client_name, slug')
    .single();

  if (error) {
    console.error('Query error:', error);
    return;
  }

  console.log('Current client data:');
  console.log(JSON.stringify(data, null, 2));

  if (data.slug) {
    console.log('\n✅ slug 컬럼이 이미 설정되어 있습니다.');
  } else {
    console.log('\n⚠️ slug 컬럼이 없거나 NULL입니다.');
    console.log('Supabase SQL Editor에서 SQL 실행 필요');
  }
}

applyMigration();
