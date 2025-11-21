# 🔒 보안 가이드 - API 키 보호

## ⚠️ 중요: API 키 노출 방지

### Google AI API 키 보안 규칙

#### ✅ 올바른 사용 (서버 사이드 전용)

```typescript
// ✅ GOOD: 서버 컴포넌트 또는 API Route에서만 사용
// app/api/reports/generate/route.ts
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!);
// ✅ 이 코드는 서버에서만 실행되므로 안전
```

#### ❌ 절대 금지 (클라이언트 노출)

```typescript
// ❌ NEVER: NEXT_PUBLIC_ 접두사 사용 금지
NEXT_PUBLIC_GOOGLE_AI_API_KEY=xxx  // 클라이언트에 노출됨!

// ❌ NEVER: 클라이언트 컴포넌트에서 직접 사용 금지
'use client'
const apiKey = process.env.GOOGLE_AI_API_KEY  // 위험!
```

### 환경 변수 설정

#### Local Development (.env.local)
```bash
# ✅ NEXT_PUBLIC_ 없이 설정
GOOGLE_AI_API_KEY=AIzaSyCOGghDPQ3QUhc-szrZGRKNDHLogTm_u_0
```

#### Vercel Production
1. Vercel Dashboard → Settings → Environment Variables
2. Key: `GOOGLE_AI_API_KEY`
3. Value: `AIzaSyCOGghDPQ3QUhc-szrZGRKNDHLogTm_u_0`
4. ⚠️ **NEXT_PUBLIC_ 접두사 절대 사용하지 말 것**

### Git 보안

#### .gitignore 확인 (이미 설정됨)
```gitignore
# ✅ .env.local은 자동으로 Git에서 제외됨
.env*.local
.env
```

#### 주의사항
- `.env.production`은 참고용으로만 사용
- 실제 키는 Vercel Dashboard에서 직접 설정
- `.env.local`은 절대 Git에 커밋하지 말 것

### Next.js 보안 원칙

#### 서버 컴포넌트 vs 클라이언트 컴포넌트

| 컴포넌트 타입 | API 키 사용 | 환경 변수 접근 |
|--------------|-----------|--------------|
| **서버 컴포넌트** (기본) | ✅ 안전 | `process.env.GOOGLE_AI_API_KEY` |
| **API Route** | ✅ 안전 | `process.env.GOOGLE_AI_API_KEY` |
| **클라이언트 컴포넌트** (`'use client'`) | ❌ 금지 | `NEXT_PUBLIC_*`만 접근 가능 |

### 현재 프로젝트 구조 (안전함 ✅)

```
dashboard/
├── app/
│   └── api/
│       └── reports/
│           └── generate/
│               └── route.ts          ✅ 서버 사이드 API Route
│
├── components/
│   └── AIInsightsPanel.tsx           ✅ 클라이언트 → API 호출 (안전)
│
├── .env.local                        ✅ Git 제외됨
├── .env.production                   ✅ 참고용 (실제 키는 Vercel에 설정)
└── .gitignore                        ✅ .env*.local 제외 설정됨
```

### 보안 체크리스트

#### 배포 전 확인
- [ ] `.env.local`이 Git에 커밋되지 않았는지 확인
- [ ] Vercel Dashboard에 `GOOGLE_AI_API_KEY` 설정 완료
- [ ] API Route에서만 Google AI API 사용
- [ ] 클라이언트 컴포넌트에서 직접 API 키 사용하지 않음
- [ ] `NEXT_PUBLIC_` 접두사를 API 키에 사용하지 않음

#### 런타임 확인
```typescript
// 개발 서버 실행 시 확인
console.log('API Key exists:', !!process.env.GOOGLE_AI_API_KEY)
// ✅ true 출력되어야 함

// 클라이언트에서 확인 (개발 모드에서만)
console.log('Client can access:', process.env.GOOGLE_AI_API_KEY)
// ✅ undefined 출력되어야 안전
```

### 노출 시 대응 절차

만약 API 키가 노출되었다면:

1. **즉시 키 비활성화**
   - Google Cloud Console → API & Services → Credentials
   - 해당 API 키 삭제 또는 비활성화

2. **새 키 발급**
   - 새로운 API 키 생성
   - `.env.local` 및 Vercel Dashboard 업데이트

3. **Git 히스토리 정리** (키가 커밋된 경우)
   ```bash
   git filter-branch --force --index-filter \
     "git rm --cached --ignore-unmatch .env.local" \
     --prune-empty --tag-name-filter cat -- --all
   ```

4. **보안 감사**
   - 노출 기간 동안의 API 사용량 확인
   - 비정상적인 활동 모니터링

### 추가 보안 강화

#### API 제한 설정 (권장)
Google Cloud Console에서:
- HTTP 리퍼러 제한 추가
- IP 주소 제한 (Vercel IP 범위)
- 일일 할당량 설정

#### 환경별 키 분리
```bash
# Development
GOOGLE_AI_API_KEY=dev_key_xxx

# Production
GOOGLE_AI_API_KEY=prod_key_yyy
```

### 참고 문서

- [Next.js Environment Variables](https://nextjs.org/docs/app/building-your-application/configuring/environment-variables)
- [Vercel Environment Variables](https://vercel.com/docs/projects/environment-variables)
- [Google AI API Key Security](https://ai.google.dev/gemini-api/docs/api-key)

---

**마지막 업데이트**: 2025-11-21
**프로젝트**: BAS Meta Ads Dashboard
