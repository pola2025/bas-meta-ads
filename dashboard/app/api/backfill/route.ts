import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// 관리자 키 검증
function isValidAdmin(request: NextRequest): boolean {
  const adminKey = request.headers.get('x-admin-key');
  return adminKey === process.env.NEXT_PUBLIC_ADMIN_KEY;
}

// AES-256-CBC 복호화
function decryptToken(encryptedText: string): string | null {
  if (!encryptedText) return null;

  const key = process.env.TOKEN_ENCRYPTION_KEY;
  if (!key || key.length !== 64) {
    console.error('TOKEN_ENCRYPTION_KEY not set or invalid');
    return null;
  }

  try {
    const parts = encryptedText.split(':');
    if (parts.length !== 2) {
      console.error('Invalid encrypted text format');
      return null;
    }

    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];
    const keyBuffer = Buffer.from(key, 'hex');

    const decipher = crypto.createDecipheriv('aes-256-cbc', keyBuffer, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error: any) {
    console.error('Decryption failed:', error.message);
    return null;
  }
}

// 클라이언트 Access Token 가져오기 (복호화 또는 Vault)
async function getClientAccessToken(clientId: string): Promise<string | null> {
  // 1. DB에서 암호화된 토큰 조회
  const { data: client, error } = await supabase
    .from('clients')
    .select('encrypted_access_token, meta_access_token_id')
    .eq('id', clientId)
    .single();

  if (error || !client) {
    console.error('Failed to fetch client:', error?.message);
    return null;
  }

  // 2. AES 암호화 토큰이 있으면 복호화
  if (client.encrypted_access_token) {
    const decrypted = decryptToken(client.encrypted_access_token);
    if (decrypted) {
      console.log('Token decrypted successfully');
      return decrypted;
    }
  }

  // 3. Fallback: Vault RPC 호출
  if (client.meta_access_token_id) {
    console.log('Falling back to Vault RPC');
    const { data: vaultToken, error: vaultError } = await supabase.rpc('get_client_meta_token', {
      p_client_id: clientId
    });

    if (!vaultError && vaultToken) {
      return vaultToken.replace(/\s/g, '');
    }
  }

  return null;
}

