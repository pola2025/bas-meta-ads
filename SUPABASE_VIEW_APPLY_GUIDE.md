# Supabase 분석 뷰 적용 가이드

**작성일**: 2025-11-19
**목적**: sql/03_analysis_views.sql을 Supabase에 적용하는 방법

---

## 📋 준비 사항

- ✅ Backfill 완료: 2,332개 레코드 (2025-01-01 ~ 2025-10-30)
- ✅ 파티션 생성 완료: 2025년 1~10월
- ✅ 분석 뷰 SQL 작성 완료: `sql/03_analysis_views.sql`

---

## 🚀 적용 방법

### 방법 1: Supabase Dashboard (권장)

#### 1단계: Supabase Dashboard 접속

```
https://supabase.com/dashboard/project/{프로젝트ID}
```

#### 2단계: SQL Editor 열기

1. 왼쪽 메뉴에서 **SQL Editor** 클릭
2. **New query** 버튼 클릭

#### 3단계: SQL 붙여넣기

`sql/03_analysis_views.sql` 파일 내용을 전체 복사하여 붙여넣기

#### 4단계: 실행

1. **Run** 버튼 클릭 (또는 Ctrl + Enter)
2. 실행 결과 확인:
   - 성공 시: "Success. No rows returned"
   - 실패 시: 에러 메시지 확인

#### 5단계: 생성된 뷰 확인

SQL Editor에서 다음 쿼리 실행:

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

**예상 결과**: 10개 뷰가 나타나야 함
- v_daily_trend_7d
- v_daily_trend_30d
- v_platform_performance_30d
- v_device_performance_30d
- v_top_campaigns_30d
- v_top_ads_7d
- v_low_performance_ads_7d
- v_frequency_analysis_7d
- v_monthly_performance_2025
- v_video_ads_performance_30d

---

### 방법 2: Node.js 스크립트 (자동화)

#### 파일 생성: `apply-views.js`

```javascript
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function applyViews() {
  console.log('📊 Applying analysis views to Supabase...');

  const sql = fs.readFileSync('sql/03_analysis_views.sql', 'utf-8');

  const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });

  if (error) {
    console.error('❌ Failed to apply views:', error);
    process.exit(1);
  }

  console.log('✅ Analysis views applied successfully!');
}

applyViews();
```

#### 실행

```bash
node apply-views.js
```

---

## 🧪 테스트 쿼리

분석 뷰가 정상적으로 작동하는지 확인:

### 1. 최근 7일 일별 트렌드 확인

```sql
SELECT * FROM v_daily_trend_7d
ORDER BY date DESC;
```

**확인 사항**:
- ✅ 데이터가 표시되는가?
- ✅ KPI가 정상적으로 계산되었는가? (CTR, CVR, CPL 등)

### 2. 플랫폼별 성과 확인

```sql
SELECT
  platform,
  impressions,
  clicks,
  leads,
  spend,
  ctr,
  cvr,
  cpl
FROM v_platform_performance_30d;
```

**예상 결과**:
- Facebook, Instagram 등 플랫폼별 데이터
- spend_share, lead_share 비중 표시

### 3. Top 캠페인 확인

```sql
SELECT
  campaign_name,
  leads,
  spend,
  cpl
FROM v_top_campaigns_30d
LIMIT 5;
```

### 4. 월별 성과 확인

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

**확인 사항**:
- ✅ 2025-01 ~ 2025-09 데이터 존재
- ✅ 전월 대비 증감률 계산됨

### 5. KPI 계산 함수 테스트

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

### 에러 1: "permission denied for schema public"

**원인**: Supabase 서비스 키 권한 부족

**해결**:
1. Supabase Dashboard → Settings → API
2. **Service Role Key** 사용 (Public Anon Key 아님)
3. 환경 변수 확인:
   ```bash
   SUPABASE_SERVICE_KEY=eyJhbGc...
   ```

### 에러 2: "relation raw_data does not exist"

**원인**: 파티션 테이블이 생성되지 않음

**해결**:
1. `sql/01_create_partitions.sql` 먼저 실행
2. 파티션 생성 확인:
   ```sql
   SELECT tablename FROM pg_tables
   WHERE tablename LIKE 'raw_data_%'
   ORDER BY tablename;
   ```

### 에러 3: "function calc_ctr already exists"

**원인**: 함수가 이미 존재함

**해결**: 정상 동작. `CREATE OR REPLACE` 사용하므로 무시 가능

### 에러 4: "no data returned"

**원인**: Backfill 데이터가 없거나 날짜 범위 밖

**해결**:
1. raw_data 테이블 데이터 확인:
   ```sql
   SELECT COUNT(*), MIN(date), MAX(date)
   FROM raw_data;
   ```
2. Backfill 실행 필요:
   ```bash
   DATA_DAYS=30 node lib/backfill.js
   ```

---

## 📊 성능 최적화

분석 뷰 SQL에는 다음 인덱스가 포함되어 있습니다:

```sql
-- 날짜 범위 쿼리 최적화
CREATE INDEX idx_raw_data_date_range ON raw_data(date)
WHERE date >= CURRENT_DATE - INTERVAL '30 days';

-- 플랫폼/디바이스/캠페인별 분석 최적화
CREATE INDEX idx_raw_data_platform_date ON raw_data(platform, date);
CREATE INDEX idx_raw_data_device_date ON raw_data(device, date);
CREATE INDEX idx_raw_data_campaign_date ON raw_data(campaign_name, date);
CREATE INDEX idx_raw_data_ad_date ON raw_data(ad_name, date);

-- 비디오 광고 분석 최적화
CREATE INDEX idx_raw_data_video_views ON raw_data(video_views)
WHERE video_views > 0;
```

인덱스 생성 확인:

```sql
SELECT
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename LIKE 'raw_data%'
ORDER BY indexname;
```

---

## ✅ 완료 체크리스트

분석 뷰 적용 후 확인:

- [ ] 10개 뷰 생성 확인
- [ ] 8개 KPI 함수 생성 확인
- [ ] 테스트 쿼리 실행 성공
- [ ] 데이터가 정상적으로 표시됨
- [ ] KPI 계산이 정확함
- [ ] 인덱스 생성 확인

---

## 🎯 다음 단계

분석 뷰 적용 완료 후:

1. **Streamlit 대시보드 개발**
   - KPI 카드 추가
   - 차트 컴포넌트 구현
   - 필터링 기능

2. **Railway 배포**
   - Streamlit 앱 배포
   - 환경 변수 설정
   - 도메인 연결

3. **모니터링 설정**
   - 일일 리포트 자동화
   - 텔레그램 알림 확장

---

**작성자**: Claude
**프로젝트**: BAS Meta Ads Analytics
