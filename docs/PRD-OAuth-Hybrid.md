# PRD: Meta Ads OAuth 하이브리드 인증 시스템

## 문서 정보
- **작성일**: 2024-12-17
- **버전**: 1.0
- **상태**: Draft
- **프로젝트**: bas_meta

---

## 1. 개요

### 1.1 배경
현재 클라이언트들은 수동으로 토큰을 발급받아 DB에 저장하는 방식으로 운영 중입니다.
Meta 앱 검수를 위해 OAuth 기반 인증을 도입하되, **기존 클라이언트는 현행 유지**하고 **신규 클라이언트만 OAuth 적용**합니다.

### 1.2 목표
- 기존 클라이언트: 현재 방식 그대로 유지 (중단 없음)
- 신규 클라이언트: OAuth 로그인 + 관리자 승인 방식
- Meta 앱 검수 통과

### 1.3 핵심 원칙
> **기존 서비스 중단 없이 신규 기능 추가**

---

## 2. 현재 시스템 분석

### 2.1 기존 아키텍처
```
[관리자] → 수동 토큰 발급 → [DB 저장]
                              ├── encrypted_access_token (AES 암호화)
                              └── meta_access_token_id (Vault)
         ↓
[TokenManager] → 토큰 조회 → [API 호출]
```

### 2.2 기존 테이블 구조 (clients)
```sql
-- 현재 사용 중인 주요 필드
id                      UUID
client_name             VARCHAR
meta_ad_account_id      VARCHAR
meta_access_token_id    UUID        -- Vault 참조
encrypted_access_token  TEXT        -- AES 암호화 토큰
token_expires_at        TIMESTAMP
auth_status             VARCHAR     -- active, auth_required, token_expired
meta_refresh_token_id   UUID        -- Vault 참조
```

### 2.3 기존 TokenManager 기능
- `ensureValidToken()`: 토큰 유효성 확인 및 자동 갱신
- `getAccessToken()`: AES 복호화 또는 Vault 조회
- `refreshToken()`: OAuth 토큰 갱신
- `updateAuthStatus()`: 상태 변경 + 텔레그램 알림

---

## 3. 목표 아키텍처 (하이브리드)

### 3.1 인증 타입 구분
```
┌─────────────────────────────────────────────────────────┐
│                     clients 테이블                       │
├─────────────────────────────────────────────────────────┤
│  auth_type = 'manual'  │  auth_type = 'oauth'           │
│  (기존 클라이언트)      │  (신규 클라이언트)              │
├─────────────────────────────────────────────────────────┤
│  - 수동 토큰 등록       │  - OAuth 로그인                │
│  - 관리자가 직접 설정   │  - 자동 토큰 발급              │
│  - 기존 로직 유지       │  - 관리자 승인 필요            │
└─────────────────────────────────────────────────────────┘
```

### 3.2 신규 클라이언트 플로우
```
[클라이언트] → /login → Meta OAuth
        ↓
[Callback] → 토큰 저장 → status: 'pending', auth_type: 'oauth'
        ↓
[관리자 알림] → 텔레그램 알림
        ↓
[관리자 승인] → status: 'active'
        ↓
[데이터 수집 시작]
```

### 3.3 기존 클라이언트 (변경 없음)
```
[기존 로직 그대로 유지]
auth_type: 'manual' (기본값)
TokenManager.getAccessToken() → AES 복호화 또는 Vault
```

---

## 4. 데이터베이스 변경

### 4.1 clients 테이블 수정
```sql
-- 신규 필드 추가 (기존 필드 유지)
ALTER TABLE clients ADD COLUMN IF NOT EXISTS
  -- 인증 타입 구분 ⭐ 핵심
  auth_type VARCHAR(20) DEFAULT 'manual',  -- 'manual' | 'oauth'

  -- OAuth 클라이언트용 상태 관리
  status VARCHAR(20) DEFAULT 'active',      -- pending, active, suspended, expired
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

-- 기존 클라이언트 기본값 설정
UPDATE clients
SET auth_type = 'manual', status = 'active'
WHERE auth_type IS NULL;

-- 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_clients_auth_type ON clients(auth_type);
CREATE INDEX IF NOT EXISTS idx_clients_status ON clients(status);
```

### 4.2 기존 필드 영향 없음
```
✅ encrypted_access_token  - 그대로 사용
✅ meta_access_token_id    - 그대로 사용
✅ meta_refresh_token_id   - 그대로 사용
✅ token_expires_at        - 그대로 사용
✅ auth_status             - 그대로 사용 (토큰 상태)
```

