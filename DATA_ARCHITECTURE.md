# BAS Meta Ads - 데이터 아키텍처 설계서

> **최종 수정**: 2025-11-26
> **목적**: 데이터 흐름과 테이블 구조를 한눈에 파악

---

## 1. 핵심 데이터 흐름 (현재 구조)

```
┌─────────────────────────────────────────────────────────────┐
│                      Meta Ads API                           │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
        ┌─────────────────────────────────────┐
        │         데이터 수집 방식            │
        │  ┌───────────┐  ┌───────────────┐  │
        │  │ 일일 수집  │  │   백필 API    │  │
        │  │ (Cron)    │  │ (/api/backfill)│  │
        │  └─────┬─────┘  └───────┬───────┘  │
        └────────┼────────────────┼──────────┘
                 │                │
                 ▼                ▼
        ┌─────────────────────────────────────┐
        │          raw_data 테이블            │  ← 원본 저장 (유일한 저장소)
        │    (client_id, date, ad_id, ...)   │
        └────────────────┬────────────────────┘
                         │
                         ▼ (VIEW 자동 집계)
        ┌─────────────────────────────────────┐
        │     ads_insights_daily (VIEW)       │  ← 대시보드 조회
        │    GROUP BY client_id, date, ad    │
        └────────────────┬────────────────────┘
                         │
                         ▼
        ┌─────────────────────────────────────┐
        │            대시보드                  │
        │   (Next.js - Vercel/Railway)       │
        └─────────────────────────────────────┘
```

**핵심 원칙**:
- 모든 데이터는 `raw_data`에만 저장
- `ads_insights_daily`는 VIEW (자동 집계)
- 백필하면 대시보드에 자동 반영

---

## 2. 테이블 구조

### 2.1 clients (클라이언트 정보)

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

---

### 2.2 raw_data (원본 광고 데이터) ⭐ 핵심

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
| video_views | INTEGER | 동영상 조회수 |
| avg_watch_time | DECIMAL | 평균 시청 시간 |

**UNIQUE 제약**: `(client_id, date, ad_id, platform, device)`

**인덱스**:
- `idx_raw_data_client_date` (client_id, date DESC)
- `idx_raw_data_date` (date DESC)
- `idx_raw_data_ad_name` (ad_name)

---

### 2.3 ads_insights_daily (VIEW) ⭐ 대시보드 소스

> ⚠️ **중요**: 테이블이 아니라 **VIEW**입니다. INSERT/UPDATE 불가!

```sql
-- sql/17_fix_ads_insights_view.sql
CREATE VIEW ads_insights_daily AS
SELECT
  client_id,
  date,
  platform,
  campaign_name,
  ad_name,
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

**특징**:
- raw_data에서 자동 집계
- platform + device 통합 (device별 분리 불필요)
- CTR, CVR, CPL, CPC, CPM 자동 계산

---

### 2.4 weekly_summary (주간 집계)

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
| avg_ctr | DECIMAL | 평균 CTR |
| avg_cpl | DECIMAL | 평균 CPL |

**용도**: 주간 리포트 생성, 텔레그램 발송

---

### 2.5 daily_aggregates (일별 집계 - 레거시)

> ⚠️ **현재 미사용**. 성능 최적화가 필요할 때 활용 가능.

기존에 VIEW가 이 테이블을 참조했으나, 현재는 raw_data 기반 VIEW 사용.

---

## 3. 서비스별 데이터 흐름

### 3.1 일일 데이터 수집 (Cron)

```
Railway: bas-meta-cron-collector
  └─→ cron-collect-data.js (매일 03:00 KST)
      └─→ collect-direct.js
          └─→ Meta API 호출 (어제 데이터)
              └─→ raw_data UPSERT
```

---

### 3.2 백필 API (수동 재수집)

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

---

### 3.3 대시보드 조회

```
대시보드 페이지
  └─→ dashboard/lib/api.ts
      └─→ supabase.from('ads_insights_daily')
          └─→ VIEW 자동 집계 결과 반환
