# PRD: Phase 1 - 월간 리포트 데이터 소스 통일

**문서 번호**: PRD-2025-001
**버전**: 1.0
**작성일**: 2025-12-01
**상태**: Ready for Development
**우선순위**: P0 (Critical)

---

## 1. 개요 (Overview)

### 1.1 문제 정의
월간 리포트가 `daily_aggregates` 테이블을 데이터 소스로 사용하고 있으나, 이 테이블의 자동 동기화가 작동하지 않아 **7개 클라이언트 중 4개(57%)의 월간 리포트가 생성되지 않는** 치명적 문제가 발생.

### 1.2 해결 방안
`daily_aggregates` (TABLE) → `ads_insights_daily` (VIEW)로 데이터 소스 변경

### 1.3 기대 효과
| 지표 | 현재 | 목표 |
|-----|-----|-----|
| 월간 리포트 생성률 | 43% (3/7) | **100%** |
| 동기화 문제 | 수동 개입 필요 | **자동** |
| 데이터 지연 | 수 시간~수 일 | **실시간** |

---

## 2. 범위 (Scope)

### 2.1 In Scope
- [x] `send-monthly-report.js` 데이터 소스 변경
- [x] JH경영지원센터 테스트 검증
- [x] 11월 월간 리포트 생성 (누락 4개 클라이언트)

### 2.2 Out of Scope
- [ ] `daily_aggregates` 테이블 삭제 (Phase 2)
- [ ] 데이터 정합성 검증 시스템 (Phase 2)
- [ ] 백필 스크립트 수정 (Phase 2)

---

## 3. 사전 검증 (Pre-flight Checklist)

### 3.1 스키마 호환성 검증

#### CHECK 1: 컬럼명 일치 여부

**검증 방법**: Supabase 대시보드에서 두 소스 비교

| 컬럼 | daily_aggregates | ads_insights_daily | 호환 |
|-----|-----------------|-------------------|-----|
| client_id | ✅ | ✅ | ✓ |
| date | ✅ | ✅ | ✓ |
| impressions | ✅ | ✅ | ✓ |
| clicks | ✅ | ✅ | ✓ |
| leads | ✅ | ✅ | ✓ |
| spend | ✅ | ✅ | ✓ |
| reach | ✅ | ✅ | ✓ |
| campaign_name | ✅ | ✅ | ✓ |
| ad_name | ✅ | ✅ | ✓ |

**상태**: [ ] 검증 완료

#### CHECK 2: 인덱스 확인

**필수 인덱스**:
```sql
-- raw_data 테이블 (VIEW의 소스)
CREATE INDEX IF NOT EXISTS idx_raw_data_client_date ON raw_data(client_id, date DESC);
```

**확인 쿼리**:
```sql
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'raw_data';
```

**상태**: [ ] 검증 완료

#### CHECK 3: 테스트 대상 선정

| 클라이언트 | auth_status | 월간 리포트 | 테스트 우선순위 |
|-----------|------------|-----------|---------------|
| JH경영지원센터 | active | ❌ 없음 | **1순위** (토큰 정상, 순수 로직 문제) |
| 솔트 | auth_required | ❌ 없음 | 2순위 |
| 성공K | auth_required | ❌ 없음 | 2순위 |
| 부자성공파트너 | auth_required | ❌ 없음 | 2순위 |

**상태**: [ ] 확인 완료

---

## 4. 기술 명세 (Technical Specification)

### 4.1 변경 파일

| 파일 | 변경 유형 | 위험도 |
|-----|---------|-------|
| `send-monthly-report.js` | 수정 | 낮음 |

### 4.2 코드 변경 상세

#### 파일: `send-monthly-report.js`
#### 함수: `fetchMonthlyData`
#### 위치: Line 120-141

**Before**:
```javascript
async function fetchMonthlyData(startDate, endDate, clientId) {
  let query = supabase
    .from('daily_aggregates')  // ❌ 동기화 안 되는 테이블
    .select('*')
    .gte('date', startDate)
    .lte('date', endDate);

  if (clientId) {
    query = query.eq('client_id', clientId);
  }

  const { data, error } = await query.order('date', { ascending: true });

  if (error) {
    console.error('❌ Error:', error.message);
    return null;
  }

  return data;
}
```

**After**:
```javascript
async function fetchMonthlyData(startDate, endDate, clientId) {
  let query = supabase
    .from('ads_insights_daily')  // ✅ 자동 동기화 VIEW
    .select('*')
    .gte('date', startDate)
    .lte('date', endDate);

  if (clientId) {
    query = query.eq('client_id', clientId);
  }

  const { data, error } = await query.order('date', { ascending: true });

  if (error) {
    console.error('❌ Error:', error.message);
    return null;
  }

  // 데이터 없는 경우 로깅
  if (!data || data.length === 0) {
    console.warn(`⚠️ No data found for client ${clientId} (${startDate} ~ ${endDate})`);
  }

  return data;
}
```

### 4.3 변경 사항 요약

