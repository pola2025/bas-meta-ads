/**
 * 클라이언트 생성 API 테스트
 * 로컬 대시보드 서버가 실행 중이어야 합니다 (npm run dev)
 */

const ADMIN_KEY = 'a3f8c2e1-9d4b-4f7a-b6c5-8e2d1f0a9b3c';
const BASE_URL = 'http://localhost:3000';

async function testCreateClient() {
  console.log('🧪 Testing Client Creation API...\n');

  // 테스트 데이터
  const testClient = {
    client_name: 'Test Company',
    email: 'test@example.com',
    meta_ad_account_id: 'act_123456789',
    meta_access_token: 'TEST_TOKEN_' + Date.now(), // 테스트용 가짜 토큰
    telegram_chat_id: '-1001234567890',
    plan_type: 'basic',
    target_leads: 100,
    target_spend: 1000,
    target_cpl: 10
  };

  console.log('📝 Test Data:');
  console.log(JSON.stringify(testClient, null, 2));
  console.log('\n');

  try {
    // POST /api/clients
    const response = await fetch(`${BASE_URL}/api/clients`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-key': ADMIN_KEY
      },
      body: JSON.stringify(testClient)
    });

    const result = await response.json();

    if (response.ok) {
      console.log('✅ Client created successfully!');
      console.log('\n📊 Response:');
      console.log(JSON.stringify(result, null, 2));
      console.log('\n🔗 Dashboard URL:', result.dashboard_url);

      // 생성된 클라이언트 ID 반환
      return result.client;
    } else {
      console.error('❌ Failed to create client:');
      console.error(result);
      return null;
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    return null;
  }
}

async function testGetClients() {
  console.log('\n📋 Fetching all clients...\n');

  try {
    const response = await fetch(`${BASE_URL}/api/clients`, {
      headers: {
        'x-admin-key': ADMIN_KEY
      }
    });

    const result = await response.json();

    if (response.ok) {
      console.log(`✅ Found ${result.clients.length} client(s):`);
      result.clients.forEach((client, i) => {
        console.log(`\n${i + 1}. ${client.client_name}`);
        console.log(`   ID: ${client.id}`);
        console.log(`   Email: ${client.email}`);
        console.log(`   Meta Account: ${client.meta_ad_account_id || 'Not set'}`);
        console.log(`   Telegram: ${client.telegram_chat_id || 'Not set'}`);
        console.log(`   Status: ${client.is_active ? '활성' : '비활성'}`);
      });
    } else {
      console.error('❌ Failed:', result);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

async function testDeleteClient(clientId) {
  console.log(`\n🗑️ Deleting test client ${clientId}...\n`);

  try {
    const response = await fetch(`${BASE_URL}/api/clients?id=${clientId}`, {
      method: 'DELETE',
      headers: {
        'x-admin-key': ADMIN_KEY
      }
    });

    const result = await response.json();

    if (response.ok) {
      console.log('✅ Client deactivated successfully');
    } else {
      console.error('❌ Failed:', result);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// 실행
async function main() {
  console.log('='.repeat(60));
  console.log('🧪 Client API Test');
  console.log('='.repeat(60));
  console.log(`📍 Server: ${BASE_URL}`);
  console.log(`🔑 Admin Key: ${ADMIN_KEY.slice(0, 8)}...`);
  console.log('='.repeat(60));

  // 1. 클라이언트 생성 테스트
  const createdClient = await testCreateClient();

  // 2. 클라이언트 목록 조회
  await testGetClients();

  // 3. 테스트 클라이언트 삭제 (선택)
  if (createdClient) {
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    rl.question('\n🗑️ Delete test client? (y/n): ', async (answer) => {
      if (answer.toLowerCase() === 'y') {
        await testDeleteClient(createdClient.id);
        await testGetClients();
      }
      rl.close();
      console.log('\n✅ Test completed!');
    });
  }
}

main();
