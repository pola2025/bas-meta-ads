# Meta 광고 데이터 분석 기획

**작성일**: 2025-11-19
**프로젝트**: BAS Meta Ads Analytics
**데이터 기간**: 2025-01 ~ 현재 (10개월 데이터)

---

## 📊 수집 중인 데이터 (실제 메트릭)

### 기본 메트릭
- **노출수 (Impressions)**: 광고가 화면에 표시된 횟수
- **도달 (Reach)**: 광고를 본 고유 사용자 수
- **클릭 (Clicks)**: 광고 클릭 횟수
- **리드 (Leads)**: 전환 (문의, 가입 등)
- **지출 (Spend)**: 광고비 (KRW)

### 비디오 광고 메트릭
- **동영상 조회수 (Video Views)**: 비디오 재생 횟수
- **평균 시청 시간 (Avg Watch Time)**: 초 단위

### 메타 정보
- **날짜 (Date)**: 일자별 데이터
- **광고명 (Ad Name)**: 개별 광고 식별
- **캠페인명 (Campaign Name)**: 캠페인 그룹
- **플랫폼 (Platform)**: facebook, instagram 등
- **디바이스 (Device)**: mobile, desktop 등

---

## 🎯 분석 목표

### 1차 목표: 광고 성과 최적화
- 저성과 광고 조기 발견 및 중단
- 고성과 광고 패턴 분석 및 확대
- 예산 배분 최적화

### 2차 목표: 인사이트 도출
- 요일별/시간대별 성과 패턴
- 플랫폼별 효율성 비교
- 디바이스별 사용자 행동 차이
- 캠페인별 ROI 분석

### 3차 목표: 예측 및 추천
- 다음 주 예산 추천
- 성과 예측 모델
- 이상 징후 감지

---

## 📈 분석 1단계: 핵심 KPI 계산

### 1.1 효율성 지표

#### CTR (Click-Through Rate) - 클릭률
```sql
CTR = (Clicks / Impressions) * 100
```
- **의미**: 노출 대비 클릭 비율
- **목표**: 업계 평균 1.80% 이상
- **활용**: 광고 소재 효과성 측정

#### CPM (Cost Per Mille) - 1,000회 노출당 비용
```sql
CPM = (Spend / Impressions) * 1000
```
- **의미**: 노출 효율성
- **활용**: 플랫폼/디바이스별 비교

#### CPC (Cost Per Click) - 클릭당 비용
```sql
CPC = Spend / Clicks
```
- **의미**: 클릭 획득 비용
- **활용**: 예산 효율성 평가

#### CPL (Cost Per Lead) - 리드당 비용
```sql
CPL = Spend / Leads
```
- **의미**: 전환 효율성
- **목표**: 산업별 벤치마크 대비 평가
- **활용**: ROI 계산의 핵심 지표

#### CVR (Conversion Rate) - 전환율
```sql
CVR = (Leads / Clicks) * 100
```
- **의미**: 클릭 대비 리드 전환율
- **목표**: 2% 이상 (B2B 기준)
- **활용**: 랜딩 페이지 최적화

#### Frequency (빈도)
```sql
Frequency = Impressions / Reach
```
- **의미**: 1인당 평균 노출 횟수
- **적정 범위**: 2~3회
- **주의**: 4회 이상 시 피로도 증가

### 1.2 비디오 광고 전용 지표

#### VTR (View-Through Rate) - 조회율
```sql
VTR = (Video_Views / Impressions) * 100
```
- **의미**: 노출 대비 재생 비율
- **활용**: 썸네일 효과성 측정

#### CPV (Cost Per View) - 조회당 비용
```sql
CPV = Spend / Video_Views
```
- **의미**: 비디오 조회 획득 비용
- **활용**: 비디오 광고 효율성

#### Avg Engagement Time (평균 참여 시간)
```sql
직접 수집: avg_watch_time (초 단위)
```
- **의미**: 사용자가 실제로 본 시간
- **목표**: 비디오 길이의 50% 이상
- **활용**: 콘텐츠 품질 평가

---

## 📊 분석 2단계: 세그먼트 분석

### 2.1 시간 기반 분석

