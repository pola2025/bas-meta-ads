#!/usr/bin/env node
/**
 * 멀티 클라이언트 데이터 수집 스크립트
 *
 * 기능:
 * - 모든 활성 클라이언트(is_active=true) 순회
 * - raw_data 테이블에 저장 (VIEW가 자동 집계)
 * - Redis 없이 직접 실행
 * - 클라이언트별 암호화 토큰 복호화 지원
 * - 자동 재시도 (Rate limit 시 30초 후 최대 3회)
 *
 * 사용법:
 *   node collect-all-clients.js              # 기본 7일 (어제까지)
 *   DATA_DAYS=14 node collect-all-clients.js # 14일
 *   DATA_DAYS=30 node collect-all-clients.js # 30일
 *
 * ⚠️ 텔레그램 알림: 백필 채널(-1003394139746)만 사용
 */

require('dotenv').config();
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

// Supabase 클라이언트
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// 백필 알림 채널 (클라이언트 채널 아님!)
const BACKFILL_CHAT_ID = '-1003394139746';

/**
 * AES-256-CBC 토큰 복호화
 */
function decryptToken(encryptedText) {
  if (!encryptedText) return null;

  const key = process.env.TOKEN_ENCRYPTION_KEY;
  if (!key || key.length !== 64) {
    console.error('❌ TOKEN_ENCRYPTION_KEY not set or invalid (need 64 hex chars)');
    return null;
  }

  try {
    const parts = encryptedText.split(':');
    if (parts.length !== 2) {
      console.error('❌ Invalid encrypted text format');
      return null;
    }

    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];
    const keyBuffer = Buffer.from(key, 'hex');

    const decipher = crypto.createDecipheriv('aes-256-cbc', keyBuffer, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    console.error('❌ Token decryption failed:', error.message);
    return null;
  }
}

/**
 * 클라이언트 Access Token 조회 (암호화 복호화 또는 Vault)
 */
async function getClientAccessToken(clientId, client) {
  // 1. AES 암호화 토큰 복호화 시도
  if (client.encrypted_access_token) {
    const decrypted = decryptToken(client.encrypted_access_token);
    if (decrypted) {
      return decrypted;
    }
  }

  // 2. Fallback: Vault RPC
  if (client.meta_access_token_id) {
    const { data: vaultToken, error } = await supabase.rpc('get_client_meta_token', {
      p_client_id: clientId
    });

    if (!error && vaultToken) {
      return vaultToken.replace(/\s/g, '');
    }
  }

  return null;
}

/**
 * 날짜 범위 계산
 */
function getDateRange(days) {
  const end = new Date();
  end.setDate(end.getDate() - 1); // 어제까지

  const start = new Date(end);
  start.setDate(end.getDate() - (days - 1));

  return {
    since: start.toISOString().split('T')[0],
    until: end.toISOString().split('T')[0]
  };
}

/**
 * actions 배열에서 값 추출
 */
function getActionValue(actions, actionType) {
  if (!actions || !Array.isArray(actions)) return 0;
  const action = actions.find(a => a.action_type === actionType);
  return action ? parseInt(action.value) || 0 : 0;
}

/**
 * Meta API 호출 (페이지네이션 + 자동 재시도 지원)
 */
async function fetchMetaInsights(adAccountId, accessToken, startDate, endDate, retryCount = 0) {
  const MAX_RETRIES = 3;
  const RETRY_DELAY = 30000; // 30초

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

  try {
    while (nextUrl) {
      const response = await fetch(nextUrl);
      const data = await response.json();

      if (data.error) {
        // Rate limit 에러면 재시도
        if (data.error.code === 17 || data.error.message.includes('limit')) {
          if (retryCount < MAX_RETRIES) {
            console.log(`    ⏳ Rate limit - ${RETRY_DELAY/1000}초 후 재시도 (${retryCount + 1}/${MAX_RETRIES})`);
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
            return fetchMetaInsights(adAccountId, accessToken, startDate, endDate, retryCount + 1);
          }
        }
        throw new Error(`Meta API Error: ${data.error.message}`);
      }

      if (data.data && data.data.length > 0) {
        allData = allData.concat(data.data);
      }

      nextUrl = data.paging?.next || null;

      // Rate limit 방지
      if (nextUrl) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    return allData;
  } catch (error) {
    // 네트워크 에러 등도 재시도
    if (retryCount < MAX_RETRIES && !error.message.includes('Meta API Error')) {
      console.log(`    ⏳ 네트워크 오류 - ${RETRY_DELAY/1000}초 후 재시도 (${retryCount + 1}/${MAX_RETRIES})`);
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
      return fetchMetaInsights(adAccountId, accessToken, startDate, endDate, retryCount + 1);
    }
    throw error;
  }
}

/**
 * raw_data에 저장 (UPSERT)
 */
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

  // 50개씩 배치 upsert
  for (let i = 0; i < records.length; i += 50) {
    const batch = records.slice(i, i + 50);
    const { error } = await supabase
      .from('raw_data')
      .upsert(batch, { onConflict: 'client_id,date,ad_id,platform,device' });

    if (error) {
      console.error(`    ❌ Batch save error: ${error.message}`);
    } else {
      savedCount += batch.length;
    }
  }

  return savedCount;
}

/**
 * 텔레그램 알림 (백필 채널만!)
 */
async function sendTelegramNotification(message, isError = false) {
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
    console.error('❌ Telegram notification failed:', error.message);
  }
}

/**
 * 메인 실행
 */
