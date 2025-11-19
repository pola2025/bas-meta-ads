require('dotenv').config();
const { Queue } = require('bullmq');
const Redis = require('ioredis');

const connection = new Redis(process.env.UPSTASH_REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false
});

const queue = new Queue('data-collection', { connection });

async function debugQueue() {
  console.log('🔍 Debugging BullMQ Queue Status\n');

  try {
    // 큐 상태 확인
    const waiting = await queue.getWaitingCount();
    const active = await queue.getActiveCount();
    const completed = await queue.getCompletedCount();
    const failed = await queue.getFailedCount();
    const delayed = await queue.getDelayedCount();

    console.log('📊 Queue Counts:');
    console.log(`   Waiting: ${waiting}`);
    console.log(`   Active: ${active}`);
    console.log(`   Completed: ${completed}`);
    console.log(`   Failed: ${failed}`);
    console.log(`   Delayed: ${delayed}`);
    console.log('');

    // Waiting 작업 확인
    if (waiting > 0) {
      const waitingJobs = await queue.getWaiting(0, 10);
      console.log('⏳ Waiting Jobs:');
      waitingJobs.forEach(job => {
        console.log(`   - ${job.id}: ${job.data.clientName} (${job.data.weekStart})`);
      });
      console.log('');
    }

    // Active 작업 확인
    if (active > 0) {
      const activeJobs = await queue.getActive(0, 10);
      console.log('🔄 Active Jobs:');
      activeJobs.forEach(job => {
        console.log(`   - ${job.id}: ${job.data.clientName}`);
      });
      console.log('');
    }

    // Completed 작업 확인 (최근 5개)
    const completedJobs = await queue.getCompleted(0, 5);
    if (completedJobs.length > 0) {
      console.log('✅ Recent Completed Jobs:');
      completedJobs.forEach(job => {
        console.log(`   - ${job.id}: ${job.data.clientName} (${job.data.weekStart})`);
      });
      console.log('');
    }

    // Failed 작업 확인
    if (failed > 0) {
      const failedJobs = await queue.getFailed(0, 5);
      console.log('❌ Failed Jobs:');
      failedJobs.forEach(job => {
        console.log(`   - ${job.id}: ${job.data.clientName}`);
        console.log(`     Error: ${job.failedReason}`);
      });
      console.log('');
    }

    // Delayed 작업 확인
    if (delayed > 0) {
      const delayedJobs = await queue.getDelayed(0, 5);
      console.log('⏰ Delayed Jobs:');
      delayedJobs.forEach(job => {
        console.log(`   - ${job.id}: ${job.data.clientName}`);
        console.log(`     Delay: ${job.opts.delay}ms`);
      });
      console.log('');
    }

    // 결론
    console.log('🎯 Analysis:');
    if (waiting > 0) {
      console.log('   ⚠️ Jobs are waiting but not being processed by Worker!');
      console.log('   → Check if Worker is running and connected to same Redis');
    } else if (completed > 0 && waiting === 0) {
      console.log('   ✅ All jobs have been processed');
      console.log('   → Issue: Producer might be adding duplicate jobIds');
    } else if (delayed > 0) {
      console.log('   ⏰ Jobs are delayed and will be processed later');
    } else {
      console.log('   📭 Queue is empty - no jobs to process');
    }

  } catch (error) {
    console.error('💥 Error:', error.message);
  } finally {
    await queue.close();
    await connection.quit();
    process.exit(0);
  }
}

debugQueue();