#### 일별 트렌드
```sql
SELECT
  date,
  SUM(impressions) as total_impressions,
  SUM(clicks) as total_clicks,
  SUM(leads) as total_leads,
  SUM(spend) as total_spend,
  ROUND((SUM(clicks)::DECIMAL / NULLIF(SUM(impressions), 0) * 100), 2) as ctr,
  ROUND((SUM(spend) / NULLIF(SUM(leads), 0)), 0) as cpl
FROM raw_data
WHERE date >= '2025-01-01'
GROUP BY date
ORDER BY date;
```

**활용**:
- 요일별 성과 패턴 발견
- 주말 vs 평일 비교
- 특정 이벤트 영향 분석

#### 주간 집계 (이미 구현됨)
```sql
SELECT * FROM weekly_summary
WHERE client_id = '고객ID'
ORDER BY week_start DESC;
```

**활용**:
- 주간 성과 추이
- 전주 대비 증감률
- 월간 목표 진척도

#### 월별 비교
```sql
SELECT
  DATE_TRUNC('month', date) as month,
  SUM(impressions) as impressions,
  SUM(clicks) as clicks,
  SUM(leads) as leads,
  SUM(spend) as spend,
  ROUND((SUM(clicks)::DECIMAL / NULLIF(SUM(impressions), 0) * 100), 2) as ctr,
  ROUND((SUM(spend) / NULLIF(SUM(leads), 0)), 0) as cpl
FROM raw_data
WHERE date >= '2025-01-01'
GROUP BY month
ORDER BY month;
```

**활용**:
- 계절성 파악
- 예산 배분 최적화
- 연간 성장률 계산

### 2.2 플랫폼/디바이스 분석

#### 플랫폼별 성과
```sql
SELECT
  platform,
  SUM(impressions) as impressions,
  SUM(clicks) as clicks,
  SUM(leads) as leads,
  SUM(spend) as spend,
  ROUND((SUM(clicks)::DECIMAL / NULLIF(SUM(impressions), 0) * 100), 2) as ctr,
  ROUND((SUM(spend) / NULLIF(SUM(leads), 0)), 0) as cpl,
  ROUND((SUM(spend) / NULLIF(SUM(clicks), 0)), 0) as cpc
FROM raw_data
WHERE date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY platform
ORDER BY spend DESC;
```

**인사이트 예시**:
- Instagram이 Facebook보다 CTR 높지만 CPL은 비싸다면?
  → 브랜딩용으로 Instagram, 전환용으로 Facebook

#### 디바이스별 성과
```sql
SELECT
  device,
  SUM(impressions) as impressions,
  SUM(clicks) as clicks,
  SUM(leads) as leads,
  SUM(spend) as spend,
  ROUND((SUM(clicks)::DECIMAL / NULLIF(SUM(impressions), 0) * 100), 2) as ctr,
  ROUND((SUM(spend) / NULLIF(SUM(leads), 0)), 0) as cpl
FROM raw_data
WHERE date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY device
ORDER BY spend DESC;
```

**인사이트 예시**:
- Mobile CTR > Desktop이지만 CVR < Desktop이라면?
  → Mobile 랜딩 페이지 최적화 필요

### 2.3 캠페인/광고 분석

#### 캠페인별 ROI 순위
```sql
SELECT
  campaign_name,
  COUNT(DISTINCT ad_id) as ad_count,
  SUM(impressions) as impressions,
  SUM(clicks) as clicks,
  SUM(leads) as leads,
  SUM(spend) as spend,
  ROUND((SUM(clicks)::DECIMAL / NULLIF(SUM(impressions), 0) * 100), 2) as ctr,
  ROUND((SUM(leads)::DECIMAL / NULLIF(SUM(clicks), 0) * 100), 2) as cvr,
  ROUND((SUM(spend) / NULLIF(SUM(leads), 0)), 0) as cpl
FROM raw_data
WHERE date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY campaign_name
ORDER BY cpl ASC NULLS LAST
LIMIT 10;
```

**활용**:
- Top 10 캠페인 패턴 분석
- Bottom 10 캠페인 개선 또는 중단
- 성과 좋은 캠페인 예산 증액

#### 광고별 성과 (상위/하위)
```sql
-- Top 10 광고
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
  AND leads > 0
GROUP BY ad_name, campaign_name
ORDER BY cpl ASC
LIMIT 10;
```

---

## 📊 분석 3단계: 고급 분석

### 3.1 코호트 분석 (주간 단위)

