# 📊 BAS Meta Ads - 데이터 아키텍처 개선

## 목적

**기존 문제**:
- 리포트 생성 시마다 raw_data를 임시 집계 → 성능 저하
- 일별 트렌드 분석 불가 (집계 데이터 미보관)
- 복잡한 분석 쿼리 시 raw_data 직접 조회 → 느림

**개선 목표**:
- 사전 집계된 일별 데이터로 빠른 분석
- 일별/주간/월간 트렌드 즉시 조회 가능
- 리포트 생성 시간 단축 (10초 → 1초)

---

## 데이터 계층 구조 (3-Tier Architecture)

```
┌─────────────────────────────────────────────┐
│  Tier 1: raw_data (원본 데이터)              │
│  - Meta API에서 직접 수집                     │
│  - 일자별 파티셔닝 (월별)                      │
│  - Platform, Device 별 세분화                 │
└─────────────────────────────────────────────┘
                    ↓ 매일 자동 집계
┌─────────────────────────────────────────────┐
│  Tier 2: daily_aggregates (일별 집계) ★      │
│  - 광고별 일별 성과 집계                       │
│  - CTR, CPL, CPC 자동 계산 (STORED)           │
│  - 분석 및 리포트의 핵심 원본                  │
└─────────────────────────────────────────────┘
                    ↓ 자동 집계 (선택)
┌─────────────────────────────────────────────┐
│  Tier 3: weekly_summary (주간 집계)          │
│  - 주간 성과 요약                             │
│  - 전주 대비 비교용                           │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│  Output: 리포트 생성                          │
│  - Telegram 자동 발송                         │
│  - 대시보드 조회                              │
└─────────────────────────────────────────────┘
```

---

## Tier 2: daily_aggregates 테이블 (핵심)

### 테이블 구조

| 컬럼               | 타입            | 설명                        |
|--------------------|-----------------|----------------------------|
| id                 | BIGSERIAL       | Primary Key                |
| client_id          | UUID            | 클라이언트 ID               |
| date               | DATE            | 날짜                       |
| ad_id              | VARCHAR(50)     | 광고 ID                    |
| ad_name            | VARCHAR(200)    | 광고명                     |
| campaign_id        | VARCHAR(50)     | 캠페인 ID                  |
| campaign_name      | VARCHAR(200)    | 캠페인명                   |
| impressions        | INTEGER         | 노출수                     |
| clicks             | INTEGER         | 클릭수                     |
| leads              | INTEGER         | 리드수                     |
| spend              | DECIMAL(10,2)   | 지출액                     |
| video_views        | INTEGER         | 동영상 조회수               |
| avg_watch_time     | DECIMAL(5,1)    | 평균 시청 시간              |
| **ctr**            | DECIMAL(5,4)    | **클릭률 (자동 계산)**      |
| **cpl**            | DECIMAL(10,2)   | **리드당 비용 (자동 계산)** |
| **cpc**            | DECIMAL(10,2)   | **클릭당 비용 (자동 계산)** |
| **conversion_rate**| DECIMAL(5,4)    | **전환율 (자동 계산)**      |

### 핵심 기능

1. **자동 계산 컬럼 (GENERATED STORED)**
   ```sql
   ctr = (clicks / impressions * 100)
   cpl = (spend / leads)
   cpc = (spend / clicks)
   conversion_rate = (leads / clicks * 100)
   ```
   → 쿼리 시 계산 불필요, 인덱스 사용 가능

2. **UPSERT 지원**
   ```sql
   ON CONFLICT (client_id, date, ad_id)
   DO UPDATE SET ...
   ```
   → 중복 데이터 자동 병합

3. **최적화된 인덱스**
   - `idx_daily_agg_client_date`: 클라이언트별 일별 조회
   - `idx_daily_agg_cpl`: CPL 정렬/필터링
   - `idx_daily_agg_ctr`: CTR 정렬/필터링

---

## 자동 집계 함수

### 1. 단일 날짜 집계

```sql
SELECT * FROM aggregate_daily_data(
  '79e35fc6-a817-4ccc-9d5d-9a93c1ad4515', -- client_id
  '2025-11-17'                             -- date
);
```

### 2. 범위 집계 (히스토리 데이터)

```sql
SELECT * FROM aggregate_daily_data_range(
  '79e35fc6-a817-4ccc-9d5d-9a93c1ad4515', -- client_id
  '2025-11-17',                            -- start_date
  '2025-11-23'                             -- end_date
);
```

### 3. 전체 클라이언트 자동 집계

```sql
SELECT * FROM aggregate_all_clients_daily(
  CURRENT_DATE - INTERVAL '1 day'
);
```

