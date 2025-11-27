# BAS Meta Ads - 시스템 아키텍처 설계서

> **최종 수정**: 2025-11-26
> **버전**: 2.0 (구조 재정비 완료)

---

## 1. 시스템 개요

BAS Meta Ads Analytics는 다중 클라이언트의 Meta 광고 데이터를 수집, 분석하고 자동 리포트를 발송하는 시스템입니다.

```
┌─────────────────────────────────────────────────────────────┐
│                      Meta Ads API                           │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
        ┌─────────────────────────────────────┐
        │         데이터 수집 방식            │
        │  ┌───────────────┐  ┌───────────┐  │
        │  │ 일일 수집     │  │ 백필 API  │  │
        │  │ (Cron 03:00)  │  │ (수동)    │  │
        │  └───────┬───────┘  └─────┬─────┘  │
        └──────────┼────────────────┼────────┘
                   │                │
                   ▼                ▼
        ┌─────────────────────────────────────┐
        │          raw_data 테이블            │  ← 원본 저장 (유일한 저장소)
        └────────────────┬────────────────────┘
                         │
                         ▼ (VIEW 자동 집계)
        ┌─────────────────────────────────────┐
        │     ads_insights_daily (VIEW)       │  ← 대시보드 조회
        └────────────────┬────────────────────┘
                         │
            ┌────────────┴────────────┐
            ▼                         ▼
┌───────────────────┐     ┌───────────────────┐
│    대시보드       │     │  텔레그램 리포트  │
│ (Vercel/Railway)  │     │  (주간/월간)      │
└───────────────────┘     └───────────────────┘
```

---

## 2. 프로젝트 파일 구조

```
F:\bas_meta\
│
├── 📂 핵심 스크립트
│   ├── collect-all-clients.js     # 멀티 클라이언트 데이터 수집 ⭐
│   ├── cron-collect-data.js       # Cron Job 진입점
│   ├── start-all.js               # Railway 시작점
│   ├── index.js                   # 서버 진입점
│   │
│   ├── send-weekly-report.js      # 주간 리포트 발송 ⭐
│   ├── send-monthly-report.js     # 월간 리포트 발송
│   ├── send-report-now.js         # 즉시 리포트 발송 (테스트용)
│   └── resend-report.js           # 리포트 재발송
│
├── 📂 유틸리티 스크립트
│   ├── add-new-client.js          # 클라이언트 추가
│   ├── preview-report.js          # 리포트 미리보기
│   ├── regenerate-ai-insights.js  # AI 인사이트 재생성
│   ├── send-dashboard-link.js     # 대시보드 링크 발송
│   │
│   ├── check-clients.js           # 클라이언트 목록 확인
│   ├── check-raw-data.js          # raw_data 확인
│   ├── check-daily-data.js        # 일별 데이터 확인
│   ├── check-weekly-data.js       # 주간 데이터 확인
│   ├── check-7day-data.js         # 7일 데이터 확인
│   ├── check-weekly-summary.js    # weekly_summary 확인
│   ├── check-archive-data.js      # 아카이브 데이터 확인
│   └── check-data-dates.js        # 날짜별 데이터 확인
│
├── 📂 lib/ (라이브러리)
│   ├── backfill.js                # 백필 로직
│   ├── encryption.js              # 토큰 암호화/복호화
│   ├── token-manager.js           # 토큰 관리
│   ├── meta.js                    # Meta API 호출
│   ├── telegram.js                # 텔레그램 기본 API
│   ├── telegram-notifier.js       # 텔레그램 알림
│   ├── telegram-chart.js          # 텔레그램 차트 생성
│   ├── chart-generator.js         # 차트 생성
│   ├── data-integrity.js          # 데이터 무결성 검사
│   ├── monthly-summary.js         # 월간 요약 생성
│   ├── report-storage.js          # 리포트 저장
│   └── reporter/                  # 리포트 생성 모듈
│
├── 📂 sql/ (데이터베이스 스키마)
│   ├── 01_schema.sql              # 기본 테이블 (clients, raw_data)
│   ├── 02_functions_timezone.sql  # 타임존 함수
│   ├── 03_vault_functions.sql     # Vault 함수
│   ├── 04_ads_insights_daily_view.sql  # VIEW 정의
│   ├── 17_fix_ads_insights_view.sql    # VIEW 수정 (현재 사용) ⭐
│   └── ... (마이그레이션 파일들)
│
├── 📂 dashboard/ (Next.js 대시보드)
│   ├── app/
│   │   ├── api/backfill/route.ts  # 백필 API ⭐
│   │   └── ...
│   └── lib/api.ts                 # 대시보드 API 함수
│
├── 📂 _backup/ (미사용 파일 백업)
│   ├── scripts/                   # 레거시/일회성 스크립트
│   ├── lib/                       # Redis 의존 라이브러리
│   ├── docs/                      # 이전 문서들
│   │   └── 회고/                  # 작업 회고록
│   └── sql/
│
├── DATA_ARCHITECTURE.md           # 이 문서 ⭐
├── README.md                      # 프로젝트 소개
└── NEXT_SESSION.md                # 다음 세션 안내
```