```sql
-- 주차별 신규 광고 성과 추적
WITH ad_first_week AS (
  SELECT
    ad_id,
    DATE_TRUNC('week', MIN(date)) as first_week
  FROM raw_data
  GROUP BY ad_id
),
weekly_performance AS (
  SELECT
    afw.first_week,
    DATE_TRUNC('week', rd.date) as performance_week,
    COUNT(DISTINCT rd.ad_id) as ad_count,
    SUM(rd.leads) as total_leads,
    SUM(rd.spend) as total_spend
  FROM raw_data rd
  JOIN ad_first_week afw ON rd.ad_id = afw.ad_id
  WHERE rd.date >= '2025-01-01'
  GROUP BY afw.first_week, performance_week
)
SELECT
  first_week as cohort_week,
  performance_week,
  EXTRACT(WEEK FROM performance_week - first_week) as week_number,
  ad_count,
  total_leads,
  total_spend,
  ROUND((total_spend / NULLIF(total_leads, 0)), 0) as cpl
FROM weekly_performance
ORDER BY first_week, performance_week;
```

**인사이트**:
- 신규 광고가 몇 주차에 가장 효율적인가?
- 광고 피로도는 언제부터 시작되는가?
- 최적 광고 교체 주기는?

### 3.2 광고 생애주기 분석

```sql
SELECT
  ad_name,
  MIN(date) as start_date,
  MAX(date) as end_date,
  COUNT(DISTINCT date) as active_days,
  SUM(impressions) as total_impressions,
  SUM(clicks) as total_clicks,
  SUM(leads) as total_leads,
  SUM(spend) as total_spend,
  ROUND((SUM(clicks)::DECIMAL / NULLIF(SUM(impressions), 0) * 100), 2) as lifetime_ctr,
  ROUND((SUM(spend) / NULLIF(SUM(leads), 0)), 0) as lifetime_cpl,
  -- 초반 7일 성과
  ROUND((
    SUM(CASE WHEN date <= MIN(date) + INTERVAL '7 days' THEN clicks ELSE 0 END)::DECIMAL /
    NULLIF(SUM(CASE WHEN date <= MIN(date) + INTERVAL '7 days' THEN impressions ELSE 0 END), 0) * 100
  ), 2) as first_7_days_ctr
FROM raw_data
WHERE date >= '2025-01-01'
GROUP BY ad_name
HAVING COUNT(DISTINCT date) >= 7
ORDER BY total_spend DESC;
```

**활용**:
- 초반 성과 vs 전체 성과 비교
- 조기 성과가 좋은 광고의 특징 파악
- 장기 집행 vs 단기 집행 효율성 비교

### 3.3 빈도 분석 (Frequency)

```sql
SELECT
  date,
  platform,
  device,
  SUM(impressions) as impressions,
  SUM(reach) as reach,
  ROUND((SUM(impressions)::DECIMAL / NULLIF(SUM(reach), 0)), 2) as frequency,
  SUM(clicks) as clicks,
  SUM(leads) as leads,
  ROUND((SUM(clicks)::DECIMAL / NULLIF(SUM(impressions), 0) * 100), 2) as ctr
FROM raw_data
WHERE date >= CURRENT_DATE - INTERVAL '30 days'
  AND reach > 0
GROUP BY date, platform, device
ORDER BY date DESC, frequency DESC;
```

**최적 빈도 분석**:
```sql
WITH frequency_buckets AS (
  SELECT
    CASE
      WHEN (impressions::DECIMAL / NULLIF(reach, 0)) < 2 THEN '1.0-1.9'
      WHEN (impressions::DECIMAL / NULLIF(reach, 0)) < 3 THEN '2.0-2.9'
      WHEN (impressions::DECIMAL / NULLIF(reach, 0)) < 4 THEN '3.0-3.9'
      WHEN (impressions::DECIMAL / NULLIF(reach, 0)) < 5 THEN '4.0-4.9'
      ELSE '5.0+'
    END as frequency_range,
    clicks,
    impressions,
    leads,
    spend
  FROM raw_data
  WHERE date >= CURRENT_DATE - INTERVAL '30 days'
    AND reach > 0
)
SELECT
  frequency_range,
  COUNT(*) as data_points,
  SUM(impressions) as total_impressions,
  SUM(clicks) as total_clicks,
  SUM(leads) as total_leads,
  SUM(spend) as total_spend,
  ROUND((SUM(clicks)::DECIMAL / NULLIF(SUM(impressions), 0) * 100), 2) as ctr,
  ROUND((SUM(leads)::DECIMAL / NULLIF(SUM(clicks), 0) * 100), 2) as cvr,
  ROUND((SUM(spend) / NULLIF(SUM(leads), 0)), 0) as cpl
FROM frequency_buckets
GROUP BY frequency_range
ORDER BY frequency_range;
```

