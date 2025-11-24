require('dotenv').config();
const { Worker } = require('bullmq');
const Redis = require('ioredis');
const { createClient } = require('@supabase/supabase-js');
const { TokenManager } = require('./token-manager');
const fetch = require('node-fetch');

/**
 * ============================================================================
 * Worker - 데이터 수집 작업 처리 (개선 버전)
 * ============================================================================
 *
 * 개선 사항:
 * 1. Meta API 페이지네이션 - 90개 이상 데이터 누락 방지
 * 2. Upstash Redis keepAlive - 연결 끊김 방지
 * 3. 안전한 데이터 접근 - undefined 에러 방지
 * 4. Currency 필드 - 통화 정보 저장
 * 5. 토큰 만료 시나리오 - auth_status 업데이트
 *
 * ============================================================================
 */

// Redis 연결 설정 (Upstash 최적화) ⭐
const connection = new Redis(process.env.UPSTASH_REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  keepAlive: 30000, // 30초마다 keep-alive 패킷 전송 (Upstash 연결 유지)
  family: 0, // IPv4/IPv6 자동 감지
  retryStrategy: (times) => Math.min(times * 50, 2000)
});

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY // Service role (RLS 우회)
);

const tokenManager = new TokenManager(supabase);

// Worker 생성
const worker = new Worker(
  'data-collection',
  async (job) => {
    const { clientId, clientName, adAccountId, weekStart, weekEnd} = job.data;

    console.log(`🔄 Processing: ${clientName} (${job.id})`);
    console.log(`📅 Period: ${weekStart} ~ ${weekEnd}`);

    try {
      // 1. Token 유효성 확인 및 갱신
      const accessToken = await tokenManager.ensureValidToken(clientId);

      // 2. Meta API 호출 (페이지네이션 포함) ⭐
      const insights = await fetchMetaAdsData(adAccountId, accessToken, weekStart, weekEnd);

      console.log(`📊 Fetched ${insights.length} records from Meta API`);

      // 3. Supabase raw_data에 저장
      await saveRawData(clientId, insights);

      // 4. Weekly Summary 생성
      await generateWeeklySummary(clientId, weekStart, weekEnd);

      // 5. 텔레그램 리포트 발송 - 자동 발송 비활성화 (수동 발송만 허용)
      // await sendTelegramReport(clientId, clientName, weekStart, weekEnd);
      console.log(`✅ Completed: ${clientName} (${insights.length} records)`);

      return {
        success: true,
        clientId,
        clientName,
        recordsCount: insights.length,
        completedAt: new Date().toISOString()
      };

    } catch (error) {
      console.error(`❌ Failed: ${clientName}`, error);

      // 토큰 갱신 실패인 경우 auth_status 업데이트 ⭐
      if (error.message.includes('token') || error.message.includes('auth')) {
        await updateAuthStatus(clientId, 'auth_required');
      }

      throw error;
    }
  },
  {
    connection,
    concurrency: 1, // ⚠️ Upstash 무료 티어: 1로 설정 (안정성 우선)
    limiter: {
      max: 10,
      duration: 60000 // 1분에 최대 10개 (Meta API Rate Limit 대비)
    },
    // Upstash Redis Serverless 최적화 설정 ⭐
    settings: {
      stalledInterval: 300000, // 5분마다 stalled job 체크 (기본: 30초)
      guardInterval: 5000, // Delayed jobs 폴링 간격
      drainDelay: 300 // Drained 상태 타임아웃
    },
    lockDuration: 180000, // 3분 (기본: 30초) - 긴 작업 대응
    maxStalledCount: 2 // Stalled 허용 횟수 (기본: 1)
  }
  // 📝 Concurrency 설정 가이드:
  // - 개발/테스트: 1 (Upstash Free Tier 안전 + Stalled 방지)
  // - 운영 (유료): 2-5 (Upstash 유료 플랜 또는 Railway Redis Plugin)
);

/**
 * Meta API 호출 함수 (페이지네이션 포함) ⭐
 */
