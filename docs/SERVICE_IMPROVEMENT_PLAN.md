# BAS Meta Ads Analytics 서비스 개선 기획서

**작성일**: 2025-12-01
**버전**: 1.1
**최종 수정**: 2025-12-01 (Phase 1 실행 가이드 추가)
**작성자**: 시스템 분석 결과 기반

---

## 1. Executive Summary

### 현재 상태
BAS Meta Ads Analytics는 Meta 광고 데이터를 수집하여 클라이언트별 주간/월간 리포트를 자동 생성하는 서비스입니다. 대시보드 UI는 완성도가 높으나, **데이터 파이프라인의 구조적 결함**으로 인해 리포트 데이터 신뢰성에 심각한 문제가 있습니다.

### 핵심 문제
- 월간 리포트 미생성 (7개 클라이언트 중 4개)
- 데이터 정합성 검증 부재
- 수동 개입 없이는 자동화가 작동하지 않음

### 개선 목표
- **Zero-Touch 자동화**: 수동 개입 없이 100% 자동 리포트 생성
- **데이터 신뢰성**: 리포트 생성 전 정합성 검증 100%
- **실시간 모니터링**: 문제 발생 시 즉시 알림

---

## 2. 현재 시스템 문제점 분석

### 2.1 아키텍처 문제 (Critical)

#### 문제: 데이터 소스 분리
```
현재 데이터 흐름:

Meta API → raw_data (테이블)
              ↓
    ┌────────┴────────┐
    ↓                 ↓
ads_insights_daily   daily_aggregates
    (VIEW)              (TABLE)
    ↓                    ↓
 주간 리포트          월간 리포트
    ↓                    ↓
 ✅ 자동 동기화       ❌ 수동 동기화 필요
```

| 구분 | 데이터 소스 | 동기화 방식 | 문제점 |
|-----|-----------|-----------|-------|
| 주간 리포트 | ads_insights_daily (VIEW) | 자동 (raw_data 참조) | 없음 |
| 월간 리포트 | daily_aggregates (TABLE) | 수동 (Worker 의존) | **동기화 안됨** |

#### 영향
- 7개 클라이언트 중 4개의 월간 리포트 미생성
- 데이터 불일치로 인한 리포트 신뢰성 저하
- 수동 집계 실행 필요

### 2.2 자동화 문제 (High)

#### 문제: Worker 의존성
```
데이터 수집 흐름:

Producer (크론) → Queue → Worker → syncAndVerify()
                              ↓
                    토큰 만료 시 → auth_required
                              ↓
                    daily_aggregates 집계 안됨
```

| 클라이언트 | auth_status | daily_aggregates | 원인 |
|-----------|------------|------------------|------|
| 솔트 | auth_required | 0건 → 100건 (수동) | 토큰 만료 |
| 성공K | auth_required | 0건 → 119건 (수동) | 토큰 만료 |
| 부자성공파트너 | auth_required | 0건 → 86건 (수동) | 토큰 만료 |
| JH경영지원센터 | active | 0건 → 21건 (수동) | Worker 미실행 |

#### 영향
- 토큰 만료 시 자동 복구 없음
- 데이터 수집 실패해도 알림 없음
- 백필 스크립트 실행해도 daily_aggregates 집계 안됨

### 2.3 데이터 정합성 문제 (High)

#### 문제: 검증 시스템 부재
```
현재:
raw_data 저장 → 리포트 생성 (검증 없음)

문제 사례:
- 비즈액터스쿨 2025-06-01: raw(4건, $66.44) vs agg(4건, $73.55)
- 비즈액터스쿨 2025-06-02: raw(2건, $45.61) vs agg(0건, $27.37)
```

#### 영향
- 리포트 데이터와 실제 데이터 불일치
- 클라이언트 신뢰도 저하
- 문제 발견 시 수동 추적 필요

### 2.4 백필 프로세스 문제 (Medium)

#### 문제: 불완전한 백필
```javascript
// backfill-cli.js 현재 동작
1. Meta API 호출
2. raw_data 저장
3. weekly_summary 생성
// ❌ daily_aggregates 집계 없음!
```

#### 영향
- 백필 후에도 월간 리포트 생성 안됨
- 수동으로 sync-all-daily-aggregates.js 실행 필요

### 2.5 모니터링 문제 (Medium)

#### 문제: 사전 알림 부재
- 데이터 수집 실패 시 알림 없음 (사후 발견)
- 토큰 만료 예정 알림 없음
- 리포트 생성 실패 시 알림 미약