**인사이트**:
- 빈도 2~3이 가장 효율적이라면 → 도달 확대 전략
- 빈도 4+ 성과 하락 시 → 광고 피로도, 소재 교체 필요

---

## 📊 분석 4단계: 시각화 및 대시보드

### 4.1 주요 차트 구성

#### 차트 1: 일별 성과 추이 (라인 차트)
- X축: 날짜
- Y축 (좌): 노출, 클릭, 리드
- Y축 (우): 지출
- **목적**: 전반적인 트렌드 파악

#### 차트 2: 주간 KPI 비교 (막대 차트)
- X축: 주차
- Y축: CTR, CVR, CPL
- **목적**: 주간 효율성 변화 추적

#### 차트 3: 플랫폼/디바이스 비교 (도넛 차트)
- 지출 비중
- 리드 비중
- **목적**: 예산 배분 최적화

#### 차트 4: 캠페인별 버블 차트
- X축: 총 지출
- Y축: 총 리드
- 버블 크기: CTR
- 색상: CPL (낮을수록 녹색)
- **목적**: 캠페인 포트폴리오 한눈에 파악

#### 차트 5: 빈도별 성과 (막대 차트)
- X축: 빈도 구간 (1-2, 2-3, 3-4, 4-5, 5+)
- Y축: CTR, CVR, CPL
- **목적**: 최적 빈도 발견

#### 차트 6: 광고 생애주기 (히트맵)
- X축: 광고 집행 일수
- Y축: 개별 광고
- 색상: 일별 CPL
- **목적**: 광고 피로도 시점 파악

### 4.2 대시보드 레이아웃

```
┌─────────────────────────────────────────────┐
│  📊 BAS Meta Ads Analytics Dashboard       │
│  기간: 2025-01-01 ~ 현재                    │
├─────────────────────────────────────────────┤
│                                             │
│  📈 핵심 KPI                                │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐      │
│  │ 노출  │ │ 클릭 │ │ 리드 │ │ 지출 │      │
│  │ 100K │ │ 2.5K │ │  50 │ │ 500K │      │
│  │ +5%  │ │ +8%  │ │ +12% │ │ +3%  │      │
│  └──────┘ └──────┘ └──────┘ └──────┘      │
│                                             │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐      │
│  │ CTR  │ │ CVR  │ │ CPL  │ │ CPC  │      │
│  │ 2.5% │ │ 2.0% │ │ 10K  │ │ 200  │      │
│  │ +0.3%│ │ +0.5%│ │ -8%  │ │ -5%  │      │
│  └──────┘ └──────┘ └──────┘ └──────┘      │
│                                             │
├─────────────────────────────────────────────┤
│                                             │
│  📊 일별 성과 추이 (최근 30일)              │
│  [라인 차트]                                │
│                                             │
├─────────────────────────────────────────────┤
│                                             │
│  🎯 플랫폼/디바이스 분석                    │
│  [좌: 플랫폼 도넛] [우: 디바이스 도넛]     │
│                                             │
├─────────────────────────────────────────────┤
│                                             │
│  🏆 Top 10 캠페인 (CPL 기준)               │
│  [막대 차트]                                │
│                                             │
├─────────────────────────────────────────────┤
│                                             │
│  ⚡ 빈도별 성과 분석                        │
│  [그룹 막대 차트]                           │
│                                             │
└─────────────────────────────────────────────┘
```

---

## 🎯 분석 5단계: 인사이트 도출 및 액션

### 5.1 성과 진단 체크리스트

#### 클릭 문제 (CTR 낮음)
- [ ] 썸네일/이미지 매력도 낮음
- [ ] 타겟팅 부정확 (관심 없는 사람에게 노출)
- [ ] 광고 피로도 (빈도 4 이상)
- [ ] 광고 소재 오래됨 (2주 이상)

**액션**:
- 소재 A/B 테스트
- 타겟팅 재설정
- 광고 교체

#### 전환 문제 (CVR 낮음)
- [ ] 랜딩 페이지와 광고 메시지 불일치
- [ ] 로딩 속도 느림 (특히 Mobile)
- [ ] 전환 버튼 CTA 불명확
- [ ] 입력 폼 복잡