async function main() {
  const days = parseInt(process.env.DATA_DAYS) || 7;
  const dateRange = getDateRange(days);

  console.log('━'.repeat(60));
  console.log('🚀 멀티 클라이언트 데이터 수집 시작');
  console.log('━'.repeat(60));
  console.log(`📅 수집 기간: ${dateRange.since} ~ ${dateRange.until} (${days}일)`);
  console.log(`🕐 실행 시각: ${new Date().toISOString()}`);
  console.log('');

  // 1. 활성 클라이언트 조회
  const { data: clients, error: clientError } = await supabase
    .from('clients')
    .select('id, client_name, meta_ad_account_id, encrypted_access_token, meta_access_token_id')
    .eq('is_active', true)
    .order('client_name');

  if (clientError) {
    console.error('❌ 클라이언트 조회 실패:', clientError.message);
    await sendTelegramNotification(`🚨 **[BAS] 데이터 수집 실패**\n\n❌ 클라이언트 조회 오류: ${clientError.message}`, true);
    process.exit(1);
  }

  console.log(`📋 활성 클라이언트: ${clients.length}개\n`);

  // 결과 집계
  const results = {
    success: [],
    failed: [],
    skipped: []
  };

  // 2. 각 클라이언트 처리 (3초 딜레이로 Rate limit 방지)
  for (let i = 0; i < clients.length; i++) {
    const client = clients[i];
    const progress = `[${i + 1}/${clients.length}]`;

    console.log(`${progress} 🏢 ${client.client_name}`);

    // Meta Ad Account ID 확인
    if (!client.meta_ad_account_id) {
      console.log(`    ⚠️ SKIP: Meta Ad Account ID 없음`);
      results.skipped.push({ name: client.client_name, reason: 'No Ad Account ID' });
      continue;
    }

    // Access Token 조회
    const accessToken = await getClientAccessToken(client.id, client);
    if (!accessToken) {
      console.log(`    ⚠️ SKIP: Access Token 없음 또는 복호화 실패`);
      results.skipped.push({ name: client.client_name, reason: 'No Access Token' });
      continue;
    }

    try {
      // Meta API 호출 (자동 재시도 포함)
      console.log(`    📡 Meta API 호출 중...`);
      const insights = await fetchMetaInsights(
        client.meta_ad_account_id,
        accessToken,
        dateRange.since,
        dateRange.until
      );

      console.log(`    📊 ${insights.length}개 레코드 수신`);

      // raw_data에 저장
      if (insights.length > 0) {
        const savedCount = await saveToRawData(client.id, insights);
        console.log(`    💾 ${savedCount}개 저장 완료`);

        results.success.push({
          name: client.client_name,
          fetched: insights.length,
          saved: savedCount
        });
      } else {
        console.log(`    ⚠️ 데이터 없음 (기간 내 광고 없음)`);
        results.skipped.push({ name: client.client_name, reason: 'No data in period' });
      }

    } catch (error) {
      console.error(`    ❌ 실패: ${error.message}`);
      results.failed.push({ name: client.client_name, error: error.message });
    }

    // Rate limit 방지 (클라이언트 간 3초 대기)
    if (i < clients.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }

  // 3. 결과 요약
  console.log('\n' + '━'.repeat(60));
  console.log('📊 수집 결과 요약');
  console.log('━'.repeat(60));
  console.log(`✅ 성공: ${results.success.length}개`);
  console.log(`❌ 실패: ${results.failed.length}개`);
  console.log(`⚠️ 스킵: ${results.skipped.length}개`);

  if (results.success.length > 0) {
    const totalFetched = results.success.reduce((sum, r) => sum + r.fetched, 0);
    const totalSaved = results.success.reduce((sum, r) => sum + r.saved, 0);
    console.log(`📈 총 수집: ${totalFetched}건, 저장: ${totalSaved}건`);
  }

  if (results.failed.length > 0) {
    console.log('\n❌ 실패 목록:');
    results.failed.forEach(f => console.log(`   - ${f.name}: ${f.error}`));
  }

  // 4. 텔레그램 알림 (실패 시 강조)
  const hasFailures = results.failed.length > 0;
  let telegramMsg = hasFailures
    ? `🚨 **[BAS] 데이터 수집 일부 실패**\n\n`
    : `✅ **[BAS] 일일 데이터 수집 완료**\n\n`;

  telegramMsg += `📅 기간: ${dateRange.since} ~ ${dateRange.until}\n`;
  telegramMsg += `✅ 성공: ${results.success.length}개\n`;
  telegramMsg += `❌ 실패: ${results.failed.length}개\n`;
  telegramMsg += `⚠️ 스킵: ${results.skipped.length}개\n`;

  if (results.success.length > 0) {
    const totalFetched = results.success.reduce((sum, r) => sum + r.fetched, 0);
    const totalSaved = results.success.reduce((sum, r) => sum + r.saved, 0);
    telegramMsg += `\n📈 총 ${totalFetched}건 수집, ${totalSaved}건 저장\n`;
  }

  if (results.failed.length > 0) {
    telegramMsg += `\n⚠️ *실패 클라이언트 (확인 필요):*\n`;
    results.failed.forEach(f => {
      telegramMsg += `• ${f.name}: ${f.error.substring(0, 50)}\n`;
    });
  }

  telegramMsg += `\n---\n🤖 BAS Meta Ads`;

  await sendTelegramNotification(telegramMsg, hasFailures);

  console.log('\n✅ 데이터 수집 완료!');
  console.log('━'.repeat(60));

  // 실패가 있으면 exit code 1
  process.exit(results.failed.length > 0 ? 1 : 0);
}

// 실행
main().catch(error => {
  console.error('💥 치명적 오류:', error.message);
  sendTelegramNotification(`🚨 **[BAS] 데이터 수집 치명적 오류**\n\n❌ ${error.message}`, true);
  process.exit(1);
});
