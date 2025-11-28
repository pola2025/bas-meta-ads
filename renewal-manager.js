#!/usr/bin/env node
/**
 * 연장관리 CLI
 *
 * 사용법:
 *   node renewal-manager.js list                    # 목록 조회 (종료일 기준)
 *   node renewal-manager.js send --client "고객명" --type d7   # 문자 발송
 *   node renewal-manager.js extend --client "고객명" --months 3  # 연장 처리
 *   node renewal-manager.js contact --client "고객명" --phone "010-xxx" --name "담당자"
 *   node renewal-manager.js --help
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const SMSClient = require('./lib/sms');
const templates = require('./lib/sms-templates');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// 날짜 포맷 (YYYY-MM-DD)
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
  const diff = Math.ceil((end - today) / (1000 * 60 * 60 * 24));
  return diff;
}

// D-day 문자열
function getDdayStr(endDate) {
  const dday = getDday(endDate);
  if (dday === null) return '-';
  if (dday === 0) return 'D-DAY';
  if (dday > 0) return `D-${dday}`;
  return `D+${Math.abs(dday)}`;
}

// 상태 이모지
function getStatusEmoji(endDate) {
  const dday = getDday(endDate);
  if (dday === null) return '⚪';
  if (dday < 0) return '🔴';  // 만료됨
  if (dday <= 3) return '🟠';  // 긴급
  if (dday <= 7) return '🟡';  // 주의
  return '🟢';  // 여유
}

// 인자 파싱
function parseArgs() {
  const args = process.argv.slice(2);
  const command = args[0];
  const options = {
    command: command,
    client: null,
    type: null,
    months: 3,
    phone: null,
    name: null,
    help: false
  };

  for (let i = 1; i < args.length; i++) {
    switch (args[i]) {
      case '--client':
      case '-c':
        options.client = args[++i];
        break;
      case '--type':
      case '-t':
        options.type = args[++i];
        break;
      case '--months':
      case '-m':
        options.months = parseInt(args[++i]) || 3;
        break;
      case '--phone':
      case '-p':
        options.phone = args[++i];
        break;
      case '--name':
      case '-n':
        options.name = args[++i];
        break;
      case '--help':
      case '-h':
        options.help = true;
        break;
    }
  }

  return options;
}

// 도움말
function showHelp() {
  console.log(`
📋 연장관리 CLI - 폴라애드 Meta 리포트 시스템

사용법:
  node renewal-manager.js <command> [options]

명령어:
  list                         목록 조회 (종료일 기준 정렬)
  send                         연장 안내 문자 발송
  extend                       서비스 연장 처리
  contact                      연락처 등록/수정

옵션:
  --client, -c <이름>          클라이언트명
  --type, -t <타입>            메시지 타입 (d7, d3, d0, expired)
  --months, -m <개월>          연장 개월 수 (기본: 3)
  --phone, -p <번호>           연락처
  --name, -n <이름>            담당자명
  --help, -h                   도움말

예시:
  # 목록 조회
  node renewal-manager.js list

  # D-7 안내 문자 발송
  node renewal-manager.js send --client "ABC마케팅" --type d7

  # 3개월 연장
  node renewal-manager.js extend --client "ABC마케팅" --months 3

  # 연락처 등록
  node renewal-manager.js contact --client "ABC마케팅" --phone "010-1234-5678" --name "김담당"

메시지 타입:
  d7       만료 7일 전 사전 안내
  d3       만료 3일 전 리마인드
  d0       만료 당일 최종 안내
  expired  서비스 종료 안내
`);
}

// 목록 조회
async function listClients() {
  console.log('\n━'.repeat(60));
  console.log('📋 연장관리 목록 (종료일 기준)');
  console.log('━'.repeat(60));

  const { data: clients, error } = await supabase
    .from('clients')
    .select('id, client_name, contact_phone, contact_name, service_start_date, service_end_date, is_active')
    .not('service_end_date', 'is', null)  // 무제한(service_end_date가 null) 클라이언트 제외
    .order('service_end_date', { ascending: true });

  if (error) {
    console.log(`\n❌ 조회 실패: ${error.message}`);
    return;
  }

  if (!clients || clients.length === 0) {
    console.log('\n등록된 클라이언트가 없습니다.\n');
    return;
  }

  // 테이블 헤더
  console.log(`\n${'상태'.padEnd(4)} ${'D-Day'.padEnd(8)} ${'종료일'.padEnd(12)} ${'클라이언트'.padEnd(20)} ${'연락처'.padEnd(15)} ${'담당자'.padEnd(10)}`);
  console.log('-'.repeat(75));

  for (const client of clients) {
    const emoji = getStatusEmoji(client.service_end_date);
    const ddayStr = getDdayStr(client.service_end_date);
    const endDate = formatDate(client.service_end_date);
    const name = (client.client_name || '').substring(0, 18).padEnd(20);
    const phone = (client.contact_phone || '-').padEnd(15);
    const contact = (client.contact_name || '-').padEnd(10);
    const active = client.is_active ? '' : '(비활성)';

    console.log(`${emoji}   ${ddayStr.padEnd(8)} ${endDate.padEnd(12)} ${name} ${phone} ${contact} ${active}`);
  }

  // 무제한 클라이언트 수 조회
  const { count: unlimitedCount } = await supabase
    .from('clients')
    .select('*', { count: 'exact', head: true })
    .is('service_end_date', null);

  // 요약
  const activeClients = clients.filter(c => c.is_active);
  const expiringSoon = activeClients.filter(c => {
    const dday = getDday(c.service_end_date);
    return dday !== null && dday >= 0 && dday <= 7;
  });
  const expired = activeClients.filter(c => {
    const dday = getDday(c.service_end_date);
    return dday !== null && dday < 0;
  });

  console.log('\n' + '-'.repeat(75));
  console.log(`\n📊 요약`);
  console.log(`   연장관리 대상: ${activeClients.length}개`);
  console.log(`   🟡 7일 이내 만료 예정: ${expiringSoon.length}개`);
  console.log(`   🔴 만료됨: ${expired.length}개`);
  console.log(`   ♾️  무제한 (제외): ${unlimitedCount || 0}개\n`);
}

// 클라이언트 조회
async function getClient(clientName) {
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .ilike('client_name', `%${clientName}%`)
    .limit(1)
    .single();

  if (error) {
    return null;
  }
  return data;
}

// 문자 발송
async function sendSMS(options) {
  console.log('\n━'.repeat(50));
  console.log('📱 연장 안내 문자 발송');
  console.log('━'.repeat(50));

  if (!options.client) {
    console.log('\n❌ 클라이언트명을 입력해주세요. (--client)');
    return;
  }

  if (!options.type) {
    console.log('\n❌ 메시지 타입을 입력해주세요. (--type d7|d3|d0|expired)');
    return;
  }

  // 클라이언트 조회
  const client = await getClient(options.client);
  if (!client) {
    console.log(`\n❌ 클라이언트를 찾을 수 없습니다: ${options.client}`);
    return;
  }

  console.log(`\n📋 클라이언트: ${client.client_name}`);
  console.log(`   종료일: ${formatDate(client.service_end_date)}`);
  console.log(`   연락처: ${client.contact_phone || '(미등록)'}`);
  console.log(`   담당자: ${client.contact_name || '(미등록)'}`);

  if (!client.contact_phone) {
    console.log('\n❌ 연락처가 등록되지 않았습니다.');
    console.log('   먼저 연락처를 등록해주세요:');
    console.log(`   node renewal-manager.js contact --client "${client.client_name}" --phone "010-xxx" --name "담당자"\n`);
    return;
  }

  // 메시지 생성
  const message = templates.getMessage(options.type, {
    clientName: client.client_name,
    endDate: formatDate(client.service_end_date)
  });

  console.log(`\n📝 메시지 타입: ${options.type.toUpperCase()}`);
  console.log('─'.repeat(40));
  console.log(message);
  console.log('─'.repeat(40));

  // SMS 발송
  console.log('\n📤 발송 중...');

  try {
    const sms = new SMSClient({
      accessKey: process.env.NCP_ACCESS_KEY,
      secretKey: process.env.NCP_SECRET_KEY,
      serviceId: process.env.NCP_SERVICE_ID,
      senderPhone: process.env.NCP_SENDER_PHONE
    });

    const result = await sms.send(client.contact_phone, message);

    if (result.success) {
      console.log(`\n✅ 발송 성공!`);
      console.log(`   수신자: ${client.contact_phone}`);
      console.log(`   요청ID: ${result.requestId}`);

      // 발송 이력 저장
      await supabase.from('sms_logs').insert({
        client_id: client.id,
        message_type: options.type,
        phone: client.contact_phone,
        status: 'success',
        request_id: result.requestId
      });
    } else {
      console.log(`\n❌ 발송 실패: ${result.error}`);

      await supabase.from('sms_logs').insert({
        client_id: client.id,
        message_type: options.type,
        phone: client.contact_phone,
        status: 'failed',
        error: result.error
      });
    }
  } catch (error) {
    console.log(`\n❌ 오류: ${error.message}`);
  }

  console.log('');
}

// 연장 처리
async function extendService(options) {
  console.log('\n━'.repeat(50));
  console.log('📅 서비스 연장 처리');
  console.log('━'.repeat(50));

  if (!options.client) {
    console.log('\n❌ 클라이언트명을 입력해주세요. (--client)');
    return;
  }

  // 클라이언트 조회
  const client = await getClient(options.client);
  if (!client) {
    console.log(`\n❌ 클라이언트를 찾을 수 없습니다: ${options.client}`);
    return;
  }

  console.log(`\n📋 클라이언트: ${client.client_name}`);
  console.log(`   현재 종료일: ${formatDate(client.service_end_date)}`);

  // 새 종료일 계산
  const currentEnd = client.service_end_date ? new Date(client.service_end_date) : new Date();
  const today = new Date();

  // 만료된 경우 오늘부터, 아니면 현재 종료일부터 연장
  const startDate = currentEnd < today ? today : currentEnd;
  const newEndDate = new Date(startDate);
  newEndDate.setMonth(newEndDate.getMonth() + options.months);

  console.log(`   연장 개월: ${options.months}개월`);
  console.log(`   새 종료일: ${formatDate(newEndDate)}`);

  // DB 업데이트
  const { error } = await supabase
    .from('clients')
    .update({
      service_end_date: newEndDate.toISOString().split('T')[0],
      is_active: true
    })
    .eq('id', client.id);

  if (error) {
    console.log(`\n❌ 업데이트 실패: ${error.message}`);
    return;
  }

  console.log('\n✅ 연장 완료!');
  console.log(`   ${formatDate(startDate)} ~ ${formatDate(newEndDate)} (${options.months}개월)\n`);
}

// 연락처 등록/수정
async function updateContact(options) {
  console.log('\n━'.repeat(50));
  console.log('📞 연락처 등록/수정');
  console.log('━'.repeat(50));

  if (!options.client) {
    console.log('\n❌ 클라이언트명을 입력해주세요. (--client)');
    return;
  }

  if (!options.phone && !options.name) {
    console.log('\n❌ 연락처(--phone) 또는 담당자명(--name)을 입력해주세요.');
    return;
  }

  // 클라이언트 조회
  const client = await getClient(options.client);
  if (!client) {
    console.log(`\n❌ 클라이언트를 찾을 수 없습니다: ${options.client}`);
    return;
  }

  console.log(`\n📋 클라이언트: ${client.client_name}`);
  console.log(`   현재 연락처: ${client.contact_phone || '(미등록)'}`);
  console.log(`   현재 담당자: ${client.contact_name || '(미등록)'}`);

  // 업데이트 데이터
  const updateData = {};
  if (options.phone) updateData.contact_phone = options.phone;
  if (options.name) updateData.contact_name = options.name;

  // DB 업데이트
  const { error } = await supabase
    .from('clients')
    .update(updateData)
    .eq('id', client.id);

  if (error) {
    console.log(`\n❌ 업데이트 실패: ${error.message}`);
    return;
  }

  console.log('\n✅ 업데이트 완료!');
  if (options.phone) console.log(`   새 연락처: ${options.phone}`);
  if (options.name) console.log(`   새 담당자: ${options.name}`);
  console.log('');
}

// 메인
async function main() {
  const options = parseArgs();

  if (options.help || !options.command) {
    showHelp();
    return;
  }

  switch (options.command) {
    case 'list':
      await listClients();
      break;
    case 'send':
      await sendSMS(options);
      break;
    case 'extend':
      await extendService(options);
      break;
    case 'contact':
      await updateContact(options);
      break;
    default:
      console.log(`\n❌ 알 수 없는 명령어: ${options.command}`);
      console.log('   --help로 사용법을 확인하세요.\n');
  }
}

main().catch(console.error);