---

## 3. 데이터베이스 구조

### 3.1 clients (클라이언트 정보)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| client_id | VARCHAR | 고유 ID (UNIQUE) |
| client_name | VARCHAR | 회사명 |
| meta_ad_account_id | VARCHAR | Meta 광고 계정 ID |
| encrypted_access_token | TEXT | AES-256 암호화된 토큰 |
| is_active | BOOLEAN | 활성 상태 |
| telegram_chat_id | VARCHAR | 텔레그램 알림 채팅 ID |
| service_start_date | DATE | 서비스 시작일 |
| service_end_date | DATE | 서비스 종료일 |

### 3.2 raw_data (원본 광고 데이터) ⭐ 핵심

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | BIGSERIAL | PK |
| client_id | UUID | FK → clients |
| date | DATE | 광고 운영 날짜 |
| ad_id | VARCHAR | 광고 ID |
| ad_name | VARCHAR | 광고명 |
| campaign_id | VARCHAR | 캠페인 ID |
| campaign_name | VARCHAR | 캠페인명 |
| platform | VARCHAR | facebook/instagram |
| device | VARCHAR | mobile/desktop |
| currency | VARCHAR | KRW/USD |
| impressions | INTEGER | 노출수 |
| reach | INTEGER | 도달수 |
| clicks | INTEGER | 클릭수 |
| leads | INTEGER | 리드수 |
| spend | DECIMAL | 지출액 |

**UNIQUE 제약**: `(client_id, date, ad_id, platform, device)`

### 3.3 ads_insights_daily (VIEW) ⭐ 대시보드 소스

> ⚠️ **중요**: 테이블이 아니라 **VIEW**입니다. INSERT/UPDATE 불가!

```sql
CREATE VIEW ads_insights_daily AS
SELECT
  client_id, date, platform, campaign_name, ad_name,
  SUM(impressions) as impressions,
  SUM(reach) as reach,
  SUM(clicks) as clicks,
  SUM(leads) as leads,
  SUM(spend) as spend,
  -- KPI 자동 계산
  CASE WHEN SUM(impressions) > 0 THEN ROUND((SUM(clicks)::DECIMAL / SUM(impressions) * 100), 2) ELSE 0 END as ctr,
  CASE WHEN SUM(clicks) > 0 THEN ROUND((SUM(leads)::DECIMAL / SUM(clicks) * 100), 2) ELSE 0 END as cvr,
  CASE WHEN SUM(leads) > 0 THEN ROUND((SUM(spend) / SUM(leads)), 2) ELSE 0 END as cpl,
  CASE WHEN SUM(clicks) > 0 THEN ROUND((SUM(spend) / SUM(clicks)), 2) ELSE 0 END as cpc,
  CASE WHEN SUM(impressions) > 0 THEN ROUND((SUM(spend) / SUM(impressions) * 1000), 2) ELSE 0 END as cpm
FROM raw_data
GROUP BY client_id, date, platform, campaign_name, ad_name
ORDER BY date DESC, spend DESC;
```

### 3.4 weekly_summary (주간 집계)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| client_id | UUID | FK |
| week_start | DATE | 주 시작일 (월요일) |
| week_end | DATE | 주 종료일 (일요일) |
| ad_name | VARCHAR | 광고명 |
| total_impressions | INTEGER | 주간 노출 합계 |
| total_clicks | INTEGER | 주간 클릭 합계 |
| total_leads | INTEGER | 주간 리드 합계 |
| total_spend | DECIMAL | 주간 지출 합계 |

---

## 4. 주요 데이터 흐름

### 4.1 일일 데이터 수집 (Cron)