| 항목 | Before | After |
|-----|--------|-------|
| 데이터 소스 | `daily_aggregates` (TABLE) | `ads_insights_daily` (VIEW) |
| 동기화 | 수동 (Worker 의존) | 자동 (raw_data 참조) |
| 코드 변경량 | - | 1줄 (테이블명) + 4줄 (로깅) |

---

## 5. 테스트 계획 (Test Plan)

### 5.1 단위 테스트

#### Test Case 1: JH경영지원센터 월간 리포트 생성

**실행 명령**:
```bash
REPORT_MONTH=2025-11 DRY_RUN=true node send-monthly-report.js --client="JH 경영지원센터"
```

**예상 결과**:
- [ ] 데이터 조회: 21건 이상
- [ ] 리드 합계: 15건 (주간 리포트 기준)
- [ ] 지출 합계: ~$136.49

**검증 방법**:
```bash
# 로그 확인
✅ JH 경영지원센터 데이터: 리드 XX건, 지출 $XX.XX
```

### 5.2 데이터 검증

#### 주간 리포트 vs 월간 리포트 비교

| 클라이언트 | 주간 합계 (11월) | 월간 리포트 | 일치 |
|-----------|-----------------|-----------|-----|
| JH경영지원센터 | 리드 15건, $136.49 | ? | [ ] |

### 5.3 통합 테스트

**실행 명령** (DRY_RUN):
```bash
REPORT_MONTH=2025-11 DRY_RUN=true node send-monthly-report.js
```

**예상 결과**:
- [ ] 7개 클라이언트 모두 데이터 조회 성공
- [ ] 에러 없음

---

## 6. 배포 계획 (Deployment Plan)

### 6.1 배포 단계

| 단계 | 작업 | 담당 | 시간 |
|-----|-----|-----|-----|
| 1 | 코드 수정 | 개발 | 5분 |
| 2 | DRY_RUN 테스트 (JH경영지원센터) | 개발 | 5분 |
| 3 | DRY_RUN 테스트 (전체) | 개발 | 10분 |
| 4 | 실제 발송 (JH경영지원센터) | 개발 | 5분 |
| 5 | 실제 발송 (전체) | 개발 | 15분 |
| 6 | Git 커밋 & 푸시 | 개발 | 5분 |

**총 예상 시간**: 45분

### 6.2 실행 명령어

```bash
# Step 1: 코드 수정 후 테스트
REPORT_MONTH=2025-11 DRY_RUN=true node send-monthly-report.js --client="JH 경영지원센터"

# Step 2: 전체 DRY_RUN
REPORT_MONTH=2025-11 DRY_RUN=true node send-monthly-report.js

# Step 3: 실제 발송 (JH경영지원센터)
REPORT_MONTH=2025-11 node send-monthly-report.js --client="JH 경영지원센터" --force

# Step 4: 실제 발송 (나머지 누락 클라이언트)
REPORT_MONTH=2025-11 node send-monthly-report.js --force
```

---

## 7. 롤백 계획 (Rollback Plan)

### 7.1 롤백 조건
- VIEW 쿼리 성능 문제 발생
- 데이터 불일치 발견
- 예상치 못한 에러

### 7.2 롤백 절차

```javascript
// 1. 코드 롤백 (1분)
// send-monthly-report.js에서 테이블명 원복
.from('daily_aggregates')  // 원래대로

// 2. daily_aggregates 동기화 (5분)
node sync-all-daily-aggregates.js

// 3. 리포트 재생성
REPORT_MONTH=2025-11 node send-monthly-report.js --force
```

### 7.3 롤백 판단 기준

| 상황 | 판단 | 조치 |
|-----|-----|-----|
| VIEW 쿼리 30초 이상 | 롤백 | 인덱스 추가 후 재시도 |
| 데이터 값 불일치 10% 이상 | 롤백 | 원인 분석 |
| 특정 클라이언트만 실패 | 부분 롤백 | 해당 클라이언트만 이전 방식 |

---

## 8. 후속 작업 (Follow-up Tasks)

### Phase 2 작업 목록

| 작업 | 우선순위 | 예상 시간 |
|-----|---------|---------|
| `daily_aggregates` 테이블 deprecation | P1 | 1시간 |
| 백필 스크립트 정리 | P1 | 2시간 |
| 데이터 정합성 검증 시스템 | P1 | 5시간 |
| 문서 업데이트 | P2 | 1시간 |

### daily_aggregates 테이블 처리 계획

```sql
-- Phase 2에서 실행
-- 1. 테이블명 변경 (soft deprecation)
ALTER TABLE daily_aggregates RENAME TO _daily_aggregates_deprecated;

-- 2. 3개월 후 삭제
DROP TABLE _daily_aggregates_deprecated;
```

---

## 9. 승인 (Approval)

| 역할 | 이름 | 승인 | 날짜 |
|-----|-----|-----|-----|
| 기술 검토 | - | [ ] | - |
| 작업 승인 | - | [ ] | - |

---

## 10. 변경 이력 (Change Log)

| 버전 | 날짜 | 변경 내용 | 작성자 |
|-----|-----|---------|-------|
| 1.0 | 2025-12-01 | 초안 작성 | System |

---

**문서 끝**
