#!/usr/bin/env node
/**
 * 백필 CLI
 *
 * 사용법:
 *   node backfill-cli.js --client "ABC마케팅" --days 90
 *   node backfill-cli.js --all --days 7
 *   node backfill-cli.js --help
 *
 * 기능:
 *   - 클라이언트명으로 백필 실행
 *   - 전체 클라이언트 일괄 백필
 *   - 토큰 자동 복호화
 *   - 작업 로그 기록
 *   - 텔레그램 알림 (백필 채널)
 */

require('dotenv').config();
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const logger = require('./lib/logger');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// 백필 알림 채널 (클라이언트 채널 아님!)
const BACKFILL_CHAT_ID = '-1003394139746';

// 인자 파싱
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    client: null,
    all: false,
    days: 7,
    help: false
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--client':
      case '-c':
        options.client = args[++i];
        break;
      case '--all':
      case '-a':
        options.all = true;
        break;
      case '--days':
      case '-d':
        options.days = parseInt(args[++i]) || 7;
        break;
      case '--help':
      case '-h':
        options.help = true;
        break;
      default:
        if (!args[i].startsWith('-') && !options.client) {
          options.client = args[i];
        }
    }
  }

  return options;
}

// 도움말
function showHelp() {
  console.log(`
📥 BAS Meta Ads - 백필 CLI

사용법:
  node backfill-cli.js --client "ABC마케팅" --days 90    특정 클라이언트 백필
  node backfill-cli.js "ABC마케팅" 90                    간단 버전
  node backfill-cli.js --all --days 7                   전체 클라이언트 백필

옵션:
  --client, -c   클라이언트명
  --all, -a      전체 활성 클라이언트
  --days, -d     백필 기간 (기본: 7일, 최대: 90일)
  --help, -h     도움말

예시:
  node backfill-cli.js --client "비즈액터스쿨" --days 30
  node backfill-cli.js --all --days 7
`);
}

// 날짜 범위 계산
function getDateRange(days) {
  const end = new Date();
  end.setDate(end.getDate() - 1); // 어제까지

  const start = new Date(end);
  start.setDate(end.getDate() - (days - 1));

  return {
    startDate: start.toISOString().split('T')[0],
    endDate: end.toISOString().split('T')[0]
  };
}

// 토큰 복호화
function decryptToken(encryptedText) {
  if (!encryptedText) return null;

  const key = process.env.TOKEN_ENCRYPTION_KEY;
  if (!key || key.length !== 64) {
    throw new Error('TOKEN_ENCRYPTION_KEY가 설정되지 않았습니다');
  }

  try {
    const parts = encryptedText.split(':');
    if (parts.length !== 2) return null;

    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];
    const keyBuffer = Buffer.from(key, 'hex');

    const decipher = crypto.createDecipheriv('aes-256-cbc', keyBuffer, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    return null;
  }
}

// actions 배열에서 값 추출
function getActionValue(actions, actionType) {
  if (!actions || !Array.isArray(actions)) return 0;
  const action = actions.find(a => a.action_type === actionType);
  return action ? parseInt(action.value) || 0 : 0;
}

