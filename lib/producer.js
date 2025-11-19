require('dotenv').config();
const { Queue } = require('bullmq');
const { createClient } = require('@supabase/supabase-js');
const Redis = require('ioredis');

const connection = new Redis(process.env.UPSTASH_REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  keepAlive: 30000, // ⭐ v1.2: Upstash Serverless 연결 유지 (30초)
  family: 0 // ⭐ v1.2: IPv4/IPv6 자동 감지
});

const dataCollectionQueue = new Queue('data-collection', { connection });

/**
 * 날짜 계산 함수 (Timezone 명시) ⭐ 개선
 */
function getLastWeekDates() {
  const now = new Date();

  // Asia/Seoul 기준으로 변환
  const kstNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));

  // 지난주 월요일 (ISO Week 기준)
  const dayOfWeek = kstNow.getDay();
  const daysToLastMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // 일요일(0) 처리
  const lastMonday = new Date(kstNow);
  lastMonday.setDate(kstNow.getDate() - daysToLastMonday - 7);

  // 지난주 일요일
  const lastSunday = new Date(lastMonday);
  lastSunday.setDate(lastMonday.getDate() + 6);

  return {
    start: lastMonday.toISOString().split('T')[0],
    end: lastSunday.toISOString().split('T')[0]
  };
}

/**
 * Producer 실행 상태 관리 ⭐ 신규
 */
class ProducerExecutionTracker {
  constructor(supabase) {
    this.supabase = supabase;
    this.executionId = null;
  }

  async start(clientCount) {
    // 실행 시작 로그 저장
    const { data, error } = await this.supabase
      .from('producer_executions') // 새 테이블 필요
      .insert({
        started_at: new Date().toISOString(),
        total_clients: clientCount,
        status: 'running'
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to create execution tracker:', error);
      return null;
    }

    this.executionId = data.id;
    console.log(`🏁 Execution tracker created: ${this.executionId}`);
    return this.executionId;
  }

  async updateProgress(enqueuedCount) {
    if (!this.executionId) return;

    await this.supabase
      .from('producer_executions')
      .update({
        enqueued_count: enqueuedCount,
        updated_at: new Date().toISOString()
      })
      .eq('id', this.executionId);
  }

  async complete(successCount, failedCount) {
    if (!this.executionId) return;

    await this.supabase
      .from('producer_executions')
      .update({
        status: 'completed',
        enqueued_count: successCount,
        failed_count: failedCount,
        completed_at: new Date().toISOString()
      })
      .eq('id', this.executionId);

    console.log(`✅ Execution completed: ${successCount} enqueued, ${failedCount} failed`);
  }

  async fail(error) {
    if (!this.executionId) return;

    await this.supabase
      .from('producer_executions')
      .update({
        status: 'failed',
        error_message: error.message,
        failed_at: new Date().toISOString()
      })
      .eq('id', this.executionId);

    console.error(`💥 Execution failed: ${error.message}`);
  }
}

/**
 * 메인 Producer 함수 (개선) ⭐
 */
async function enqueueDataCollectionJobs() {
  console.log('🚀 Starting data collection job enqueuing...');

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );

  const tracker = new ProducerExecutionTracker(supabase);

  let enqueuedCount = 0;
  let failedCount = 0;