// Meta API에서 데이터 수집 (간단 버전)
async function fetchMetaAdsData(
  adAccountId: string,
  accessToken: string,
  startDate: string,
  endDate: string
): Promise<any[]> {
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

  let allData: any[] = [];
  let nextUrl: string | null = `${baseUrl}?${params}`;

  while (nextUrl) {
    const response: Response = await fetch(nextUrl);

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Meta API Error: ${errorData.error?.message || response.statusText}`);
    }

    const resJson = await response.json();

    if (resJson.data && resJson.data.length > 0) {
      allData = allData.concat(resJson.data);
    }

    const nextPage = resJson.paging?.next;
    nextUrl = nextPage || null;

    // Rate limit 방지
    if (nextUrl) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  return allData;
}

// actions 배열에서 특정 action_type 값 추출
function getActionValue(actions: any[], actionType: string): number {
  if (!actions || !Array.isArray(actions)) return 0;
  const action = actions.find((a: any) => a.action_type === actionType);
  return action ? parseInt(action.value) || 0 : 0;
}

// raw_data에 저장
async function saveRawData(clientId: string, insights: any[]): Promise<number> {
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

  // 배치로 upsert (50개씩)
  for (let i = 0; i < records.length; i += 50) {
    const batch = records.slice(i, i + 50);
    const { error } = await supabase
      .from('raw_data')
      .upsert(batch, { onConflict: 'client_id,date,ad_id,platform,device' });

    if (error) {
      console.error('Failed to save batch:', error.message);
    } else {
      savedCount += batch.length;
    }
  }

  return savedCount;
}

// daily_aggregates 동기화
async function syncDailyAggregates(clientId: string, startDate: string, endDate: string): Promise<void> {
  // RPC 호출로 daily_aggregates 생성
  const { error } = await supabase.rpc('sync_daily_aggregates', {
    p_client_id: clientId,
    p_start_date: startDate,
    p_end_date: endDate
  });

  if (error) {
    console.error('Failed to sync daily aggregates:', error.message);
    // RPC가 없으면 직접 집계 (fallback)
    await manualSyncDailyAggregates(clientId, startDate, endDate);
  }
}

// 수동 daily_aggregates 동기화 (RPC 없을 때)
async function manualSyncDailyAggregates(clientId: string, startDate: string, endDate: string): Promise<void> {
  // raw_data에서 날짜별 집계
  const { data: rawData, error } = await supabase
    .from('raw_data')
    .select('date, ad_name, campaign_name, impressions, clicks, leads, spend')
    .eq('client_id', clientId)
    .gte('date', startDate)
    .lte('date', endDate);

  if (error || !rawData) return;

  // 날짜+광고별 집계
  const aggregated: Record<string, any> = {};

  rawData.forEach((row: any) => {
    const key = `${row.date}_${row.ad_name}`;
    if (!aggregated[key]) {
      aggregated[key] = {
        client_id: clientId,
        date: row.date,
        ad_name: row.ad_name,
        campaign_name: row.campaign_name,
        impressions: 0,
        clicks: 0,
        leads: 0,
        spend: 0
      };
    }
    aggregated[key].impressions += row.impressions || 0;
    aggregated[key].clicks += row.clicks || 0;
    aggregated[key].leads += row.leads || 0;
    aggregated[key].spend += row.spend || 0;
  });

  const records = Object.values(aggregated).map((item: any) => ({
    ...item,
    ctr: item.impressions > 0 ? (item.clicks / item.impressions) * 100 : 0,
    cvr: item.clicks > 0 ? (item.leads / item.clicks) * 100 : 0,
    cpl: item.leads > 0 ? item.spend / item.leads : 0
  }));

  // ads_insights_daily에 upsert
  for (let i = 0; i < records.length; i += 50) {
    const batch = records.slice(i, i + 50);
    await supabase
      .from('ads_insights_daily')
      .upsert(batch, { onConflict: 'client_id,date,ad_name' });
  }
}

// POST: 백필 작업 실행
export async function POST(request: NextRequest) {
  if (!isValidAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { clientId, startDate, endDate } = body;

    if (!clientId || !startDate || !endDate) {
      return NextResponse.json(
        { error: 'clientId, startDate, endDate are required' },
        { status: 400 }
      );
    }

    // 날짜 유효성 검증
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return NextResponse.json(
        { error: 'Invalid date format' },
        { status: 400 }
      );
    }

    if (start > end) {
      return NextResponse.json(
        { error: 'startDate must be before endDate' },
        { status: 400 }
      );
    }

    // 최대 90일 제한
    const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    if (daysDiff > 90) {
      return NextResponse.json(
        { error: 'Maximum 90 days allowed per backfill request' },
        { status: 400 }
      );
    }

    // 클라이언트 정보 확인
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id, client_name, meta_ad_account_id')
      .eq('id', clientId)
      .single();

    if (clientError || !client) {
      return NextResponse.json(
        { error: 'Client not found' },
        { status: 404 }
      );
    }

    if (!client.meta_ad_account_id) {
      return NextResponse.json(
        { error: 'Client has no Meta Ad Account ID configured' },
        { status: 400 }
      );
    }

    // 토큰 조회 (암호화된 토큰 복호화 또는 Vault)
    const accessToken = await getClientAccessToken(clientId);

    if (!accessToken) {
      return NextResponse.json(
        { error: 'Client has no Meta Access Token configured or decryption failed' },
        { status: 400 }
      );
    }

    // 7일 이하: 즉시 실행
    // 7일 초과: 텔레그램 알림 후 응답 (실제 실행은 Worker에서)
    const IMMEDIATE_THRESHOLD = 14; // 14일까지 즉시 실행

    if (daysDiff <= IMMEDIATE_THRESHOLD) {
      // === 즉시 실행 모드 ===
      console.log(`🚀 Starting immediate backfill for ${client.client_name}: ${startDate} ~ ${endDate}`);

      try {
        // 1. Meta API에서 데이터 수집
        const insights = await fetchMetaAdsData(
          client.meta_ad_account_id,
          accessToken,
          startDate,
          endDate
        );

        console.log(`📊 Fetched ${insights.length} records from Meta API`);

        // 2. raw_data에 저장
        const savedCount = await saveRawData(clientId, insights);
        console.log(`💾 Saved ${savedCount} records to raw_data`);

        // 3. daily_aggregates 동기화
        await syncDailyAggregates(clientId, startDate, endDate);
        console.log(`📈 Daily aggregates synced`);

        // 4. 텔레그램 알림 (관리자에게)
        await sendBackfillNotification(
          client.client_name,
          startDate,
          endDate,
          insights.length,
          savedCount,
          true
        );

        return NextResponse.json({
          success: true,
          message: `백필 완료: ${client.client_name} (${startDate} ~ ${endDate})`,
          job: {
            clientId,
            clientName: client.client_name,
            startDate,
            endDate,
            status: 'completed',
            days: daysDiff,
            recordsFetched: insights.length,
            recordsSaved: savedCount,
            executionMode: 'immediate'
          }
        });

      } catch (fetchError: any) {
        console.error('Backfill execution failed:', fetchError);

        // 실패 알림
        await sendBackfillNotification(
          client.client_name,
          startDate,
          endDate,
          0,
          0,
          false,
          fetchError.message
        );

        return NextResponse.json({
          success: false,
          error: `백필 실행 실패: ${fetchError.message}`,
          job: {
            clientId,
            clientName: client.client_name,
            startDate,
            endDate,
            status: 'failed',
            days: daysDiff,
            executionMode: 'immediate'
          }
        }, { status: 500 });
      }

    } else {
      // === 큐 모드 (14일 초과) ===
      // 텔레그램으로 안내 메시지만 보내고, 수동 실행 안내
      await sendBackfillNotification(
        client.client_name,
        startDate,
        endDate,
        0,
        0,
        false,
        `기간이 ${daysDiff}일로 길어 수동 실행이 필요합니다. 서버에서 다음 명령어를 실행하세요:\nnode lib/backfill.js ${startDate} ${endDate}`
      );

      return NextResponse.json({
        success: true,
        message: `백필 요청이 접수되었습니다. 기간이 ${daysDiff}일로 길어 서버에서 수동 실행이 필요합니다.`,
        job: {
          clientId,
          clientName: client.client_name,
          startDate,
          endDate,
          status: 'manual_required',
          days: daysDiff,
          executionMode: 'queue',
          instruction: `서버에서 실행: node lib/backfill.js ${startDate} ${endDate}`
        }
      });
    }

  } catch (error: any) {
    console.error('Backfill API error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// 텔레그램 알림 발송
async function sendBackfillNotification(
  clientName: string,
  startDate: string,
  endDate: string,
  recordsFetched: number,
  recordsSaved: number,
  success: boolean,
  errorMessage?: string
): Promise<void> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = '-1003394139746'; // 백필 알림 전용 채널

  if (!botToken) return;

  const emoji = success ? '✅' : '❌';
  const status = success ? '완료' : '실패';

  let message = `${emoji} **[BAS] 백필 ${status}**\n\n`;
  message += `📋 클라이언트: ${clientName}\n`;
  message += `📅 기간: ${startDate} ~ ${endDate}\n`;

  if (success) {
    message += `📊 수집: ${recordsFetched}건\n`;
    message += `💾 저장: ${recordsSaved}건\n`;
  } else if (errorMessage) {
    message += `\n⚠️ ${errorMessage}\n`;
  }

  message += `\n---\n🤖 BAS Meta Ads Analytics`;

  try {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'Markdown'
      })
    });
  } catch (err) {
    console.error('Failed to send telegram notification:', err);
  }
}

// GET: 백필 작업 상태 조회
export async function GET(request: NextRequest) {
  if (!isValidAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('clientId');

    // raw_data에서 클라이언트별 데이터 범위 조회
    let query = supabase
      .from('raw_data')
      .select('client_id, date')
      .order('date', { ascending: false });

    if (clientId) {
      query = query.eq('client_id', clientId);
    }

    const { data, error } = await query.limit(1);

    if (error) {
      throw error;
    }

    // 클라이언트별 최신 수집일 반환
    return NextResponse.json({
      latestDate: data && data.length > 0 ? data[0].date : null,
      clientId: data && data.length > 0 ? data[0].client_id : clientId
    });

  } catch (error: any) {
    console.error('Backfill status API error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