// Meta API 호출
async function fetchMetaInsights(adAccountId, accessToken, startDate, endDate) {
  const baseUrl = `https://graph.facebook.com/v22.0/${adAccountId}/insights`;

  const params = new URLSearchParams({
    access_token: accessToken,
    time_range: JSON.stringify({ since: startDate, until: endDate }),
    fields: 'ad_id,ad_name,campaign_id,campaign_name,impressions,spend,inline_link_clicks,reach,actions,account_currency',
    breakdowns: 'publisher_platform,device_platform',
    level: 'ad',
    limit: '500',
    time_increment: '1'
  });

  let allData = [];
  let nextUrl = `${baseUrl}?${params}`;

  while (nextUrl) {
    const response = await fetch(nextUrl);
    const data = await response.json();

    if (data.error) {
      throw new Error(`Meta API: ${data.error.message}`);
    }

    if (data.data && data.data.length > 0) {
      allData = allData.concat(data.data);
    }

    nextUrl = data.paging?.next || null;

    if (nextUrl) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  return allData;
}

// raw_data에 저장
async function saveToRawData(clientId, insights) {
  if (!insights || insights.length === 0) return 0;

  const records = insights.map(item => ({
    client_id: clientId,
    date: item.date_start,
    ad_id: item.ad_id,
    ad_name: item.ad_name || 'Unknown',
    campaign_id: item.campaign_id,
    campaign_name: item.campaign_name || 'Unknown',
    platform: item.publisher_platform || 'unknown',
    device: item.device_platform || 'unknown',
    currency: item.account_currency || 'KRW',
    impressions: parseInt(item.impressions) || 0,
    reach: parseInt(item.reach) || 0,
    clicks: parseInt(item.inline_link_clicks) || 0,
    leads: getActionValue(item.actions, 'lead'),
    spend: parseFloat(item.spend) || 0
  }));

  let savedCount = 0;

  for (let i = 0; i < records.length; i += 50) {
    const batch = records.slice(i, i + 50);
    const { error } = await supabase
      .from('raw_data')
      .upsert(batch, { onConflict: 'client_id,date,ad_id,platform,device' });

    if (!error) {
      savedCount += batch.length;
    }
  }

  return savedCount;
}

// 텔레그램 알림
async function sendTelegramNotification(message) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) return;

  try {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: BACKFILL_CHAT_ID,
        text: message,
        parse_mode: 'Markdown'
      })
    });
  } catch (error) {
    // 알림 실패는 무시
  }
}

// 단일 클라이언트 백필
async function backfillClient(client, days) {
  const { startDate, endDate } = getDateRange(days);

  console.log(`\n📥 ${client.client_name}`);
  console.log(`   기간: ${startDate} ~ ${endDate} (${days}일)`);

  // 토큰 복호화
  const accessToken = decryptToken(client.encrypted_access_token);
  if (!accessToken) {
    logger.fail('BACKFILL', `${client.client_name} - 토큰 복호화 실패`);
    console.log(`   ❌ 토큰 복호화 실패`);
    return { success: false, error: '토큰 복호화 실패' };
  }

  try {
    // Meta API 호출
    console.log(`   📡 Meta API 호출 중...`);
    const insights = await fetchMetaInsights(
      client.meta_ad_account_id,
      accessToken,
      startDate,
      endDate
    );

    console.log(`   📊 ${insights.length}개 레코드 수신`);

    // 저장
    if (insights.length > 0) {
      const savedCount = await saveToRawData(client.id, insights);
      console.log(`   💾 ${savedCount}개 저장 완료`);

      logger.success('BACKFILL', `${client.client_name} ${days}일 - ${savedCount}건 저장`);

      return {
        success: true,
        fetched: insights.length,
        saved: savedCount
      };
    } else {
      console.log(`   ⚠️ 데이터 없음`);
      logger.info('BACKFILL', `${client.client_name} ${days}일 - 데이터 없음`);
      return { success: true, fetched: 0, saved: 0 };
    }

  } catch (error) {
    logger.fail('BACKFILL', `${client.client_name} - ${error.message}`);
    console.log(`   ❌ 실패: ${error.message}`);
    return { success: false, error: error.message };
  }
}

