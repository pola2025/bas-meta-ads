require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

/**
 * 새 클라이언트 추가
 *
 * 사용법:
 * node add-new-client.js "회사명" "act_123456789" "텔레그램_채팅_ID(선택)"
 */
(async () => {
  const clientName = process.argv[2];
  const metaAdAccountId = process.argv[3];
  const telegramChatId = process.argv[4] || null;

  if (!clientName || !metaAdAccountId) {
    console.log('❌ Usage: node add-new-client.js "회사명" "act_123456789" "텔레그램_채팅_ID(선택)"\n');
    console.log('Example:');
    console.log('  node add-new-client.js "새회사" "act_987654321"');
    console.log('  node add-new-client.js "새회사" "act_987654321" "-1002733338460"');
    process.exit(1);
  }

  console.log('📊 Adding new client...\n');
  console.log(`   Name: ${clientName}`);
  console.log(`   Meta Ad Account: ${metaAdAccountId}`);
  console.log(`   Telegram Chat ID: ${telegramChatId || 'None (use default)'}\n`);

  // 1. clients 테이블에 삽입
  const { data, error } = await supabase
    .from('clients')
    .insert({
      client_name: clientName,
      meta_ad_account_id: metaAdAccountId,
      telegram_chat_id: telegramChatId,
      is_active: true
    })
    .select();

  if (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }

  console.log('✅ Client added successfully!\n');
  console.log('━'.repeat(80));
  console.log('Client ID:', data[0].client_id);
  console.log('Client Name:', data[0].client_name);
  console.log('Meta Ad Account:', data[0].meta_ad_account_id);
  console.log('Telegram Chat ID:', data[0].telegram_chat_id || '(사용 기본값)');
  console.log('Is Active:', data[0].is_active);
  console.log('Created At:', data[0].created_at);
  console.log('━'.repeat(80));

  console.log('\n📌 Next Steps:\n');
  console.log('1. Meta Access Token 설정:');
  console.log('   - 해당 클라이언트의 Meta 광고 계정에 접근 가능한 Access Token 필요');
  console.log('   - 현재는 환경 변수 META_ACCESS_TOKEN을 모든 클라이언트가 공유');
  console.log('   - 클라이언트마다 다른 토큰이 필요하면 clients 테이블에 컬럼 추가 필요\n');

  console.log('2. 데이터 수집 시작:');
  console.log('   - Railway Worker가 자동으로 모든 active 클라이언트 데이터 수집');
  console.log('   - 또는 수동 실행: MODE=worker node index.js\n');

  console.log('3. 텔레그램 리포트:');
  console.log('   - telegram_chat_id가 없으면 기본 채팅방으로 발송');
  console.log('   - 개별 채팅방 원하면 클라이언트별 Chat ID 설정\n');

  process.exit(0);
})();
