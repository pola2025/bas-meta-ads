require('dotenv').config();
const { Queue } = require('bullmq');
const Redis = require('ioredis');

const connection = new Redis(process.env.UPSTASH_REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false
});

const queue = new Queue('data-collection', { connection });

async function checkQueue() {
  try {
    console.log('🔍 Checking Queue status...\n');

    const waiting = await queue.getWaitingCount();
    const active = await queue.getActiveCount();
    const completed = await queue.getCompletedCount();
    const failed = await queue.getFailedCount();

    console.log('📊 Queue Status:');
    console.log(`   Waiting: ${waiting}`);
    console.log(`   Active: ${active}`);
    console.log(`   Completed: ${completed}`);
    console.log(`   Failed: ${failed}\n`);

    if (waiting > 0) {
      console.log('📋 Waiting Jobs:');
      const waitingJobs = await queue.getWaiting();
      waitingJobs.forEach((job, index) => {
        console.log(`   ${index + 1}. ${job.name} (${job.id})`);
        console.log(`      Client: ${job.data.clientName}`);
        console.log(`      Period: ${job.data.weekStart} ~ ${job.data.weekEnd}\n`);
      });
    }

    if (failed > 0) {
      console.log('❌ Failed Jobs:');
      const failedJobs = await queue.getFailed();
      failedJobs.forEach((job, index) => {
        console.log(`   ${index + 1}. ${job.name} (${job.id})`);
        console.log(`      Error: ${job.failedReason}\n`);
      });
    }

    await connection.quit();
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkQueue();