**액션**:
- 랜딩 페이지 A/B 테스트
- Mobile 최적화
- 폼 간소화

#### 비용 문제 (CPL 높음)
- [ ] 경쟁 과열 (입찰가 상승)
- [ ] 타겟 과도하게 넓음
- [ ] 저품질 트래픽 유입
- [ ] 캠페인 최적화 부족

**액션**:
- 타겟 세분화
- 저성과 광고 중단
- 예산 재배분

### 5.2 주간 리뷰 프로세스

#### 월요일: 전주 성과 리뷰
```sql
-- 전주 vs 전전주 비교
SELECT
  'Last Week' as period,
  SUM(impressions) as impressions,
  SUM(clicks) as clicks,
  SUM(leads) as leads,
  SUM(spend) as spend,
  ROUND((SUM(clicks)::DECIMAL / NULLIF(SUM(impressions), 0) * 100), 2) as ctr,
  ROUND((SUM(spend) / NULLIF(SUM(leads), 0)), 0) as cpl
FROM raw_data
WHERE date >= CURRENT_DATE - INTERVAL '7 days'
  AND date < CURRENT_DATE

UNION ALL

SELECT
  'Week Before' as period,
  SUM(impressions),
  SUM(clicks),
  SUM(leads),
  SUM(spend),
  ROUND((SUM(clicks)::DECIMAL / NULLIF(SUM(impressions), 0) * 100), 2),
  ROUND((SUM(spend) / NULLIF(SUM(leads), 0)), 0)
FROM raw_data
WHERE date >= CURRENT_DATE - INTERVAL '14 days'
  AND date < CURRENT_DATE - INTERVAL '7 days';
```

**체크 포인트**:
- 리드 수 목표 달성 여부
- 예산 소진율 (100% 근접 여부)
- 이상 징후 (급격한 CPL 상승 등)

#### 화요일~목요일: 실시간 모니터링
```sql
-- 금일 성과 (실시간)
SELECT
  campaign_name,
  ad_name,
  SUM(impressions) as impressions,
  SUM(clicks) as clicks,
  SUM(leads) as leads,
  SUM(spend) as spend,
  ROUND((SUM(clicks)::DECIMAL / NULLIF(SUM(impressions), 0) * 100), 2) as ctr,
  ROUND((SUM(spend) / NULLIF(SUM(leads), 0)), 0) as cpl
FROM raw_data
WHERE date = CURRENT_DATE
GROUP BY campaign_name, ad_name
ORDER BY spend DESC;
```

**조치 기준**:
- CPL 평균 대비 150% 이상 → 즉시 일시 중지
- CTR 0.5% 미만 → 소재 교체 검토
- 리드 0건 (지출 10만원 이상) → 타겟팅 재검토

#### 금요일: 다음 주 계획
- Top 3 캠페인 예산 증액 (20%)
- Bottom 3 캠페인 예산 감액 또는 중단
- 신규 A/B 테스트 광고 론칭

---

## 🚀 분석 6단계: 고급 기능 (향후 구현)

### 6.1 예측 모델

#### 다음 주 리드 예측
- 과거 4주 데이터 기반 선형 회귀
- 계절성 보정 (월별 패턴)
- 예산 시나리오 시뮬레이션

#### 이상 탐지 (Anomaly Detection)
- CPL 급등 감지 (평균 대비 2 표준편차 이상)
- CTR 급락 감지
- 지출 폭증 조기 경보

### 6.2 추천 시스템

#### 예산 재배분 추천
```
현재 예산: 100만원
- 캠페인 A: 40% (CPL 8천원) → 50% 증액 권장 ✅
- 캠페인 B: 30% (CPL 15천원) → 20% 감액 권장 ⚠️
- 캠페인 C: 30% (CPL 25천원) → 중단 권장 ❌
```

#### 광고 교체 알림
```
[경고] "광고명 A"가 14일째 실행 중입니다.
- 현재 CTR: 1.2% (7일 전 대비 -0.5%p)
- 광고 피로도 감지
- 권장: 새 소재로 교체
```

### 6.3 자동 리포트 생성

