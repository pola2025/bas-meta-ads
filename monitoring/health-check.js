require('dotenv').config();
const { Queue } = require('bullmq');
const Redis = require('ioredis');
const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch');

/**
 * 시스템 헬스 체크 스크립트
 *
 * 확인 항목:
 * 1. Upstash Redis 연결
 * 2. BullMQ 큐 상태
 * 3. Supabase 연결 및 최근 데이터
 * 4. Worker 상태 (최근 완료 작업)
 * 5. Telegram Bot 연결
 */

const connection = new Redis(process.env.UPSTASH_REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false
});

const queue = new Queue('data-collection', { connection });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function healthCheck() {
  console.log('🏥 System Health Check');
  console.log('━'.repeat(60));
  console.log(`📅 ${new Date().toISOString()}\n`);

  const issues = [];
  const warnings = [];

  try {
    // 1. Redis 연결 체크
    console.log('1️⃣ Checking Upstash Redis...');
    try {
      await connection.ping();
      console.log('   ✅ Redis connection OK\n');
    } catch (error) {
      console.log('   ❌ Redis connection FAILED\n');
      issues.push(`Redis: ${error.message}`);
    }

    // 2. BullMQ 큐 상태 체크
    console.log('2️⃣ Checking BullMQ Queue...');
    try {
      const waiting = await queue.getWaitingCount();
      const active = await queue.getActiveCount();
      const failed = await queue.getFailedCount();

      console.log(`   Waiting: ${waiting}`);
      console.log(`   Active: ${active}`);
      console.log(`   Failed: ${failed}`);

      if (failed > 5) {
        warnings.push(`High failed job count: ${failed}`);
        console.log(`   ⚠️  Warning: ${failed} failed jobs\n`);
      } else {
        console.log('   ✅ Queue status OK\n');
      }
    } catch (error) {
      console.log('   ❌ Queue check FAILED\n');
      issues.push(`Queue: ${error.message}`);
    }

    // 3. Supabase 연결 및 최근 데이터 체크
    console.log('3️⃣ Checking Supabase...');
    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

      const { data, error } = await supabase
        .from('raw_data')
        .select('created_at')
        .gte('created_at', oneHourAgo)
        .limit(1);

      if (error) throw error;

      if (data.length > 0) {
        console.log(`   ✅ Supabase OK (Recent data: ${data[0].created_at})\n`);
      } else {
        console.log('   ⚠️  No recent data (last 1 hour)\n');
        warnings.push('No data collected in last 1 hour');
      }
    } catch (error) {
      console.log('   ❌ Supabase check FAILED\n');
      issues.push(`Supabase: ${error.message}`);
    }

    // 4. Worker 최근 완료 작업 체크
    console.log('4️⃣ Checking Worker Status...');
    try {
      const completedJobs = await queue.getCompleted(0, 1);

      if (completedJobs.length > 0) {
        const job = completedJobs[0];
        const finishedTime = new Date(job.finishedOn);
        const hoursSinceCompletion = (Date.now() - finishedTime) / (1000 * 60 * 60);

        console.log(`   Last completed: ${finishedTime.toISOString()}`);
        console.log(`   Client: ${job.data.clientName}`);
        console.log(`   Records: ${job.returnvalue?.recordsCount || 'Unknown'}`);

        if (hoursSinceCompletion > 168) { // 7일
          warnings.push(`No job completed in last 7 days`);
          console.log('   ⚠️  Last job was over 7 days ago\n');
        } else {
          console.log('   ✅ Worker OK\n');
        }
      } else {
        console.log('   ⚠️  No completed jobs found\n');
        warnings.push('No completed jobs in history');
      }
    } catch (error) {
      console.log('   ❌ Worker check FAILED\n');
      issues.push(`Worker: ${error.message}`);
    }

    // 5. Telegram Bot 체크
    console.log('5️⃣ Checking Telegram Bot...');
    try {
      const botToken = process.env.TELEGRAM_BOT_TOKEN;
      const response = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
      const data = await response.json();

      if (data.ok) {
        console.log(`   ✅ Telegram Bot OK (@${data.result.username})\n`);
      } else {
        throw new Error(data.description);
      }
    } catch (error) {
      console.log('   ❌ Telegram Bot check FAILED\n');
      issues.push(`Telegram: ${error.message}`);
    }

    // 결과 요약
    console.log('━'.repeat(60));
    console.log('📊 Health Check Summary\n');

    if (issues.length === 0 && warnings.length === 0) {
      console.log('✅ All systems operational!');
      return { status: 'healthy', issues: [], warnings: [] };
    } else {
      if (issues.length > 0) {
        console.log('❌ Critical Issues:');
        issues.forEach(issue => console.log(`   - ${issue}`));
        console.log('');
      }

      if (warnings.length > 0) {
        console.log('⚠️  Warnings:');
        warnings.forEach(warning => console.log(`   - ${warning}`));
        console.log('');
      }

      return {
        status: issues.length > 0 ? 'unhealthy' : 'degraded',
        issues,
        warnings
      };
    }

  } catch (error) {
    console.error('💥 Health check failed:', error);
    return { status: 'error', issues: [error.message], warnings: [] };
  } finally {
    await queue.close();
    await connection.quit();
  }
}

// 텔레그램으로 알림 발송
async function sendHealthAlert(result) {
  if (result.status === 'healthy') return; // 정상이면 알림 안 함

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID;

  if (!botToken || !chatId) {
    console.log('⚠️  Telegram credentials not set, skipping alert');
    return;
  }

  const statusEmoji = {
    unhealthy: '🔴',
    degraded: '🟡',
    error: '💥'
  };

  let message = `${statusEmoji[result.status]} **시스템 헬스 체크 알림**\n\n`;
  message += `상태: ${result.status.toUpperCase()}\n`;
  message += `시간: ${new Date().toISOString()}\n\n`;

  if (result.issues.length > 0) {
    message += '**❌ Critical Issues:**\n';
    result.issues.forEach(issue => {
      message += `• ${issue}\n`;
    });
    message += '\n';
  }

  if (result.warnings.length > 0) {
    message += '**⚠️ Warnings:**\n';
    result.warnings.forEach(warning => {
      message += `• ${warning}\n`;
    });
  }

  try {
    await fetch(
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
    console.log('📱 Health alert sent to Telegram');
  } catch (error) {
    console.error('Failed to send health alert:', error.message);
  }
}

// 실행
if (require.main === module) {
  healthCheck()
    .then(async (result) => {
      await sendHealthAlert(result);
      process.exit(result.status === 'healthy' ? 0 : 1);
    })
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = { healthCheck, sendHealthAlert };