### 4.3 status vs auth_status 구분
```
auth_status (기존): 토큰 상태
  - active: 토큰 유효
  - auth_required: 재인증 필요
  - token_expired: 토큰 만료

status (신규): 서비스 상태 (OAuth 클라이언트용)
  - pending: 승인 대기
  - active: 서비스 활성
  - suspended: 일시 중지
  - expired: 계약 만료
```

---

## 5. 기능 요구사항

### 5.1 OAuth 로그인 (신규 클라이언트용)

#### `/api/auth/login`
```javascript
// OAuth 시작점 - Meta 로그인 페이지로 리다이렉트
const authUrl = `https://www.facebook.com/v22.0/dialog/oauth
  ?client_id=${META_APP_ID}
  &redirect_uri=${CALLBACK_URL}
  &scope=ads_read
  &state=${csrfToken}`;
```

#### `/api/auth/callback`
```javascript
// 콜백 처리
1. Authorization Code 수신
2. Access Token 교환
3. Long-lived Token 변환
4. 광고 계정 ID 조회
5. DB 저장:
   - auth_type: 'oauth'
   - status: 'pending'
   - encrypted_access_token: 암호화된 토큰
6. 관리자 텔레그램 알림
7. /pending 페이지로 리다이렉트
```

### 5.2 관리자 승인 시스템

#### 클라이언트 상태 관리
```
GET  /api/admin/clients              - 목록 (auth_type, status 필터)
POST /api/admin/clients/approve      - 승인 (pending → active)
POST /api/admin/clients/suspend      - 중지 (active → suspended)
POST /api/admin/clients/activate     - 재활성화 (suspended → active)
```

#### 승인 시 처리
```javascript
// 승인 처리
await supabase
  .from('clients')
  .update({
    status: 'active',
    approved_at: new Date().toISOString(),
    approved_by: adminId,
    contract_start_date: startDate,
    contract_end_date: endDate
  })
  .eq('id', clientId);
```

### 5.3 TokenManager 수정

#### getAccessToken() 수정
```javascript
async getAccessToken(clientId) {
  const { data: client } = await this.supabase
    .from('clients')
    .select('auth_type, status, encrypted_access_token, meta_access_token_id')
    .eq('id', clientId)
    .single();

  // OAuth 클라이언트: status 체크 ⭐
  if (client.auth_type === 'oauth' && client.status !== 'active') {
    console.log(`⚠️ OAuth client ${clientId} is not active (status: ${client.status})`);
    return null;  // 데이터 수집 스킵
  }

  // 기존 로직 그대로 (AES 복호화 또는 Vault)
  if (client.encrypted_access_token) {
    return decrypt(client.encrypted_access_token);
  }
  // ... Vault fallback
}
```

#### 데이터 수집 시 필터링
```javascript
// backfill.js 등에서
const { data: clients } = await supabase
  .from('clients')
  .select('*')
  .or('auth_type.eq.manual,and(auth_type.eq.oauth,status.eq.active)')
  .eq('is_active', true);
```

### 5.4 UI 페이지

#### `/login` (신규)
- Meta 로그인 버튼
- 서비스 소개
- 이용약관 동의

#### `/pending` (신규)
- "승인 대기 중" 안내
- 예상 처리 시간
- 문의처 안내

#### `/admin/clients` (기존 확장)
- auth_type 필터 (전체/수동/OAuth)
- status 필터 (전체/대기/활성/중지)
- 승인/중지 버튼

---

## 6. 파일 구조

### 6.1 신규 파일
```
bas_meta/
├── dashboard/src/app/
│   ├── login/
│   │   └── page.tsx              # OAuth 로그인 페이지
│   ├── pending/
│   │   └── page.tsx              # 승인 대기 안내
│   └── api/
│       ├── auth/
│       │   ├── login/route.ts    # OAuth 시작
│       │   ├── callback/route.ts # 콜백 처리
│       │   └── status/route.ts   # 상태 확인
│       └── admin/
│           └── clients/
│               ├── route.ts      # 목록 (필터 추가)
│               ├── approve/route.ts
│               ├── suspend/route.ts
│               └── activate/route.ts
└── lib/
    └── oauth-handler.js          # OAuth 유틸리티 (신규)
```

### 6.2 수정 파일
```
lib/token-manager.js   # getAccessToken()에 status 체크 추가
lib/backfill.js        # 클라이언트 필터링 조건 추가
dashboard/.env.local   # OAuth 환경변수 추가
```

---

## 7. 환경변수