#### 주간 리포트 (텔레그램/이메일)
```
📊 BAS 주간 리포트 (2025-11-11 ~ 11-17)

🎯 핵심 성과:
  - 리드: 52건 (전주 대비 +8%)
  - 지출: 520만원 (목표 500만원 대비 +4%)
  - CPL: 10만원 (전주 대비 -5%)

🏆 Top 3 캠페인:
  1. 봄 프로모션 (CPL 8만원, 리드 20건)
  2. 신규 론칭 (CPL 9만원, 리드 15건)
  3. 재타겟팅 (CPL 11만원, 리드 10건)

⚠️  주의 필요:
  - 여름 캠페인 CPL 18만원 (평균 대비 +80%)
  - 리드 없는 광고 3개 발견 (총 지출 30만원)

💡 추천 액션:
  1. 봄 프로모션 예산 +20만원 증액
  2. 여름 캠페인 일시 중지 및 소재 교체
  3. 모바일 랜딩 페이지 로딩 속도 개선
```

---

## 📂 구현 계획

### Phase 1: 기본 분석 (즉시 가능)
- [x] 파티션 생성 완료
- [x] Backfill 데이터 수집 완료
- [ ] KPI 계산 함수 작성
- [ ] 일별/주별/월별 집계 뷰 생성
- [ ] 플랫폼/디바이스/캠페인별 분석 쿼리

### Phase 2: 대시보드 구축 (1주)
- [ ] Next.js 대시보드 KPI 카드 추가
- [ ] Chart.js/Recharts로 차트 구현
- [ ] 실시간 데이터 업데이트 (5분마다)
- [ ] 필터링 기능 (날짜, 캠페인, 플랫폼)

### Phase 3: 고급 분석 (2주)
- [ ] 코호트 분석 쿼리
- [ ] 빈도 분석 자동화
- [ ] 광고 생애주기 추적
- [ ] 이상 탐지 알고리즘

### Phase 4: 자동화 (3주)
- [ ] 주간 리포트 자동 생성
- [ ] 텔레그램 상세 리포트 전송
- [ ] 이메일 리포트 (PDF)
- [ ] 예산 재배분 추천

---

## 🎯 즉시 실행 가능한 쿼리 TOP 10

### 1. 오늘의 성과 요약
```sql
SELECT
  SUM(impressions) as impressions,
  SUM(reach) as reach,
  SUM(clicks) as clicks,
  SUM(leads) as leads,
  SUM(spend) as spend,
  ROUND((SUM(clicks)::DECIMAL / NULLIF(SUM(impressions), 0) * 100), 2) as ctr,
  ROUND((SUM(leads)::DECIMAL / NULLIF(SUM(clicks), 0) * 100), 2) as cvr,
  ROUND((SUM(spend) / NULLIF(SUM(leads), 0)), 0) as cpl
FROM raw_data
WHERE date = CURRENT_DATE;
```

### 2. 최근 7일 일별 트렌드
```sql
SELECT
  date,
  SUM(impressions) as impressions,
  SUM(clicks) as clicks,
  SUM(leads) as leads,
  SUM(spend) as spend,
  ROUND((SUM(clicks)::DECIMAL / NULLIF(SUM(impressions), 0) * 100), 2) as ctr,
  ROUND((SUM(spend) / NULLIF(SUM(leads), 0)), 0) as cpl
FROM raw_data
WHERE date >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY date
ORDER BY date;
```

### 3. 플랫폼별 비교 (최근 30일)
```sql
SELECT
  platform,
  SUM(impressions) as impressions,
  SUM(clicks) as clicks,
  SUM(leads) as leads,
  SUM(spend) as spend,
  ROUND((SUM(clicks)::DECIMAL / NULLIF(SUM(impressions), 0) * 100), 2) as ctr,
  ROUND((SUM(spend) / NULLIF(SUM(leads), 0)), 0) as cpl
FROM raw_data
WHERE date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY platform
ORDER BY spend DESC;
```

### 4. 디바이스별 비교 (최근 30일)
```sql
SELECT
  device,
  SUM(impressions) as impressions,
  SUM(clicks) as clicks,
  SUM(leads) as leads,
  SUM(spend) as spend,
  ROUND((SUM(clicks)::DECIMAL / NULLIF(SUM(impressions), 0) * 100), 2) as ctr,
  ROUND((SUM(spend) / NULLIF(SUM(leads), 0)), 0) as cpl
FROM raw_data
WHERE date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY device
ORDER BY spend DESC;
```

