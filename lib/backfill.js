require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { TokenManager } = require('./token-manager');
const { syncAndVerify } = require('./data-integrity');
const fetch = require('node-fetch');

/**
 * ============================================================================
 * Backfill Script - Meta Ads 과거 데이터 수집
 * ============================================================================
 *
 * 목적: 2025년 1월~10월 Meta Ads 데이터를 raw_data에 수집
 *
 * 사용법:
 * - 전체 실행 (1월~10월): node lib/backfill.js
 * - 특정 월만 실행: node lib/backfill.js 2025-09-01 2025-09-30
 *
 * 주요 기능:
 * - 월별 순차 실행 (1월부터 10월까지)
 * - 안전한 Rate Limit 처리 (API 호출 간 200ms 대기)
 * - Exponential backoff 재시도
 * - 진행 상황 로그 및 텔레그램 알림
 * - raw_data 저장 (upsert)
 * - 월별 완료 후 generate_weekly_summary RPC 호출
 *
 * ============================================================================
 */

// Supabase 클라이언트
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const tokenManager = new TokenManager(supabase);

// 통계 추적 객체
const stats = {
  totalRecords: 0,
  monthlyRecords: {},
  errors: [],
  startTime: new Date()
};

/**
 * 메인 함수
 */
async function main() {
  console.log('🚀 BAS Meta Ads Backfill Script');
  console.log('=' .repeat(60));

  // 1. 명령줄 인자 확인
  const args = process.argv.slice(2);

  let periods = [];

  if (args.length === 2) {
    // 특정 기간 지정
    const [startDate, endDate] = args;
    console.log(`📅 Custom period: ${startDate} ~ ${endDate}\n`);
    periods.push({ start: startDate, end: endDate });
  } else {
    // 기본: 1월~10월
    console.log('📅 Default period: 2025-01-01 ~ 2025-10-31\n');
    periods = generateMonthlyPeriods('2025-01-01', '2025-10-31');
  }

  console.log(`📊 Total periods to process: ${periods.length}\n`);

  // 2. 클라이언트 정보 조회
  // ⭐ OAuth 하이브리드 지원: manual 또는 (oauth AND status=active)
  const { data: clients, error: clientError } = await supabase
    .from('clients')
    .select('id, client_name, meta_ad_account_id, auth_status, auth_type, status')
    .eq('auth_status', 'active')
    .eq('is_active', true)
    .or('auth_type.eq.manual,and(auth_type.eq.oauth,status.eq.active)');

  if (clientError || !clients || clients.length === 0) {
    console.error('❌ No active clients found');
    process.exit(1);
  }

  console.log(`👥 Found ${clients.length} active client(s):\n`);
  clients.forEach(client => {
    console.log(`   - ${client.client_name} (${client.id})`);
  });
  console.log();

  // 3. 각 클라이언트별로 백필 실행
  for (const client of clients) {
    console.log('='.repeat(60));
    console.log(`🔄 Processing client: ${client.client_name}`);
    console.log('='.repeat(60));

    await backfillClient(client, periods);
  }

  // 4. 최종 리포트
  await printFinalReport();

  // 5. 텔레그램 알림
  await sendTelegramNotification();

  console.log('\n✅ Backfill completed successfully!');
  process.exit(0);
}

/**
 * 클라이언트별 백필 실행
 */