---

## 3. 개선 방안

### 3.1 아키텍처 단순화 (P0 - 즉시)

#### 목표
데이터 소스를 단일화하여 동기화 문제 원천 제거

#### 개선안
```
개선 후:

Meta API → raw_data (단일 원본)
              ↓
      ads_insights_daily (VIEW) ← 자동 최신 데이터
              ↓
      모든 리포트 (주간 + 월간)
```

#### 작업 내용
| 작업 | 파일 | 예상 시간 |
|-----|-----|---------|
| 월간 리포트 데이터 소스 변경 | send-monthly-report.js | 30분 |
| fetchMonthlyData 함수 수정 | - | - |
| daily_aggregates → ads_insights_daily | - | - |

#### 코드 변경
```javascript
// Before (send-monthly-report.js:121)
async function fetchMonthlyData(startDate, endDate, clientId) {
  let query = supabase
    .from('daily_aggregates')  // ❌ 동기화 안됨
    ...
}

// After
async function fetchMonthlyData(startDate, endDate, clientId) {
  let query = supabase
    .from('ads_insights_daily')  // ✅ VIEW - 자동 최신
    ...
}
```

#### 기대 효과
- 동기화 문제 100% 해결
- daily_aggregates 테이블 관리 불필요
- 코드 복잡도 감소

---

### 3.2 데이터 정합성 검증 시스템 (P1 - 1주일 내)

#### 목표
리포트 생성 전 데이터 완전성 및 정합성 자동 검증

#### 개선안
```
리포트 생성 프로세스:

1. 데이터 완전성 체크
   - 해당 기간 모든 날짜 데이터 존재 확인
   - 누락 날짜 감지 시 경고

2. 데이터 정합성 체크
   - raw_data 합계 vs VIEW 합계 비교
   - 불일치 시 알림 + 리포트 보류

3. 임계값 검증
   - 리드 0건 + 지출 0 = 경고 표시
   - 전주 대비 급격한 변화 감지

4. 리포트 생성
   - 모든 검증 통과 시에만 생성
   - 검증 결과 메타데이터 저장
```

#### 작업 내용
| 작업 | 파일 | 예상 시간 |
|-----|-----|---------|
| 검증 모듈 확장 | lib/data-integrity.js | 2시간 |
| 리포트 생성 전 검증 로직 | send-weekly-report.js | 1시간 |
| 검증 결과 DB 저장 | - | 1시간 |
| 텔레그램 알림 연동 | lib/telegram-notifier.js | 1시간 |

#### 검증 항목
```javascript
const validationChecks = {
  // 1. 날짜 완전성
  dateCompleteness: {
    check: '기간 내 모든 날짜 데이터 존재',
    threshold: 100, // 100% 필수
    action: 'warn_and_continue'
  },

  // 2. 데이터 정합성
  dataConsistency: {
    check: 'raw_data vs VIEW 합계 일치',
    tolerance: 0.01, // 1% 오차 허용
    action: 'block_if_fail'
  },

  // 3. 이상치 감지
  anomalyDetection: {
    check: '전주 대비 변화율',
    threshold: 200, // 200% 이상 변화 시 경고
    action: 'warn_and_continue'
  },

  // 4. 최소 데이터 확인
  minimumData: {
    check: '리드 또는 지출 존재',
    action: 'skip_if_zero'
  }
};
```

---

### 3.3 백필 프로세스 완성 (P1 - 1주일 내)

#### 목표
백필 실행 시 모든 데이터 파이프라인 자동 완료

#### 현재 vs 개선
```
현재:
backfill-cli.js → raw_data 저장 → weekly_summary
                                 ↓
                    daily_aggregates 집계 안됨 ❌

개선:
backfill-cli.js → raw_data 저장 → syncAndVerify() → weekly_summary
                                        ↓
                           daily_aggregates 자동 동기화 ✅
```

#### 작업 내용
```javascript
// backfill-cli.js에 추가
const { syncAndVerify } = require('./lib/data-integrity');

// 백필 완료 후
await syncAndVerify(clientId, startDate, endDate);
```

---

### 3.4 토큰 관리 개선 (P2 - 2주 내)

#### 목표
토큰 만료 사전 예방 및 자동 알림

