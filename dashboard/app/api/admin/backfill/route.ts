/**
 * Admin API - 백필 실행 (SSE 실시간 로그)
 *
 * POST: 백필 실행 (Server-Sent Events로 실시간 로그 스트리밍)
 *       90일 초과 시 30일 단위로 자동 분할
 *
 * SSE 이벤트 타입:
 *   - log: 일반 로그 메시지
 *   - progress: 진행률 업데이트
 *   - complete: 작업 완료
 *   - error: 오류 발생
 */

import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { decrypt } from '@/lib/encryption';

// 관리자 키 검증
function isAdmin(request: NextRequest): boolean {
  const adminKey = request.headers.get('x-admin-key');
  return adminKey === process.env.NEXT_PUBLIC_ADMIN_KEY;
}

// 날짜 포맷 (YYYY-MM-DD)
function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

// 현재 시간 포맷 (HH:MM:SS)
function formatTime(): string {
  return new Date().toLocaleTimeString('ko-KR', { hour12: false });
}

// 기간을 30일 단위로 분할
function splitDateRange(startDate: string, endDate: string): Array<{ start: string; end: string }> {
  const ranges: Array<{ start: string; end: string }> = [];
  const start = new Date(startDate);
  const end = new Date(endDate);

  let current = new Date(start);

  while (current < end) {
    const rangeEnd = new Date(current);
    rangeEnd.setDate(rangeEnd.getDate() + 29); // 30일 단위

    if (rangeEnd > end) {
      rangeEnd.setTime(end.getTime());
    }

    ranges.push({
      start: formatDate(current),
      end: formatDate(rangeEnd),
    });

    current = new Date(rangeEnd);
    current.setDate(current.getDate() + 1);
  }

  return ranges;
}

// actions 배열에서 특정 action_type 값 추출
function getActionValue(actions: any[], actionType: string): number {
  if (!actions || !Array.isArray(actions)) return 0;
  const action = actions.find((a: any) => a.action_type === actionType);
  return action ? parseInt(action.value) || 0 : 0;
}