  try {
    // 1. 활성 클라이언트 조회
    const { data: clients, error } = await supabase
      .from('clients')
      .select('id, client_id, client_name, meta_ad_account_id')
      .eq('is_active', true)
      .order('client_id');

    if (error) {
      throw new Error(`Failed to fetch clients: ${error.message}`);
    }

    console.log(`📋 Found ${clients.length} active clients`);

    // 2. Execution Tracker 시작
    await tracker.start(clients.length);

    // 3. 지난주 날짜 계산 (Timezone 명시)
    const { start: weekStart, end: weekEnd } = getLastWeekDates();
    console.log(`📅 Target period: ${weekStart} ~ ${weekEnd} (KST)`);

    // 4. 각 클라이언트별로 Job 생성 (Staggering 적용)
    const totalClients = clients.length;

    for (let i = 0; i < totalClients; i++) {
      const client = clients[i];

      try {
        // Staggering: 0~10분 시차 분산
        const delayMs = Math.floor((i * 10 * 60 * 1000) / Math.max(totalClients, 1));

        await dataCollectionQueue.add(
          'collect-data',
          {
            clientId: client.id,
            clientName: client.client_name,
            adAccountId: client.meta_ad_account_id,
            weekStart,
            weekEnd
          },
          {
            jobId: `collect-${client.id}-${weekStart}-${Date.now()}`, // 타임스탬프로 중복 방지 ⭐
            attempts: 3,
            backoff: {
              type: 'exponential',
              delay: 2000
            },
            delay: delayMs,
            removeOnComplete: {
              age: 86400 * 7, // 7일 후 삭제
              count: 1000      // 최대 1000개 보관
            },
            removeOnFail: false // 실패 작업은 무기한 보관
          }
        );

        enqueuedCount++;
        console.log(
          `  ✅ [${enqueuedCount}/${totalClients}] ${client.client_name} ` +
          `(delay: ${Math.round(delayMs / 1000)}s)`
        );

        // 진행률 업데이트 (10개마다)
        if (enqueuedCount % 10 === 0) {
          await tracker.updateProgress(enqueuedCount);
        }

      } catch (enqueueError) {
        failedCount++;
        console.error(
          `  ❌ [${i + 1}/${totalClients}] Failed to enqueue ${client.client_name}:`,
          enqueueError.message
        );

        // 개별 실패는 기록하고 계속 진행 (전체 중단하지 않음)
        await supabase
          .from('producer_errors')
          .insert({
            execution_id: tracker.executionId,
            client_id: client.id,
            error_message: enqueueError.message,
            created_at: new Date().toISOString()
          });
      }
    }

    // 5. 최종 완료
    await tracker.complete(enqueuedCount, failedCount);

    console.log('\n' + '='.repeat(60));
    console.log('🎉 Enqueuing completed!');
    console.log(`   Total clients: ${totalClients}`);
    console.log(`   ✅ Enqueued: ${enqueuedCount}`);
    console.log(`   ❌ Failed: ${failedCount}`);
    console.log(`   📅 Period: ${weekStart} ~ ${weekEnd}`);
    console.log('='.repeat(60));

    // 6. 실패가 있으면 Admin 알림
    if (failedCount > 0) {
      await sendAdminAlert(
        `⚠️ Producer completed with ${failedCount} failures`,
        `Total: ${totalClients}, Enqueued: ${enqueuedCount}, Failed: ${failedCount}`
      );
    }

    return {
      success: true,
      total: totalClients,
      enqueued: enqueuedCount,
      failed: failedCount
    };

  } catch (error) {
    // 전체 실패
    await tracker.fail(error);

    console.error('\n' + '='.repeat(60));
    console.error('💥 Producer failed!');
    console.error('   Error:', error.message);
    console.error('   Stack:', error.stack);
    console.error('='.repeat(60));

    // Admin 알림
    await sendAdminAlert(
      '🚨 Producer FAILED',
      `Error: ${error.message}\n\nEnqueued before failure: ${enqueuedCount}`
    );

    throw error;
  }
}

/**
 * Admin 알림 함수
 */
async function sendAdminAlert(title, message) {
  const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN;
  const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID;

  if (!telegramBotToken || !adminChatId) {
    console.log('⚠️ Telegram credentials not set, skipping admin alert');
    return;
  }

  try {
    const fetch = require('node-fetch');
    await fetch(
      `https://api.telegram.org/bot${telegramBotToken}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: adminChatId,
          text: `${title}\n\n${message}`,
          parse_mode: 'HTML'
        })
      }
    );
  } catch (error) {
    console.error('Failed to send admin alert:', error.message);
  }
}

// 실행
if (require.main === module) {
  enqueueDataCollectionJobs()
    .then((result) => {
      console.log('Result:', result);
      process.exit(0);
    })
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = {
  enqueueDataCollectionJobs,
  getLastWeekDates
};