#### 개선안
```
토큰 관리 흐름:

1. 일일 토큰 상태 체크 (크론)
   - 만료 7일 전 알림
   - 만료 1일 전 긴급 알림

2. 토큰 갱신 자동화
   - refresh_token으로 자동 갱신
   - 갱신 실패 시 관리자 알림

3. auth_required 상태 모니터링
   - 상태 변경 즉시 알림
   - 재인증 링크 자동 발송
```

#### 작업 내용
| 작업 | 예상 시간 |
|-----|---------|
| 토큰 만료 체크 크론 | 2시간 |
| 자동 갱신 로직 | 3시간 |
| 관리자 알림 시스템 | 2시간 |

---

### 3.5 모니터링 대시보드 (P3 - 1개월 내)

#### 목표
시스템 상태 실시간 모니터링

#### 개선안
```
모니터링 항목:

1. 데이터 수집 상태
   - 클라이언트별 최근 수집 시간
   - 수집 성공/실패 현황

2. 리포트 발송 상태
   - 주간/월간 리포트 발송 현황
   - 발송 실패 내역

3. 시스템 헬스
   - Worker 상태
   - Queue 상태
   - Redis 연결 상태

4. 알림 히스토리
   - 발송된 알림 내역
   - 에러 로그
```

---

## 4. 구현 우선순위

### Phase 1: 즉시 (이번 주)
| 순위 | 작업 | 효과 | 예상 시간 |
|-----|-----|-----|---------|
| P0-1 | 월간 리포트 데이터 소스 변경 | 동기화 문제 해결 | 30분 |
| P0-2 | 11월 월간 리포트 생성 | 현재 이슈 해결 | 1시간 |

### Phase 2: 1주일 내
| 순위 | 작업 | 효과 | 예상 시간 |
|-----|-----|-----|---------|
| P1-1 | 데이터 정합성 검증 시스템 | 리포트 신뢰성 | 5시간 |
| P1-2 | 백필 프로세스 완성 | 운영 효율성 | 2시간 |
| P1-3 | 리포트 생성 전 검증 로직 | 자동 품질 관리 | 2시간 |

### Phase 3: 2주 내
| 순위 | 작업 | 효과 | 예상 시간 |
|-----|-----|-----|---------|
| P2-1 | 토큰 만료 사전 알림 | 사전 예방 | 4시간 |
| P2-2 | auth_required 자동 알림 | 빠른 대응 | 2시간 |

### Phase 4: 1개월 내
| 순위 | 작업 | 효과 | 예상 시간 |
|-----|-----|-----|---------|
| P3-1 | 관리자 모니터링 페이지 | 실시간 상태 파악 | 8시간 |
| P3-2 | 알림 히스토리 관리 | 이력 추적 | 4시간 |

---

## 5. Phase 1 실행 가이드 (즉시 적용)

### 5.1 작업 개요

| 항목 | 내용 |
|-----|-----|
| **목표** | daily_aggregates(동기화 안 되는 테이블) 의존성 제거 → ads_insights_daily(자동 갱신 VIEW)로 교체 |
| **대상 파일** | `send-monthly-report.js` |
| **예상 소요 시간** | 10~20분 |
| **위험도** | 낮음 (VIEW 컬럼 구조 동일) |

### 5.2 코드 수정 가이드

#### 수정 위치: `send-monthly-report.js` - fetchMonthlyData 함수

```javascript
// send-monthly-report.js

async function fetchMonthlyData(startDate, endDate, clientId) {
  try {
    // [변경 전] 동기화가 필요한 테이블 사용 (문제 원인)
    // const { data, error } = await supabase
    //   .from('daily_aggregates')
    //   .select('*')
    //   .eq('client_id', clientId)
    //   .gte('date', startDate)
    //   .lte('date', endDate);

    // [변경 후] 실시간 반영되는 VIEW 사용 (해결책)
    // ads_insights_daily는 raw_data를 기반으로 하므로 별도 동기화 불필요
    const { data, error } = await supabase
      .from('ads_insights_daily')
      .select('*')
      .eq('client_id', clientId)
      .gte('date', startDate)
      .lte('date', endDate);

    if (error) {
      console.error(`Error fetching data for client ${clientId}:`, error);
      throw error;
    }

    // 데이터가 없는 경우 처리
    if (!data || data.length === 0) {
        console.warn(`No data found for client ${clientId} between ${startDate} and ${endDate}`);
        return [];
    }

    return data;
  } catch (err) {
    console.error('fetchMonthlyData execution failed:', err);
    return []; // 에러 시 빈 배열 반환하여 프로세스 중단 방지
  }
}
```

