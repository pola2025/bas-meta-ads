# Supabase 뷰 생성 가이드

**날짜**: 2025-11-21
**프로젝트**: BAS Meta Ads Dashboard

---

## 🚨 현재 문제

대시보드 에러 발생:
```
Error: relation "v_daily_trend_7d" does not exist
```

**원인**: Supabase에 분석 뷰가 생성되지 않음

---

## ✅ 빠른 해결 (3분)

### 1단계: Supabase SQL Editor 접속

1. https://supabase.com/dashboard 접속
2. 프로젝트 선택: **mpljqcuqrrfwzamfyxnz**
3. 왼쪽 메뉴에서 **SQL Editor** 클릭

### 2단계: 뷰 생성 SQL 실행

다음 파일 내용을 복사하여 SQL Editor에 붙여넣기:

📁 **파일**: `CREATE_VIEWS_QUICK.sql`

또는 아래 SQL을 직접 복사:

```sql
-- 1. 최근 7일 일별 트렌드
CREATE OR REPLACE VIEW v_daily_trend_7d AS
SELECT
  date,
  SUM(impressions) as impressions,
  SUM(reach) as reach,
  SUM(clicks) as clicks,
  SUM(leads) as leads,
  SUM(spend) as spend,
  ROUND((SUM(clicks)::DECIMAL / NULLIF(SUM(impressions), 0) * 100), 2) as ctr,
  ROUND((SUM(leads)::DECIMAL / NULLIF(SUM(clicks), 0) * 100), 2) as cvr,
  ROUND((SUM(spend) / NULLIF(SUM(leads), 0)), 0) as cpl
FROM raw_data
WHERE date >= CURRENT_DATE - INTERVAL '7 days'
  AND date < CURRENT_DATE
GROUP BY date
ORDER BY date;

-- 2. 플랫폼별 성과 (최근 30일)
CREATE OR REPLACE VIEW v_platform_performance_30d AS
SELECT
  platform,
  SUM(impressions) as impressions,
  SUM(reach) as reach,
  SUM(clicks) as clicks,
  SUM(leads) as leads,
  SUM(spend) as spend,
  ROUND((SUM(clicks)::DECIMAL / NULLIF(SUM(impressions), 0) * 100), 2) as ctr,
  ROUND((SUM(leads)::DECIMAL / NULLIF(SUM(clicks), 0) * 100), 2) as cvr,
  ROUND((SUM(spend) / NULLIF(SUM(leads), 0)), 0) as cpl
FROM raw_data
WHERE date >= CURRENT_DATE - INTERVAL '30 days'
  AND date < CURRENT_DATE
GROUP BY platform
ORDER BY spend DESC;

-- 3. Top 10 광고
CREATE OR REPLACE VIEW v_top_ads_7d AS
SELECT
  ad_name,
  campaign_name,
  SUM(impressions) as impressions,
  SUM(clicks) as clicks,
  SUM(leads) as leads,
  SUM(spend) as spend,
  ROUND((SUM(clicks)::DECIMAL / NULLIF(SUM(impressions), 0) * 100), 2) as ctr,
  ROUND((SUM(spend) / NULLIF(SUM(leads), 0)), 0) as cpl
FROM raw_data
WHERE date >= CURRENT_DATE - INTERVAL '7 days'
  AND date < CURRENT_DATE
  AND leads > 0
GROUP BY ad_name, campaign_name
ORDER BY leads DESC
LIMIT 10;
```

**RUN** 버튼 클릭 또는 `Ctrl + Enter`

### 3단계: 뷰 생성 확인

다음 SQL로 확인:

```sql
SELECT viewname
FROM pg_views
WHERE schemaname = 'public'
AND viewname IN ('v_daily_trend_7d', 'v_platform_performance_30d', 'v_top_ads_7d')
ORDER BY viewname;
```