async function fetchMetaAdsData(adAccountId, accessToken, weekStart, weekEnd) {
  const baseUrl = `https://graph.facebook.com/v22.0/${adAccountId}/insights`;

  const params = new URLSearchParams({
    access_token: accessToken,
    time_range: JSON.stringify({
      since: weekStart,
      until: weekEnd
    }),
    fields: 'ad_id,ad_name,campaign_id,campaign_name,impressions,spend,inline_link_clicks,reach,actions,video_avg_time_watched_actions,cost_per_action_type,account_currency',
    breakdowns: 'publisher_platform,device_platform',
    level: 'ad',
    limit: '90', // 최대 90개씩 가져오기
    time_increment: '1' // 일자별
  });

  let allData = [];
  let nextUrl = `${baseUrl}?${params}`;

  // 페이지네이션 루프 ⭐
  while (nextUrl) {
    const response = await fetch(nextUrl);

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        `Meta API Error: ${errorData.error?.message || response.statusText}`
      );
    }

    const resJson = await response.json();

    // 데이터가 있으면 누적
    if (resJson.data && resJson.data.length > 0) {
      allData = allData.concat(resJson.data);
      console.log(`📦 Fetched ${resJson.data.length} records (Total: ${allData.length})`);
    }

    // 다음 페이지 URL 확인
    nextUrl = resJson.paging?.next || null;

    // Rate Limit 방지를 위한 짧은 대기
    if (nextUrl) {
      await new Promise(resolve => setTimeout(resolve, 200)); // 200ms 대기
    }
  }

  return allData;
}

/**
 * Supabase 저장 함수 (안전한 접근) ⭐
 */
async function saveRawData(clientId, insights) {
  if (!insights || insights.length === 0) {
    console.log('⚠️ No data to save');
    return;
  }

  const records = insights.map(item => ({
    client_id: clientId,
    date: item.date_start,
    ad_id: item.ad_id,
    ad_name: item.ad_name || 'Unknown',
    campaign_id: item.campaign_id,
    campaign_name: item.campaign_name || 'Unknown',
    platform: item.publisher_platform || 'unknown',
    device: item.device_platform || 'unknown',
    currency: item.account_currency || 'KRW', // 통화 정보 ⭐
    impressions: parseInt(item.impressions) || 0,
    reach: parseInt(item.reach) || 0,
    clicks: parseInt(item.inline_link_clicks) || 0,
    leads: getActionValue(item.actions, 'lead'),
    spend: parseFloat(item.spend) || 0,
    video_views: getActionValue(item.actions, 'video_view'),
    avg_watch_time: getVideoAvgTime(item.video_avg_time_watched_actions),
    cost_per_video_view: getCostPerAction(item.cost_per_action_type, 'video_view'),
    cost_per_lead: getCostPerAction(item.cost_per_action_type, 'lead')
  }));

  // Batch insert with ON CONFLICT (Idempotency)
  for (const record of records) {
    const { error } = await supabase
      .from('raw_data')
      .upsert(record, {
        onConflict: 'client_id,date,ad_id,platform,device'
      });

    if (error) {
      console.error('Failed to insert record:', error);
      throw error;
    }
  }

  console.log(`💾 Saved ${records.length} records to raw_data`);
}

/**
 * Weekly Summary 생성 함수
 */
async function generateWeeklySummary(clientId, weekStart, weekEnd) {
  const { error } = await supabase.rpc('generate_weekly_summary', {
    p_client_id: clientId,
    p_week_start: weekStart,
    p_week_end: weekEnd
  });

  if (error) {
    console.error('Failed to generate weekly summary:', error);
    throw new Error(`Failed to generate weekly summary: ${error.message}`);
  }

  console.log(`📊 Weekly summary generated: ${weekStart} ~ ${weekEnd}`);
}

/**
 * 헬퍼 함수: actions 배열에서 특정 action_type 값 추출 (안전한 접근) ⭐
 */
function getActionValue(actions, actionType) {
  if (!actions || !Array.isArray(actions)) return 0;
  const action = actions.find(a => a.action_type === actionType);
  return action ? parseInt(action.value) || 0 : 0;
}