> **참고**: `ads_insights_daily` VIEW가 `daily_aggregates` 테이블과 컬럼 구조(spend, impressions, clicks 등)가 동일하므로, 테이블 명만 교체하면 즉시 작동합니다.

### 5.3 검증 및 11월 리포트 생성 (P0-2)

#### Step 1: 특정 클라이언트 테스트
```bash
# JH경영지원센터로 우선 테스트 (월간 리포트 미생성 상태)
node send-monthly-report.js --client="JH경영지원센터" --month="2025-11"
```

#### Step 2: 로그 확인 사항
- [ ] `Data source: ads_insights_daily` 메시지 확인
- [ ] `Fetched XX records...` - 0이 아닌 정상 숫자 확인
- [ ] `Report generated successfully` 확인

#### Step 3: 데이터 검증
- [ ] 생성된 리포트의 수치(지출액, 리드 등)가 Meta 광고 관리자와 일치 확인
- [ ] 주간 리포트 합산 값과 월간 리포트 값 비교 확인

### 5.4 전체 클라이언트 적용

테스트 성공 후 전체 클라이언트 월간 리포트 생성:

```bash
# 모든 클라이언트 11월 월간 리포트 생성
REPORT_MONTH=2025-11 node send-monthly-report.js --force
```

### 5.5 롤백 계획

문제 발생 시:
1. `daily_aggregates`로 즉시 롤백 가능 (테이블에 데이터 존재)
2. `sync-all-daily-aggregates.js` 실행으로 최신 데이터 동기화
3. 원본 코드로 복원

---

## 6. 개선 후 기대 효과

### 정량적 효과
| 지표 | 현재 | 목표 |
|-----|-----|-----|
| 월간 리포트 생성률 | 43% (3/7) | 100% |
| 데이터 정합성 | 검증 없음 | 100% 검증 |
| 수동 개입 빈도 | 주 3-5회 | 0회 |
| 문제 발견 시간 | 사후 (수일) | 즉시 (분 단위) |

### 정성적 효과
- 클라이언트 신뢰도 향상
- 운영 부담 감소
- 확장성 확보 (신규 클라이언트 온보딩 용이)

---

## 6. 리스크 및 대응

| 리스크 | 영향 | 대응 방안 |
|-------|-----|---------|
| VIEW 성능 저하 | 리포트 생성 지연 | 인덱스 최적화, 캐싱 |
| 토큰 만료 | 데이터 수집 중단 | 사전 알림, 자동 갱신 |
| Meta API 변경 | 수집 실패 | 버전 고정, 모니터링 |

---

## 7. 부록

### A. 현재 클라이언트 현황 (2025-12-01)

| 클라이언트 | auth_status | raw_data | daily_aggregates | 주간 리포트 | 월간 리포트 |
|-----------|------------|----------|------------------|-----------|-----------|
| 비즈액터스쿨 | active | 2,651건 | 462건 | ✅ | ✅ |
| 내일채움 | active | 142건 | 59건 | ✅ | ✅ |
| JH경영지원센터 | active | 43건 | 21건 | ✅ | ❌ |
| 솔트 | auth_required | 179건 | 100건 | ✅ | ❌ |
| 성공K | auth_required | 255건 | 119건 | ✅ | ❌ |
| 부자성공파트너 | auth_required | 173건 | 86건 | ✅ | ❌ |
| JY경영지원센터 | auth_required | 81건 | 39건 | ✅ | ❌ |

### B. 파일 구조

```
bas_meta/
├── lib/
│   ├── data-integrity.js    # 정합성 검증 (확장 필요)
│   ├── worker.js            # 데이터 수집 Worker
│   ├── token-manager.js     # 토큰 관리
│   └── telegram-notifier.js # 알림 발송
├── send-weekly-report.js    # 주간 리포트 (ads_insights_daily 사용)
├── send-monthly-report.js   # 월간 리포트 (daily_aggregates 사용 → 변경 필요)
├── backfill-cli.js          # 백필 (syncAndVerify 추가 필요)
└── start-all.js             # 크론 스케줄러
```

### C. 데이터베이스 스키마

```sql
-- 원본 데이터
raw_data (client_id, date, ad_id, ...)

-- VIEW (raw_data 기반 자동 집계)
ads_insights_daily AS SELECT ... FROM raw_data GROUP BY ...

-- TABLE (수동 동기화 필요) → 제거 예정
daily_aggregates (client_id, date, ad_id, ...)
```

---

**문서 끝**
