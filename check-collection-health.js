#!/usr/bin/env node

/**
 * 데이터 수집 헬스체크
 *
 * 매일 오전 8시에 실행하여 새벽 3시 수집이 정상 작동했는지 확인
 * 수집이 안 됐으면 관리자에게 텔레그램 알림 발송
 *
 * 사용법:
 *   node check-collection-health.js
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const ADMIN_CHAT_ID = '-1003394139746';

async function sendAlert(message) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    console.error('TELEGRAM_BOT_TOKEN not set');
    return;
  }

  try {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: ADMIN_CHAT_ID,
        text: message,
        parse_mode: 'Markdown'
      })
    });
    console.log('✅ 알림 발송 완료');
  } catch (error) {
    console.error('❌ 알림 발송 실패:', error.message);
  }
}

async function checkCollectionHealth() {
  console.log('🔍 데이터 수집 헬스체크 시작...');
  console.log(`📅 현재 시각: ${new Date().toISOString()}`);

  // 오늘 날짜 (KST 기준)
  const now = new Date();
  const kstOffset = 9 * 60 * 60 * 1000;
  const kstNow = new Date(now.getTime() + kstOffset);
  const today = kstNow.toISOString().split('T')[0];

  // 어제 날짜 (수집 대상)
  const yesterday = new Date(kstNow);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  console.log(`📊 체크 대상 날짜: ${yesterdayStr}`);

  // 1. 활성 클라이언트 수 확인
  const { data: clients, error: clientError } = await supabase
    .from('clients')
    .select('id, client_name')
    .eq('is_active', true);

  if (clientError) {
    await sendAlert(`🚨 **[BAS] 헬스체크 실패**\n\n❌ 클라이언트 조회 오류: ${clientError.message}`);
    return;
  }

  const activeClientCount = clients.length;
  console.log(`👥 활성 클라이언트: ${activeClientCount}개`);

  // 2. 어제 날짜 데이터가 있는 클라이언트 확인
  const { data: collectedData, error: dataError } = await supabase
    .from('raw_data')
    .select('client_id')
    .eq('date', yesterdayStr);

  if (dataError) {
    await sendAlert(`🚨 **[BAS] 헬스체크 실패**\n\n❌ 데이터 조회 오류: ${dataError.message}`);
    return;
  }

  // 수집된 클라이언트 ID 목록 (중복 제거)
  const collectedClientIds = [...new Set(collectedData.map(d => d.client_id))];
  const collectedCount = collectedClientIds.length;

  console.log(`📈 ${yesterdayStr} 데이터 수집된 클라이언트: ${collectedCount}개`);

  // 3. 수집 안 된 클라이언트 찾기
  const missingClients = clients.filter(c => !collectedClientIds.includes(c.id));

  // 4. 결과 판단
  if (collectedCount === 0) {
    // 전체 미수집 - 크리티컬
    const message = `🚨 **[BAS] 데이터 수집 미작동 경고**

⏰ 체크 시각: ${kstNow.toLocaleString('ko-KR')} KST
📅 대상 날짜: ${yesterdayStr}

❌ **새벽 3시 데이터 수집이 실행되지 않았습니다!**

📊 활성 클라이언트: ${activeClientCount}개
📉 수집된 클라이언트: 0개

⚠️ **즉시 확인 필요:**
1. GitHub Actions 워크플로우 상태 확인
2. GitHub Secrets 환경변수 확인
3. 수동 실행: Actions → Daily Data Collection → Run workflow

---
🤖 BAS Meta Ads 헬스체크`;

    await sendAlert(message);
    console.log('🚨 크리티컬: 전체 미수집 알림 발송');

  } else if (missingClients.length > 0) {
    // 일부 미수집 - 경고
    const missingNames = missingClients.map(c => c.client_name).join(', ');
    const message = `⚠️ **[BAS] 일부 클라이언트 미수집**

⏰ 체크 시각: ${kstNow.toLocaleString('ko-KR')} KST
📅 대상 날짜: ${yesterdayStr}

📊 활성 클라이언트: ${activeClientCount}개
✅ 수집 완료: ${collectedCount}개
❌ 미수집: ${missingClients.length}개

⚠️ **미수집 클라이언트:**
${missingNames}

💡 원인 가능성:
- 해당 날짜에 광고 집행 없음
- 토큰 만료 (auth_status 확인)
- API 오류

---
🤖 BAS Meta Ads 헬스체크`;

    await sendAlert(message);
    console.log('⚠️ 경고: 일부 미수집 알림 발송');

  } else {
    // 전체 정상
    console.log('✅ 모든 클라이언트 정상 수집 완료');
    // 정상일 때는 알림 안 보냄 (성공 알림은 collect-all-clients.js에서 발송)
  }

  console.log('\n✅ 헬스체크 완료');
}

// 실행
checkCollectionHealth().catch(error => {
  console.error('💥 헬스체크 오류:', error.message);
  process.exit(1);
});