// Meta API 호출
async function fetchMetaInsights(
  adAccountId: string,
  accessToken: string,
  startDate: string,
  endDate: string,
  onLog: (message: string, type: string) => void
): Promise<any[]> {
  const baseUrl = `https://graph.facebook.com/v22.0/${adAccountId}/insights`;

  const params = new URLSearchParams({
    access_token: accessToken,
    time_range: JSON.stringify({ since: startDate, until: endDate }),
    fields:
      'ad_id,ad_name,campaign_id,campaign_name,impressions,spend,inline_link_clicks,reach,actions,account_currency',
    breakdowns: 'publisher_platform,device_platform',
    level: 'ad',
    limit: '500',
    time_increment: '1',
  });

  let allData: any[] = [];
  let nextUrl: string | null = `${baseUrl}?${params}`;
  let pageCount = 0;

  while (nextUrl) {
    pageCount++;
    const response: Response = await fetch(nextUrl);

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Meta API Error: ${errorData.error?.message || response.statusText}`);
    }

    const resJson = await response.json();

    if (resJson.data && resJson.data.length > 0) {
      allData = allData.concat(resJson.data);
      onLog(`페이지 ${pageCount}: ${resJson.data.length}개 레코드 수신`, 'info');
    }

    nextUrl = resJson.paging?.next || null;

    if (nextUrl) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  return allData;
}

// raw_data에 저장
async function saveRawData(
  clientId: string,
  insights: any[],
  onLog: (message: string, type: string) => void
): Promise<number> {
  if (!insights || insights.length === 0) return 0;

  const records = insights.map((item) => ({
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
  }));

  let savedCount = 0;
  const batchSize = 50;
  const totalBatches = Math.ceil(records.length / batchSize);

  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    const batchNum = Math.floor(i / batchSize) + 1;

    const { error } = await supabaseAdmin
      .from('raw_data')
      .upsert(batch, { onConflict: 'client_id,date,ad_id,platform,device' });

    if (error) {
      onLog(`배치 ${batchNum}/${totalBatches} 저장 실패: ${error.message}`, 'warning');
    } else {
      savedCount += batch.length;
      const progress = Math.round((batchNum / totalBatches) * 100);
      onLog(`저장 중... ${progress}% (${savedCount}/${records.length}건)`, 'info');
    }
  }

  return savedCount;
}

// 텔레그램 알림 발송
async function sendTelegramNotification(
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
        parse_mode: 'Markdown',
      }),
    });
  } catch (err) {
    console.error('Failed to send telegram notification:', err);
  }
}

// POST: 백필 실행 (SSE)
export async function POST(request: NextRequest) {
  if (!isAdmin(request)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await request.json();
    const { clientId, days, startDate: customStart, endDate: customEnd } = body;

    if (!clientId) {
      return new Response(JSON.stringify({ error: 'clientId is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 날짜 범위 결정
    let startDate: string;
    let endDate: string;

    if (customStart && customEnd) {
      startDate = customStart;
      endDate = customEnd;
    } else {
      const requestDays = days || 90;
      const end = new Date();
      end.setDate(end.getDate() - 1); // 어제까지
      const start = new Date(end);
      start.setDate(start.getDate() - (requestDays - 1));

      startDate = formatDate(start);
      endDate = formatDate(end);
    }

    // 클라이언트 정보 확인
    const { data: client, error: clientError } = await supabaseAdmin
      .from('clients')
      .select('id, client_name, meta_ad_account_id, encrypted_access_token')
      .eq('id', clientId)
      .single();

    if (clientError || !client) {
      return new Response(JSON.stringify({ error: '클라이언트를 찾을 수 없습니다.' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!client.meta_ad_account_id) {
      return new Response(JSON.stringify({ error: 'Meta 광고계정 ID가 설정되지 않았습니다.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 토큰 복호화
    const accessToken = decrypt(client.encrypted_access_token);
    if (!accessToken) {
      return new Response(
        JSON.stringify({ error: 'Access Token이 설정되지 않았거나 복호화에 실패했습니다.' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // 기간 분할 (90일 초과 시 30일 단위)
    const totalDays = Math.ceil(
      (new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)
    );
    const dateRanges = totalDays > 90 ? splitDateRange(startDate, endDate) : [{ start: startDate, end: endDate }];

    // SSE 스트림 생성
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const sendEvent = (event: string, data: any) => {
          const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(encoder.encode(message));
        };

        const sendLog = (message: string, type: string = 'info') => {
          sendEvent('log', { time: formatTime(), type, message });
        };

        try {
          sendLog(`🔍 ${client.client_name} 백필 시작`, 'info');
          sendLog(`📅 기간: ${startDate} ~ ${endDate} (${totalDays}일)`, 'info');

          if (dateRanges.length > 1) {
            sendLog(`⚠️ 90일 초과 - ${dateRanges.length}개 구간으로 분할 실행`, 'warning');
          }

          let totalFetched = 0;
          let totalSaved = 0;

          for (let i = 0; i < dateRanges.length; i++) {
            const range = dateRanges[i];
            const rangeNum = i + 1;

            sendLog(`\n📡 [${rangeNum}/${dateRanges.length}] ${range.start} ~ ${range.end} 수집 중...`, 'info');
            sendEvent('progress', {
              current: rangeNum,
              total: dateRanges.length,
              phase: 'fetching',
              range,
            });

            // Meta API 호출
            const insights = await fetchMetaInsights(
              client.meta_ad_account_id,
              accessToken,
              range.start,
              range.end,
              sendLog
            );

            sendLog(`📊 ${insights.length}개 레코드 수신`, 'success');
            totalFetched += insights.length;

            // 저장
            if (insights.length > 0) {
              sendLog(`💾 저장 시작...`, 'info');
              sendEvent('progress', {
                current: rangeNum,
                total: dateRanges.length,
                phase: 'saving',
                records: insights.length,
              });

              const savedCount = await saveRawData(clientId, insights, sendLog);
              totalSaved += savedCount;
              sendLog(`✅ ${savedCount}건 저장 완료`, 'success');
            } else {
              sendLog(`⚠️ 해당 기간 데이터 없음`, 'warning');
            }

            // 구간 간 대기
            if (i < dateRanges.length - 1) {
              sendLog(`⏳ 다음 구간 대기 중...`, 'info');
              await new Promise((resolve) => setTimeout(resolve, 1000));
            }
          }

          // 완료
          sendLog(`\n🎉 백필 완료!`, 'success');
          sendLog(`📊 총 수집: ${totalFetched}건`, 'info');
          sendLog(`💾 총 저장: ${totalSaved}건`, 'info');

          sendEvent('complete', {
            success: true,
            totalRecords: totalFetched,
            savedRecords: totalSaved,
            duration: `${dateRanges.length}개 구간 처리`,
            startDate,
            endDate,
          });

          // 텔레그램 알림
          await sendTelegramNotification(
            client.client_name,
            startDate,
            endDate,
            totalFetched,
            totalSaved,
            true
          );
        } catch (error: any) {
          console.error('Backfill error:', error);
          sendLog(`❌ 오류 발생: ${error.message}`, 'error');
          sendEvent('error', { message: error.message });

          // 실패 알림
          await sendTelegramNotification(
            client.client_name,
            startDate,
            endDate,
            0,
            0,
            false,
            error.message
          );
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error: any) {
    console.error('Backfill API error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// GET: 백필 가능 여부 확인
export async function GET(request: NextRequest) {
  if (!isAdmin(request)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get('clientId');

  if (!clientId) {
    return new Response(JSON.stringify({ error: 'clientId is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    // 클라이언트 정보 확인
    const { data: client, error } = await supabaseAdmin
      .from('clients')
      .select('id, client_name, meta_ad_account_id, encrypted_access_token')
      .eq('id', clientId)
      .single();

    if (error || !client) {
      return new Response(JSON.stringify({ canBackfill: false, error: '클라이언트를 찾을 수 없습니다.' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const hasAccountId = !!client.meta_ad_account_id;
    const hasToken = !!client.encrypted_access_token;

    // 최신 데이터 날짜
    const { data: latestData } = await supabaseAdmin
      .from('raw_data')
      .select('date')
      .eq('client_id', clientId)
      .order('date', { ascending: false })
      .limit(1);

    return new Response(
      JSON.stringify({
        canBackfill: hasAccountId && hasToken,
        client: {
          id: client.id,
          name: client.client_name,
          hasAccountId,
          hasToken,
          latestDataDate: latestData?.[0]?.date || null,
        },
        missingRequirements: [
          ...(!hasAccountId ? ['Meta 광고계정 ID'] : []),
          ...(!hasToken ? ['Access Token'] : []),
        ],
      }),
      {
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message || 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