### 5. Top 10 캠페인 (CPL 낮은 순)
```sql
SELECT
  campaign_name,
  COUNT(DISTINCT ad_id) as ad_count,
  SUM(impressions) as impressions,
  SUM(clicks) as clicks,
  SUM(leads) as leads,
  SUM(spend) as spend,
  ROUND((SUM(clicks)::DECIMAL / NULLIF(SUM(impressions), 0) * 100), 2) as ctr,
  ROUND((SUM(spend) / NULLIF(SUM(leads), 0)), 0) as cpl
FROM raw_data
WHERE date >= CURRENT_DATE - INTERVAL '30 days'
  AND leads > 0
GROUP BY campaign_name
ORDER BY cpl ASC
LIMIT 10;
```

### 6. Top 10 광고 (리드 많은 순)
```sql
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
  AND leads > 0
GROUP BY ad_name, campaign_name
ORDER BY leads DESC
LIMIT 10;
```

### 7. 저성과 광고 (리드 0건, 지출 10만원 이상)
```sql
SELECT
  ad_name,
  campaign_name,
  SUM(impressions) as impressions,
  SUM(clicks) as clicks,
  SUM(spend) as spend,
  ROUND((SUM(clicks)::DECIMAL / NULLIF(SUM(impressions), 0) * 100), 2) as ctr
FROM raw_data
WHERE date >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY ad_name, campaign_name
HAVING SUM(leads) = 0 AND SUM(spend) >= 100000
ORDER BY spend DESC;
```

### 8. 빈도 분석 (최근 7일)
```sql
SELECT
  ROUND(AVG(impressions::DECIMAL / NULLIF(reach, 0)), 2) as avg_frequency,
  SUM(impressions) as total_impressions,
  SUM(reach) as total_reach,
  SUM(clicks) as total_clicks,
  SUM(leads) as total_leads,
  ROUND((SUM(clicks)::DECIMAL / NULLIF(SUM(impressions), 0) * 100), 2) as ctr,
  ROUND((SUM(spend) / NULLIF(SUM(leads), 0)), 0) as cpl
FROM raw_data
WHERE date >= CURRENT_DATE - INTERVAL '7 days'
  AND reach > 0;
```

### 9. 월별 성과 비교 (2025년 전체)
```sql
SELECT
  TO_CHAR(date, 'YYYY-MM') as month,
  SUM(impressions) as impressions,
  SUM(clicks) as clicks,
  SUM(leads) as leads,
  SUM(spend) as spend,
  ROUND((SUM(clicks)::DECIMAL / NULLIF(SUM(impressions), 0) * 100), 2) as ctr,
  ROUND((SUM(spend) / NULLIF(SUM(leads), 0)), 0) as cpl
FROM raw_data
WHERE date >= '2025-01-01'
GROUP BY month
ORDER BY month;
```

### 10. 비디오 광고 성과 (최근 30일)
```sql
SELECT
  ad_name,
  campaign_name,
  SUM(impressions) as impressions,
  SUM(video_views) as video_views,
  AVG(avg_watch_time) as avg_watch_time,
  SUM(clicks) as clicks,
  SUM(leads) as leads,
  SUM(spend) as spend,
  ROUND((SUM(video_views)::DECIMAL / NULLIF(SUM(impressions), 0) * 100), 2) as vtr,
  ROUND((SUM(spend) / NULLIF(SUM(video_views), 0)), 0) as cpv
FROM raw_data
WHERE date >= CURRENT_DATE - INTERVAL '30 days'
  AND video_views > 0
GROUP BY ad_name, campaign_name
ORDER BY video_views DESC
LIMIT 10;
```

---

## 🎓 용어 정리

- **CTR (Click-Through Rate)**: 클릭률, 노출 대비 클릭 비율
- **CVR (Conversion Rate)**: 전환율, 클릭 대비 리드 비율
- **CPM (Cost Per Mille)**: 1,000회 노출당 비용
- **CPC (Cost Per Click)**: 클릭당 비용
- **CPL (Cost Per Lead)**: 리드당 비용
- **CPV (Cost Per View)**: 조회당 비용 (비디오 광고)
- **VTR (View-Through Rate)**: 조회율, 노출 대비 재생 비율
- **Frequency (빈도)**: 1인당 평균 노출 횟수
- **Reach (도달)**: 광고를 본 고유 사용자 수
- **Impressions (노출)**: 광고가 화면에 표시된 총 횟수

---

**작성자**: Claude
**프로젝트**: BAS Meta Ads Analytics
**버전**: 1.0.0
**다음 단계**: Phase 1 구현 → KPI 계산 함수 작성
