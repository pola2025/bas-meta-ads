# Phase 6: Supabase 분석 뷰 수동 적용 가이드

**날짜**: 2025-11-19
**목적**: sql/03_analysis_views.sql을 Supabase Dashboard에서 직접 적용

---

## ⚠️ 왜 수동 적용이 필요한가?

### 문제 상황
- Supabase JavaScript SDK는 DDL (CREATE VIEW, CREATE FUNCTION) 실행 불가
- `psql` CLI 미설치
- `npx supabase db execute`는 `--file` 옵션 미지원
- Supabase Pooler는 파티션 생성 불가 ("Tenant or user not found" 에러)

### 해결 방법
✅ **Supabase Dashboard → SQL Editor 직접 사용**

---

## 📋 적용 단계 (5분)

### 1단계: SQL 파일 열기

**파일 위치**: `F:\bas_meta\sql\03_analysis_views.sql`

**Windows 탐색기에서 열기**:
```
탐색기 → F:\bas_meta\sql → 03_analysis_views.sql → 마우스 우클릭 → 연결 프로그램 → Visual Studio Code
```

### 2단계: SQL 전체 복사

- **Ctrl + A** (전체 선택)
- **Ctrl + C** (복사)

### 3단계: Supabase Dashboard 접속

**URL**:
```
https://supabase.com/dashboard/project/mpljqcuqrrfwzamfyxnz
```

### 4단계: SQL Editor 열기

1. 왼쪽 메뉴 → **SQL Editor** 클릭
2. 상단 **+ New query** 버튼 클릭

### 5단계: SQL 붙여넣기 및 실행

1. **Ctrl + V** (붙여넣기)
2. **Run** 버튼 클릭 (또는 Ctrl + Enter)
3. 실행 완료 대기 (약 30초)

**예상 결과**:
```
Success. No rows returned
```

---

## ✅ 생성되는 항목 (24개)

### 1. 분석 뷰 (10개)

| 뷰 이름 | 설명 | 기간 |
|--------|------|------|
| `v_daily_trend_7d` | 일별 트렌드 | 최근 7일 |
| `v_daily_trend_30d` | 일별 트렌드 | 최근 30일 |
| `v_platform_performance_30d` | 플랫폼별 성과 | 최근 30일 |
| `v_device_performance_30d` | 디바이스별 성과 | 최근 30일 |
| `v_top_campaigns_30d` | Top 10 캠페인 (CPL 낮은 순) | 최근 30일 |
| `v_top_ads_7d` | Top 10 광고 (리드 많은 순) | 최근 7일 |
| `v_low_performance_ads_7d` | 저성과 광고 | 최근 7일 |
| `v_frequency_analysis_7d` | 빈도 구간별 분석 | 최근 7일 |
| `v_monthly_performance_2025` | 월별 성과 비교 | 2025년 전체 |
| `v_video_ads_performance_30d` | 비디오 광고 Top 20 | 최근 30일 |

### 2. KPI 계산 함수 (8개)

| 함수 이름 | 설명 |
|----------|------|
| `calc_ctr(clicks, impressions)` | CTR (Click-Through Rate) |
| `calc_cvr(leads, clicks)` | CVR (Conversion Rate) |
| `calc_cpl(spend, leads)` | CPL (Cost Per Lead) |
| `calc_cpc(spend, clicks)` | CPC (Cost Per Click) |
| `calc_cpm(spend, impressions)` | CPM (Cost Per Mille) |
| `calc_frequency(impressions, reach)` | Frequency (빈도) |
| `calc_vtr(video_views, impressions)` | VTR (View-Through Rate) |
| `calc_cpv(spend, video_views)` | CPV (Cost Per View) |

### 3. 인덱스 (6개)

| 인덱스 이름 | 목적 |
|-----------|------|
| `idx_raw_data_date_range` | 날짜 범위 쿼리 최적화 |
| `idx_raw_data_platform_date` | 플랫폼별 분석 최적화 |
| `idx_raw_data_device_date` | 디바이스별 분석 최적화 |
| `idx_raw_data_campaign_date` | 캠페인별 분석 최적화 |
| `idx_raw_data_ad_date` | 광고별 분석 최적화 |
| `idx_raw_data_video_views` | 비디오 광고 분석 최적화 |

