# 분석 뷰 설치 가이드

**작성일**: 2025-11-19
**목적**: Supabase SQL Editor에서 분석 뷰 및 함수 생성

---

## 📋 개요

총 **10개의 분석 뷰**와 **8개의 KPI 계산 함수**를 Supabase에 생성합니다.

### 생성될 뷰 목록

1. ✅ **v_daily_trend_7d** - 최근 7일 일별 트렌드
2. ✅ **v_daily_trend_30d** - 최근 30일 일별 트렌드
3. ✅ **v_platform_performance_30d** - 플랫폼별 성과 비교
4. ✅ **v_device_performance_30d** - 디바이스별 성과 비교
5. ✅ **v_top_campaigns_30d** - Top 10 캠페인 (CPL 낮은 순)
6. ✅ **v_top_ads_7d** - Top 10 광고 (리드 많은 순)
7. ✅ **v_low_performance_ads_7d** - 저성과 광고 감지
8. ✅ **v_frequency_analysis_7d** - 빈도별 성과 분석
9. ✅ **v_monthly_performance_2025** - 월별 성과 및 성장률
10. ✅ **v_video_ads_performance_30d** - 비디오 광고 성과

### 생성될 함수 목록

1. `calc_ctr()` - CTR 계산
2. `calc_cvr()` - CVR 계산
3. `calc_cpl()` - CPL 계산
4. `calc_cpc()` - CPC 계산
5. `calc_cpm()` - CPM 계산
6. `calc_frequency()` - Frequency 계산
7. `calc_vtr()` - VTR 계산
8. `calc_cpv()` - CPV 계산

---

## 🚀 설치 방법

### 1단계: Supabase SQL Editor 접속

1. **Supabase Dashboard 열기**:
   ```
   https://supabase.com/dashboard/project/mpljqcuqrrfwzamfyxnz
   ```

2. **SQL Editor 탭 클릭**

### 2단계: SQL 파일 내용 복사

파일 위치: `F:/bas_meta/sql/03_analysis_views.sql`

### 3단계: SQL Editor에 붙여넣기 및 실행

1. SQL Editor에 전체 내용 붙여넣기
2. **Run** 버튼 클릭

### 4단계: 실행 결과 확인

다음 쿼리로 생성된 뷰 확인:

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

**예상 결과**: 10개의 뷰가 표시되어야 함

---

## 📊 사용 예시

### 1. 최근 7일 일별 트렌드 조회

```sql
SELECT * FROM v_daily_trend_7d;
```

**결과 예시**:
```
date       | impressions | clicks | leads | spend  | ctr  | cvr  | cpl
-----------|-------------|--------|-------|--------|------|------|------
2025-11-12 | 10,234      | 256    | 12    | 120,000| 2.50 | 4.69 | 10,000
2025-11-13 | 11,567      | 289    | 15    | 145,000| 2.50 | 5.19 | 9,667
...
```

### 2. 플랫폼별 성과 비교

```sql
SELECT * FROM v_platform_performance_30d;
```

**결과 예시**:
```
platform  | impressions | clicks | leads | spend    | ctr  | cpl    | spend_share | lead_share
----------|-------------|--------|-------|----------|------|--------|-------------|------------
facebook  | 250,000     | 6,250  | 125   | 1,250,000| 2.50 | 10,000 | 60.0%       | 55.6%
instagram | 180,000     | 4,680  | 100   | 833,333  | 2.60 | 8,333  | 40.0%       | 44.4%
```

### 3. Top 10 캠페인 조회

```sql
SELECT * FROM v_top_campaigns_30d;
```

### 4. 저성과 광고 찾기

```sql
SELECT * FROM v_low_performance_ads_7d;
```

**결과 예시**:
```
ad_name        | campaign_name | impressions | clicks | spend   | ctr  | warning_level
---------------|---------------|-------------|--------|---------|------|---------------
광고 A         | 봄 프로모션   | 50,000      | 100    | 150,000 | 0.20 | 🟠 CTR 매우 낮음
광고 B         | 여름 캠페인   | 30,000      | 0      | 100,000 | 0.00 | 🔴 클릭 없음
```

### 5. 월별 성과 및 성장률

```sql
SELECT * FROM v_monthly_performance_2025;
```

**결과 예시**:
```
month   | impressions | leads | spend     | cpl    | lead_growth_rate | spend_growth_rate
--------|-------------|-------|-----------|--------|------------------|------------------
2025-01 | 100,000     | 50    | 500,000   | 10,000 | NULL             | NULL
2025-02 | 120,000     | 60    | 550,000   | 9,167  | +20.0%           | +10.0%
2025-03 | 150,000     | 75    | 600,000   | 8,000  | +25.0%           | +9.1%
```

---

## 🔧 KPI 계산 함수 사용법

### 함수 목록 및 사용 예시

