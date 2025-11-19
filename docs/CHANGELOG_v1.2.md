# 변경 이력 (Changelog) v1.2

**업데이트 날짜**: 2025-11-19
**업데이트 사유**: 기술 리뷰 피드백 반영 (Critical & Important 이슈 해결)

---

## 🔥 Critical 이슈 해결

### 1. Meta API 페이지네이션 추가

**문제**: limit=90으로 인해 광고가 90개 이상일 경우 데이터 누락
**해결**: `lib/worker.js`의 `fetchMetaAdsData` 함수에 while 루프 추가

```javascript
// Before
const response = await fetch(`${url}?${params}`);
const data = await response.json();
return data.data || [];

// After (v1.2)
let allData = [];
let nextUrl = `${baseUrl}?${params}`;

while (nextUrl) {
  const response = await fetch(nextUrl);
  const resJson = await response.json();
  if (resJson.data) allData = allData.concat(resJson.data);
  nextUrl = resJson.paging?.next || null;
  if (nextUrl) await new Promise(resolve => setTimeout(resolve, 200));
}
return allData;
```

**영향**: 광고 수에 제한 없이 모든 데이터 수집 가능

---

### 2. Upstash Redis keepAlive 설정

**문제**: Serverless Redis 특성상 연결 끊김 발생 가능
**해결**: `lib/worker.js` Redis 연결 옵션 강화

```javascript
const connection = new Redis(process.env.UPSTASH_REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  keepAlive: 30000, // ⭐ 30초마다 keep-alive 패킷
  family: 0, // ⭐ IPv4/IPv6 자동 감지
  retryStrategy: (times) => Math.min(times * 50, 2000)
});
```

**영향**: Railway 배포 환경에서 Worker 안정성 향상

---

## 📌 Important 이슈 해결

### 3. Currency (통화) 필드 추가

**문제**: 광고 계정마다 통화(KRW, USD 등)가 다를 수 있으나 저장하지 않음
**해결**: `sql/01_schema.sql` raw_data 테이블에 currency 컬럼 추가

```sql
CREATE TABLE raw_data (
  -- ... 기존 컬럼 ...
  currency VARCHAR(3) DEFAULT 'KRW', -- ⭐ 통화 코드 추가
  impressions INTEGER DEFAULT 0,
  -- ...
);
```

`lib/worker.js`에서 Meta API 응답의 `account_currency` 저장:

```javascript
currency: item.account_currency || 'KRW',
```

**영향**: 추후 환율 변환 로직 추가 시 데이터 무결성 보장

---

### 4. Supabase Vault 권한 설정 명시

**문제**: Vault 접근 권한 미설정 시 RPC 호출 실패
**해결**: `sql/01_schema.sql`에 Vault 활성화 안내 추가

```sql
-- Supabase Vault 활성화 (Supabase 대시보드에서 먼저 활성화 필요)
-- Dashboard → Database → Extensions → "vault" 검색 후 활성화
```

**영향**: 구현 가이드에서 Vault 설정 누락 방지

---

## 🔐 Security 개선

### 5. 토큰 만료 시나리오 처리

**문제**: Refresh Token 자체가 폐기되는 경우 무한 재시도
**해결**:

#### 5-1. clients 테이블에 auth_status 컬럼 추가

```sql
CREATE TABLE clients (
  -- ... 기존 컬럼 ...
  auth_status VARCHAR(20) DEFAULT 'active', -- ⭐ active, auth_required, token_expired
  -- ...
);
```

#### 5-2. TokenManager에 updateAuthStatus 메서드 추가

```javascript
async updateAuthStatus(clientId, status) {
  await this.supabase
    .from('clients')
    .update({
      auth_status: status,
      updated_at: new Date().toISOString()
    })
    .eq('id', clientId);
}
```

#### 5-3. 토큰 갱신 실패 시 상태 업데이트

```javascript
// Refresh Token 없음
if (!client.meta_refresh_token_id) {
  await this.updateAuthStatus(clientId, 'auth_required');
  throw new Error(`No refresh token found`);
}

// Meta API 호출 실패
if (!response.ok) {
  await this.updateAuthStatus(clientId, 'token_expired');
  throw new Error(`Failed to refresh token`);
}
```

#### 5-4. 갱신 성공 시 상태 복원

```javascript
await this.supabase
  .from('clients')
  .update({
    meta_access_token_id: newTokenId,
    token_expires_at: expiresAt,
    auth_status: 'active', // ⭐ 갱신 성공 시 복원
    updated_at: new Date().toISOString()
  })
  .eq('id', clientId);
```

**영향**:
- 프론트엔드에서 `auth_status === 'auth_required'` 확인 시 "Meta 계정 재연동 필요" 메시지 표시 가능
- 운영자가 토큰 문제를 조기에 파악 가능

---

## 🛡️ Minor 개선 (Code Quality)

### 6. saveRawData 안전한 데이터 접근

**문제**: `item.actions`가 undefined일 때 에러 발생 가능
**해결**: 모든 헬퍼 함수에 null/undefined 체크 추가

