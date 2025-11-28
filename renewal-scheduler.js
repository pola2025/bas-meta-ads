#!/usr/bin/env node
/**
 * 연장 안내 자동 발송 스케줄러
 *
 * 매일 오전 10시에 실행하여 다음 대상에게 자동 발송:
 * - D-7: 만료 7일 전 사전 안내
 * - D-3: 만료 3일 전 리마인드
 * - D-0: 만료 당일 최종 안내
 * - D+1: 서비스 종료 안내
 *
 * 사용법:
 *   node renewal-scheduler.js           # 즉시 실행 (테스트)
 *   node renewal-scheduler.js --cron    # 크론 모드 (매일 10시)
 *   node renewal-scheduler.js --dry-run # 테스트 모드 (발송 안함)
 */

require('dotenv').config();
const cron = require('node-cron');
const { createClient } = require('@supabase/supabase-js');
const SMSClient = require('./lib/sms');
const templates = require('./lib/sms-templates');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// 옵션 파싱
const args = process.argv.slice(2);
const isCronMode = args.includes('--cron');
const isDryRun = args.includes('--dry-run');

// 날짜 포맷
function formatDate(date) {
  if (!date) return 'N/A';
  const d = new Date(date);
  return d.toISOString().split('T')[0];
}

// D-day 계산
function getDday(endDate) {
  if (!endDate) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);
  return Math.ceil((end - today) / (1000 * 60 * 60 * 24));
}

// 오늘 발송 여부 확인
async function wasAlreadySent(clientId, messageType) {
  const today = new Date().toISOString().split('T')[0];

  const { data } = await supabase
    .from('sms_logs')
    .select('id')
    .eq('client_id', clientId)
    .eq('message_type', messageType)
    .eq('status', 'success')
    .gte('sent_at', `${today}T00:00:00`)
    .limit(1);

  return data && data.length > 0;
}

// 텔레그램 알림
async function sendTelegramNotification(message) {
  try {
    const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
    const token = process.env.TELEGRAM_BOT_TOKEN;

    if (!chatId || !token) return;

    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML'
      })
    });
  } catch (e) {
    console.error('텔레그램 알림 실패:', e.message);
  }
}

// 만료된 클라이언트 자동 종료
async function autoDeactivateExpired() {
  console.log('\n🔄 만료 클라이언트 자동 종료 처리...');

  const today = new Date().toISOString().split('T')[0];

  // 만료일이 지난 활성 클라이언트 조회
  const { data: expiredClients, error } = await supabase
    .from('clients')
    .select('id, client_name, service_end_date')
    .eq('is_active', true)
    .lt('service_end_date', today);

  if (error) {
    console.log(`   ❌ 조회 실패: ${error.message}`);
    return [];
  }

  if (!expiredClients || expiredClients.length === 0) {
    console.log('   ✅ 만료된 클라이언트 없음');
    return [];
  }

  const deactivated = [];

  for (const client of expiredClients) {
    const { error: updateError } = await supabase
      .from('clients')
      .update({ is_active: false })
      .eq('id', client.id);

    if (!updateError) {
      console.log(`   🔴 ${client.client_name}: 서비스 자동 종료 (만료일: ${client.service_end_date})`);
      deactivated.push(client);
    }
  }

  return deactivated;
}

