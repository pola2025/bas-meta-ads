/**
 * 데이터 수집 로직 - Vercel Cron용
 *
 * 기존 collect-all-clients.js의 TypeScript 버전
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// 타입 정의
interface Client {
  id: string;
  client_name: string;
  meta_ad_account_id: string | null;
  encrypted_access_token: string | null;
  meta_access_token_id: string | null;
  auth_type: string;
  status: string;
}

interface MetaInsight {
  date_start: string;
  ad_id: string;
  ad_name: string;
  campaign_id: string;
  campaign_name: string;
  publisher_platform: string;
  device_platform: string;
  account_currency: string;
  impressions: string;
  reach: string;
  inline_link_clicks: string;
  spend: string;
  actions?: Array<{ action_type: string; value: string }>;
  video_avg_time_watched_actions?: Array<{ action_type: string; value: string }>;
}

interface CollectionResult {
  success: Array<{ name: string; fetched: number; saved: number }>;
  failed: Array<{ name: string; error: string }>;
  skipped: Array<{ name: string; reason: string }>;
}

// 백필 알림 채널 (클라이언트 채널 아님!)
const BACKFILL_CHAT_ID = '-1003394139746';

/**
 * AES-256-CBC 토큰 복호화
 */
function decryptToken(encryptedText: string | null): string | null {
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
    console.error('❌ Token decryption failed:', (error as Error).message);
    return null;
  }
}

/**
 * 클라이언트 Access Token 조회
 */
async function getClientAccessToken(
  supabase: SupabaseClient,
  clientId: string,
  client: Client
): Promise<string | null> {
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
      return (vaultToken as string).replace(/\s/g, '');
    }
  }

  return null;
}

/**
 * 날짜 범위 계산 (KST 기준)
 */
function getDateRange(days: number): { since: string; until: string } {
  const now = new Date();
  const kstOffset = 9 * 60 * 60 * 1000;
  const kstNow = new Date(now.getTime() + kstOffset);

  const end = new Date(kstNow);
  end.setUTCDate(end.getUTCDate() - 1);

  const start = new Date(end);
  start.setUTCDate(end.getUTCDate() - (days - 1));

  return {
    since: start.toISOString().split('T')[0],
    until: end.toISOString().split('T')[0]
  };
}

/**
 * actions 배열에서 값 추출
 */
function getActionValue(
  actions: Array<{ action_type: string; value: string }> | undefined,
  actionType: string
): number {
  if (!actions || !Array.isArray(actions)) return 0;
  const action = actions.find(a => a.action_type === actionType);
  return action ? parseInt(action.value) || 0 : 0;
}

/**
 * video_avg_time_watched_actions에서 평균 시청 시간 추출
 */
function getVideoAvgTime(
  videoActions: Array<{ action_type: string; value: string }> | undefined
): number {
  if (!videoActions || !Array.isArray(videoActions)) return 0;
  const action = videoActions.find(a => a.action_type === 'video_view');
  return action ? parseFloat(action.value) || 0 : 0;
}

/**
 * Meta API 호출 (페이지네이션 + 자동 재시도)
 */
async function fetchMetaInsights(
  adAccountId: string,
  accessToken: string,
  startDate: string,
  endDate: string,
  retryCount = 0
): Promise<MetaInsight[]> {
  const MAX_RETRIES = 3;
  const RETRY_DELAY = 30000;

  const baseUrl = `https://graph.facebook.com/v22.0/${adAccountId}/insights`;

  const params = new URLSearchParams({
    access_token: accessToken,
    time_range: JSON.stringify({ since: startDate, until: endDate }),
    fields: 'ad_id,ad_name,campaign_id,campaign_name,impressions,spend,inline_link_clicks,reach,actions,video_avg_time_watched_actions,account_currency',
    breakdowns: 'publisher_platform,device_platform',
    level: 'ad',
    limit: '500',
    time_increment: '1'
  });

  const allData: MetaInsight[] = [];
  let nextUrl: string | null = `${baseUrl}?${params}`;

  try {
    while (nextUrl) {
      const response: Response = await fetch(nextUrl);
      const data = await response.json() as {
        error?: { code?: number; message?: string };
        data?: MetaInsight[];
        paging?: { next?: string };
      };

      if (data.error) {
        if (data.error.code === 17 || data.error.message?.includes('limit')) {
          if (retryCount < MAX_RETRIES) {
            console.log(`    ⏳ Rate limit - ${RETRY_DELAY / 1000}초 후 재시도 (${retryCount + 1}/${MAX_RETRIES})`);
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
            return fetchMetaInsights(adAccountId, accessToken, startDate, endDate, retryCount + 1);
          }
        }
        throw new Error(`Meta API Error: ${data.error.message}`);
      }

      if (data.data && data.data.length > 0) {
        allData.push(...data.data);
      }

      nextUrl = data.paging?.next || null;

      if (nextUrl) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    return allData;
  } catch (error) {
    if (retryCount < MAX_RETRIES && !(error as Error).message.includes('Meta API Error')) {
      console.log(`    ⏳ 네트워크 오류 - ${RETRY_DELAY / 1000}초 후 재시도 (${retryCount + 1}/${MAX_RETRIES})`);
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
      return fetchMetaInsights(adAccountId, accessToken, startDate, endDate, retryCount + 1);
    }
    throw error;
  }
}

/**
 * raw_data에 저장 (UPSERT)
 */
async function saveToRawData(
  supabase: SupabaseClient,
  clientId: string,
  insights: MetaInsight[]
): Promise<number> {
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
    spend: parseFloat(item.spend) || 0,
    video_views: getActionValue(item.actions, 'video_view'),
    avg_watch_time: getVideoAvgTime(item.video_avg_time_watched_actions)
  }));

  let savedCount = 0;

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
 * 텔레그램 알림
 */
