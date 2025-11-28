#!/usr/bin/env node
/**
 * SMS 템플릿 전체 테스트 발송
 */

require('dotenv').config();
const SMSClient = require('./lib/sms');
const templates = require('./lib/sms-templates');

const TEST_PHONE = '010-9897-9834';
const TEST_CLIENT = '테스트고객';
const TEST_END_DATE = '2025-12-31';

async function main() {
  console.log('━'.repeat(50));
  console.log('📱 SMS 템플릿 전체 테스트 발송');
  console.log('━'.repeat(50));
  console.log(`\n수신번호: ${TEST_PHONE}`);
  console.log(`테스트 고객명: ${TEST_CLIENT}`);
  console.log(`테스트 만료일: ${TEST_END_DATE}\n`);

  const sms = new SMSClient();

  const messageTypes = [
    { type: 'd7', name: 'D-7 사전안내' },
    { type: 'd3', name: 'D-3 리마인드' },
    { type: 'd0', name: 'D-0 당일안내' },
    { type: 'expired', name: '서비스종료' },
  ];

  for (const { type, name } of messageTypes) {
    console.log(`\n─────────────────────────────────────`);
    console.log(`📤 발송 중: ${name} (${type})`);
    console.log(`─────────────────────────────────────`);

    const message = templates.getMessage(type, {
      clientName: TEST_CLIENT,
      endDate: TEST_END_DATE
    });

    console.log('\n📝 메시지 내용:');
    console.log(message);
    console.log('\n발송 중...');

    try {
      const result = await sms.send(TEST_PHONE, message);

      if (result.success) {
        console.log(`✅ 발송 성공! (requestId: ${result.requestId})`);
      } else {
        console.log(`❌ 발송 실패: ${result.error}`);
      }
    } catch (error) {
      console.log(`❌ 오류: ${error.message}`);
    }

    // 잠시 대기 (API 과부하 방지)
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // 결제 확인 메시지
  console.log(`\n─────────────────────────────────────`);
  console.log(`📤 발송 중: 결제확인 (payment_confirm)`);
  console.log(`─────────────────────────────────────`);

  const paymentMessage = templates.getMessage('payment_confirm', {
    clientName: TEST_CLIENT,
    amount: 660000,
    startDate: '2025-12-31',
    endDate: '2026-03-31'
  });

  console.log('\n📝 메시지 내용:');
  console.log(paymentMessage);
  console.log('\n발송 중...');

  try {
    const result = await sms.send(TEST_PHONE, paymentMessage);

    if (result.success) {
      console.log(`✅ 발송 성공! (requestId: ${result.requestId})`);
    } else {
      console.log(`❌ 발송 실패: ${result.error}`);
    }
  } catch (error) {
    console.log(`❌ 오류: ${error.message}`);
  }

  console.log('\n━'.repeat(50));
  console.log('✅ 전체 테스트 발송 완료!');
  console.log('━'.repeat(50) + '\n');
}

main().catch(console.error);