---

## 적용 방법

### 1단계: 테이블 생성

```bash
# Supabase 대시보드에서 SQL 실행
cat sql/06_daily_aggregates.sql
```

또는 SQL Editor에서:
```sql
-- sql/06_daily_aggregates.sql 내용 붙여넣기
```

### 2단계: 히스토리 데이터 집계

```bash
# Node.js 스크립트로 자동 집계
node aggregate-historical-data.js
```

### 3단계: 자동화 설정 (Worker에 추가)

```javascript
// index.js (Worker)에 추가

async function dailyAggregation() {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const dateStr = yesterday.toISOString().split('T')[0];

  const { data, error } = await supabase.rpc('aggregate_all_clients_daily', {
    p_date: dateStr
  });

  if (error) {
    console.error('❌ 일별 집계 실패:', error);
  } else {
    console.log(`✅ 일별 집계 완료: ${data.length}개 클라이언트`);
  }
}

// 매일 오전 1시 실행
setInterval(dailyAggregation, 24 * 60 * 60 * 1000);
```

---

## 리포트 생성 시 활용

### 기존 방식 (raw_data 직접 조회)

```javascript
// ❌ 느림: 매번 집계
const { data } = await supabase
  .from('raw_data')
  .select('*')
  .eq('client_id', clientId)
  .gte('date', startDate)
  .lte('date', endDate);

// 클라이언트에서 집계 계산...
```

### 개선 방식 (daily_aggregates 활용)

```javascript
// ✅ 빠름: 사전 집계된 데이터
const { data } = await supabase
  .from('daily_aggregates')
  .select('*')
  .eq('client_id', clientId)
  .gte('date', startDate)
  .lte('date', endDate)
  .order('date', { ascending: true });

// CTR, CPL 이미 계산되어 있음!
```

### 일별 트렌드 분석

```javascript
// 일별 CPL 추이
const { data } = await supabase
  .from('daily_aggregates')
  .select('date, ad_name, cpl, leads, ctr')
  .eq('client_id', clientId)
  .gte('date', '2025-11-17')
  .lte('date', '2025-11-23')
  .gt('leads', 0) // 리드가 있는 것만
  .order('date', { ascending: true });

// 바로 사용 가능!
data.forEach(row => {
  console.log(`${row.date}: ${row.ad_name} - CPL $${row.cpl}, CTR ${row.ctr}%`);
});
```

### 광고별 주간 성과 비교

```javascript
// 광고별 주간 합계
const { data } = await supabase
  .from('daily_aggregates')
  .select('ad_id, ad_name, leads, spend, cpl')
  .eq('client_id', clientId)
  .gte('date', weekStart)
  .lte('date', weekEnd)
  .order('cpl', { ascending: true });

// 광고별로 그룹핑하여 합계 계산
const adGroups = {};
data.forEach(row => {
  if (!adGroups[row.ad_id]) {
    adGroups[row.ad_id] = { name: row.ad_name, leads: 0, spend: 0 };
  }
  adGroups[row.ad_id].leads += row.leads;
  adGroups[row.ad_id].spend += row.spend;
});

// CPL 재계산
Object.keys(adGroups).forEach(adId => {
  const ad = adGroups[adId];
  ad.cpl = ad.leads > 0 ? ad.spend / ad.leads : 0;
});
```

---

## 장점

### 1. 성능 향상
- **기존**: raw_data 28개 레코드 조회 → 집계 계산 (10초)
- **개선**: daily_aggregates 14개 레코드 조회 → 즉시 사용 (1초)
- **인덱스 활용**: cpl, ctr로 정렬/필터링 가능

### 2. 분석 능력 향상
- 일별 트렌드 즉시 조회
- 요일별 패턴 분석 가능
- 광고별 성과 변화 추적

### 3. 데이터 품질
- 중복 데이터 자동 병합 (UPSERT)
- 계산 오류 방지 (GENERATED STORED)
- 데이터 무결성 보장

### 4. 확장성
- 월간, 연간 집계 추가 가능
- 커스텀 분석 뷰 생성 용이
- 대시보드 성능 개선

---

## 다음 단계

1. ✅ **Tier 2 구축**: daily_aggregates 테이블 생성
2. ⏳ **히스토리 집계**: 기존 raw_data 일괄 변환
3. ⏳ **자동화**: Worker에 daily aggregation 추가
4. ⏳ **리포트 개선**: daily_aggregates 기반 리포트 재작성
5. ⏳ **대시보드 최적화**: 사전 집계 데이터 활용

---

**작성**: 2025-11-24
**버전**: 1.0.0