// 메인 백필 실행
async function runBackfill(options) {
  console.log('━'.repeat(60));
  console.log('📥 BAS Meta Ads - 백필');
  console.log('━'.repeat(60));

  // 기간 제한
  if (options.days > 90) {
    console.log('\n⚠️ 최대 90일까지 가능합니다. 90일로 조정됩니다.\n');
    options.days = 90;
  }

  let clients = [];

  // 클라이언트 조회
  if (options.all) {
    // 전체 활성 클라이언트
    const { data, error } = await supabase
      .from('clients')
      .select('id, client_name, meta_ad_account_id, encrypted_access_token')
      .eq('is_active', true)
      .order('client_name');

    if (error || !data) {
      logger.fail('BACKFILL', `클라이언트 조회 실패: ${error?.message}`);
      console.log(`\n❌ 클라이언트 조회 실패\n`);
      return;
    }

    clients = data;
    console.log(`\n🎯 전체 활성 클라이언트: ${clients.length}개`);

  } else if (options.client) {
    // 특정 클라이언트
    const { data, error } = await supabase
      .from('clients')
      .select('id, client_name, meta_ad_account_id, encrypted_access_token')
      .ilike('client_name', `%${options.client}%`)
      .single();

    if (error || !data) {
      logger.fail('BACKFILL', `"${options.client}" 찾을 수 없음`);
      console.log(`\n❌ "${options.client}" 클라이언트를 찾을 수 없습니다.\n`);

      // 클라이언트 목록 출력
      const { data: allClients } = await supabase
        .from('clients')
        .select('client_name, is_active');

      console.log('등록된 클라이언트:');
      allClients?.forEach(c => {
        console.log(`  - ${c.client_name} ${c.is_active ? '(활성)' : '(비활성)'}`);
      });
      return;
    }

    clients = [data];
    console.log(`\n🎯 대상: ${data.client_name}`);

  } else {
    console.log('\n❌ --client 또는 --all 옵션이 필요합니다.\n');
    showHelp();
    return;
  }

  console.log(`📅 백필 기간: ${options.days}일`);

  // 백필 실행
  const results = {
    success: [],
    failed: []
  };

  for (const client of clients) {
    const result = await backfillClient(client, options.days);

    if (result.success) {
      results.success.push({
        name: client.client_name,
        fetched: result.fetched,
        saved: result.saved
      });
    } else {
      results.failed.push({
        name: client.client_name,
        error: result.error
      });
    }

    // 클라이언트 간 대기
    if (clients.length > 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  // 결과 요약
  console.log('\n' + '━'.repeat(60));
  console.log('📊 백필 결과');
  console.log('━'.repeat(60));
  console.log(`✅ 성공: ${results.success.length}개`);
  console.log(`❌ 실패: ${results.failed.length}개`);

  if (results.success.length > 0) {
    const totalFetched = results.success.reduce((sum, r) => sum + r.fetched, 0);
    const totalSaved = results.success.reduce((sum, r) => sum + r.saved, 0);
    console.log(`📈 총 수집: ${totalFetched}건, 저장: ${totalSaved}건`);
  }

  if (results.failed.length > 0) {
    console.log('\n실패 목록:');
    results.failed.forEach(f => console.log(`  - ${f.name}: ${f.error}`));
  }

  // 텔레그램 알림
  const { startDate, endDate } = getDateRange(options.days);
  let telegramMsg = `📥 **[BAS] 백필 완료**\n\n`;
  telegramMsg += `📅 기간: ${startDate} ~ ${endDate}\n`;
  telegramMsg += `✅ 성공: ${results.success.length}개\n`;
  telegramMsg += `❌ 실패: ${results.failed.length}개\n`;

  if (results.success.length > 0) {
    const totalSaved = results.success.reduce((sum, r) => sum + r.saved, 0);
    telegramMsg += `\n📈 총 ${totalSaved}건 저장\n`;
  }

  if (results.failed.length > 0) {
    telegramMsg += `\n⚠️ 실패: ${results.failed.map(f => f.name).join(', ')}\n`;
  }

  telegramMsg += `\n---\n🤖 BAS Meta Ads`;

  await sendTelegramNotification(telegramMsg);

  console.log('\n');
}

// 메인
async function main() {
  const options = parseArgs();

  if (options.help) {
    showHelp();
    return;
  }

  try {
    await runBackfill(options);
  } catch (error) {
    logger.fail('BACKFILL', error.message);
    console.error('❌ 오류:', error.message);
    process.exit(1);
  }
}

main();
