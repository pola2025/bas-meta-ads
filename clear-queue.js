require('dotenv').config();
const { Queue } = require('bullmq');
const Redis = require('ioredis');

const connection = new Redis(process.env.UPSTASH_REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false
});

const queue = new Queue('data-collection', { connection });

async function clearQueue() {
  console.log('🧹 Clearing queue...\n');

  // 모든 작업 삭제
  await queue.obliterate({ force: true });

  console.log('✅ Queue cleared!\n');

  // 상태 확인
  const counts = await queue.getJobCounts('waiting', 'active', 'completed', 'failed');
  console.log('📊 Queue Status:');
  console.log(`   Waiting: ${counts.waiting}`);
  console.log(`   Active: ${counts.active}`);
  console.log(`   Completed: ${counts.completed}`);
  console.log(`   Failed: ${counts.failed}\n`);

  await connection.quit();
  process.exit(0);
}

clearQueue();
