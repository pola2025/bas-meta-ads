require('dotenv').config();
const { Queue } = require('bullmq');
const Redis = require('ioredis');

const connection = new Redis(process.env.UPSTASH_REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false
});

const queue = new Queue('data-collection', { connection });

async function checkFailedJob() {
  try {
    const failedJobs = await queue.getFailed(0, 5);

    if (failedJobs.length === 0) {
      console.log('No failed jobs');
      process.exit(0);
    }

    console.log(`Found ${failedJobs.length} failed jobs:\n`);

    for (const job of failedJobs) {
      console.log('━'.repeat(60));
      console.log(`Job ID: ${job.id}`);
      console.log(`Client: ${job.data.clientName}`);
      console.log(`Period: ${job.data.weekStart} ~ ${job.data.weekEnd}`);
      console.log(`Attempts: ${job.attemptsMade}/${job.opts.attempts}`);
      console.log(`Failed Reason: ${job.failedReason}`);
      console.log(`Stack Trace:`);
      console.log(job.stacktrace ? job.stacktrace.join('\n') : 'No stack trace');
      console.log('');
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await queue.close();
    await connection.quit();
    process.exit(0);
  }
}

checkFailedJob();