async function sendTelegramNotification(message: string): Promise<void> {
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
    console.error('❌ Telegram notification failed:', (error as Error).message);
  }
}

/**
 * 메인 데이터 수집 함수
 */
export async function collectAllClientsData(days = 7): Promise<{
  success: boolean;
  results: CollectionResult;
  dateRange: { since: string; until: string };
}> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const dateRange = getDateRange(days);

  console.log('━'.repeat(60));
  console.log('🚀 멀티 클라이언트 데이터 수집 시작');
  console.log(`📅 수집 기간: ${dateRange.since} ~ ${dateRange.until} (${days}일)`);
  console.log('');

  // 활성 클라이언트 조회
  const { data: clients, error: clientError } = await supabase
    .from('clients')
    .select('id, client_name, meta_ad_account_id, encrypted_access_token, meta_access_token_id, auth_type, status')
    .eq('is_active', true)
    .or('auth_type.eq.manual,and(auth_type.eq.oauth,status.eq.active)')
    .order('client_name');

  if (clientError) {
    console.error('❌ 클라이언트 조회 실패:', clientError.message);
    await sendTelegramNotification(`🚨 **[BAS] 데이터 수집 실패**\n\n❌ 클라이언트 조회 오류: ${clientError.message}`);
    throw new Error(clientError.message);
  }

  console.log(`📋 활성 클라이언트: ${clients?.length || 0}개\n`);

  const results: CollectionResult = {
    success: [],
    failed: [],
    skipped: []
  };

  if (!clients || clients.length === 0) {
    return { success: true, results, dateRange };
  }

  // 각 클라이언트 처리
  for (let i = 0; i < clients.length; i++) {
    const client = clients[i] as Client;
    const progress = `[${i + 1}/${clients.length}]`;

    console.log(`${progress} 🏢 ${client.client_name}`);

    if (!client.meta_ad_account_id) {
      console.log(`    ⚠️ SKIP: Meta Ad Account ID 없음`);
      results.skipped.push({ name: client.client_name, reason: 'No Ad Account ID' });
      continue;
    }

    const accessToken = await getClientAccessToken(supabase, client.id, client);
    if (!accessToken) {
      console.log(`    ⚠️ SKIP: Access Token 없음 또는 복호화 실패`);
      results.skipped.push({ name: client.client_name, reason: 'No Access Token' });
      continue;
    }

    try {
      console.log(`    📡 Meta API 호출 중...`);
      const insights = await fetchMetaInsights(
        client.meta_ad_account_id,
        accessToken,
        dateRange.since,
        dateRange.until
      );

      console.log(`    📊 ${insights.length}개 레코드 수신`);

      if (insights.length > 0) {
        const savedCount = await saveToRawData(supabase, client.id, insights);
        console.log(`    💾 ${savedCount}개 저장 완료`);

        results.success.push({
          name: client.client_name,
          fetched: insights.length,
          saved: savedCount
        });
      } else {
        console.log(`    ⚠️ 데이터 없음`);
        results.skipped.push({ name: client.client_name, reason: 'No data in period' });
      }
    } catch (error) {
      console.error(`    ❌ 실패: ${(error as Error).message}`);
      results.failed.push({ name: client.client_name, error: (error as Error).message });
    }

    // Rate limit 방지
    if (i < clients.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }

  // 결과 요약
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
    telegramMsg += `\n⚠️ *실패 클라이언트:*\n`;
    results.failed.forEach(f => {
      telegramMsg += `• ${f.name}: ${f.error.substring(0, 50)}\n`;
    });
  }

  telegramMsg += `\n---\n🤖 BAS Meta Ads (Vercel Cron)`;

  await sendTelegramNotification(telegramMsg);

  console.log('\n✅ 데이터 수집 완료!');

  return {
    success: results.failed.length === 0,
    results,
    dateRange
  };
}
