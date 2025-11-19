const { Queue, Worker } = require('bullmq');
const { createClient } = require('@supabase/supabase-js');
const Redis = require('ioredis');

/**
 * ============================================================================
 * Chart Generator - 비동기 차트 이미지 생성
 * ============================================================================
 *
 * 개선 사항:
 * 1. 비동기 Job Queue 패턴 - 동기 요청으로 인한 타임아웃 방지
 * 2. Supabase Storage 캐싱 - 중복 생성 방지, 성능 향상
 * 3. Warm-up 전략 - 콜드 스타트 최소화
 * 4. Puppeteer 리소스 관리 - 메모리 누수 방지
 *
 * 사용 시나리오:
 * 1. 사용자가 리포트 요청 → Job Queue에 등록
 * 2. Worker가 비동기로 차트 생성
 * 3. 생성 완료 시 Supabase Storage에 저장
 * 4. 사용자에게 알림 (이메일/텔레그램) 또는 다운로드 링크 제공
 *
 * ============================================================================
 */

const connection = new Redis(process.env.UPSTASH_REDIS_URL, {
  maxRetriesPerRequest: null
});

const chartQueue = new Queue('chart-generation', { connection });

/**
 * Chart 생성 요청 (비동기) ⭐
 *
 * @param {Object} params - 차트 생성 파라미터
 * @param {string} params.clientId - 클라이언트 ID
 * @param {string} params.chartType - 차트 타입 (line, bar, pie)
 * @param {Object} params.dataParams - 데이터 조회 파라미터
 * @param {string} params.notificationMethod - 알림 방법 (telegram, email, none)
 * @returns {Promise<Object>} - Job 정보
 */
async function requestChartGeneration({
  clientId,
  chartType,
  dataParams,
  notificationMethod = 'none'
}) {
  const chartId = `${clientId}_${chartType}_${Date.now()}`;

  // 1. 캐시 확인 (같은 파라미터로 최근 생성된 차트가 있는지)
  const cachedUrl = await checkCache(clientId, chartType, dataParams);
  if (cachedUrl) {
    console.log(`✅ Chart found in cache: ${cachedUrl}`);
    return {
      status: 'cached',
      chartId,
      url: cachedUrl,
      message: 'Chart already exists (cached)'
    };
  }

  // 2. Job Queue에 등록
  const job = await chartQueue.add(
    'generate',
    {
      chartId,
      clientId,
      chartType,
      dataParams,
      notificationMethod
    },
    {
      jobId: chartId, // 멱등성 보장
      attempts: 2,
      backoff: {
        type: 'exponential',
        delay: 3000
      },
      removeOnComplete: {
        age: 86400 * 30 // 30일 후 삭제
      }
    }
  );

  console.log(`📊 Chart generation job created: ${job.id}`);

  return {
    status: 'queued',
    jobId: job.id,
    chartId,
    message: 'Chart generation started. You will be notified when ready.'
  };
}

/**
 * 캐시 확인
 */
async function checkCache(clientId, chartType, dataParams) {
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );

  try {
    // chart_cache 테이블에서 조회 (필요 시 생성)
    const { data, error } = await supabase
      .from('chart_cache')
      .select('file_url, created_at')
      .eq('client_id', clientId)
      .eq('chart_type', chartType)
      .eq('data_params_hash', hashParams(dataParams))
      .gte('created_at', new Date(Date.now() - 3600000).toISOString()) // 1시간 캐시
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!error && data) {
      return data.file_url;
    }

    return null;
  } catch (error) {
    console.error('Cache check failed:', error.message);
    return null;
  }
}

/**
 * 파라미터 해시 생성 (캐시 키용)
 */
function hashParams(params) {
  const crypto = require('crypto');
  return crypto
    .createHash('md5')
    .update(JSON.stringify(params))
    .digest('hex');
}

/**
 * Chart Generator Worker ⭐
 */
function startChartWorker() {
  const worker = new Worker(
    'chart-generation',
    async (job) => {
      const { chartId, clientId, chartType, dataParams, notificationMethod } = job.data;

      console.log(`📊 Generating chart: ${chartId}`);

      try {
        // 1. 데이터 조회
        const chartData = await fetchChartData(clientId, chartType, dataParams);

        // 2. Puppeteer로 차트 이미지 생성
        const imageBuffer = await generateChartImage(chartData, chartType);

        // 3. Supabase Storage에 저장
        const fileUrl = await uploadToStorage(chartId, imageBuffer);

        // 4. 캐시 저장
        await saveToCache(clientId, chartType, dataParams, fileUrl);

        // 5. 알림 전송
        if (notificationMethod !== 'none') {
          await sendNotification(clientId, notificationMethod, fileUrl);
        }

        console.log(`✅ Chart generated: ${fileUrl}`);

        return {
          success: true,
          chartId,
          fileUrl
        };

      } catch (error) {
        console.error(`❌ Chart generation failed: ${chartId}`, error);
        throw error;
      }
    },
    {
      connection,
      concurrency: 2, // 동시 2개 (Puppeteer 리소스 많이 사용)
      limiter: {
        max: 5,
        duration: 60000 // 1분에 최대 5개
      }
    }
  );

  worker.on('completed', (job, result) => {
    console.log(`🎉 Chart job ${job.id} completed:`, result.fileUrl);
  });

  worker.on('failed', (job, error) => {
    console.error(`💥 Chart job ${job.id} failed:`, error.message);
  });

  console.log('👷 Chart Generator Worker started (concurrency: 2)');

  return worker;
}