async function backfillClient(client, periods) {
  const { id: clientId, client_name: clientName, meta_ad_account_id: adAccountId } = client;

  stats.monthlyRecords[clientName] = {};

  try {
    // 1. 토큰 유효성 확인
    const accessToken = await tokenManager.ensureValidToken(clientId);

    // 2. 각 기간별로 데이터 수집
    for (let i = 0; i < periods.length; i++) {
      const { start, end } = periods[i];

      console.log(`\n📦 [${i + 1}/${periods.length}] Fetching ${start} ~ ${end}...`);

      try {
        // Meta API 호출 (페이지네이션 포함)
        const insights = await fetchMetaAdsData(
          adAccountId,
          accessToken,
          start,
          end
        );

        console.log(`   ✓ Fetched ${insights.length} records`);

        // raw_data에 저장
        if (insights.length > 0) {
          await saveRawData(clientId, insights);
          console.log(`   ✓ Saved ${insights.length} records to raw_data`);
        } else {
          console.log(`   ⚠️  No data for this period`);
        }

        // 통계 업데이트
        const monthKey = start.substring(0, 7); // YYYY-MM
        stats.monthlyRecords[clientName][monthKey] =
          (stats.monthlyRecords[clientName][monthKey] || 0) + insights.length;
        stats.totalRecords += insights.length;

        // Rate Limit 방지 (200ms 대기)
        if (i < periods.length - 1) {
          await sleep(200);
        }

      } catch (error) {
        console.error(`   ❌ Error fetching ${start} ~ ${end}:`, error.message);
        stats.errors.push({
          client: clientName,
          period: `${start} ~ ${end}`,
          error: error.message
        });

        // Exponential backoff 재시도
        await retryWithBackoff(
          async () => {
            const insights = await fetchMetaAdsData(adAccountId, accessToken, start, end);
            if (insights.length > 0) {
              await saveRawData(clientId, insights);
            }
            return insights;
          },
          3 // 최대 3회 재시도
        );
      }
    }

    // 3. Weekly Summary 생성 (전체 기간)
    console.log(`\n📊 Generating weekly summaries for ${clientName}...`);
    await generateWeeklySummariesForClient(clientId, periods);
    console.log(`   ✓ Weekly summaries generated`);

    // 4. Daily Aggregates 동기화 (P1-2: 백필 프로세스 완성)
    console.log(`\n🔄 Syncing daily_aggregates for ${clientName}...`);
    for (const { start, end } of periods) {
      try {
        await syncAndVerify(clientId, start, end);
      } catch (syncError) {
        console.error(`   ⚠️ Sync failed for ${start} ~ ${end}:`, syncError.message);
      }
    }
    console.log(`   ✓ Daily aggregates synced`);

  } catch (error) {
    console.error(`❌ Failed to process client ${clientName}:`, error.message);
    stats.errors.push({
      client: clientName,
      period: 'All',
      error: error.message
    });
  }
}

/**
 * Meta API 호출 함수 (페이지네이션 포함) - worker.js에서 복사
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
    limit: '90',
    time_increment: '1'
  });

  let allData = [];
  let nextUrl = `${baseUrl}?${params}`;
  let pageCount = 0;

  // 페이지네이션 루프
  while (nextUrl) {
    pageCount++;
    const response = await fetch(nextUrl);

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        `Meta API Error: ${errorData.error?.message || response.statusText}`
      );
    }

    const resJson = await response.json();

    if (resJson.data && resJson.data.length > 0) {
      allData = allData.concat(resJson.data);
      console.log(`      Page ${pageCount}: ${resJson.data.length} records (Total: ${allData.length})`);
    }

    nextUrl = resJson.paging?.next || null;

    // Rate Limit 방지
    if (nextUrl) {
      await sleep(200);
    }
  }

  return allData;
}

/**
 * raw_data에 저장 (worker.js에서 복사)
 */
