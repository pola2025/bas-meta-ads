# Meta Ads OAuth 하이브리드 시스템 구현 요청

## 프로젝트 경로
`F:\bas_meta`

## PRD 문서
`F:\bas_meta\docs\PRD-OAuth-Hybrid.md` 참고

---

## 요청 내용

### 목표
**기존 클라이언트는 그대로 유지**하고, **신규 클라이언트만 OAuth 기반**으로 등록되도록 하이브리드 시스템을 구축해주세요.

### 핵심 원칙
> 기존 서비스 중단 없이 신규 기능 추가

### 구분 방식
```
auth_type = 'manual'  →  기존 클라이언트 (현행 유지)
auth_type = 'oauth'   →  신규 클라이언트 (OAuth + 관리자 승인)
```

---

## 구현 요구사항

### 1. DB 마이그레이션

```sql
ALTER TABLE clients ADD COLUMN IF NOT EXISTS
  -- 인증 타입 구분 (핵심)
  auth_type VARCHAR(20) DEFAULT 'manual',  -- 'manual' | 'oauth'

  -- OAuth 클라이언트 상태 관리
  status VARCHAR(20) DEFAULT 'active',
  approved_at TIMESTAMP WITH TIME ZONE,
  approved_by VARCHAR(100),
  contract_start_date DATE,
  contract_end_date DATE,
  suspended_at TIMESTAMP WITH TIME ZONE,
  suspension_reason TEXT,

  -- OAuth 사용자 정보
  meta_user_id VARCHAR(50),
  meta_user_name VARCHAR(100),
  oauth_registered_at TIMESTAMP WITH TIME ZONE;

-- 기존 클라이언트 기본값 설정 (중요!)
UPDATE clients
SET auth_type = 'manual', status = 'active'
WHERE auth_type IS NULL;
```

### 2. OAuth API (신규 클라이언트용)

```
/api/auth/login     - Meta OAuth 시작 (리다이렉트)
/api/auth/callback  - 콜백 처리:
                      1. 토큰 교환
                      2. Long-lived Token 변환
                      3. 광고 계정 ID 조회
                      4. DB 저장 (auth_type='oauth', status='pending')
                      5. 관리자 텔레그램 알림
                      6. /pending으로 리다이렉트
```

### 3. 관리자 API

```
GET  /api/admin/clients           - 목록 (auth_type, status 필터 추가)
POST /api/admin/clients/approve   - 승인 (pending → active)
POST /api/admin/clients/suspend   - 중지 (active → suspended)
POST /api/admin/clients/activate  - 재활성화 (suspended → active)
```

### 4. TokenManager 수정

`lib/token-manager.js`의 `getAccessToken()` 수정:

```javascript
// OAuth 클라이언트는 status 체크 추가
if (client.auth_type === 'oauth' && client.status !== 'active') {
  console.log(`⚠️ OAuth client ${clientId} is not active`);
  return null;  // 데이터 수집 스킵
}

// 기존 로직은 그대로 유지
```

### 5. 데이터 수집 필터링

`lib/backfill.js` 등에서 클라이언트 조회 시:

```javascript
const { data: clients } = await supabase
  .from('clients')
  .select('*')
  .or('auth_type.eq.manual,and(auth_type.eq.oauth,status.eq.active)')
  .eq('is_active', true);
```

### 6. UI 페이지

```
/login    - Meta 로그인 버튼 (신규 클라이언트용)
/pending  - 승인 대기 안내 페이지
/admin/clients - 기존 페이지에 필터 추가 (auth_type, status)
```

---

## 상태 구분

### auth_status (기존 - 토큰 상태)
```
active        - 토큰 유효
auth_required - 재인증 필요
token_expired - 토큰 만료
```

### status (신규 - 서비스 상태, OAuth 클라이언트용)
```
pending   - 승인 대기 (서비스 비활성)
active    - 서비스 활성
suspended - 일시 중지 (미납 등)
expired   - 계약 만료
```

---

## 환경변수

```env
# 기존 유지
META_APP_ID=xxx
META_APP_SECRET=xxx
TOKEN_ENCRYPTION_KEY=xxx

# 신규 추가
NEXT_PUBLIC_META_REDIRECT_URI=https://bas-meta-ads.vercel.app/api/auth/callback
```

---

## 테스트 체크리스트

### 기존 클라이언트 (영향 없음 확인 필수!)
```
[ ] 기존 클라이언트 데이터 수집 정상
[ ] 기존 클라이언트 토큰 갱신 정상
[ ] 기존 클라이언트 리포트 발송 정상
```

### 신규 OAuth 클라이언트
```
[ ] OAuth 로그인 → pending 저장
[ ] 관리자 알림 수신
[ ] pending → 대시보드 차단
[ ] 승인 → active 변경
[ ] active → 데이터 수집 시작
```

---

## 구현 순서 권장

1. **DB 마이그레이션** - auth_type, status 필드 추가, 기존 클라이언트 기본값 설정
2. **TokenManager 수정** - OAuth 클라이언트 status 체크 추가
3. **OAuth API** - login, callback 엔드포인트
4. **관리자 API** - approve, suspend, activate
5. **UI 페이지** - login, pending, admin 확장
6. **테스트** - 기존 클라이언트 영향 없음 반드시 확인

---

## 주의사항

1. **기존 클라이언트 보호**: `auth_type='manual'` 기본값으로 기존 로직과 격리
2. **롤백 가능**: 문제 시 OAuth 클라이언트만 비활성화 가능
3. **권한**: `ads_read`만 요청 (instagram 불필요)
4. **토큰 저장**: 기존과 동일하게 `encrypted_access_token`에 AES 암호화 저장