// 자동 발송 실행
async function runAutoSend() {
  console.log('\n━'.repeat(60));
  console.log(`📤 연장 안내 자동 발송 ${isDryRun ? '(DRY-RUN)' : ''}`);
  console.log(`   실행 시각: ${new Date().toLocaleString('ko-KR')}`);
  console.log('━'.repeat(60));

  // 1. 만료된 클라이언트 자동 종료 처리
  const deactivated = await autoDeactivateExpired();

  // 연락처가 있는 활성 클라이언트 조회
  const { data: clients, error } = await supabase
    .from('clients')
    .select('id, client_name, contact_phone, contact_name, service_end_date')
    .eq('is_active', true)
    .not('contact_phone', 'is', null)
    .not('service_end_date', 'is', null);

  if (error) {
    console.log(`\n❌ 클라이언트 조회 실패: ${error.message}`);
    return { success: 0, failed: 0 };
  }

  if (!clients || clients.length === 0) {
    console.log('\n연락처가 등록된 클라이언트가 없습니다.\n');
    return { success: 0, failed: 0 };
  }

  // 발송 대상 분류
  const targets = {
    d7: [],
    d3: [],
    d0: [],
    expired: []
  };

  for (const client of clients) {
    const dday = getDday(client.service_end_date);

    if (dday === 7) targets.d7.push(client);
    else if (dday === 3) targets.d3.push(client);
    else if (dday === 0) targets.d0.push(client);
    else if (dday === -1) targets.expired.push(client);
  }

  console.log('\n📋 발송 대상:');
  console.log(`   D-7 (사전 안내): ${targets.d7.length}명`);
  console.log(`   D-3 (리마인드): ${targets.d3.length}명`);
  console.log(`   D-0 (당일 안내): ${targets.d0.length}명`);
  console.log(`   D+1 (종료 안내): ${targets.expired.length}명`);

  let success = 0;
  let failed = 0;
  let skipped = 0;

  // SMS 클라이언트 생성
  let sms;
  try {
    sms = new SMSClient({
      accessKey: process.env.NCP_ACCESS_KEY,
      secretKey: process.env.NCP_SECRET_KEY,
      serviceId: process.env.NCP_SERVICE_ID,
      senderPhone: process.env.NCP_SENDER_PHONE
    });
  } catch (e) {
    console.log(`\n❌ SMS 클라이언트 초기화 실패: ${e.message}`);
    return { success: 0, failed: 0 };
  }

  // 발송 처리
  for (const [type, clientList] of Object.entries(targets)) {
    if (clientList.length === 0) continue;

    console.log(`\n📤 ${type.toUpperCase()} 발송 중...`);

    for (const client of clientList) {
      // 중복 발송 체크
      const alreadySent = await wasAlreadySent(client.id, type);
      if (alreadySent) {
        console.log(`   ⏭️ ${client.client_name}: 오늘 이미 발송됨`);
        skipped++;
        continue;
      }

      // 메시지 생성
      const message = templates.getMessage(type, {
        clientName: client.client_name,
        endDate: formatDate(client.service_end_date)
      });

      if (isDryRun) {
        console.log(`   🔸 ${client.client_name} (${client.contact_phone}): DRY-RUN`);
        success++;
        continue;
      }

      // 발송
      const result = await sms.send(client.contact_phone, message);

      if (result.success) {
        console.log(`   ✅ ${client.client_name} (${client.contact_phone})`);
        success++;

        // 발송 이력 저장
        await supabase.from('sms_logs').insert({
          client_id: client.id,
          message_type: type,
          phone: client.contact_phone,
          status: 'success',
          request_id: result.requestId
        });
      } else {
        console.log(`   ❌ ${client.client_name}: ${result.error}`);
        failed++;

        await supabase.from('sms_logs').insert({
          client_id: client.id,
          message_type: type,
          phone: client.contact_phone,
          status: 'failed',
          error: result.error
        });
      }

      // API 호출 간격 (0.5초)
      await new Promise(r => setTimeout(r, 500));
    }
  }

  // 결과 출력
  console.log('\n' + '─'.repeat(60));
  console.log('📊 발송 결과:');
  console.log(`   성공: ${success}건`);
  console.log(`   실패: ${failed}건`);
  console.log(`   스킵: ${skipped}건 (중복 발송 방지)`);

  // 텔레그램 알림
  if (success > 0 || failed > 0 || deactivated.length > 0) {
    let telegramMsg = `📤 <b>연장 안내 자동 발송 완료</b>

• D-7 (사전 안내): ${targets.d7.length}명
• D-3 (리마인드): ${targets.d3.length}명
• D-0 (당일 안내): ${targets.d0.length}명
• D+1 (종료 안내): ${targets.expired.length}명

📊 결과: 성공 ${success}건 / 실패 ${failed}건 / 스킵 ${skipped}건`;

    if (deactivated.length > 0) {
      telegramMsg += `\n\n🔴 <b>자동 종료됨:</b>`;
      for (const c of deactivated) {
        telegramMsg += `\n• ${c.client_name} (만료: ${c.service_end_date})`;
      }
    }

    await sendTelegramNotification(telegramMsg);
  }

  console.log('');
  return { success, failed, skipped };
}

// 메인
async function main() {
  if (isCronMode) {
    console.log('🕐 크론 모드 시작 (매일 오전 10시 발송)');
    console.log('   종료하려면 Ctrl+C');

    // 매일 오전 10시
    cron.schedule('0 10 * * *', async () => {
      console.log(`\n⏰ 크론 실행: ${new Date().toLocaleString('ko-KR')}`);
      await runAutoSend();
    });

    // 프로세스 유지
    process.stdin.resume();
  } else {
    // 즉시 실행
    await runAutoSend();
  }
}

main().catch(console.error);