async function saveRawData(clientId, insights) {
  if (!insights || insights.length === 0) {
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
    currency: item.account_currency || 'KRW',
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

  // Batch upsert
  for (const record of records) {
    const { error } = await supabase
      .from('raw_data')
      .upsert(record, {
        onConflict: 'client_id,date,ad_id,platform,device'
      });

    if (error) {
      console.error('      ⚠️  Failed to insert record:', error.message);
    }
  }
}

/**
 * Weekly Summary 생성 (클라이언트별 전체 기간)
 */
async function generateWeeklySummariesForClient(clientId, periods) {
  // 기간을 주 단위로 분할
  const allDates = [];

  periods.forEach(({ start, end }) => {
    const startDate = new Date(start);
    const endDate = new Date(end);

    let current = new Date(startDate);
    while (current <= endDate) {
      allDates.push(current.toISOString().split('T')[0]);
      current.setDate(current.getDate() + 1);
    }
  });

  // 고유한 날짜만 추출
  const uniqueDates = [...new Set(allDates)].sort();

  if (uniqueDates.length === 0) return;

  const firstDate = uniqueDates[0];
  const lastDate = uniqueDates[uniqueDates.length - 1];

  // 주 단위로 분할
  const weeklyPeriods = [];
  let weekStart = new Date(firstDate);

  while (weekStart <= new Date(lastDate)) {
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);

    if (weekEnd > new Date(lastDate)) {
      weeklyPeriods.push({
        start: weekStart.toISOString().split('T')[0],
        end: lastDate
      });
      break;
    }

    weeklyPeriods.push({
      start: weekStart.toISOString().split('T')[0],
      end: weekEnd.toISOString().split('T')[0]
    });

    weekStart.setDate(weekStart.getDate() + 7);
  }

  // 각 주별로 Summary 생성
  for (const { start, end } of weeklyPeriods) {
    const { error } = await supabase.rpc('generate_weekly_summary', {
      p_client_id: clientId,
      p_week_start: start,
      p_week_end: end
    });

    if (error) {
      console.error(`      ⚠️  Failed to generate summary for ${start} ~ ${end}:`, error.message);
    } else {
      console.log(`      ✓ Summary generated: ${start} ~ ${end}`);
    }
  }
}

/**
 * 월별 기간 생성 (YYYY-MM-01 ~ YYYY-MM-말일)
 */
function generateMonthlyPeriods(startDate, endDate) {
  const periods = [];
  const start = new Date(startDate);
  const end = new Date(endDate);

  let current = new Date(start.getFullYear(), start.getMonth(), 1);

  while (current <= end) {
    const monthStart = new Date(current.getFullYear(), current.getMonth(), 1);
    const monthEnd = new Date(current.getFullYear(), current.getMonth() + 1, 0);

    // 시작일과 종료일 범위 제한
    if (monthStart < start) {
      monthStart.setTime(start.getTime());
    }
    if (monthEnd > end) {
      monthEnd.setTime(end.getTime());
    }

    periods.push({
      start: monthStart.toISOString().split('T')[0],
      end: monthEnd.toISOString().split('T')[0]
    });

    current.setMonth(current.getMonth() + 1);
  }

  return periods;
}

/**
 * Exponential Backoff 재시도
 */
async function retryWithBackoff(fn, maxRetries = 3, baseDelay = 1000) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) {
        throw error;
      }

      const delay = baseDelay * Math.pow(2, i);
      console.log(`      🔄 Retrying in ${delay}ms... (${i + 1}/${maxRetries})`);
      await sleep(delay);
    }
  }
}

/**
 * 최종 리포트 출력
 */
async function printFinalReport() {
  const duration = ((new Date() - stats.startTime) / 1000).toFixed(2);

  console.log('\n' + '='.repeat(60));
  console.log('📊 BACKFILL FINAL REPORT');
  console.log('='.repeat(60));

  console.log(`\n⏱️  Duration: ${duration}s`);
  console.log(`📦 Total Records: ${stats.totalRecords.toLocaleString()}`);

  console.log(`\n📅 Monthly Breakdown:`);
  Object.entries(stats.monthlyRecords).forEach(([clientName, months]) => {
    console.log(`\n   ${clientName}:`);
    Object.entries(months).forEach(([month, count]) => {
      console.log(`      ${month}: ${count.toLocaleString()} records`);
    });
  });

  if (stats.errors.length > 0) {
    console.log(`\n⚠️  Errors (${stats.errors.length}):`);
    stats.errors.forEach(({ client, period, error }) => {
      console.log(`   - ${client} [${period}]: ${error}`);
    });
  } else {
    console.log(`\n✅ No errors!`);
  }

  // 데이터 검증: 누락된 날짜 확인
  console.log(`\n🔍 Data Validation:`);
  await validateData();
}

