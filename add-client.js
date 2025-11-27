#!/usr/bin/env node
/**
 * 클라이언트 추가 CLI
 *
 * 사용법:
 *   node add-client.js --name "ABC마케팅" --account "act_123" --telegram "-100xxx" --token "EAAG..."
 *   node add-client.js --help
 *
 * 기능:
 *   - 토큰 유효성 자동 검증 (Meta API 테스트)
 *   - 토큰 AES-256 암호화 저장
 *   - 작업 로그 기록
 */

require('dotenv').config();
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const logger = require('./lib/logger');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// slug 자동 생성 (클라이언트명 기반 + 랜덤 6자)
function generateSlug(name) {
  // 한글/영문 → 영문 소문자 변환, 특수문자 제거
  const base = name
    .toLowerCase()
    .replace(/[가-힣]+/g, match => {
      // 간단한 한글 → 영문 변환 (초성 기반)
      const cho = ['g','kk','n','d','tt','r','m','b','pp','s','ss','','j','jj','ch','k','t','p','h'];
      return match.split('').map(char => {
        const code = char.charCodeAt(0) - 44032;
        if (code < 0 || code > 11171) return '';
        return cho[Math.floor(code / 588)] || '';
      }).join('');
    })
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 20);

  // 랜덤 6자 추가
  const random = crypto.randomBytes(3).toString('hex');
  return `${base}-${random}`;
}

// 인자 파싱
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    name: null,
    account: null,
    telegram: null,
    token: null,
    help: false,
    skipValidation: false
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--name':
      case '-n':
        options.name = args[++i];
        break;
      case '--account':
      case '-a':
        options.account = args[++i];
        break;
      case '--telegram':
      case '-t':
        options.telegram = args[++i];
        break;
      case '--token':
        options.token = args[++i];
        break;
      case '--skip-validation':
        options.skipValidation = true;
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
👤 BAS Meta Ads - 클라이언트 추가 CLI

사용법:
  node add-client.js --name "회사명" --account "act_xxx" --telegram "-100xxx" --token "EAAG..."

필수 옵션:
  --name, -n       클라이언트명
  --account, -a    Meta 광고계정 ID (act_xxxxxxxx)
  --token          Meta Access Token

선택 옵션:
  --telegram, -t     텔레그램 채팅 ID (나중에 설정 가능)
  --skip-validation  토큰 검증 건너뛰기
  --help, -h         도움말

예시:
  node add-client.js \\
    --name "ABC마케팅" \\
    --account "act_123456789" \\
    --telegram "-1001234567890" \\
    --token "EAAGxxxxxxxxx..."
`);
}

// 필수 옵션 검증
function validateOptions(options) {
  const missing = [];

  if (!options.name) missing.push('--name (클라이언트명)');
  if (!options.account) missing.push('--account (광고계정 ID)');
  if (!options.token) missing.push('--token (Access Token)');

  if (missing.length > 0) {
    console.log('\n❌ 필수 옵션이 누락되었습니다:\n');
    missing.forEach(m => console.log(`   ${m}`));
    console.log('\n--help 로 사용법을 확인하세요.\n');
    return false;
  }

  // 광고계정 ID 형식 검증
  if (!options.account.startsWith('act_')) {
    console.log('\n❌ 광고계정 ID는 "act_"로 시작해야 합니다.');
    console.log(`   입력값: ${options.account}`);
    console.log('   예시: act_123456789\n');
    return false;
  }

  return true;
}

// Meta API 토큰 검증
async function validateToken(accountId, token) {
  console.log('\n🔍 토큰 검증 중...');

  try {
    const url = `https://graph.facebook.com/v22.0/${accountId}?fields=name,account_status&access_token=${token}`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.error) {
      console.log(`\n❌ 토큰 검증 실패`);
      console.log(`   에러: ${data.error.message}`);

      if (data.error.code === 190) {
        console.log('   원인: 토큰이 만료되었거나 유효하지 않습니다.');
      } else if (data.error.code === 100) {
        console.log('   원인: 광고계정 ID가 잘못되었거나 접근 권한이 없습니다.');
      }

      return { valid: false, error: data.error.message };
    }

    console.log(`   ✅ 계정명: ${data.name}`);
    console.log(`   ✅ 계정 상태: ${data.account_status === 1 ? '활성' : '비활성'}`);

    return { valid: true, accountName: data.name };
  } catch (error) {
    console.log(`\n❌ API 호출 실패: ${error.message}`);
    return { valid: false, error: error.message };
  }
}

