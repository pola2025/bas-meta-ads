# BAS Meta Ads Project Guide Skill

**목적**: BAS Meta Ads 프로젝트 작업 시 가이드 문서를 항상 준수하도록 강제

---

## 📋 필수 참조 문서

### 1. PROJECT_SPECIFICATION.md
- **위치**: `docs/PROJECT_SPECIFICATION.md`
- **버전**: v1.2.2
- **내용**: 전체 프로젝트 설계, 아키텍처, DB 스키마, API 설계

### 2. IMPLEMENTATION_GUIDE.md
- **위치**: `docs/IMPLEMENTATION_GUIDE.md`
- **내용**: 단계별 구현 가이드, 코드 예시

### 3. PROGRESS_SUMMARY.md
- **위치**: `docs/PROGRESS_SUMMARY.md`
- **내용**: 현재 진행 상황, 완료된 작업

---

## 🚨 필수 준수 사항

### 데이터베이스

#### 테이블 스키마 (변경 금지)
```sql
-- clients 테이블
- meta_access_token_id: UUID (vault.secrets 참조)
- meta_refresh_token_id: UUID (vault.secrets 참조)
- token_expires_at: TIMESTAMPTZ
- auth_status: VARCHAR (active/auth_required/token_expired)

-- raw_data 테이블
- currency: VARCHAR(3) ⭐ v1.2 추가 (필수)
- 월별 파티셔닝 적용

-- weekly_summary 테이블
- currency: VARCHAR(3) ⭐ v1.2 추가 (필수)
```

#### SQL Functions
```sql
-- 변수 네이밍 규칙
DECLARE
  v_week_year INTEGER;      -- v_ 접두사 필수
  v_week_number INTEGER;
  p_client_id UUID;         -- p_ 접두사 (파라미터)
```

### Meta API

#### 페이지네이션 (필수)
```javascript
// ⭐ v1.2 Critical: 90개 이상 광고 데이터 누락 방지
async function fetchAllAds(accountId, accessToken) {
  let allAds = [];
  let url = `https://graph.facebook.com/v22.0/${accountId}/ads`;

  while (url) {
    const response = await fetch(url);
    const data = await response.json();

    allAds = allAds.concat(data.data);
    url = data.paging?.next;  // 다음 페이지
  }

  return allAds;
}
```

#### 토큰 관리
```javascript
// Vault에서 토큰 가져올 때 공백 제거 (필수)
async getAccessToken(tokenId) {
  const { data } = await supabase.rpc('vault_read_secret', {
    secret_id: tokenId
  });

  return data.secret.replace(/\s/g, '');  // ⭐ 공백 제거
}
```

### Job Queue (BullMQ)

#### Upstash Redis 설정
```javascript
// ⭐ v1.2: keepAlive 필수 (Serverless 환경)
const connection = new Redis(process.env.UPSTASH_REDIS_URL, {
  maxRetriesPerRequest: null,
  enableOfflineQueue: false,
  keepAlive: 30000  // ⭐ 30초 keepAlive
});
```

#### Worker 설정
```javascript
const worker = new Worker('meta-ads-collection', processJob, {
  connection,
  concurrency: 2,  // ⭐ v1.2: 동시 실행 2개로 제한
  limiter: {
    max: 5,
    duration: 60000  // 1분당 5개 작업
  },
  settings: {
    backoffStrategies: {
      exponential: (attemptsMade) => {
        return Math.min(Math.pow(2, attemptsMade) * 1000, 60000);
      }
    }
  }
});
```

### 웹 대시보드 (Streamlit)

#### KPI 카드 형식
```
총 리드
125건 ↑18% (+19건)
전주: 106건
```

- **증감률 + 절대값 표시 필수**
- **이전 값 표시 필수**

#### 차트
- **Plotly 사용**
- 빈 데이터 처리 (No data available 표시)
- 호버 템플릿 명시

### 보안

#### Null/Undefined 체크
```javascript
// ⭐ v1.2: 안전한 데이터 접근
const insights = adData?.insights?.data?.[0] || {};
const impressions = insights.impressions || 0;
const clicks = insights.clicks || 0;
```

---

## 📝 작업 전 체크리스트

### 데이터베이스 관련 작업
- [ ] `docs/PROJECT_SPECIFICATION.md` 섹션 3 (데이터베이스 설계) 확인
- [ ] 테이블 스키마 변경 시 마이그레이션 파일 생성
- [ ] SQL 변수에 `v_` 접두사 사용
- [ ] `currency` 필드 포함 (v1.2)

### Meta API 관련 작업
- [ ] 페이지네이션 구현 확인
- [ ] Null/undefined 체크 적용
- [ ] Vault 토큰에서 공백 제거
- [ ] 에러 처리 및 재시도 로직

### Job Queue 관련 작업
- [ ] Upstash Redis `keepAlive` 설정 확인
- [ ] Worker `concurrency: 2` 확인
- [ ] Exponential backoff 적용

### Streamlit 대시보드 작업
- [ ] KPI 카드에 증감률 + 절대값 + 이전 값 표시
- [ ] Plotly 차트 사용
- [ ] 빈 데이터 처리
- [ ] Supabase 연동 확인

---

## 🔧 자동 적용 규칙

### 1. 코드 작성 시
모든 코드는 `docs/PROJECT_SPECIFICATION.md`에 명시된 설계를 따릅니다.

### 2. 파일 수정 시
- 기존 코드 패턴 유지
- v1.2 개선 사항 반영
- 문서와 불일치 시 **문서 우선**

### 3. 새 기능 추가 시
- 먼저 `docs/IMPLEMENTATION_GUIDE.md` 참조
- 가이드에 없으면 사용자에게 확인

---

## 🚨 위반 시 처리

1. **즉시 작업 중단**
2. **사용자에게 보고**:
   ```
   ⚠️ 가이드 위반 감지

   위반 내용: [구체적 내용]
   관련 문서: docs/PROJECT_SPECIFICATION.md 섹션 [번호]
   올바른 방법: [설명]
   ```
3. **수정 후 재작업**

---

## 📚 참고 우선순위

1. **PROJECT_SPECIFICATION.md** (최우선)
2. **IMPLEMENTATION_GUIDE.md** (구현 세부)
3. **PROGRESS_SUMMARY.md** (현재 상태)
4. **기존 코드** (패턴 유지)

---

**이 스킬은 BAS Meta Ads 프로젝트 작업 시 자동으로 활성화됩니다.**