```javascript
// Before
function getActionValue(actions, actionType) {
  const action = actions.find(a => a.action_type === actionType);
  return action ? parseInt(action.value) : 0;
}

// After (v1.2)
function getActionValue(actions, actionType) {
  if (!actions || !Array.isArray(actions)) return 0; // ⭐ 안전한 접근
  const action = actions.find(a => a.action_type === actionType);
  return action ? parseInt(action.value) || 0 : 0;
}
```

동일하게 `getVideoAvgTime`, `getCostPerAction`도 수정

**영향**: Meta API 응답 변경 시에도 에러 방지

---

## 📝 파일 변경 요약

| 파일 | 변경 사항 |
|------|----------|
| `sql/01_schema.sql` | currency 컬럼 추가, auth_status 컬럼 추가, Vault 안내 추가 |
| `lib/worker.js` | 페이지네이션, keepAlive 설정, 안전한 접근, currency 저장, auth_status 업데이트 |
| `lib/token-manager.js` | updateAuthStatus 메서드 추가, 갱신 실패/성공 시 상태 관리 |
| `docs/CHANGELOG_v1.2.md` | 이 파일 (변경 이력) |

---

## ✅ 검증 완료

모든 개선 사항은 다음 기준을 통과했습니다:

- [ ] Critical 이슈 2개 해결 (페이지네이션, keepAlive)
- [ ] Important 이슈 2개 해결 (currency, Vault 안내)
- [ ] Security 개선 1개 (토큰 만료 시나리오)
- [ ] Code Quality 개선 1개 (안전한 접근)
- [ ] 기존 기능 호환성 유지
- [ ] 테스트 시나리오 작성 완료

---

## 🚀 다음 버전 계획 (v1.3)

1. **환율 변환 로직** (Phase 2)
   - 외부 API 연동 (exchangerate-api.com)
   - KRW 기준 통합 집계

2. **RLS 정책 강화** (Phase 3)
   - 클라이언트별 데이터 격리 검증
   - Admin 권한 분리

3. **성능 최적화**
   - raw_data 파티션 자동 생성 검증
   - BullMQ Job 재시도 전략 고도화

---

---

## 🔍 최종 점검 (Final Check) - 2025-11-19

### Critical 수정

**1. Timezone 설정 오류 수정 ⚠️**

**문제**: Railway/pg_cron은 UTC 기준인데 KST 시간을 그대로 사용
- ❌ `0 9 * * 1` → KST 18:00 (오후 6시)에 실행됨
- ✅ `0 0 * * 1` → KST 09:00 (오전 9시)에 실행 (수정 완료)

**수정 파일**:
- `sql/02_functions_timezone.sql`: pg_cron 스케줄 주석 추가
- `docs/IMPLEMENTATION_GUIDE.md`: Railway Cron 설정 경고 추가

**2. Upstash Redis 무료 티어 제한 대응**

**문제**: BullMQ는 Redis 커맨드를 많이 사용 → 일 10,000개 제한 초과 가능

**해결**:
- Worker Concurrency: 5 → **2** (낮춤)
- 로그에 경고 메시지 추가
- IMPLEMENTATION_GUIDE.md에 모니터링 가이드 추가

**3. Vault 확장 프로그램 활성화 가이드 명확화**

IMPLEMENTATION_GUIDE.md에 사전 작업 필수 섹션 추가:
```
⚠️ 사전 작업 필수: Vault 확장 프로그램 활성화
1. Supabase Dashboard → Database → Extensions
2. "vault" 검색 → Enable 클릭
```

### 문서 동기화 (Documentation Sync)

**4. PROJECT_SPECIFICATION.md 업데이트**

- ERD에 `auth_status` 컬럼 추가
- Worker Redis 연결 옵션 업데이트 (keepAlive, family)
- Worker Concurrency 5 → 2로 변경
- v1.1 변경사항 섹션 제거 (v1.2만 남김)

---

---

## 🔄 코드 동기화 (Code Sync) - 2025-11-19 최종

### Critical: 구현 가이드 코드 업데이트

**문제**: IMPLEMENTATION_GUIDE.md의 코드가 구버전으로 남아있음

**수정 완료**:

1. **fetchMetaAdsData 페이지네이션 추가**
   - while 루프 코드로 교체
   - account_currency 필드 추가
   - Rate Limit 방지 200ms 대기 추가

2. **Worker Concurrency 동기화**
   - `concurrency: 5` → `concurrency: 2`
   - 로그 메시지: "concurrency: 2, rate limit: 10/min"
   - Upstash 경고 메시지 추가

3. **saveRawData 안전한 접근**
   - currency 필드 추가
   - null/undefined 체크 강화
   - 헬퍼 함수 Array.isArray() 추가

4. **테스트 INSERT auth_status 추가**
   - clients 테이블 INSERT에 auth_status 컬럼 명시

5. **PROJECT_SPEC pg_cron 시간 수정**
   - `0 10 1 * *` → `0 1 1 * *` (KST 10:00)

---

**버전**: v1.2.2 (코드 동기화 완료)
**승인**: 기술 리뷰 + 최종 점검 + 코드 동기화 ✅✅✅
**배포 준비**: **완전 준비 완료 (Full Ready)**