```
Railway: bas-meta-cron-collector (03:00 KST)
  └─→ cron-collect-data.js
      └─→ collect-all-clients.js
          ├─→ clients 테이블에서 is_active=true 조회
          ├─→ 각 클라이언트별 토큰 복호화 (AES-256)
          ├─→ Meta API 호출 (기본 7일)
          ├─→ raw_data UPSERT
          └─→ 텔레그램 알림 (-1003394139746)
```

**사용법**:
```bash
node collect-all-clients.js              # 기본 7일
DATA_DAYS=14 node collect-all-clients.js # 14일
```

### 4.2 백필 API (수동 재수집)

```
Vercel 대시보드: /admin 페이지
  └─→ POST /api/backfill
      ├─→ 클라이언트 토큰 복호화 (AES-256)
      ├─→ Meta API 호출 (최대 90일)
      ├─→ raw_data UPSERT
      └─→ 텔레그램 알림 (-1003394139746)
```

**API 스펙**:
```json
POST /api/backfill
Headers: { "x-admin-key": "..." }
Body: {
  "clientId": "uuid",
  "startDate": "2025-09-01",
  "endDate": "2025-11-25"
}
```

### 4.3 주간/월간 리포트 발송

```
Railway: bas-meta-ads (Cron)
  ├─→ 주간: send-weekly-report.js (월요일 10:00 KST)
  └─→ 월간: send-monthly-report.js (매월 1일 10:00 KST)
      ├─→ raw_data에서 기간 데이터 집계
      ├─→ AI 인사이트 생성 (Gemini)
      ├─→ 텔레그램 리포트 발송
      └─→ telegram_reports 테이블 저장
```

---

## 5. Railway 서비스 구성

| 서비스 | 역할 | 시작 명령어 | Cron |
|--------|------|------------|------|
| bas-meta-ads | 리포트 발송 | `node start-all.js` | 주간/월간 |
| bas-meta-cron-collector | 데이터 수집 | `node cron-collect-data.js` | 매일 03:00 |

**Vercel**: 대시보드 프로덕션 (`bas-meta-ads.vercel.app`)

---

## 6. 환경 변수

### Supabase
```
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=eyJ...
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

### 암호화
```
TOKEN_ENCRYPTION_KEY=<64자 hex, AES-256>
```

### 텔레그램
```
TELEGRAM_BOT_TOKEN=<봇 토큰>
TELEGRAM_ADMIN_CHAT_ID=<관리자 채팅 ID>
# 백필 알림 채널 (하드코딩): -1003394139746
```

### AI (Gemini)
```
GEMINI_API_KEY=<Gemini API 키>
```

### 인증
```
NEXT_PUBLIC_ADMIN_KEY=<관리자 키>
```

---

## 7. 핵심 원칙

1. **단일 진실 소스**: 모든 데이터는 `raw_data`에만 저장
2. **VIEW 자동 집계**: `ads_insights_daily`는 VIEW (자동 계산)
3. **Redis 없음**: 직접 실행 방식 (큐 시스템 제거)
4. **텔레그램 알림 분리**:
   - 백필/시스템 알림 → `-1003394139746` (관리자)
   - 클라이언트 리포트 → 클라이언트별 `telegram_chat_id`

---

## 8. 트러블슈팅

### Q: 백필했는데 대시보드에 안 보여요
**A**: VIEW가 raw_data 기반인지 확인
```sql
-- sql/17_fix_ads_insights_view.sql 내용 실행
```

### Q: 데이터 수집이 안 돼요
**A**:
1. `node check-clients.js`로 활성 클라이언트 확인
2. 토큰 복호화 확인 (`TOKEN_ENCRYPTION_KEY`)
3. Meta API 권한 확인

### Q: 텔레그램 알림이 안 와요
**A**:
1. `TELEGRAM_BOT_TOKEN` 환경 변수 확인
2. 클라이언트별 `telegram_chat_id` 확인

---

## 9. 변경 이력

| 날짜 | 변경 내용 |
|------|----------|
| 2025-11-26 | 프로젝트 구조 재정비, 미사용 파일 _backup으로 이동 |
| 2025-11-26 | 멀티 클라이언트 수집 스크립트 추가 (collect-all-clients.js) |
| 2025-11-26 | cron-collect-data.js Redis 의존성 제거 |
| 2025-11-26 | VIEW를 raw_data 기반으로 복원 |

---

**문서 끝**