**예상 결과**:
```
viewname
---------------------------
v_daily_trend_7d
v_platform_performance_30d
v_top_ads_7d
```

3개 뷰가 모두 표시되어야 합니다.

### 4단계: 데이터 확인

```sql
-- 각 뷰의 데이터 개수 확인
SELECT 'v_daily_trend_7d' AS view_name, COUNT(*) AS row_count FROM v_daily_trend_7d
UNION ALL
SELECT 'v_platform_performance_30d', COUNT(*) FROM v_platform_performance_30d
UNION ALL
SELECT 'v_top_ads_7d', COUNT(*) FROM v_top_ads_7d;
```

**예상 결과**:
```
view_name                      | row_count
-------------------------------+-----------
v_daily_trend_7d              | 7
v_platform_performance_30d    | 2-5
v_top_ads_7d                  | 10
```

---

## 🔍 데이터가 0인 경우

### 원인

`raw_data` 테이블에 데이터가 없거나 파티션 테이블 구조 사용

### 해결 방법 1: 파티션 테이블 확인

```sql
-- 파티션 테이블 목록 확인
SELECT tablename
FROM pg_tables
WHERE schemaname = 'public'
AND tablename LIKE 'raw_data_%'
ORDER BY tablename;
```

**파티션 테이블이 있는 경우** (`raw_data_2025_09`, `raw_data_2025_10` 등):

뷰를 다음과 같이 수정:

```sql
-- 파티션 테이블 직접 참조
CREATE OR REPLACE VIEW v_daily_trend_7d AS
SELECT
  date,
  SUM(impressions) as impressions,
  SUM(reach) as reach,
  SUM(clicks) as clicks,
  SUM(leads) as leads,
  SUM(spend) as spend,
  ROUND((SUM(clicks)::DECIMAL / NULLIF(SUM(impressions), 0) * 100), 2) as ctr,
  ROUND((SUM(leads)::DECIMAL / NULLIF(SUM(clicks), 0) * 100), 2) as cvr,
  ROUND((SUM(spend) / NULLIF(SUM(leads), 0)), 0) as cpl
FROM (
  SELECT * FROM raw_data_2025_09
  UNION ALL
  SELECT * FROM raw_data_2025_10
  UNION ALL
  SELECT * FROM raw_data_2025_11
) as raw_data
WHERE date >= CURRENT_DATE - INTERVAL '7 days'
  AND date < CURRENT_DATE
GROUP BY date
ORDER BY date;
```

### 해결 방법 2: Backfill 실행

데이터가 전혀 없는 경우:

```bash
cd F:\bas_meta
DATA_DAYS=30 node lib/backfill.js
```

---

## 🎯 완료 후

뷰 생성 완료 후:

1. **대시보드 새로고침**
   ```
   https://dashboard-[your-hash].vercel.app
   ```

2. **로컬 테스트**
   ```bash
   cd F:\bas_meta\dashboard
   npm run dev
   ```

3. **데이터 확인**
   - KPI 카드에 숫자 표시
   - 차트에 데이터 시각화
   - 테이블에 광고 목록 표시

---

## 📚 추가 뷰 (선택사항)

더 많은 분석 뷰가 필요하면:

📁 **파일**: `sql/03_analysis_views.sql` (전체 10개 뷰 + 8개 함수)

포함 내용:
- `v_daily_trend_30d` - 최근 30일 일별 트렌드
- `v_device_performance_30d` - 디바이스별 성과
- `v_top_campaigns_30d` - Top 10 캠페인
- `v_low_performance_ads_7d` - 저성과 광고
- `v_frequency_analysis_7d` - 빈도 분석
- `v_monthly_performance_2025` - 월별 성과
- `v_video_ads_performance_30d` - 비디오 광고 성과
- 8개 KPI 계산 함수

---

**작성일**: 2025-11-21
**프로젝트**: BAS Meta Ads Dashboard
**우선순위**: 🔴 긴급 (대시보드 작동 필수)