/**
 * 데이터 검증: 누락된 날짜 확인
 */
async function validateData() {
  const { data: clients } = await supabase
    .from('clients')
    .select('id, client_name');

  for (const client of clients) {
    const { data: dates } = await supabase
      .from('raw_data')
      .select('date')
      .eq('client_id', client.id)
      .order('date', { ascending: true });

    if (!dates || dates.length === 0) {
      console.log(`   ⚠️  ${client.client_name}: No data found`);
      continue;
    }

    const uniqueDates = [...new Set(dates.map(d => d.date))];
    const firstDate = new Date(uniqueDates[0]);
    const lastDate = new Date(uniqueDates[uniqueDates.length - 1]);

    const expectedDays = Math.floor((lastDate - firstDate) / (1000 * 60 * 60 * 24)) + 1;
    const actualDays = uniqueDates.length;

    if (expectedDays === actualDays) {
      console.log(`   ✓ ${client.client_name}: Complete (${actualDays} days)`);
    } else {
      console.log(`   ⚠️  ${client.client_name}: Missing ${expectedDays - actualDays} day(s)`);
      console.log(`      Expected: ${expectedDays}, Actual: ${actualDays}`);
    }
  }
}

/**
 * 텔레그램 알림 발송
 */
async function sendTelegramNotification() {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  // 백필 알림은 관리자 전용 채팅방으로 (클라이언트에게 안 보이게)
  const chatId = '-1003394139746';

  if (!botToken || !chatId) {
    console.log('\n⚠️  Telegram credentials not set, skipping notification');
    return;
  }

  const duration = ((new Date() - stats.startTime) / 1000 / 60).toFixed(1);

  let message = `📊 **[BAS] Backfill Completed**\n\n`;
  message += `⏱️ Duration: ${duration} minutes\n`;
  message += `📦 Total Records: ${stats.totalRecords.toLocaleString()}\n\n`;

  message += `**Monthly Breakdown:**\n`;
  Object.entries(stats.monthlyRecords).forEach(([clientName, months]) => {
    const total = Object.values(months).reduce((sum, count) => sum + count, 0);
    message += `• ${clientName}: ${total.toLocaleString()} records\n`;
    Object.entries(months).forEach(([month, count]) => {
      message += `  - ${month}: ${count.toLocaleString()}\n`;
    });
  });

  if (stats.errors.length > 0) {
    message += `\n⚠️ Errors: ${stats.errors.length}\n`;
  } else {
    message += `\n✅ No errors!\n`;
  }

  message += `\n---\n🤖 BAS Meta Ads Analytics`;

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: 'Markdown'
        })
      }
    );

    if (response.ok) {
      console.log('\n📱 Telegram notification sent successfully');
    } else {
      const error = await response.text();
      console.error('\n❌ Failed to send Telegram notification:', error);
    }
  } catch (error) {
    console.error('\n❌ Telegram error:', error.message);
  }
}

/**
 * 헬퍼 함수들 (worker.js에서 복사)
 */
function getActionValue(actions, actionType) {
  if (!actions || !Array.isArray(actions)) return 0;
  const action = actions.find(a => a.action_type === actionType);
  return action ? parseInt(action.value) || 0 : 0;
}

function getVideoAvgTime(videoActions) {
  if (!videoActions || !Array.isArray(videoActions)) return 0;
  const action = videoActions.find(a => a.action_type === 'video_view');
  return action ? parseFloat(action.value) || 0 : 0;
}

function getCostPerAction(costPerActionType, actionType) {
  if (!costPerActionType || !Array.isArray(costPerActionType)) return 0;
  const cost = costPerActionType.find(c => c.action_type === actionType);
  return cost ? parseFloat(cost.value) || 0 : 0;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 에러 핸들링
process.on('unhandledRejection', (error) => {
  console.error('\n💥 Unhandled rejection:', error);
  process.exit(1);
});

// 실행
main().catch((error) => {
  console.error('\n💥 Fatal error:', error);
  process.exit(1);
});