```

**주요 API 함수**:
| 함수 | 데이터 소스 | 용도 |
|------|------------|------|
| getDailyTrend() | ads_insights_daily | 일별 추이 차트 |
| getKPISummary() | ads_insights_daily | KPI 요약 카드 |
| getTopAds() | ads_insights_daily | 광고 성과 순위 |
| getPlatformPerformance() | raw_data | 플랫폼별 분석 |

---

## 4. 테이블 관계도

```
┌─────────────┐
│   clients   │ ──────────────────────────────────────┐
└──────┬──────┘                                       │
       │ 1:N (client_id FK)                          │
       ▼                                              │
┌─────────────┐      VIEW 자동 집계     ┌────────────┴────────────┐
│  raw_data   │ ─────────────────────→  │  ads_insights_daily     │
│  (원본)     │                         │  (대시보드 메인 소스)    │
└──────┬──────┘                         └─────────────────────────┘
       │
       │ RPC 호출 (generate_weekly_summary)
       ▼
┌─────────────────┐
│ weekly_summary  │ ← 주간 리포트용
└─────────────────┘
```

---

## 5. Railway 서비스 구성

| 서비스 | 역할 | 시작 명령어 |
|--------|------|------------|
| bas-meta-ads | Cron 스케줄러 (주간 리포트) | `node start-all.js` |
| bas-meta-cron-collector | 일일 데이터 수집 | `node cron-collect-data.js` |
| bas-meta-ads-dashboard | (Railway 대시보드) | Next.js |

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

### 인증
```
NEXT_PUBLIC_ADMIN_KEY=<관리자 키>
```

---

## 7. 주요 파일 위치

```
F:\bas_meta\
├── sql/
│   ├── 01_schema.sql                    # 기본 테이블 (clients, raw_data)
│   ├── 04_ads_insights_daily_view.sql   # VIEW 원본 정의
│   ├── 17_fix_ads_insights_view.sql     # VIEW 수정 (raw_data 기반) ⭐
│   └── 06_daily_aggregates.sql          # 레거시 집계 테이블
│
├── collect-direct.js                    # 일일 수집 스크립트
├── cron-collect-data.js                 # Cron Job 진입점
├── start-all.js                         # Railway 시작점
│
├── dashboard/
│   ├── lib/api.ts                       # 대시보드 API 함수 ⭐
│   └── app/api/backfill/route.ts        # 백필 API ⭐
│
└── DATA_ARCHITECTURE.md                 # 이 문서
```

---

## 8. 변경 이력

| 날짜 | 변경 내용 |
|------|----------|
| 2025-11-26 | VIEW를 raw_data 기반으로 복원 (sql/17_fix_ads_insights_view.sql) |
| 2025-11-26 | 백필 API 단순화 - daily_aggregates 동기화 제거 |
| 2025-11-26 | Worker 제거 (Redis 미사용) |
| 2025-11-25 | VIEW를 daily_aggregates 기반으로 변경 (문제 발생) |

---

## 9. 트러블슈팅

### Q: 백필했는데 대시보드에 안 보여요
**A**: VIEW가 raw_data 기반인지 확인.
```sql
-- Supabase SQL Editor에서 실행
-- sql/17_fix_ads_insights_view.sql 내용 실행
```

### Q: 텔레그램 알림이 안 와요
**A**:
1. Vercel 환경 변수에 `TELEGRAM_BOT_TOKEN` 설정
2. Vercel 재배포

### Q: Meta API rate limit 에러
**A**: 1시간 후 재시도. 한 번에 너무 많은 백필 요청 금지.

### Q: VIEW가 daily_aggregates를 참조하고 있어요
**A**: `sql/17_fix_ads_insights_view.sql` 실행하여 raw_data 기반으로 변경.

---

## 10. 다음 단계 (향후 개선)

- [ ] daily_aggregates 성능 최적화용 활용 검토
- [ ] 월간 리포트 기능 추가
- [ ] 실시간 대시보드 (WebSocket)

---

**문서 끝**
