# Meta 광고 자동 분석 플랫폼 설계 기획서 v1.3

**프로젝트명**: BAS Meta Ads Analytics Platform
**버전**: 1.3.0 (Phase 3 시각화 및 리포팅 가이드 추가)
**작성일**: 2025-11-18
**최종 수정**: 2025-11-19 (Phase 3 상세 계획 추가)

---

## 🎯 v1.2 주요 변경 사항 (2025-11-19)

### 🔥 Critical 이슈 해결 (Approved for Production)

1. **Meta API 페이지네이션 추가** - 90개 이상 광고 데이터 누락 방지
2. **Upstash Redis keepAlive 설정** - Serverless 환경 연결 안정성 향상

### 📌 Important 개선

3. **Currency (통화) 필드 추가** - 다중 통화 광고 계정 지원
4. **Supabase Vault 권한 설정** - 구현 가이드 명시

### 🔐 Security 강화

5. **토큰 만료 시나리오 처리** - auth_status 필드로 상태 관리

### 🛡️ Code Quality

6. **안전한 데이터 접근** - null/undefined 체크 강화

**상세 내역**: [CHANGELOG_v1.2.md](./CHANGELOG_v1.2.md)

---

## 📋 목차

1. [프로젝트 개요](#1-프로젝트-개요)
2. [시스템 아키텍처 (개선)](#2-시스템-아키텍처-개선)
3. [데이터베이스 설계 (개선)](#3-데이터베이스-설계-개선)
4. [Job Queue 시스템 설계 (신규)](#4-job-queue-시스템-설계-신규)
5. [API 설계 (개선)](#5-api-설계-개선)
6. [웹 대시보드 설계 (개선)](#6-웹-대시보드-설계-개선)
7. [데이터 파이프라인 (개선)](#7-데이터-파이프라인-개선)
8. [보안 강화 (개선)](#8-보안-강화-개선)
9. [개발 로드맵 (재정의)](#9-개발-로드맵-재정의)
10. [배포 및 운영](#10-배포-및-운영)

---

## 1. 프로젝트 개요

*(v1.0과 동일)*

---

## 2. 시스템 아키텍처 (개선)

### 2.1 전체 구조 (개선)

```
┌─────────────────────────────────────────────────────────────────┐
│                       Meta Ads API                               │
└───────────────────────────┬─────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│         Data Collection Orchestrator (Railway)                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Cron Trigger (매주 월요일 09:00 KST)                     │   │
│  │  → Job Queue에 클라이언트별 작업 등록                    │   │
│  └──────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Job Queue (BullMQ + Redis) ⭐ NEW                         │   │
│  │  - 클라이언트별 독립 작업 실행                            │   │
│  │  - 재시도 로직 (3회, Exponential Backoff)                │   │
│  │  - 동시 실행 제한 (5개)                                  │   │
│  │  - 실패 작업 Dead Letter Queue                           │   │
│  └──────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Worker Pool (5 workers)                                   │   │
│  │  Worker 1: client_001 처리                                │   │
│  │  Worker 2: client_002 처리                                │   │
│  │  Worker 3: client_003 처리                                │   │
│  │  ...                                                      │   │
│  └──────────────────────────────────────────────────────────┘   │
└───────────────────────────┬─────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│                    Supabase                                      │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ PostgreSQL 15 + pg_cron ⭐ NEW                            │   │
│  │  - 매월 1일 00:00: 다음 달 파티션 자동 생성              │   │
│  │  - 매월 1일 10:00: 지난달 월간 집계 실행                 │   │
│  │  - 매분기 1일 11:00: 지난 분기 집계 실행                 │   │
│  └──────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Supabase Vault ⭐ NEW                                     │   │
│  │  - Meta Access Token 암호화 저장                         │   │
│  │  - Refresh Token 암호화 저장                             │   │
│  └──────────────────────────────────────────────────────────┘   │
└───────────────────────────┬─────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│              Web Dashboard (Next.js 14 on Vercel)                │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Server-Side Chart Generation ⭐ NEW                       │   │
│  │  - Puppeteer + Recharts                                   │   │
│  │  - Supabase Storage 캐싱                                  │   │
│  │  - QuickChart fallback                                    │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 기술 스택 업데이트

#### Backend (Data Collection) - 업데이트

- **Runtime**: Node.js 20
- **Job Queue**: BullMQ 5.x ⭐ NEW
- **Cache/Queue Storage**: Upstash Redis (무료) ⭐ NEW
- **Scheduler**: Railway Cron Jobs
- **Database**: Supabase (PostgreSQL 15 + pg_cron)
- **Libraries**:
  - `@supabase/supabase-js`: Supabase 클라이언트
  - `bullmq`: Job Queue
  - `ioredis`: Redis 클라이언트
  - `node-fetch`: HTTP 요청
  - `dotenv`: 환경 변수

---

## 3. 데이터베이스 설계 (개선)

### 3.1 ERD (업데이트)

```
┌─────────────────────┐
│     clients         │
│─────────────────────│
│ id (PK)             │ UUID
│ client_id           │ VARCHAR (unique)
│ client_name         │ VARCHAR
│ email               │ VARCHAR (unique)
│ password_hash       │ VARCHAR
│ meta_ad_account_id  │ VARCHAR
│ meta_access_token_id│ UUID → vault.secrets
│ meta_refresh_token_id│ UUID → vault.secrets
│ token_expires_at    │ TIMESTAMPTZ
│ auth_status         │ VARCHAR (active/auth_required/token_expired) ⭐ v1.2
│ plan_type           │ ENUM
│ is_active           │ BOOLEAN
│ created_at          │ TIMESTAMPTZ
│ updated_at          │ TIMESTAMPTZ
└─────────────────────┘
```

### 3.2 파티셔닝 자동화 (신규)

#### 3.2.1 자동 파티션 생성 함수

```sql
-- 다음 달 파티션 자동 생성 함수
CREATE OR REPLACE FUNCTION create_next_month_partition()
RETURNS VOID AS $$
DECLARE
  partition_name TEXT;
  start_date DATE;
  end_date DATE;
BEGIN
  -- 다음 달 1일
  start_date := DATE_TRUNC('month', CURRENT_DATE + INTERVAL '1 month');
  -- 다음다음 달 1일
  end_date := DATE_TRUNC('month', CURRENT_DATE + INTERVAL '2 month');

  -- 파티션 이름: raw_data_2025_12
  partition_name := 'raw_data_' || TO_CHAR(start_date, 'YYYY_MM');

  -- 파티션 생성 (이미 존재하면 무시)
  EXECUTE format(
    'CREATE TABLE IF NOT EXISTS %I PARTITION OF raw_data
     FOR VALUES FROM (%L) TO (%L)',
    partition_name,
    start_date,
    end_date
  );

  RAISE NOTICE 'Partition % created for period % to %',
    partition_name, start_date, end_date;
END;
$$ LANGUAGE plpgsql;
```

#### 3.2.2 pg_cron 스케줄 등록

```sql
-- Supabase에서 pg_cron 활성화
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 매월 1일 00:00 (UTC)에 다음 달 파티션 생성
SELECT cron.schedule(
  'create-next-month-partition',
  '0 0 1 * *',
  $$ SELECT create_next_month_partition(); $$
);
```

---

## 4. Job Queue 시스템 설계 (신규)

### 4.1 아키텍처

```
┌─────────────────────────────────────────────────────────┐
│ Cron Trigger (매주 월요일 09:00)                         │
│  ↓                                                       │
│ Producer: 모든 활성 클라이언트 조회                      │
│  ↓                                                       │
│ FOR EACH client:                                         │
│   queue.add('collect-data', {                            │
│     clientId: client.id,                                 │
│     weekStart: '2025-11-11',                             │
│     weekEnd: '2025-11-17'                                │
│   }, {                                                   │
│     attempts: 3,                                         │
│     backoff: { type: 'exponential', delay: 2000 },      │
│     delay: client.id.hashCode() % 600 * 1000  // Stagger│
│   })                                                     │
└─────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│ BullMQ Queue (Upstash Redis)                            │
│  ┌─────────┬─────────┬─────────┬─────────┐              │
│  │ Job 1   │ Job 2   │ Job 3   │ ...     │              │
│  │ client_1│ client_2│ client_3│         │              │
│  └─────────┴─────────┴─────────┴─────────┘              │
└─────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│ Worker Pool (Concurrency: 5)                            │
│  ┌──────────────────────────────────────────────────┐   │
│  │ Worker.process('collect-data', async (job) => {  │   │
│  │   const { clientId, weekStart, weekEnd } = job.data;│ │
│  │                                                  │   │
│  │   // 1. Meta API 호출                            │   │
│  │   const data = await fetchMetaAds(clientId);     │   │
│  │                                                  │   │
│  │   // 2. Supabase 저장                            │   │
│  │   await saveToSupabase(data);                    │   │
│  │                                                  │   │
│  │   // 3. Weekly Summary 생성                      │   │
│  │   await generateWeeklySummary(clientId);         │   │
│  │                                                  │   │
│  │   // 4. Telegram 알림                            │   │
│  │   await sendTelegram(clientId, summary);         │   │
│  │                                                  │   │
│  │   return { success: true, recordsCount: ... };   │   │
│  │ })                                               │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│ 성공: completed queue                                    │
│ 실패 (3회 재시도 후): failed queue (Dead Letter Queue)   │
│  → Admin 알림 → 수동 처리                                │
└─────────────────────────────────────────────────────────┘
```

### 4.2 코드 구현

#### 4.2.1 Producer (Cron Trigger)

```javascript
// producer.js
const { Queue } = require('bullmq');
const { createClient } = require('@supabase/supabase-js');
const Redis = require('ioredis');

const connection = new Redis(process.env.UPSTASH_REDIS_URL, {
  maxRetriesPerRequest: null
});

const dataCollectionQueue = new Queue('data-collection', { connection });

async function enqueueDataCollectionJobs() {
  console.log('🚀 Enqueuing data collection jobs...');

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );

  // 활성 클라이언트 조회
  const { data: clients, error } = await supabase
    .from('clients')
    .select('id, client_id, client_name, meta_ad_account_id')
    .eq('is_active', true);

  if (error) throw error;

  console.log(`📋 Found ${clients.length} active clients`);

  const lastWeekStart = getLastWeekStart();
  const lastWeekEnd = getLastWeekEnd();

  // 각 클라이언트별로 Job 생성 (Staggering 적용)
  for (let i = 0; i < clients.length; i++) {
    const client = clients[i];

    // 클라이언트별로 0~10분 시차 적용
    const delayMs = (i * 60 * 1000) / clients.length;

    await dataCollectionQueue.add(
      'collect-data',
      {
        clientId: client.id,
        clientName: client.client_name,
        adAccountId: client.meta_ad_account_id,
        weekStart: lastWeekStart,
        weekEnd: lastWeekEnd
      },
      {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000
        },
        delay: delayMs,
        removeOnComplete: {
          age: 86400 * 7 // 7일 후 삭제
        },
        removeOnFail: false // 실패 작업은 보관
      }
    );

    console.log(`  ✅ Enqueued: ${client.client_name} (delay: ${Math.round(delayMs/1000)}s)`);
  }

  console.log(`🎉 Total ${clients.length} jobs enqueued`);
}

// 실행
enqueueDataCollectionJobs().catch(console.error);
```

#### 4.2.2 Worker (Job Processor)

```javascript
// worker.js
const { Worker } = require('bullmq');
const Redis = require('ioredis');
const { collectDataForClient } = require('./lib/collector');

const connection = new Redis(process.env.UPSTASH_REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  keepAlive: 30000, // ⭐ v1.2: Upstash Serverless 연결 유지
  family: 0 // ⭐ v1.2: IPv4/IPv6 자동 감지
});

const worker = new Worker(
  'data-collection',
  async (job) => {
    const { clientId, clientName, adAccountId, weekStart, weekEnd } = job.data;

    console.log(`🔄 Processing: ${clientName} (${job.id})`);

    try {
      // 실제 데이터 수집 로직
      const result = await collectDataForClient({
        clientId,
        adAccountId,
        weekStart,
        weekEnd
      });

      console.log(`✅ Completed: ${clientName} (${result.recordsCount} records)`);

      return {
        success: true,
        clientId,
        clientName,
        recordsCount: result.recordsCount,
        completedAt: new Date().toISOString()
      };

    } catch (error) {
      console.error(`❌ Failed: ${clientName}`, error);

      // 에러를 throw하면 BullMQ가 자동 재시도
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

// 이벤트 리스너
worker.on('completed', (job, result) => {
  console.log(`🎉 Job ${job.id} completed:`, result);
});

worker.on('failed', (job, error) => {
  console.error(`💥 Job ${job.id} failed:`, error.message);

  // 3회 재시도 후 최종 실패 시 Admin 알림
  if (job.attemptsMade >= 3) {
    sendAdminAlert(`Client ${job.data.clientName} 데이터 수집 실패`, error);
  }
});

worker.on('error', (error) => {
  console.error('Worker error:', error);
});

console.log('👷 Worker started (concurrency: 2)'); // ⭐ v1.2
```

### 4.3 Upstash Redis 설정

**무료 티어**:
- ✅ 10,000 commands/day (충분함)
- ✅ 전 세계 Edge 위치
- ✅ TLS/SSL 암호화

**환경 변수**:
```bash
UPSTASH_REDIS_URL=rediss://default:xxxxx@relaxed-starling-12345.upstash.io:6379
```

---

## 5. API 설계 (개선)

### 5.1 페이지네이션 표준 (신규)

**모든 목록 조회 API에 적용**:

```typescript
// Request Query Parameters
interface PaginationParams {
  page?: number;      // 페이지 번호 (1부터 시작, default: 1)
  limit?: number;     // 페이지당 개수 (default: 20, max: 100)
  sort_by?: string;   // 정렬 필드
  order?: 'asc' | 'desc'; // 정렬 방향
}

// Response
interface PaginatedResponse<T> {
  success: true;
  data: T[];
  pagination: {
    current_page: number;
    per_page: number;
    total_count: number;
    total_pages: number;
    has_next: boolean;
    has_prev: boolean;
  };
}
```

**예시**:

##### GET /api/dashboard/top-ads (업데이트)

**Query Parameters**:
```
?page=1
&limit=20
&sort_by=avg_cpl
&order=asc
&period=week
&week=47
&year=2025
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": [
    {
      "rank": 1,
      "ad_id": "120239569117950456",
      "ad_name": "20250808_고객이찾아오는영업",
      "campaign_name": "영업사원 캠페인",
      "total_leads": 45,
      "total_spend": 112.50,
      "avg_cpl": 2.50,
      "efficiency_grade": "S",
      "change_vs_prev": {
        "percent": -15.5,
        "absolute": -2.2
      }
    },
    ...
  ],
  "pagination": {
    "current_page": 1,
    "per_page": 20,
    "total_count": 87,
    "total_pages": 5,
    "has_next": true,
    "has_prev": false
  }
}
```

---

## 6. 웹 대시보드 설계 (개선)

### 6.1 KPI 카드 개선 (증감률 + 절대값)

**Before**:
```
총 리드
125건
↑18%
```

**After** (개선):
```
총 리드
125건 ↑18% (+19건)
전주: 106건
```

**컴포넌트 코드**:

```tsx
// components/KPICard.tsx
interface KPICardProps {
  title: string;
  value: number;
  unit?: string;
  comparison: {
    percent: number;    // 증감률 (%)
    absolute: number;   // 절대값
    previous: number;   // 이전 값
  };
}

export function KPICard({ title, value, unit = '', comparison }: KPICardProps) {
  const isPositive = comparison.percent > 0;
  const arrow = isPositive ? '↑' : '↓';
  const color = isPositive ? 'text-green-600' : 'text-red-600';

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <h3 className="text-sm text-gray-500 mb-2">{title}</h3>
      <div className="text-3xl font-bold mb-2">
        {value.toLocaleString()}{unit}
      </div>
      <div className={`text-sm ${color} font-medium`}>
        {arrow} {Math.abs(comparison.percent)}%
        ({comparison.absolute > 0 ? '+' : ''}{comparison.absolute.toLocaleString()}{unit})
      </div>
      <div className="text-xs text-gray-400 mt-1">
        전주: {comparison.previous.toLocaleString()}{unit}
      </div>
    </div>
  );
}
```

### 6.2 서버 사이드 차트 생성 (신규)

**장점**:
- ✅ QuickChart 의존성 제거
- ✅ 완전한 커스터마이징
- ✅ 브랜딩 (워터마크, 로고)
- ✅ Supabase Storage 캐싱으로 성능 향상

**구현**:

```typescript
// app/api/charts/[chartId]/route.ts
import puppeteer from 'puppeteer-core';
import chrome from '@sparticuz/chromium';
import { createClient } from '@supabase/supabase-js';

export async function GET(
  request: Request,
  { params }: { params: { chartId: string } }
) {
  const { chartId } = params;
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type'); // 'line' | 'bar' | 'pie'
  const clientId = searchParams.get('client_id');

  // 1. 캐시 확인
  const cachedUrl = await checkCache(chartId);
  if (cachedUrl) {
    return Response.redirect(cachedUrl);
  }

  // 2. 데이터 조회
  const data = await fetchChartData(clientId, type);

  // 3. HTML 템플릿 생성 (Recharts 사용)
  const html = generateChartHTML(data, type);

  // 4. Puppeteer로 스크린샷
  const browser = await puppeteer.launch({
    args: chrome.args,
    executablePath: await chrome.executablePath()
  });

  const page = await browser.newPage();
  await page.setContent(html);
  await page.setViewport({ width: 1200, height: 600 });

  const screenshot = await page.screenshot({ type: 'png' });
  await browser.close();

  // 5. Supabase Storage에 저장
  const supabase = createClient(...);
  const { data: uploadData } = await supabase.storage
    .from('charts')
    .upload(`${chartId}.png`, screenshot, {
      contentType: 'image/png',
      cacheControl: '3600' // 1시간 캐시
    });

  // 6. Public URL 반환
  const { data: { publicUrl } } = supabase.storage
    .from('charts')
    .getPublicUrl(`${chartId}.png`);

  return Response.redirect(publicUrl);
}
```

---

## 7. 데이터 파이프라인 (개선)

### 7.1 월간 집계 별도 Cron Job (개선)

```sql
-- 매월 1일 KST 10:00 (UTC 01:00)에 지난달 월간 집계 실행 ⭐ v1.2
SELECT cron.schedule(
  'generate-monthly-summary',
  '0 1 1 * *', -- UTC 01:00 = KST 10:00
  $$
  DO $$
  DECLARE
    client_record RECORD;
    last_month_year INTEGER;
    last_month_month INTEGER;
  BEGIN
    -- 지난달 계산
    last_month_year := EXTRACT(YEAR FROM CURRENT_DATE - INTERVAL '1 month');
    last_month_month := EXTRACT(MONTH FROM CURRENT_DATE - INTERVAL '1 month');

    -- 모든 활성 클라이언트에 대해 월간 집계 생성
    FOR client_record IN
      SELECT id FROM clients WHERE is_active = true
    LOOP
      PERFORM generate_monthly_summary(
        client_record.id,
        last_month_year,
        last_month_month
      );
    END LOOP;

    RAISE NOTICE 'Monthly summary generated for % clients',
      (SELECT COUNT(*) FROM clients WHERE is_active = true);
  END $$;
  $$
);
```

**독립성 확보**:
- ✅ 주간 작업 실패해도 월간 집계는 정상 실행
- ✅ raw_data 테이블에서 직접 집계 (weekly_summary 의존 X)
- ✅ 재실행 가능 (멱등성 보장)

---

## 8. 보안 강화 (개선)

### 8.1 Access Token 자동 갱신 (신규)

#### 8.1.1 토큰 저장 구조

```sql
-- clients 테이블에 토큰 관련 필드 추가
ALTER TABLE clients
ADD COLUMN meta_access_token_id UUID REFERENCES vault.secrets(id),
ADD COLUMN meta_refresh_token_id UUID REFERENCES vault.secrets(id),
ADD COLUMN token_expires_at TIMESTAMPTZ;

-- Index
CREATE INDEX idx_clients_token_expiry ON clients(token_expires_at);
```

#### 8.1.2 토큰 갱신 함수

```javascript
// lib/token-manager.js
const { createClient } = require('@supabase/supabase-js');

async function refreshMetaToken(clientId) {
  const supabase = createClient(...);

  // 1. Vault에서 Refresh Token 조회
  const { data: client } = await supabase
    .from('clients')
    .select('meta_refresh_token_id')
    .eq('id', clientId)
    .single();

  const { data: secretData } = await supabase.rpc('vault_read_secret', {
    secret_id: client.meta_refresh_token_id
  });

  const refreshToken = secretData.secret;

  // 2. Meta OAuth Token Exchange
  const response = await fetch(
    'https://graph.facebook.com/v22.0/oauth/access_token',
    {
      method: 'POST',
      body: new URLSearchParams({
        grant_type: 'fb_exchange_token',
        client_id: process.env.META_APP_ID,
        client_secret: process.env.META_APP_SECRET,
        fb_exchange_token: refreshToken
      })
    }
  );

  const { access_token, expires_in } = await response.json();

  // 3. 새 Access Token을 Vault에 저장
  const { data: newSecret } = await supabase.rpc('vault_create_secret', {
    secret: access_token,
    name: `meta_access_token_${clientId}_${Date.now()}`
  });

  // 4. clients 테이블 업데이트
  await supabase
    .from('clients')
    .update({
      meta_access_token_id: newSecret.id,
      token_expires_at: new Date(Date.now() + expires_in * 1000).toISOString()
    })
    .eq('id', clientId);

  return access_token;
}

// 토큰 만료 확인 및 자동 갱신
async function ensureValidToken(clientId) {
  const { data: client } = await supabase
    .from('clients')
    .select('token_expires_at')
    .eq('id', clientId)
    .single();

  // 만료 1시간 전이면 갱신
  if (new Date(client.token_expires_at) < new Date(Date.now() + 3600000)) {
    console.log(`🔄 Refreshing token for client ${clientId}`);
    await refreshMetaToken(clientId);
  }
}
```

#### 8.1.3 Cron Job으로 토큰 갱신 모니터링

```sql
-- 매일 08:00 (UTC)에 만료 예정 토큰 확인
SELECT cron.schedule(
  'check-expiring-tokens',
  '0 8 * * *',
  $$
  SELECT notify_expiring_tokens();
  $$
);

CREATE OR REPLACE FUNCTION notify_expiring_tokens()
RETURNS VOID AS $$
DECLARE
  expiring_count INTEGER;
BEGIN
  -- 7일 이내 만료 예정 토큰 카운트
  SELECT COUNT(*) INTO expiring_count
  FROM clients
  WHERE is_active = true
    AND token_expires_at < CURRENT_TIMESTAMP + INTERVAL '7 days';

  IF expiring_count > 0 THEN
    -- Admin에게 알림 (pg_net 또는 외부 API 호출)
    RAISE NOTICE '⚠️ % tokens expiring within 7 days', expiring_count;

    -- TODO: Telegram/Email 알림 전송
  END IF;
END;
$$ LANGUAGE plpgsql;
```

---

## 9. 개발 로드맵 (재정의)

### 🎯 현실적인 MVP 범위

**제외 항목** (Phase 2로 연기):
- ❌ Telegram 리포트 (MVP에서 제외)
- ❌ PDF 리포트 생성 (MVP에서 제외)
- ❌ 고급 차트 (Line Chart만 포함)

**MVP 핵심 기능**:
- ✅ Meta API 자동 수집 (Job Queue 적용)
- ✅ Supabase 저장 및 주간 집계
- ✅ 로그인 + 기본 대시보드
- ✅ KPI 카드 (개선된 증감률 표시)
- ✅ 주간 트렌드 Line Chart 1개
- ✅ TOP 광고 테이블
- ✅ 파티셔닝 자동화

---

### Phase 1: MVP (3주) - 2025년 12월 9일까지

**Week 1** (11/18 ~ 11/24) - 인프라 구축:
- [ ] Supabase 프로젝트 생성
- [ ] PostgreSQL 스키마 구축 (clients, raw_data, weekly_summary)
- [ ] Row Level Security 설정
- [ ] pg_cron 설정 (파티셔닝 자동화)
- [ ] Upstash Redis 생성
- [ ] BullMQ Job Queue 구현
- [ ] Railway 배포 (Producer + Worker)

**Week 2** (11/25 ~ 12/1) - 데이터 수집:
- [ ] Meta API → Supabase 연동
- [ ] Job Queue 테스트
- [ ] Weekly Summary 자동 생성 로직
- [ ] Staggering 적용 및 테스트
- [ ] 에러 핸들링 및 재시도 로직
- [ ] Dead Letter Queue 처리

**Week 3** (12/2 ~ 12/9) - 웹 대시보드:
- [ ] Next.js 14 프로젝트 초기화
- [ ] Supabase Auth 연동
- [ ] 로그인/로그아웃 페이지
- [ ] 메인 대시보드 레이아웃
- [ ] KPI 카드 4개 (개선된 UI)
- [ ] 주간 트렌드 Line Chart (Recharts)
- [ ] TOP 광고 테이블 (페이지네이션)
- [ ] Vercel 배포
- [ ] 통합 테스트

**Deliverable**:
- ✅ 안정적인 자동 데이터 수집 (Job Queue)
- ✅ 로그인 + 기본 대시보드
- ✅ 주간 통계 조회 및 시각화
- ✅ 파티셔닝 자동화 운영

---

### Phase 2: 고급 기능 (2주) - 2025년 12월 23일까지

**Week 4** (12/10 ~ 12/16):
- [ ] 차트 5개 추가 (Bar, Pie, Donut)
- [ ] 플랫폼/디바이스별 분석
- [ ] 월간/분기 통계 View
- [ ] 서버 사이드 차트 생성 (Puppeteer)
- [ ] Supabase Storage 캐싱

**Week 5** (12/17 ~ 12/23):
- [ ] PDF 리포트 생성 (jsPDF)
- [ ] Telegram 리포트 (차트 이미지 포함)
- [ ] QuickChart fallback 구현
- [ ] 광고별 상세 페이지
- [ ] 반응형 디자인 (모바일)

**Deliverable**:
- ✅ 완전한 시각화 대시보드
- ✅ PDF + Telegram 리포트
- ✅ 고급 통계 분석

---

### Phase 3: 자동 리포팅 및 고도화 (3주) - 2026년 1월 27일까지

**Week 6** (12/24 ~ 12/30): Railway 배포 및 자동화
- [ ] GitHub 리포지토리 생성 및 코드 푸시
- [ ] Railway 프로젝트 생성
- [ ] Worker 배포 (Start Command: `npm run worker`)
- [ ] 환경 변수 설정 (Supabase, Redis, Meta API, Telegram)
- [ ] Cron Job 추가: 매주 월요일 09:00 KST (UTC 00:00)
- [ ] 배포 확인 및 로그 모니터링

**Week 7** (12/31 ~ 1/6): 시각화 및 분석 고도화
- [ ] 기간별 분석 전략 구현 (주간/월간/분기)
- [ ] KPI Scorecard 개선 (증감률 + 절대값 + 이전 기간 값)
- [ ] Daily Trend Line (이번 주 vs 지난주 겹쳐서 표시)
- [ ] 요일별 히트맵 (CTR/CPL 효율 비교)
- [ ] Efficiency Grade 변동 추적 (S/A/B/C 등급 변화)
- [ ] Budget Pacing (월 예산 대비 소진율)
- [ ] Cumulative Spend/Leads (누적 그래프)
- [ ] Platform/Device Pie Chart

**Week 8** (1/7 ~ 1/13): 텔레그램 자동 리포팅
- [ ] 리포팅 전용 Python 스크립트 작성 (`lib/reporter.py`)
- [ ] 분석 로직 구현 (Rule-based Insight Generation)
- [ ] 차트 이미지 생성 (Plotly + Kaleido)
- [ ] 텔레그램 메시지 포맷 구현
- [ ] Railway Cron 설정:
  - 주간 리포트: 매주 화요일 09:00 (UTC 00:00)
  - 월간 리포트: 매월 2일 09:00 (UTC 00:00)
- [ ] Streamlit 관리자 설정 페이지 (리포트 설정)
- [ ] 테스트 및 검증

**Deliverable**:
- ✅ Railway 자동 스케줄링 (매주 월요일 데이터 수집)
- ✅ 기간별 비교 분석 (WoW, MoM, QoQ)
- ✅ 자동 텔레그램 리포트 (주간/월간)
- ✅ 차트 이미지 자동 생성
- ✅ AI 기반 인사이트 생성 (Rule-based)

---

### Phase 4: 멀티 클라이언트 및 확장 (2주) - 2026년 2월 10일까지

**Week 9** (1/14 ~ 1/20):
- [ ] 2-3개 추가 클라이언트 등록
- [ ] 멀티 클라이언트 기능 검증
- [ ] 클라이언트별 독립 대시보드
- [ ] 권한 관리 (RLS)

**Week 10** (1/21 ~ 1/27):
- [ ] PDF 리포트 생성 (jsPDF)
- [ ] 광고별 상세 페이지
- [ ] 반응형 디자인 (모바일)
- [ ] 최종 통합 테스트

**Deliverable**:
- ✅ 멀티 클라이언트 지원
- ✅ PDF 다운로드 기능
- ✅ 모바일 최적화
- ✅ 프로덕션 환경 완성

---

## 9.5. 시각화 및 분석 리포팅 구현 가이드 (Phase 3 상세)

### 9.5.1 기간별 분석 전략 (Analysis Strategy)

데이터를 누적하며 비교 분석할 때, 각 주기(Weekly, Monthly, Quarterly)마다 확인해야 할 **핵심 질문(Key Questions)**과 시각화 방법이 다릅니다.

#### A. 주간 분석 (Weekly) - "기민한 대응"

**핵심 질문**:
- "지난주 대비 효율이 급격히 떨어진 광고는 무엇인가?"
- "주말 효율은 어떠했는가?"

**비교 대상**: Current Week vs Previous Week (WoW - Week over Week)

**주요 시각화**:

1. **KPI Scorecard**
   - 노출, 클릭, 지출, 리드, CPL의 전주 대비 증감률(%) 및 절대값 차이
   - 예: `125건 ↑18% (+19건)` + `이전 기간: 106건`

2. **Daily Trend Line**
   - 이번 주 vs 지난주 일별 추이를 겹쳐서 표시
   - 회색 점선: 지난주, 실선: 이번 주

3. **요일별 히트맵**
   - 요일별 CTR/CPL 효율 비교
   - 예: "화요일 효율이 가장 높음"

4. **Efficiency Grade 변동**
   - S/A/B/C 등급이 지난주 대비 변동된 광고 리스트

#### B. 월간 분석 (Monthly) - "예산 및 방향성"

**핵심 질문**:
- "이번 달 예산 소진 속도는 적절한가?"
- "캠페인 목표를 달성했는가?"

**비교 대상**: Current Month vs Previous Month (MoM)

**주요 시각화**:

1. **Budget Pacing (속도계)**
   - 월 예산 대비 현재 소진율
   - 이상적 소진율 라인 포함

2. **Cumulative Spend/Leads**
   - 월초부터 월말까지 누적 그래프
   - 목표 달성 여부 확인

3. **Platform/Device Pie Chart**
   - 플랫폼(FB/IG) 및 디바이스별 점유율 변화

#### C. 분기/반기/연간 (Long-term) - "전략적 인사이트"

**핵심 질문**:
- "계절적 요인(Seasonality)이 존재하는가?"
- "크리에이티브 피로도는 언제 오는가?"

**비교 대상**: Current Q vs Previous Q (QoQ) 또는 Year over Year (YoY)

**주요 시각화**:

1. **Bar Chart (Monthly Aggregate)**
   - 월별 막대 그래프로 장기 추세 확인

2. **Creative Fatigue Analysis**
   - 광고 소재별 수명 주기(Life Cycle) 분석
   - CPL 상승 시점 포착

---

### 9.5.2 유의미한 통계 및 텍스트 생성 (Insight Generation)

단순히 그래프만 보여주는 것이 아니라, **"해석된 텍스트"**를 제공해야 합니다.

#### 분석 로직 예시 (Rule-based Analysis)

```python
# utils/insight_generator.py
def generate_weekly_insight(current, previous):
    """
    주간 분석 코멘트 생성 로직

    Args:
        current (dict): 현재 주간 데이터
        previous (dict): 이전 주간 데이터

    Returns:
        list: 인사이트 텍스트 리스트
    """
    insights = []

    # 1. CPL(효율) 분석
    cpl_change = ((current['cpl'] - previous['cpl']) / previous['cpl']) * 100

    if cpl_change > 20:
        insights.append(
            f"🔴 **경고**: 리드당 비용(CPL)이 전주 대비 {cpl_change:.1f}% 급증했습니다. "
            f"소재 교체가 시급합니다."
        )
    elif cpl_change < -20:
        insights.append(
            f"🟢 **호재**: 효율이 {abs(cpl_change):.1f}% 개선되었습니다. "
            f"예산 증액을 고려하세요."
        )

    # 2. CTR(반응률) 분석
    if current['ctr'] < 1.0:
        insights.append(
            "⚠️ **주의**: 평균 클릭률(CTR)이 1% 미만(저조)입니다. "
            "썸네일/카피 수정이 필요합니다."
        )

    # 3. 지출 vs 리드 불균형
    spend_change = ((current['spend'] - previous['spend']) / previous['spend']) * 100
    leads_change = ((current['leads'] - previous['leads']) / previous['leads']) * 100

    if spend_change > 10 and leads_change < -10:
        insights.append(
            "⚠️ **불균형**: 지출은 증가했지만 리드는 감소했습니다. "
            "타겟팅 재검토가 필요합니다."
        )

    return "\n".join(insights) if insights else "✅ 전반적으로 안정적인 성과를 유지하고 있습니다."
```

---

### 9.5.3 텔레그램 자동 리포팅 시스템 아키텍처

**목표**: 지정된 시간(화요일 09:00 등)에 텍스트 요약 + 주요 차트 이미지를 텔레그램으로 전송

#### 시스템 구조

```
┌─────────────────────────────────────────────────────────────┐
│                Railway Cron Job (Reporter)                  │
│ 1. Trigger: 설정된 Cron Schedule (화 09:00, 매월 2일 09:00)   │
│ 2. Action:                                                  │
│    a. Supabase에서 해당 기간(주간/월간) 데이터 조회            │
│    b. Python Script 실행 (pandas + plotly + kaleido)         │
│       → 데이터 집계 및 비교 분석                             │
│       → 차트 이미지 생성 (.png)                              │
│       → 요약 텍스트 생성 (GPT-4o 연동 권장, 또는 룰베이스)      │
│    c. Telegram API로 메시지 + 사진 전송                       │
└─────────────────────────────────────────────────────────────┘
```

#### 리포트 전송 스케줄 (Railway Cron 설정)

Railway Cron은 UTC 기준이므로 KST 09:00은 UTC 00:00입니다.

| 리포트 종류 | KST 실행 시간 | Railway Cron Expression (UTC) | 비고 |
|------------|-------------|------------------------------|------|
| 주간 리포트 | 매주 화요일 09:00 | `0 0 * * 2` | 월~일 데이터 집계 후 화요일 발송 |
| 월간 리포트 | 매월 2일 09:00 | `0 0 2 * *` | 1일은 데이터 마감/검증, 2일 발송 |
| 분기 리포트 | 1, 4, 7, 10월 2일 | `0 0 2 1,4,7,10 *` | 분기/반기 통합 로직 처리 |

#### 텔레그램 메시지 포맷 (예시)

```
[BAS] 📅 11월 2주차 주간 리포트
(기간: 2025.11.11 ~ 11.17)

📊 핵심 성과 요약
• 지출: 1,540,000원 (🔺12%)
• 리드: 45건 (🔻5%)
• CPL: 34,220원 (🔺18%) → 🔴 효율 저하

💡 주요 인사이트
1. 전주 대비 지출은 늘었으나 리드 수는 감소하여 효율이 떨어졌습니다.
2. '고객찾기_V2' 소재의 피로도가 높은 것으로 추정됩니다.
3. 주말(토,일) CTR이 평일 대비 30% 낮습니다.

📎 첨부: 주간_성과_차트.png
```

---

### 9.5.4 구현 로드맵 (Action Plan)

#### Step 1: 리포팅 전용 스크립트 작성 (`lib/reporter.py`)

Node.js보다 Python을 사용하는 것을 권장합니다. Streamlit에서 이미 Plotly와 Pandas를 사용하고 있으므로, 차트 생성 로직을 공유할 수 있기 때문입니다.

**필요 라이브러리**:
- `python-telegram-bot`: 메시지 전송
- `kaleido`: Plotly 차트를 이미지로 변환
- `pandas`, `plotly`: 데이터 처리 및 시각화

#### Step 2: 차트 이미지 생성 함수 구현

```python
# utils/report_generator.py
import plotly.io as pio
import plotly.graph_objects as go

def generate_chart_image(fig, filename):
    """
    Plotly 객체를 이미지로 저장

    Args:
        fig: Plotly Figure 객체
        filename: 저장할 파일명 (확장자 제외)

    Returns:
        str: 저장된 이미지 경로
    """
    output_path = f"temp/{filename}.png"
    fig.write_image(output_path, width=800, height=500)
    return output_path
```

#### Step 3: 스케줄러(Railway) 설정

Railway에서 새로운 Service를 생성하거나 기존 Worker Service에 Python 환경을 추가하여 Cron Job을 등록합니다.

**필요 파일**:
```
lib/
├── reporter.py           # 메인 리포터
├── insight_generator.py  # 인사이트 생성
└── telegram_sender.py    # 텔레그램 전송

requirements-reporter.txt  # Python 의존성
```

#### Step 4: 관리자 설정 기능 (Streamlit 추가)

Streamlit 대시보드에 "리포트 설정" 페이지를 추가하여 다음을 관리자가 직접 입력하게 합니다:
- 텔레그램 챗 ID
- 알림 수신 여부 (ON/OFF)
- 리포트 주기 설정 (주간/월간/분기)

---

### 9.5.5 추천 수정 사항 (현재 구현 대비)

1. **Weekly Summary 테이블 활용**
   - 현재 `generate_weekly_summary` 함수가 잘 작동하므로
   - 리포팅 시 `raw_data`를 매번 쿼리하기보다 `weekly_summary` 테이블을 조회하여 속도 향상

2. **메시지 템플릿화**
   - 텔레그램 메시지 포맷을 코드에 하드코딩하지 말고
   - 별도의 템플릿 파일 (YAML 또는 JSON)로 분리하여 유지보수 용이

3. **이미지 생성 엔진**
   - Railway(Linux 환경)에서 이미지 생성을 위해 `kaleido` 패키지 설치 필요
   - `requirements-reporter.txt`에 꼭 포함:
     ```
     kaleido==0.2.1
     python-telegram-bot==20.7
     plotly==5.24.1
     pandas==2.2.3
     supabase==2.11.2
     ```

4. **에러 핸들링 및 재시도**
   - Telegram API 호출 실패 시 3회 재시도
   - Supabase 연결 실패 시 Admin에게 알림
   - 차트 생성 실패 시 텍스트만 전송

---

## 10. 배포 및 운영

### 10.1 환경 변수 (업데이트)

#### Railway (Producer + Worker)

```bash
# Meta Ads API
META_APP_ID=1474546053653616
META_APP_SECRET=5d3ea72d4293c8f78842334b8558175c

# Supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGc...

# Upstash Redis (Job Queue)
UPSTASH_REDIS_URL=rediss://default:xxx@xxx.upstash.io:6379

# Telegram
TELEGRAM_BOT_TOKEN=7947112373:...
TELEGRAM_ADMIN_CHAT_ID=-1003394139746
```

### 10.2 모니터링 대시보드

**BullMQ UI** (Bull Board):
```javascript
// server.js (Railway)
const { createBullBoard } = require('@bull-board/api');
const { BullMQAdapter } = require('@bull-board/api/bullMQAdapter');
const { ExpressAdapter } = require('@bull-board/express');

const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/admin/queues');

createBullBoard({
  queues: [new BullMQAdapter(dataCollectionQueue)],
  serverAdapter
});

app.use('/admin/queues', serverAdapter.getRouter());
```

**URL**: `https://your-app.railway.app/admin/queues`

**기능**:
- ✅ Job 상태 실시간 조회
- ✅ 실패한 Job 재시도
- ✅ Queue 통계 (처리량, 대기 중)

---

## 11. 비용 분석 (업데이트)

### 11.1 초기 비용 (MVP)

| 서비스 | 플랜 | 비용 | 비고 |
|--------|------|------|------|
| **Supabase** | Free | $0/월 | 500MB DB |
| **Railway** | Developer | $10/월 | Cron + Worker (업그레이드) |
| **Upstash Redis** | Free | $0/월 | 10K commands/day |
| **Vercel** | Hobby | $0/월 | Next.js |
| **Cloudflare** | Free | $0/월 | DNS + CDN |

**월간 총 비용**: **$10/월**
**연간 총 비용**: **$120/년**

*(v1.0 대비 $5 증가 - Job Queue 도입)*

---

## 12. 부록

### 12.1 변경 이력

| 버전 | 날짜 | 변경 내용 |
|------|------|----------|
| 1.0.0 | 2025-11-18 | 초안 작성 |
| 1.1.0 | 2025-11-18 | 리뷰 피드백 반영 (Job Queue, 파티셔닝 자동화, Token 갱신 등) |
| 1.2.0 | 2025-11-19 | Phase 2 (Streamlit 대시보드) 완료 반영 |
| 1.3.0 | 2025-11-19 | Phase 3 상세 계획 추가 (시각화 및 자동 리포팅 가이드) |

### 12.2 참고 자료 (추가)

- [BullMQ 공식 문서](https://docs.bullmq.io)
- [Upstash Redis](https://upstash.com)
- [Supabase Vault](https://supabase.com/docs/guides/database/vault)
- [pg_cron](https://github.com/citusdata/pg_cron)
- [Puppeteer](https://pptr.dev)

---

**문서 버전**: 1.3.0
**최종 수정**: 2025-11-19
**다음 리뷰**: 2025-12-15

---

**승인**:
- [x] 프로젝트 매니저 (리뷰 피드백 반영 완료)
- [ ] 기술 리더
- [ ] 클라이언트