### 7.1 기존 유지
```env
META_APP_ID=xxx
META_APP_SECRET=xxx
TOKEN_ENCRYPTION_KEY=xxx
SUPABASE_URL=xxx
SUPABASE_SERVICE_KEY=xxx
```

### 7.2 신규 추가
```env
# OAuth Callback URL
NEXT_PUBLIC_META_REDIRECT_URI=https://bas-meta-ads.vercel.app/api/auth/callback

# 또는 커스텀 도메인 사용 시
# NEXT_PUBLIC_META_REDIRECT_URI=https://your-domain.com/api/auth/callback
```

---

## 8. Meta 앱 설정

### 8.1 리디렉션 URI 등록
```
https://bas-meta-ads.vercel.app/api/auth/callback
```

### 8.2 요청 권한
```
ads_read
```

### 8.3 앱 검수 제출 내용
```
"이 앱은 광고주가 자신의 Meta 광고 계정 성과를
분석하고 리포트를 받을 수 있는 B2B 서비스입니다.

기능:
1. 광고 성과 대시보드 (노출, 클릭, 리드, CPL)
2. 주간/월간 리포트 자동 발송

사용 권한: ads_read
- 광고 인사이트 데이터 조회에만 사용
- 개인정보 수집하지 않음
- 광고 수정/삭제 기능 없음 (읽기 전용)
"
```

---

## 9. 구현 순서

### Phase 1: DB 마이그레이션 (0.5일)
```
1. auth_type, status 등 신규 필드 추가
2. 기존 클라이언트에 기본값 설정 (auth_type='manual', status='active')
3. 인덱스 생성
```

### Phase 2: OAuth API (1일)
```
1. /api/auth/login - OAuth 시작
2. /api/auth/callback - 콜백 처리
3. oauth-handler.js 유틸리티
4. 토큰 암호화 저장
```

### Phase 3: 관리자 API (0.5일)
```
1. /api/admin/clients 필터 기능 추가
2. /api/admin/clients/approve
3. /api/admin/clients/suspend
4. /api/admin/clients/activate
```

### Phase 4: TokenManager 수정 (0.5일)
```
1. getAccessToken()에 OAuth 클라이언트 status 체크 추가
2. backfill.js 필터링 조건 수정
3. 기존 클라이언트 영향 없음 확인 테스트
```

### Phase 5: UI 페이지 (1일)
```
1. /login 페이지
2. /pending 페이지
3. /admin/clients 확장
```

### Phase 6: 테스트 및 검수 (1일)
```
1. 기존 클라이언트 정상 동작 확인 ⭐
2. 신규 OAuth 플로우 테스트
3. 스크린캐스트 녹화
4. Meta 앱 설정 완료
```

---

## 10. 테스트 체크리스트

### 10.1 기존 클라이언트 (영향 없음 확인) ⭐
```
[ ] 기존 클라이언트 데이터 수집 정상
[ ] 기존 클라이언트 토큰 갱신 정상
[ ] 기존 클라이언트 대시보드 접근 정상
[ ] 기존 클라이언트 리포트 발송 정상
```

### 10.2 신규 OAuth 클라이언트
```
[ ] OAuth 로그인 → pending 상태 저장
[ ] 관리자 텔레그램 알림 수신
[ ] pending 상태 → 대시보드 접근 차단
[ ] 관리자 승인 → active 상태 변경
[ ] active 상태 → 데이터 수집 시작
[ ] suspended 상태 → 데이터 수집 중단
```

---

## 11. 리스크 관리

| 리스크 | 영향 | 대응 |
|--------|------|------|
| 기존 클라이언트 영향 | 심각 | auth_type='manual' 기본값으로 격리 |
| 마이그레이션 실패 | 높음 | 롤백 스크립트 준비 |
| OAuth 토큰 발급 실패 | 중간 | 에러 핸들링 및 재시도 안내 |

---

## 12. 롤백 계획

문제 발생 시 신규 기능만 비활성화:
```sql
-- OAuth 클라이언트 비활성화 (기존 영향 없음)
UPDATE clients
SET is_active = false
WHERE auth_type = 'oauth';
```

---

## 부록: 기존 vs 신규 비교

| 항목 | 기존 (manual) | 신규 (oauth) |
|------|--------------|--------------|
| 토큰 발급 | 관리자 수동 | 클라이언트 직접 |
| 승인 과정 | 없음 | 관리자 승인 필요 |
| 상태 관리 | auth_status만 | auth_status + status |
| 토큰 저장 | AES/Vault | AES (동일) |
| 토큰 갱신 | TokenManager | TokenManager (동일) |
| 데이터 수집 | 바로 시작 | 승인 후 시작 |