/**
 * 헬퍼 함수: 평균 시청 시간 추출 (안전한 접근) ⭐
 */
function getVideoAvgTime(videoActions) {
  if (!videoActions || !Array.isArray(videoActions)) return 0;
  const action = videoActions.find(a => a.action_type === 'video_view');
  return action ? parseFloat(action.value) || 0 : 0;
}

/**
 * 헬퍼 함수: Cost Per Action 추출 (안전한 접근) ⭐
 */
function getCostPerAction(costPerActionType, actionType) {
  if (!costPerActionType || !Array.isArray(costPerActionType)) return 0;
  const cost = costPerActionType.find(c => c.action_type === actionType);
  return cost ? parseFloat(cost.value) || 0 : 0;
}

/**
 * Auth Status 업데이트 (토큰 갱신 실패 시) ⭐
 */
async function updateAuthStatus(clientId, status) {
  const { error } = await supabase
    .from('clients')
    .update({
      auth_status: status,
      updated_at: new Date().toISOString()
    })
    .eq('id', clientId);

  if (error) {
    console.error('Failed to update auth status:', error);
  } else {
    console.log(`🔐 Auth status updated to '${status}' for client ${clientId}`);
  }
}

/**
 * Telegram Report 발송 ⭐ NEW
 */
async function sendTelegramReport(clientId, clientName, weekStart, weekEnd) {
  try {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID;

    if (!botToken || !chatId) {
      console.log("⚠️ Telegram credentials not set, skipping report");
      return;
    }

    // Supabase에서 주간 요약 데이터 조회
    const { data, error } = await supabase
      .from("weekly_summary")
      .select("*")
      .eq("client_id", clientId)
      .eq("week_start", weekStart)
      .eq("week_end", weekEnd);

    if (error || !data || data.length === 0) {
      console.log("⚠️ No data for telegram report");
      return;
    }

    // 데이터 집계
    const total = data.reduce((acc, d) => ({
      impressions: acc.impressions + (d.total_impressions || 0),
      clicks: acc.clicks + (d.total_clicks || 0),
      spend: acc.spend + (d.total_spend || 0),
      leads: acc.leads + (d.total_leads || 0)
    }), { impressions: 0, clicks: 0, spend: 0, leads: 0 });

    const ctr = total.impressions > 0 ? (total.clicks / total.impressions * 100) : 0;
    const cpl = total.leads > 0 ? (total.spend / total.leads) : 0;

    // 메시지 구성
    const message = `
📊 **[BAS] ${clientName} 주간 리포트**
기간: ${weekStart} ~ ${weekEnd}

**📈 핵심 성과 요약**
• 노출수: ${total.impressions.toLocaleString()}회
• 클릭수: ${total.clicks}회
• 지출: $${total.spend.toFixed(2)}
• 리드: ${total.leads}건
• CPL: $${cpl.toFixed(2)}
• CTR: ${ctr.toFixed(2)}%

---
🤖 BAS Meta Ads Analytics
    `;

    // Telegram API 호출
    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: "Markdown"
        })
      }
    );

    if (response.ok) {
      console.log("📱 Telegram report sent successfully");
    } else {
      const errorText = await response.text();
      console.error("❌ Failed to send telegram report:", errorText);
    }
  } catch (error) {
    console.error("❌ Telegram report error:", error.message);
  }
}

// Worker 이벤트 핸들러
worker.on('completed', (job, result) => {
  console.log(`🎉 Job ${job.id} completed:`, result);
});

worker.on('failed', (job, error) => {
  console.error(`💥 Job ${job.id} failed:`, error.message);
});

worker.on('error', (error) => {
  console.error('⚠️ Worker error:', error);
});

console.log('👷 Worker started (concurrency: 2, rate limit: 10/min)');
console.log('🔌 Connected to Upstash Redis with keepAlive enabled');
console.log('⚠️  Upstash Free Tier: 일 10,000 커맨드 제한 (모니터링 필요)');
console.log('👀 Waiting for jobs from queue: data-collection');

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('📴 Gracefully closing worker...');
  await worker.close();
  process.exit(0);
});

module.exports = worker;
