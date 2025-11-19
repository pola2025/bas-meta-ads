# 구현 가이드 (Implementation Guide)

**BAS Meta Ads Analytics Platform 단계별 구현 가이드**

이 문서는 **프로젝트를 처음부터 구축**하기 위한 실무 가이드입니다.

---

## 📋 사전 준비 체크리스트

### 계정 생성

- [ ] [Supabase](https://supabase.com) 계정 (무료)
- [ ] [Upstash](https://upstash.com) Redis 계정 (무료)
- [ ] [Railway](https://railway.app) 계정 (Developer $10/월)
- [ ] [Vercel](https://vercel.com) 계정 (무료)
- [ ] Meta 개발자 계정 (기존 보유)
- [ ] Telegram Bot 생성 (기존 보유)

### 필수 정보 준비

- [ ] Meta App ID: `1474546053653616`
- [ ] Meta App Secret: `5d3ea72d4293c8f78842334b8558175c`
- [ ] Meta Access Token (장기 토큰)
- [ ] Telegram Bot Token: `7947112373:...`
- [ ] Telegram Admin Chat ID: `-1003394139746`

---

## 🚀 Phase 1: 인프라 구축 (Week 1)

### 1-1. Supabase 프로젝트 생성

**소요 시간**: 30분

1. **https://supabase.com** 접속 → "Start your project" 클릭
2. **New Project** 클릭
   - Name: `bas-meta-analytics`
   - Database Password: 강력한 비밀번호 (저장 필수!)
   - Region: `Northeast Asia (Seoul)`
   - Plan: `Free`

3. **Project Settings → API** 메뉴에서 복사:
   ```
   SUPABASE_URL=https://xxx.supabase.co
   SUPABASE_SERVICE_KEY=eyJhbGc...
   ```

4. `.env` 파일에 추가

---

### 1-2. Supabase 데이터베이스 스키마 생성

**소요 시간**: 1시간

**⚠️ 사전 작업 필수: Vault 확장 프로그램 활성화**

1. **Supabase Dashboard → Database → Extensions** 이동
2. 검색창에 **"vault"** 입력
3. **"vault"** 확장 프로그램 찾아서 **Enable** 클릭
4. ✅ 활성화 확인 (초록색 토글)

**이제 스키마 생성**:

1. **Supabase Dashboard → SQL Editor** 이동

2. **새 쿼리 생성** → `sql/01_schema.sql` 파일 내용 붙여넣기

   **파일 생성 필요**: `sql/01_schema.sql`

   ```sql
   -- ============================================================================
   -- Database Schema
   -- ============================================================================

   -- Enable extensions
   CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
   CREATE EXTENSION IF NOT EXISTS "pg_cron";

   -- 1. clients 테이블
   CREATE TABLE clients (
     id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
     client_id VARCHAR(50) UNIQUE NOT NULL,
     client_name VARCHAR(100) NOT NULL,
     email VARCHAR(255) UNIQUE NOT NULL,
     password_hash VARCHAR(255) NOT NULL,
     meta_ad_account_id VARCHAR(50),
     meta_access_token_id UUID, -- Vault reference
     meta_refresh_token_id UUID, -- Vault reference
     token_expires_at TIMESTAMPTZ,
     auth_status VARCHAR(20) DEFAULT 'active', -- ⭐ v1.2: active/auth_required/token_expired
     plan_type VARCHAR(20) DEFAULT 'free',
     is_active BOOLEAN DEFAULT true,
     created_at TIMESTAMPTZ DEFAULT NOW(),
     updated_at TIMESTAMPTZ DEFAULT NOW()
   );

   CREATE INDEX idx_clients_email ON clients(email);
   CREATE INDEX idx_clients_client_id ON clients(client_id);
   CREATE INDEX idx_clients_is_active ON clients(is_active);
   CREATE INDEX idx_clients_token_expiry ON clients(token_expires_at);

   -- 2. raw_data 테이블 (파티셔닝)
   CREATE TABLE raw_data (
     id BIGSERIAL,
     client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
     date DATE NOT NULL,
     ad_id VARCHAR(50) NOT NULL,
     ad_name VARCHAR(200),
     campaign_id VARCHAR(50),
     campaign_name VARCHAR(200),
     platform VARCHAR(20),
     device VARCHAR(20),
     impressions INTEGER DEFAULT 0,
     reach INTEGER DEFAULT 0,
     clicks INTEGER DEFAULT 0,
     leads INTEGER DEFAULT 0,
     spend DECIMAL(10,2) DEFAULT 0,
     video_views INTEGER DEFAULT 0,
     avg_watch_time DECIMAL(5,1) DEFAULT 0,
     cost_per_video_view DECIMAL(10,6) DEFAULT 0,
     cost_per_lead DECIMAL(10,6) DEFAULT 0,
     created_at TIMESTAMPTZ DEFAULT NOW(),
     UNIQUE(client_id, date, ad_id, platform, device)
   ) PARTITION BY RANGE (date);

   -- 초기 파티션 생성 (2025년 11월)
   CREATE TABLE raw_data_2025_11 PARTITION OF raw_data
     FOR VALUES FROM ('2025-11-01') TO ('2025-12-01');

   -- 2025년 12월 파티션 (미리 생성)
   CREATE TABLE raw_data_2025_12 PARTITION OF raw_data
     FOR VALUES FROM ('2025-12-01') TO ('2026-01-01');

   CREATE INDEX idx_raw_data_client_id ON raw_data(client_id);
   CREATE INDEX idx_raw_data_date ON raw_data(date);

   -- 3. weekly_summary 테이블
   CREATE TABLE weekly_summary (
     id BIGSERIAL PRIMARY KEY,
     client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
     week_year INTEGER NOT NULL,
     week_number INTEGER NOT NULL,
     week_start DATE NOT NULL,
     week_end DATE NOT NULL,
     ad_id VARCHAR(50) NOT NULL,
     ad_name VARCHAR(200),
     campaign_id VARCHAR(50),
     campaign_name VARCHAR(200),
     total_impressions INTEGER DEFAULT 0,
     total_reach INTEGER DEFAULT 0,
     total_clicks INTEGER DEFAULT 0,
     total_leads INTEGER DEFAULT 0,
     total_spend DECIMAL(10,2) DEFAULT 0,
     total_video_views INTEGER DEFAULT 0,
     avg_ctr DECIMAL(5,2) GENERATED ALWAYS AS (
       CASE WHEN total_impressions > 0
       THEN (total_clicks::DECIMAL / total_impressions * 100)
       ELSE 0 END
     ) STORED,
     avg_cpl DECIMAL(10,2) GENERATED ALWAYS AS (
       CASE WHEN total_leads > 0
       THEN (total_spend / total_leads)
       ELSE 0 END
     ) STORED,
     efficiency_grade CHAR(1) GENERATED ALWAYS AS (
       CASE
         WHEN total_leads = 0 THEN 'F'
         WHEN (total_spend / NULLIF(total_leads, 0)) <= 3.00 THEN 'S'
         WHEN (total_spend / NULLIF(total_leads, 0)) <= 5.00 THEN 'A'
         WHEN (total_spend / NULLIF(total_leads, 0)) <= 8.00 THEN 'B'
         WHEN (total_spend / NULLIF(total_leads, 0)) <= 12.00 THEN 'C'
         ELSE 'D'
       END
     ) STORED,
     created_at TIMESTAMPTZ DEFAULT NOW(),
     UNIQUE(client_id, week_year, week_number, ad_id)
   );

   CREATE INDEX idx_weekly_client_week ON weekly_summary(client_id, week_year, week_number);
   CREATE INDEX idx_weekly_grade ON weekly_summary(efficiency_grade);

   -- 4. monthly_summary 테이블
   CREATE TABLE monthly_summary (
     id BIGSERIAL PRIMARY KEY,
     client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
     year INTEGER NOT NULL,
     month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
     ad_id VARCHAR(50) NOT NULL,
     ad_name VARCHAR(200),
     campaign_id VARCHAR(50),
     campaign_name VARCHAR(200),
     total_impressions INTEGER DEFAULT 0,
     total_reach INTEGER DEFAULT 0,
     total_clicks INTEGER DEFAULT 0,
     total_leads INTEGER DEFAULT 0,
     total_spend DECIMAL(10,2) DEFAULT 0,
     avg_ctr DECIMAL(5,2),
     avg_cpl DECIMAL(10,2),
     week_count INTEGER,
     created_at TIMESTAMPTZ DEFAULT NOW(),
     UNIQUE(client_id, year, month, ad_id)
   );

   CREATE INDEX idx_monthly_client_period ON monthly_summary(client_id, year, month);

   -- 5. producer_executions 테이블 (Producer 실행 추적)
   CREATE TABLE producer_executions (
     id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
     started_at TIMESTAMPTZ NOT NULL,
     completed_at TIMESTAMPTZ,
     failed_at TIMESTAMPTZ,
     total_clients INTEGER NOT NULL,
     enqueued_count INTEGER DEFAULT 0,
     failed_count INTEGER DEFAULT 0,
     status VARCHAR(20) NOT NULL,
     error_message TEXT,
     updated_at TIMESTAMPTZ DEFAULT NOW()
   );

   CREATE INDEX idx_producer_exec_started ON producer_executions(started_at DESC);
   CREATE INDEX idx_producer_exec_status ON producer_executions(status);

   -- 6. producer_errors 테이블 (Producer 에러 로그)
   CREATE TABLE producer_errors (
     id BIGSERIAL PRIMARY KEY,
     execution_id UUID REFERENCES producer_executions(id) ON DELETE CASCADE,
     client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
     error_message TEXT,
     created_at TIMESTAMPTZ DEFAULT NOW()
   );

   -- 7. token_refresh_logs 테이블 (토큰 갱신 이력)
   CREATE TABLE token_refresh_logs (
     id BIGSERIAL PRIMARY KEY,
     client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
     refreshed_at TIMESTAMPTZ NOT NULL,
     expires_at TIMESTAMPTZ,
     success BOOLEAN DEFAULT true,
     error_message TEXT
   );

   CREATE INDEX idx_token_refresh_client ON token_refresh_logs(client_id, refreshed_at DESC);

   -- 8. chart_cache 테이블 (차트 캐싱)
   CREATE TABLE chart_cache (
     id BIGSERIAL PRIMARY KEY,
     client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
     chart_type VARCHAR(20) NOT NULL,
     data_params_hash VARCHAR(32) NOT NULL,
     file_url TEXT NOT NULL,
     created_at TIMESTAMPTZ DEFAULT NOW()
   );

   CREATE INDEX idx_chart_cache_lookup ON chart_cache(client_id, chart_type, data_params_hash, created_at DESC);

   -- Row Level Security 활성화
   ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
   ALTER TABLE raw_data ENABLE ROW LEVEL SECURITY;
   ALTER TABLE weekly_summary ENABLE ROW LEVEL SECURITY;
   ALTER TABLE monthly_summary ENABLE ROW LEVEL SECURITY;

   -- RLS 정책 (기본)
   CREATE POLICY "Users can view own data" ON clients
     FOR SELECT USING (auth.uid() = id);

   CREATE POLICY "Users can view own raw_data" ON raw_data
     FOR SELECT USING (
       client_id IN (SELECT id FROM clients WHERE id = auth.uid())
     );

   CREATE POLICY "Users can view own weekly_summary" ON weekly_summary
     FOR SELECT USING (
       client_id IN (SELECT id FROM clients WHERE id = auth.uid())
     );

   CREATE POLICY "Users can view own monthly_summary" ON monthly_summary
     FOR SELECT USING (
       client_id IN (SELECT id FROM clients WHERE id = auth.uid())
     );

   -- 완료 메시지
   SELECT 'Schema created successfully!' AS message;
   ```

3. **실행** 버튼 클릭

4. **확인**: Table Editor에서 테이블들이 생성되었는지 확인

---

### 1-3. SQL Functions 및 pg_cron 설정

1. **새 쿼리 생성** → `sql/02_functions_timezone.sql` 파일 내용 붙여넣기

   (이미 생성된 파일: `F:\bas_meta\sql\02_functions_timezone.sql`)

2. **실행**

3. **확인**:
   ```sql
   SELECT * FROM cron.job;
   ```

   3개의 Cron Job이 등록되어 있어야 함:
   - `create-next-month-partition`
   - `generate-monthly-summary`
   - `check-expiring-tokens`

---

### 1-4. Upstash Redis 생성

1. **https://upstash.com** 접속 → 로그인

2. **Redis → Create Database**
   - Name: `bas-meta-queue`
   - Type: `Global`
   - Region: `Seoul, South Korea`
   - Eviction: `No Eviction`

3. **Details** 탭에서 복사:
   ```
   UPSTASH_REDIS_URL=rediss://default:xxxxx@xxx.upstash.io:6379
   ```

4. `.env` 파일에 추가

**⚠️ Upstash 무료 티어 제한 사항**:
- 일 커맨드 제한: **10,000개/일**
- BullMQ는 큐 관리를 위해 Redis 커맨드를 많이 사용합니다
- **권장**: 초기에는 Worker Concurrency를 1-2로 설정
- **모니터링**: Upstash Dashboard에서 일일 사용량 확인
- **대안**: 제한 초과 시 Railway Redis Plugin 또는 Upstash 유료 플랜($10/월)

---

### 1-5. 테스트 클라이언트 데이터 삽입

**Supabase SQL Editor**에서 실행:

```sql
-- 테스트 클라이언트 생성
INSERT INTO clients (
  client_id,
  client_name,
  email,
  password_hash,
  meta_ad_account_id,
  token_expires_at,
  auth_status, -- ⭐ v1.2
  plan_type,
  is_active
) VALUES (
  'client_001',
  '비즈액터스쿨',
  'bizactor@email.com',
  '$2a$10$dummyhash', -- 실제 구현 시 bcrypt 해시 사용
  'act_705731635104506',
  NOW() + INTERVAL '60 days', -- 60일 후 만료
  'active', -- ⭐ v1.2: 토큰 상태
  'pro',
  true
);

-- 확인
SELECT * FROM clients;
```

---

## 🔄 Phase 2: 데이터 수집 구현 (Week 2)

### 2-1. Producer 실행 테스트

**로컬에서 실행**:

```bash
node lib/producer.js
```

**예상 결과**:
```
🚀 Starting data collection job enqueuing...
📋 Found 1 active clients
📅 Target period: 2025-11-11 ~ 2025-11-17 (KST)
  ✅ [1/1] 비즈액터스쿨 (delay: 0s)
🎉 Enqueuing completed!
   Total clients: 1
   ✅ Enqueued: 1
   ❌ Failed: 0
```

**Upstash Redis Dashboard 확인**:
- Data Browser → Job이 등록되어 있어야 함

---

### 2-2. Worker 구현 (TODO)

**파일 생성**: `lib/worker.js`

```javascript
const { Worker } = require('bullmq');
const Redis = require('ioredis');
const { createClient } = require('@supabase/supabase-js');
const { TokenManager } = require('./token-manager');
const fetch = require('node-fetch');

const connection = new Redis(process.env.UPSTASH_REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  keepAlive: 30000, // ⭐ v1.2: Upstash Serverless 연결 유지 (30초)
  family: 0 // ⭐ v1.2: IPv4/IPv6 자동 감지
});

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const tokenManager = new TokenManager(supabase);

const worker = new Worker(
  'data-collection',
  async (job) => {
    const { clientId, clientName, adAccountId, weekStart, weekEnd } = job.data;

    console.log(`🔄 Processing: ${clientName} (${job.id})`);

    try {
      // 1. Token 유효성 확인 및 갱신
      const accessToken = await tokenManager.ensureValidToken(clientId);

      // 2. Meta API 호출
      const insights = await fetchMetaAdsData(adAccountId, accessToken, weekStart, weekEnd);

      // 3. Supabase raw_data에 저장
      await saveRawData(clientId, insights);

      // 4. Weekly Summary 생성
      await generateWeeklySummary(clientId, weekStart, weekEnd);

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
      throw error;
    }
  },
  {
    connection,
    concurrency: 2, // ⭐ v1.2: Upstash 무료 티어 (일 10K 커맨드 제한)
    limiter: {
      max: 10, // 1분에 최대 10개 작업
      duration: 60000
    }
  }
);

// Meta API 호출 함수 (페이지네이션 포함) ⭐ v1.2
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
    time_increment: '1'
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

// Supabase 저장 함수 (안전한 접근) ⭐ v1.2
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
    currency: item.account_currency || 'KRW', // ⭐ v1.2: 통화 정보
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

  // Batch insert with ON CONFLICT
  for (const record of records) {
    await supabase
      .from('raw_data')
      .upsert(record, {
        onConflict: 'client_id,date,ad_id,platform,device'
      });
  }

  console.log(`💾 Saved ${records.length} records to raw_data`);
}

// Weekly Summary 생성 함수
async function generateWeeklySummary(clientId, weekStart, weekEnd) {
  const { error } = await supabase.rpc('generate_weekly_summary', {
    p_client_id: clientId,
    p_week_start: weekStart,
    p_week_end: weekEnd
  });

  if (error) {
    throw new Error(`Failed to generate weekly summary: ${error.message}`);
  }

  console.log(`📊 Weekly summary generated: ${weekStart} ~ ${weekEnd}`);
}

// 헬퍼 함수: actions 배열에서 특정 action_type 값 추출 (안전한 접근) ⭐ v1.2
function getActionValue(actions, actionType) {
  if (!actions || !Array.isArray(actions)) return 0;
  const action = actions.find(a => a.action_type === actionType);
  return action ? parseInt(action.value) || 0 : 0;
}

// 헬퍼 함수: 평균 시청 시간 추출 (안전한 접근) ⭐ v1.2
function getVideoAvgTime(videoActions) {
  if (!videoActions || !Array.isArray(videoActions)) return 0;
  const action = videoActions.find(a => a.action_type === 'video_view');
  return action ? parseFloat(action.value) || 0 : 0;
}

// 헬퍼 함수: Cost Per Action 추출 (안전한 접근) ⭐ v1.2
function getCostPerAction(costPerActionType, actionType) {
  if (!costPerActionType || !Array.isArray(costPerActionType)) return 0;
  const cost = costPerActionType.find(c => c.action_type === actionType);
  return cost ? parseFloat(cost.value) || 0 : 0;
}

// Worker 이벤트 핸들러
worker.on('completed', (job, result) => {
  console.log(`🎉 Job ${job.id} completed:`, result);
});

worker.on('failed', (job, error) => {
  console.error(`💥 Job ${job.id} failed:`, error.message);
});

console.log('👷 Worker started (concurrency: 2, rate limit: 10/min)'); // ⭐ v1.2
console.log('⚠️  Upstash Free Tier: 일 10,000 커맨드 제한 (모니터링 필요)');
```

---

### 2-3. Worker 로컬 테스트

**Terminal 1 - Worker 실행**:
```bash
node lib/worker.js
```

**Terminal 2 - Producer 실행**:
```bash
node lib/producer.js
```

**예상 결과**:
```
👷 Worker started (concurrency: 2, rate limit: 10/min)
⚠️  Upstash Free Tier: 일 10,000 커맨드 제한 (모니터링 필요)
🔄 Processing: 비즈액터스쿨 (xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)
🔐 Checking token validity for client...
✅ Token is valid for client 비즈액터스쿨
📦 Fetched 63 records (Total: 63)
💾 Saved 63 records to raw_data
📊 Weekly summary generated: 2025-11-11 ~ 2025-11-17
✅ Completed: 비즈액터스쿨 (63 records)
🎉 Job xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx completed: { success: true, clientId: '...', recordsCount: 63 }
```

**Supabase에서 확인**:
```sql
-- raw_data 확인
SELECT COUNT(*) FROM raw_data;

-- weekly_summary 확인
SELECT * FROM weekly_summary ORDER BY created_at DESC LIMIT 5;
```

---

## 🚀 Phase 3: Railway 배포 (Week 2)

### 3-1. Railway 프로젝트 생성

1. **https://railway.app** 접속 → 로그인

2. **New Project → Empty Project**

3. **+ New → GitHub Repo** 선택
   - GitHub 연동 후 `bas_meta` 리포지토리 선택

4. **Settings → Variables** 메뉴에서 환경 변수 추가:
   ```
   META_APP_ID=1474546053653616
   META_APP_SECRET=5d3ea72d4293c8f78842334b8558175c
   SUPABASE_URL=https://xxx.supabase.co
   SUPABASE_SERVICE_KEY=eyJhbGc...
   UPSTASH_REDIS_URL=rediss://...
   TELEGRAM_BOT_TOKEN=7947112373:...
   TELEGRAM_ADMIN_CHAT_ID=-1003394139746
   ```

---

### 3-2. Railway Cron Job 설정

1. **railway.json 파일 생성**:

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "node lib/worker.js",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

2. **.railwayignore 파일 생성**:

```
node_modules
.env
archive
docs
README.md
```

3. **Cron Job 추가**:
   - Railway Dashboard → **Cron Jobs** 탭
   - **Add Cron Job** 클릭
   - Schedule: `0 0 * * 1` ⚠️ **UTC 00:00 = KST 09:00 (매주 월요일 오전 9시)**
   - Command: `node lib/producer.js`

   **⚠️ Timezone 주의!**
   Railway Cron은 UTC 기준으로 동작합니다.
   - KST 09:00 = UTC 00:00 (전날 24시)
   - KST = UTC + 9시간

---

### 3-3. 배포 확인

1. **Deployments** 탭에서 배포 로그 확인

2. **첫 실행 확인** (매주 월요일 09:00 KST):
   - Telegram으로 알림 수신 확인
   - Supabase `raw_data`, `weekly_summary` 데이터 확인

---

## 🧪 테스트 체크리스트

### 로컬 테스트

- [ ] Producer 실행 → Job이 Redis에 등록되는지 확인
- [ ] Worker 실행 → Job이 처리되는지 확인
- [ ] Meta API 호출 → 데이터가 정상 조회되는지 확인
- [ ] Supabase 저장 → raw_data에 데이터가 저장되는지 확인
- [ ] Weekly Summary 생성 → weekly_summary 테이블에 집계되는지 확인
- [ ] Token 갱신 → 만료 시나리오 테스트

### Railway 배포 후 테스트

- [ ] Worker가 정상 실행되는지 확인 (Logs 탭)
- [ ] Cron Job이 예정대로 실행되는지 확인 (Deployments 탭)
- [ ] Telegram 알림이 전송되는지 확인
- [ ] Supabase 데이터가 실시간으로 저장되는지 확인

---

## 📊 Phase 4: 웹 대시보드 (Week 3)

### 4-1. Next.js 프로젝트 생성

```bash
npx create-next-app@latest dashboard --typescript --tailwind --app
cd dashboard
npm install @supabase/supabase-js recharts lucide-react
```

### 4-2. Supabase 클라이언트 설정

**lib/supabase.ts**:
```typescript
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
```

### 4-3. 주요 페이지 구현

- `app/page.tsx` - 대시보드 메인 (주간 통계)
- `app/weekly/page.tsx` - 주간 상세
- `app/monthly/page.tsx` - 월간 통계
- `app/quarterly/page.tsx` - 분기 통계
- `app/yearly/page.tsx` - 연간 통계

### 4-4. Vercel 배포

```bash
vercel login
vercel --prod
```

**환경 변수 추가**:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

---

## 🎯 다음 단계 (Phase 2 & 3)

### Phase 2: 고급 기능 (2주)

- [ ] Telegram 주간 리포트 자동 발송
- [ ] PDF 리포트 생성 (Puppeteer)
- [ ] 차트 시각화 (Recharts)
- [ ] 이메일 알림 (Resend)

### Phase 3: 멀티 클라이언트 (2주)

- [ ] JWT 인증 시스템 (Next-Auth)
- [ ] Admin 패널 (클라이언트 관리)
- [ ] 사용자 초대 시스템
- [ ] 플랜별 기능 제한

---

## 🔧 트러블슈팅

### 1. Redis 연결 오류

**증상**: `ECONNREFUSED` 에러

**해결**:
```javascript
const connection = new Redis(process.env.UPSTASH_REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  retryStrategy: (times) => Math.min(times * 50, 2000)
});
```

### 2. Meta API Rate Limiting

**증상**: `(#4) Application request limit reached`

**해결**: Producer의 staggering 값 증가
```javascript
const delayMs = index * 60000; // 0분, 1분, 2분... (1분 간격)
```

### 3. Token 만료

**증상**: `(#190) Access token expired`

**해결**: `ensureValidToken()` 호출 확인
```javascript
const accessToken = await tokenManager.ensureValidToken(clientId);
```

### 4. Partition 누락

**증상**: `no partition of relation "raw_data" found for row`

**해결**: 수동으로 파티션 생성
```sql
SELECT create_next_month_partition();
```

---

## 📝 참고 문서

- [Supabase 공식 문서](https://supabase.com/docs)
- [BullMQ 공식 문서](https://docs.bullmq.io)
- [Meta Marketing API](https://developers.facebook.com/docs/marketing-api)
- [Railway 공식 문서](https://docs.railway.app)
- [Next.js 공식 문서](https://nextjs.org/docs)

---

**구현 가이드 완료!** 🎉

이제 Phase 1부터 순서대로 구현을 시작하세요.