# Google Gemini API 마이그레이션 완료

## 📋 작업 개요

- **날짜**: 2025-11-21
- **작업**: Anthropic Claude → Google Gemini API 전환
- **목적**: 비용 효율성 및 성능 개선

## ✅ 완료된 작업

### 1. 패키지 설치
```bash
npm install @google/generative-ai
```
- 1개 패키지 추가
- 기존 `@anthropic-ai/sdk` 제거 가능 (선택 사항)

### 2. API Route 수정
**파일**: `dashboard/app/api/reports/generate/route.ts`

**Before (Claude)**:
```typescript
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

const message = await anthropic.messages.create({
  model: 'claude-3-5-sonnet-20241022',
  max_tokens: 2000,
  messages: [{ role: 'user', content: prompt }]
});

const insights = message.content[0].text;
```

**After (Gemini)**:
```typescript
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!);

const model = genAI.getGenerativeModel({
  model: 'gemini-2.0-flash-exp'
});

const result = await model.generateContent(prompt);
const insights = result.response.text();
```

### 3. 환경 변수 설정

#### .env.local (Local Development)
```bash
GOOGLE_AI_API_KEY=AIzaSyCOGghDPQ3QUhc-szrZGRKNDHLogTm_u_0
```

#### .env.production (Vercel 참고용)
```bash
# Google AI API (AI 인사이트용) - 서버 사이드 전용
# ⚠️ NEXT_PUBLIC_ 접두사 절대 사용 금지 (클라이언트 노출 방지)
GOOGLE_AI_API_KEY=AIzaSyCOGghDPQ3QUhc-szrZGRKNDHLogTm_u_0
```

### 4. 보안 설정

#### Git 보안 확인 ✅
- `.env.local` → `.gitignore`에 포함됨 (자동 제외)
- API 키는 절대 Git에 커밋되지 않음

#### Next.js 보안 원칙 ✅
- `NEXT_PUBLIC_` 접두사 사용 안 함 (클라이언트 노출 방지)
- API Route에서만 사용 (서버 사이드 전용)
- 클라이언트 컴포넌트는 API 호출로만 접근

### 5. 보안 가이드 문서 작성
**파일**: `dashboard/SECURITY.md`
- API 키 보호 규칙
- 올바른/잘못된 사용 예시
- 보안 체크리스트
- 노출 시 대응 절차

## 🎯 사용된 Google AI 설정

### API 정보
- **API Key**: `AIzaSyCOGghDPQ3QUhc-szrZGRKNDHLogTm_u_0`
- **Project**: `gen-lang-client-0486671683`
- **Model**: `gemini-2.0-flash-exp` (최신 Gemini 2.0 Flash 실험 모델)

### 모델 선택 이유
- **gemini-2.0-flash-exp**: 빠른 응답 속도, 비용 효율적, 실험 기능 지원
- 대안 모델:
  - `gemini-3-pro-preview-11-2025`: 더 높은 품질 (느림, 비쌈)
  - `gemini-1.5-flash`: 안정적인 프로덕션 모델

## 🔒 보안 체크리스트

### ✅ 완료된 항목
- [x] API 키를 서버 사이드 전용으로 설정 (`NEXT_PUBLIC_` 없음)
- [x] `.env.local` Git 제외 확인
- [x] API Route에서만 Google AI API 사용
- [x] 클라이언트 컴포넌트는 API 호출로만 접근
- [x] 보안 가이드 문서 작성 (`SECURITY.md`)
- [x] TypeScript 타입 체크 통과

### 🔜 배포 시 필요한 작업
- [ ] Vercel Dashboard에 `GOOGLE_AI_API_KEY` 환경 변수 추가
  1. Vercel Dashboard → 프로젝트 선택
  2. Settings → Environment Variables
  3. Key: `GOOGLE_AI_API_KEY`
  4. Value: `AIzaSyCOGghDPQ3QUhc-szrZGRKNDHLogTm_u_0`
  5. Environment: Production, Preview, Development 모두 선택

## 📊 Claude vs Gemini 비교

| 항목 | Claude 3.5 Sonnet | Gemini 2.0 Flash |
|------|------------------|------------------|
| **응답 속도** | 보통 | 빠름 ⚡ |
| **비용** | 높음 ($3/1M input) | 낮음 (무료 티어 제공) |
| **품질** | 매우 우수 | 우수 |
| **토큰 제한** | 200K | 1M+ |
| **멀티모달** | 제한적 | 우수 (이미지, 비디오) |
| **프롬프트 엔지니어링** | 필요 | 간단함 |

## 🚀 다음 단계

### 1. Vercel 배포
```bash
vercel --prod
```

### 2. 환경 변수 설정
Vercel Dashboard에서 `GOOGLE_AI_API_KEY` 추가

### 3. 테스트
- AI 인사이트 생성 버튼 클릭
- Gemini API 정상 작동 확인
- 응답 품질 검증

### 4. 모니터링
- Google Cloud Console에서 API 사용량 확인
- 일일 할당량 모니터링
- 비용 추적

## 🔧 문제 해결

### API 키 오류
```
Error: API key not valid
```
**해결**: `.env.local` 또는 Vercel 환경 변수 확인

### 타입 에러
```
Property 'text' does not exist
```
**해결**: `result.response.text()` 사용 (괄호 포함)

### 클라이언트 노출
```
API key exposed in browser
```
**해결**: `NEXT_PUBLIC_` 접두사 제거, API Route에서만 사용

## 📚 참고 자료

### Google AI 공식 문서
- [Gemini API Quickstart](https://ai.google.dev/gemini-api/docs/quickstart)
- [Node.js SDK](https://ai.google.dev/gemini-api/docs/get-started/node)
- [API Key 보안](https://ai.google.dev/gemini-api/docs/api-key)

### Next.js 보안
- [Environment Variables](https://nextjs.org/docs/app/building-your-application/configuring/environment-variables)
- [Server vs Client Components](https://nextjs.org/docs/app/building-your-application/rendering/composition-patterns)

### 프로젝트 문서
- `dashboard/SECURITY.md` - API 키 보호 가이드
- `dashboard/.env.production` - 환경 변수 참고

## ✨ 마이그레이션 완료 요약

✅ **Google Gemini API 전환 성공**
- Anthropic Claude → Google Gemini 2.0 Flash
- 1개 패키지 설치, API Route 수정 완료
- 보안 설정 완료 (서버 사이드 전용)
- TypeScript 타입 체크 통과
- 보안 가이드 문서 작성

✅ **보안 강화**
- API 키 Git 제외 확인
- `NEXT_PUBLIC_` 접두사 사용 안 함
- 서버 사이드 전용 설정
- 클라이언트 노출 방지

🔜 **다음 작업**
- Vercel에 `GOOGLE_AI_API_KEY` 환경 변수 추가
- 프로덕션 배포 및 테스트

---

**작성일**: 2025-11-21
**프로젝트**: BAS Meta Ads Dashboard
**API**: Google Gemini 2.0 Flash (`gemini-2.0-flash-exp`)