```sql
-- CTR 계산
SELECT calc_ctr(250, 10000);  -- 결과: 2.50

-- CVR 계산
SELECT calc_cvr(10, 250);     -- 결과: 4.00

-- CPL 계산
SELECT calc_cpl(100000, 10);  -- 결과: 10000

-- CPC 계산
SELECT calc_cpc(50000, 250);  -- 결과: 200

-- CPM 계산
SELECT calc_cpm(100000, 10000); -- 결과: 10000

-- Frequency 계산
SELECT calc_frequency(10000, 5000); -- 결과: 2.00

-- VTR 계산
SELECT calc_vtr(500, 10000);  -- 결과: 5.00

-- CPV 계산
SELECT calc_cpv(50000, 500);  -- 결과: 100
```

### 커스텀 쿼리에서 활용

```sql
SELECT
  campaign_name,
  SUM(impressions) as impressions,
  SUM(clicks) as clicks,
  SUM(leads) as leads,
  SUM(spend) as spend,
  calc_ctr(SUM(clicks), SUM(impressions)) as ctr,
  calc_cvr(SUM(leads), SUM(clicks)) as cvr,
  calc_cpl(SUM(spend), SUM(leads)) as cpl
FROM raw_data
WHERE date >= '2025-01-01'
GROUP BY campaign_name
ORDER BY cpl ASC;
```

---

## 🎯 대시보드에서 활용

### Next.js API 라우트 예시

```javascript
// app/api/daily-trend/route.js
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export async function GET() {
  const { data, error } = await supabase
    .from('v_daily_trend_7d')
    .select('*');

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json(data);
}
```

### React 컴포넌트에서 사용

```jsx
// components/DailyTrendChart.jsx
import { useEffect, useState } from 'react';

export function DailyTrendChart() {
  const [data, setData] = useState([]);

  useEffect(() => {
    fetch('/api/daily-trend')
      .then(res => res.json())
      .then(setData);
  }, []);

  return (
    <div>
      <h2>최근 7일 일별 트렌드</h2>
      {/* Chart.js 또는 Recharts로 시각화 */}
    </div>
  );
}
```

---

## ⚠️ 주의사항

### 1. 날짜 범위

모든 뷰는 **오늘(CURRENT_DATE)을 제외**합니다.
- 이유: 오늘 데이터는 아직 수집 중이므로 불완전함
- 해결: 실시간 성과는 별도 쿼리 사용

### 2. 성능 최적화

분석 뷰는 매번 실시간으로 계산됩니다.
- 대용량 데이터 시 느릴 수 있음
- 해결: Materialized View 또는 캐싱 고려

**Materialized View 예시** (향후 적용 검토):
```sql
CREATE MATERIALIZED VIEW mv_daily_trend_7d AS
SELECT * FROM v_daily_trend_7d;

-- 매일 새벽 자동 갱신
REFRESH MATERIALIZED VIEW mv_daily_trend_7d;
```

### 3. 권한 설정

뷰 조회 권한이 필요합니다.
```sql
GRANT SELECT ON v_daily_trend_7d TO authenticated;
GRANT SELECT ON v_daily_trend_7d TO anon;
```

---

## 🔍 검증 방법

### 1. 뷰 생성 확인

```sql
SELECT
  viewname,
  definition
FROM pg_views
WHERE schemaname = 'public'
  AND viewname = 'v_daily_trend_7d';
```

### 2. 함수 생성 확인

```sql
SELECT
  proname,
  prosrc
FROM pg_proc
WHERE proname LIKE 'calc_%';
```

### 3. 데이터 조회 테스트

```sql
-- 각 뷰에서 1건씩 조회
SELECT * FROM v_daily_trend_7d LIMIT 1;
SELECT * FROM v_platform_performance_30d LIMIT 1;
SELECT * FROM v_top_campaigns_30d LIMIT 1;
```

---

## 🐛 문제 해결

### 문제 1: "relation does not exist" 에러

**원인**: 뷰가 생성되지 않음

**해결**:
1. SQL Editor에서 다시 실행
2. 에러 메시지 확인
3. 권한 문제 시 Supabase 지원팀 문의

### 문제 2: "division by zero" 에러

**원인**: NULLIF 처리 누락

**해결**: 이미 모든 계산에 NULLIF 적용되어 있음

### 문제 3: 느린 쿼리 성능

**원인**: 대용량 데이터

**해결**:
1. 인덱스 확인:
```sql
SELECT * FROM pg_indexes WHERE tablename = 'raw_data';
```

2. 필요 시 추가 인덱스 생성:
```sql
CREATE INDEX idx_raw_data_date_recent
ON raw_data(date)
WHERE date >= CURRENT_DATE - INTERVAL '30 days';
```

---

## 📚 참고 자료

- **분석 기획서**: `META_ADS_ANALYSIS_PLAN.md`
- **SQL 파일**: `sql/03_analysis_views.sql`
- **Supabase 공식 문서**: https://supabase.com/docs/guides/database

---

**마지막 업데이트**: 2025-11-19
**작성자**: Claude
**프로젝트**: BAS Meta Ads Analytics
