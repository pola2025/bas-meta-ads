require('dotenv').config();
const { Queue } = require('bullmq');
const Redis = require('ioredis');

const connection = new Redis(process.env.UPSTASH_REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false
});

const queue = new Queue('data-collection', { connection });

async function checkCompletedJob() {
  try {
    const completedJobs = await queue.getCompleted(0, 3);

    if (completedJobs.length === 0) {
      console.log('No completed jobs');
      process.exit(0);
    }

    console.log(`Found ${completedJobs.length} completed jobs:\n`);

    for (const job of completedJobs) {
      console.log('━'.repeat(60));
      console.log(`Job ID: ${job.id}`);
      console.log(`Client: ${job.data.clientName}`);
      console.log(`Period: ${job.data.weekStart} ~ ${job.data.weekEnd}`);
      console.log(`Finished: ${job.finishedOn ? new Date(job.finishedOn).toISOString() : 'Unknown'}`);
      console.log(`Return Value:`);
      console.log(JSON.stringify(job.returnvalue, null, 2));
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

checkCompletedJob();