---

## 🧪 테스트 쿼리 (검증)

SQL Editor에서 다음 쿼리를 실행하여 정상 작동 확인:

### 1. 뷰 생성 확인

```sql
SELECT
  schemaname,
  viewname,
  viewowner
FROM pg_views
WHERE schemaname = 'public'
  AND viewname LIKE 'v_%'
ORDER BY viewname;
```

**예상 결과**: 10개 행

### 2. 함수 생성 확인

```sql
SELECT
  proname AS function_name,
  pg_get_function_arguments(oid) AS arguments
FROM pg_proc
WHERE proname LIKE 'calc_%'
  AND pronamespace = 'public'::regnamespace
ORDER BY proname;
```

**예상 결과**: 8개 행

### 3. 데이터 조회 테스트

```sql
-- 최근 7일 일별 트렌드
SELECT * FROM v_daily_trend_7d
ORDER BY date DESC
LIMIT 7;
```

**예상 결과**: 데이터가 표시됨 (impressions, clicks, leads, ctr, cvr, cpl 등)

### 4. 플랫폼별 성과 테스트

```sql
SELECT
  platform,
  impressions,
  clicks,
  leads,
  spend,
  ROUND(ctr, 2) as ctr,
  ROUND(cvr, 2) as cvr,
  cpl
FROM v_platform_performance_30d
ORDER BY spend DESC;
```

**예상 결과**: Facebook, Instagram 등 플랫폼별 데이터

### 5. 월별 성과 테스트

```sql
SELECT
  month,
  leads,
  spend,
  cpl,
  lead_growth_rate,
  spend_growth_rate
FROM v_monthly_performance_2025
ORDER BY month;
```

**예상 결과**: 2025-01 ~ 2025-09 데이터 (10개월)

### 6. KPI 함수 테스트

```sql
SELECT
  calc_ctr(100, 1000) as ctr,      -- 예상: 10.00
  calc_cvr(10, 100) as cvr,        -- 예상: 10.00
  calc_cpl(100000, 10) as cpl,     -- 예상: 10000
  calc_cpc(100000, 100) as cpc,    -- 예상: 1000
  calc_cpm(100000, 1000) as cpm,   -- 예상: 100000
  calc_frequency(1500, 1000) as frequency, -- 예상: 1.50
  calc_vtr(500, 1000) as vtr,      -- 예상: 50.00
  calc_cpv(100000, 500) as cpv;    -- 예상: 200
```

---

## ❌ 문제 해결

### 에러 1: "relation raw_data does not exist"

**원인**: 파티션 테이블 미생성

**해결**:
```sql
-- 파티션 테이블 확인
SELECT tablename FROM pg_tables
WHERE tablename LIKE 'raw_data_%'
ORDER BY tablename;
```

파티션이 없으면 `sql/create-partitions-via-supabase.sql` 먼저 실행

### 에러 2: "no data returned"

**원인**: Backfill 데이터 없음

**해결**:
```bash
# Backfill 실행
DATA_DAYS=30 node lib/backfill.js
```

### 에러 3: "function already exists"

**원인**: 이미 생성됨

**해결**: 정상. `CREATE OR REPLACE` 사용하므로 무시 가능

---

## ✅ 완료 체크리스트

- [ ] SQL Editor에서 sql/03_analysis_views.sql 실행 완료
- [ ] "Success. No rows returned" 메시지 확인
- [ ] 10개 뷰 생성 확인 (v_*)
- [ ] 8개 함수 생성 확인 (calc_*)
- [ ] 테스트 쿼리 실행 성공
- [ ] 데이터가 정상적으로 표시됨

---

## 🎯 다음 단계

분석 뷰 적용 완료 후:

1. **Streamlit 대시보드 개발**
   - dashboard 폴더 생성
   - Supabase 연결 설정
   - KPI 카드 구현

2. **Railway 배포**
   - Streamlit 앱 Railway에 배포
   - 환경 변수 설정
   - 도메인 연결

3. **모니터링 확장**
   - 일일 리포트 자동화
   - 텔레그램 알림 개선

---

**작성자**: Claude
**프로젝트**: BAS Meta Ads Analytics
**참고 문서**: SUPABASE_VIEW_APPLY_GUIDE.md
