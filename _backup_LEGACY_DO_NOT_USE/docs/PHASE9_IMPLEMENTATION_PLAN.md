# Phase 9 구현 계획

## 목표
주간/월간 리포트 자동 생성 + AI 인사이트 통합

---

## 1. 주간/월간 리포트 자동 생성

### 1.1 리포트 생성 API
**파일**: `dashboard/app/api/reports/generate/route.ts`

```typescript
POST /api/reports/generate
{
  "type": "weekly" | "monthly",
  "startDate": "2025-11-18",
  "endDate": "2025-11-24"
}

Response:
{
  "reportId": "uuid",
  "type": "weekly",
  "period": "2025-11-18 ~ 2025-11-24",
  "metrics": {
    "impressions": 1234567,
    "clicks": 12345,
    "ctr": 1.0,
    "spend": 10493250
  },
  "comparison": {
    "impressions": { "value": 1234567, "change": 15.3, "trend": "up" },
    "clicks": { "value": 12345, "change": -3.2, "trend": "down" }
  },
  "topCampaigns": [...],
  "lowPerformanceAds": [...],
  "aiInsight": "..."
}
```

### 1.2 DB 테이블
```sql
CREATE TABLE reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_type VARCHAR(20) NOT NULL, -- 'weekly', 'monthly'
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  metrics JSONB NOT NULL,
  comparison JSONB,
  top_campaigns JSONB,
  low_performance_ads JSONB,
  ai_insight TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_reports_period ON reports(period_start, period_end, report_type);
```

---

## 2. AI 인사이트 생성

### 2.1 Claude API 통합
**파일**: `lib/ai-insights.ts`

```typescript
import Anthropic from '@anthropic-ai/sdk';

export async function generateInsight(data: ReportData) {
  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY
  });

  const prompt = `
당신은 Meta 광고 성과 분석 전문가입니다.
아래 데이터를 바탕으로 주간 리포트 인사이트를 작성해주세요.

**중요**: 아래 제공된 실제 데이터만 사용하고, 추측하지 마세요.

데이터:
${JSON.stringify(data, null, 2)}

형식:
💡 주요 발견사항: (3줄 이내)
⚠️ 주의사항: (2줄 이내)
📊 추천 액션: (3개 이내)
`;

  const message = await anthropic.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }]
  });

  return message.content[0].text;
}
```

### 2.2 데이터 수집
**파일**: `lib/report-data.ts`

```typescript
export async function collectReportData(startDate: string, endDate: string) {
  const supabase = createClient();

  // 1. 기간별 메트릭
  const { data: metrics } = await supabase
    .from('v_daily_trend_7d')
    .select('*');

  // 2. 캠페인 Top 5
  const { data: topCampaigns } = await supabase
    .from('v_top_campaigns_30d')
    .select('*')
    .limit(5);

  // 3. 저성과 광고
  const { data: lowPerformance } = await supabase
    .from('v_low_performance_ads_7d')
    .select('*');

  // 4. 플랫폼/디바이스 성과
  const { data: platformPerf } = await supabase
    .from('v_platform_performance_30d')
    .select('*');

  return {
    metrics,
    topCampaigns,
    lowPerformance,
    platformPerf
  };
}
```

---

## 3. 비교 모드 (이번 주 vs 지난 주)

### 3.1 비교 API
**파일**: `dashboard/app/api/compare/route.ts`

```typescript
GET /api/compare?period=week
GET /api/compare?period=month

Response:
{
  "current": {
    "startDate": "2025-11-18",
    "endDate": "2025-11-24",
    "metrics": { ... }
  },
  "previous": {
    "startDate": "2025-11-11",
    "endDate": "2025-11-17",
    "metrics": { ... }
  },
  "comparison": {
    "impressions": { "change": 15.3, "trend": "up" },
    "ctr": { "change": -16.1, "trend": "down" }
  }
}
```

---

## 4. 엑셀 다운로드

### 4.1 라이브러리 설치
```bash
npm install xlsx
```

### 4.2 다운로드 API
**파일**: `dashboard/app/api/export/route.ts`

```typescript
import * as XLSX from 'xlsx';

POST /api/export
{
  "type": "current" | "report",
  "reportId": "uuid" (optional)
}

Response: Excel 파일 다운로드
```

---

## 5. 텔레그램 알림

### 5.1 텔레그램 봇 설정
- 기존 `test-telegram-report.js` 확장
- Cron 설정: 매주 월요일 오전 9시

### 5.2 알림 내용
```
📊 BAS Meta 광고 주간 리포트
기간: 2025-11-18 ~ 2025-11-24

📈 주요 지표:
노출수: 1,234,567 (▲ 15.3%)
클릭수: 12,345 (▼ 3.2%)
CTR: 1.0% (▼ 16.1%)
지출: ₩10,493,250

🤖 AI 인사이트:
💡 CTR 하락은 노출수 증가 대비 클릭수 감소로 인한 것으로, 광고 소재 점검이 필요합니다.

🔗 전체 리포트 보기: https://your-dashboard.vercel.app/reports/uuid
```

---

## 6. SEO 차단 및 보안

### 6.1 robots.txt
**파일**: `dashboard/public/robots.txt`
```
User-agent: *
Disallow: /
```

### 6.2 메타 태그 (noindex)
**파일**: `dashboard/app/layout.tsx`
```tsx
export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false
  }
};
```

### 6.3 인증 (선택)
- Vercel 자체 비밀번호 보호 또는
- Next.js Middleware로 간단한 인증

---

## 구현 우선순위

1. ✅ SEO 차단 (5분)
2. ✅ 비교 모드 API (30분)
3. ✅ 엑셀 다운로드 (30분)
4. ✅ 리포트 생성 API + AI 인사이트 (1시간)
5. ✅ 텔레그램 알림 통합 (30분)
6. ✅ UI 구현 (1시간)

**총 예상 시간**: 3.5시간

---

## 다음 단계

1. 사용자 승인 대기
2. 구현 시작 (TodoWrite로 추적)
3. 단계별 검증
4. Vercel 배포