// 토큰 암호화
function encryptToken(token) {
  const key = process.env.TOKEN_ENCRYPTION_KEY;
  if (!key || key.length !== 64) {
    throw new Error('TOKEN_ENCRYPTION_KEY가 설정되지 않았거나 잘못되었습니다 (64자 hex 필요)');
  }

  const iv = crypto.randomBytes(16);
  const keyBuffer = Buffer.from(key, 'hex');
  const cipher = crypto.createCipheriv('aes-256-cbc', keyBuffer, iv);

  let encrypted = cipher.update(token, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  return `${iv.toString('hex')}:${encrypted}`;
}

// 중복 확인
async function checkDuplicate(name, account) {
  // 이름 중복
  const { data: byName } = await supabase
    .from('clients')
    .select('id')
    .ilike('client_name', name)
    .limit(1);

  if (byName && byName.length > 0) {
    return { duplicate: true, field: 'client_name', value: name };
  }

  // 계정 ID 중복
  const { data: byAccount } = await supabase
    .from('clients')
    .select('id')
    .eq('meta_ad_account_id', account)
    .limit(1);

  if (byAccount && byAccount.length > 0) {
    return { duplicate: true, field: 'meta_ad_account_id', value: account };
  }

  return { duplicate: false };
}

// 클라이언트 추가
async function addClient(options) {
  console.log('\n━'.repeat(50));
  console.log('👤 클라이언트 추가');
  console.log('━'.repeat(50));

  console.log(`\n📋 입력 정보`);
  console.log(`   이름: ${options.name}`);
  console.log(`   광고계정: ${options.account}`);
  console.log(`   텔레그램: ${options.telegram || '(미설정)'}`);
  console.log(`   토큰: ${options.token.substring(0, 20)}...`);

  // 1. 중복 확인
  console.log('\n🔍 중복 확인 중...');
  const dupCheck = await checkDuplicate(options.name, options.account);

  if (dupCheck.duplicate) {
    logger.fail('ADD_CLIENT', `중복: ${dupCheck.field} = ${dupCheck.value}`);
    console.log(`\n❌ 이미 등록된 ${dupCheck.field === 'client_name' ? '클라이언트명' : '광고계정'}입니다.`);
    console.log(`   값: ${dupCheck.value}\n`);
    return false;
  }
  console.log('   ✅ 중복 없음');

  // 2. 토큰 검증
  if (!options.skipValidation) {
    const validation = await validateToken(options.account, options.token);
    if (!validation.valid) {
      logger.fail('ADD_CLIENT', `${options.name} - 토큰 검증 실패: ${validation.error}`);
      return false;
    }
  } else {
    console.log('\n⚠️ 토큰 검증 건너뜀 (--skip-validation)');
  }

  // 3. 토큰 암호화
  console.log('\n🔐 토큰 암호화 중...');
  let encryptedToken;
  try {
    encryptedToken = encryptToken(options.token);
    console.log('   ✅ 암호화 완료');
  } catch (error) {
    logger.fail('ADD_CLIENT', `${options.name} - 암호화 실패: ${error.message}`);
    console.log(`\n❌ ${error.message}\n`);
    return false;
  }

  // 4. slug 자동 생성
  const slug = generateSlug(options.name);
  console.log(`\n🔗 slug 생성: ${slug}`);

  // 5. DB 저장
  console.log('💾 저장 중...');

  const clientData = {
    client_name: options.name,
    meta_ad_account_id: options.account,
    encrypted_access_token: encryptedToken,
    telegram_chat_id: options.telegram || null,
    slug: slug,
    is_active: true,
    service_start_date: new Date().toISOString().split('T')[0]
  };

  const { data, error } = await supabase
    .from('clients')
    .insert(clientData)
    .select()
    .single();

  if (error) {
    logger.fail('ADD_CLIENT', `${options.name} - DB 저장 실패: ${error.message}`);
    console.log(`\n❌ 저장 실패: ${error.message}\n`);
    return false;
  }

  // 6. 완료
  logger.success('ADD_CLIENT', `${options.name} (${options.account})`);

  console.log('\n' + '━'.repeat(50));
  console.log('✅ 클라이언트 추가 완료!');
  console.log('━'.repeat(50));
  console.log(`\n   ID: ${data.id}`);
  console.log(`   이름: ${data.client_name}`);
  console.log(`   광고계정: ${data.meta_ad_account_id}`);
  console.log(`   slug: ${data.slug}`);

  console.log('\n📌 다음 단계:');
  console.log(`   1. 백필 실행: node backfill-cli.js --client "${options.name}" --days 90`);
  console.log(`   2. 상태 확인: node status.js --client "${options.name}"`);
  console.log('');

  return true;
}

// 메인
async function main() {
  const options = parseArgs();

  if (options.help) {
    showHelp();
    return;
  }

  if (!validateOptions(options)) {
    process.exit(1);
  }

  try {
    const success = await addClient(options);
    process.exit(success ? 0 : 1);
  } catch (error) {
    logger.fail('ADD_CLIENT', error.message);
    console.error('❌ 오류:', error.message);
    process.exit(1);
  }
}

main();