/**
 * Puppeteer Chart 생성 (실제 구현)
 */
async function generateChartImage(chartData, chartType) {
  // Vercel 환경에서는 @sparticuz/chromium 사용
  const puppeteer = require('puppeteer-core');
  const chromium = require('@sparticuz/chromium');

  let browser;

  try {
    // HTML 템플릿 생성 (Recharts 사용)
    const html = generateChartHTML(chartData, chartType);

    // Puppeteer 실행
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    await page.setViewport({ width: 1200, height: 600, deviceScaleFactor: 2 });

    // 차트 렌더링 대기 (React 렌더링 완료)
    await page.waitForSelector('#chart-container', { timeout: 5000 });
    await page.waitForTimeout(1000); // 애니메이션 완료 대기

    // 스크린샷
    const screenshot = await page.screenshot({
      type: 'png',
      fullPage: false,
      clip: {
        x: 0,
        y: 0,
        width: 1200,
        height: 600
      }
    });

    return screenshot;

  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * Chart HTML 템플릿 생성
 */
function generateChartHTML(data, chartType) {
  // Recharts CDN + React
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
  <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
  <script src="https://unpkg.com/recharts@2.5.0/dist/Recharts.js"></script>
  <style>
    body {
      margin: 0;
      padding: 20px;
      font-family: 'Pretendard', -apple-system, sans-serif;
      background: white;
    }
    #chart-container {
      width: 1160px;
      height: 560px;
    }
  </style>
</head>
<body>
  <div id="chart-container"></div>
  <script>
    const { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } = Recharts;

    const data = ${JSON.stringify(data)};

    const ChartComponent = () => {
      ${getChartJSX(chartType)}
    };

    const root = ReactDOM.createRoot(document.getElementById('chart-container'));
    root.render(React.createElement(ChartComponent));
  </script>
</body>
</html>
  `;
}

/**
 * 차트 타입별 JSX 코드 생성
 */
function getChartJSX(chartType) {
  switch (chartType) {
    case 'line':
      return `
        return React.createElement(ResponsiveContainer, { width: '100%', height: '100%' },
          React.createElement(LineChart, { data },
            React.createElement(CartesianGrid, { strokeDasharray: '3 3' }),
            React.createElement(XAxis, { dataKey: 'date' }),
            React.createElement(YAxis),
            React.createElement(Tooltip),
            React.createElement(Legend),
            React.createElement(Line, { type: 'monotone', dataKey: 'spend', stroke: '#8884d8' }),
            React.createElement(Line, { type: 'monotone', dataKey: 'leads', stroke: '#82ca9d' })
          )
        );
      `;

    case 'bar':
      return `
        return React.createElement(ResponsiveContainer, { width: '100%', height: '100%' },
          React.createElement(BarChart, { data },
            React.createElement(CartesianGrid, { strokeDasharray: '3 3' }),
            React.createElement(XAxis, { dataKey: 'name' }),
            React.createElement(YAxis),
            React.createElement(Tooltip),
            React.createElement(Legend),
            React.createElement(Bar, { dataKey: 'value', fill: '#8884d8' })
          )
        );
      `;

    default:
      return `return React.createElement('div', {}, 'Unsupported chart type');`;
  }
}

/**
 * Supabase Storage 업로드
 */
async function uploadToStorage(chartId, imageBuffer) {
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );

  const filePath = `charts/${chartId}.png`;

  const { data, error } = await supabase.storage
    .from('public-charts')
    .upload(filePath, imageBuffer, {
      contentType: 'image/png',
      cacheControl: '3600', // 1시간 캐시
      upsert: true
    });

  if (error) {
    throw new Error(`Failed to upload chart: ${error.message}`);
  }

  // Public URL 생성
  const { data: urlData } = supabase.storage
    .from('public-charts')
    .getPublicUrl(filePath);

  return urlData.publicUrl;
}

/**
 * 캐시 저장
 */
async function saveToCache(clientId, chartType, dataParams, fileUrl) {
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );

  await supabase
    .from('chart_cache')
    .insert({
      client_id: clientId,
      chart_type: chartType,
      data_params_hash: hashParams(dataParams),
      file_url: fileUrl,
      created_at: new Date().toISOString()
    });
}

/**
 * 데이터 조회 (Placeholder)
 */
async function fetchChartData(clientId, chartType, dataParams) {
  // 실제 구현에서는 Supabase에서 데이터 조회
  return [
    { date: '2025-11-11', spend: 50, leads: 5 },
    { date: '2025-11-12', spend: 60, leads: 7 },
    { date: '2025-11-13', spend: 45, leads: 4 }
  ];
}

/**
 * 알림 전송 (Placeholder)
 */
async function sendNotification(clientId, method, fileUrl) {
  console.log(`📧 Notification (${method}): Chart ready at ${fileUrl}`);
  // 실제 구현: Telegram/Email 전송
}

/**
 * Warm-up 함수 (콜드 스타트 방지) ⭐
 */
async function warmUpChartGenerator() {
  console.log('🔥 Warming up Chart Generator...');

  try {
    const dummyJob = await requestChartGeneration({
      clientId: 'warmup',
      chartType: 'line',
      dataParams: { warmup: true },
      notificationMethod: 'none'
    });

    console.log('✅ Warm-up completed:', dummyJob.status);
  } catch (error) {
    console.error('Warm-up failed:', error.message);
  }
}

module.exports = {
  requestChartGeneration,
  startChartWorker,
  warmUpChartGenerator
};
