# 대시보드 기술 스택 결정

**날짜**: 2025-11-19
**목적**: 최적의 대시보드 개발 방법 결정

---

## 📊 현재 상황

### 완료된 작업
- ✅ 데이터 수집 백엔드 (Node.js + BullMQ)
- ✅ Supabase 데이터베이스 (파티션 + 분석 뷰)
- ✅ 2,332개 레코드 수집 완료
- ✅ 10개 분석 뷰 + 8개 KPI 함수 준비

### 다음 작업
- 웹 대시보드 개발

---

## 🔍 프로젝트 명세 분석

### 원래 계획 (PROJECT_SPECIFICATION.md)

**Week 3 (12/2 ~ 12/9) - 웹 대시보드**:
- Next.js 14 프로젝트 초기화
- Supabase Auth 연동
- 로그인/로그아웃 페이지
- 메인 대시보드 레이아웃
- KPI 카드 4개 (개선된 UI)
- 주간 트렌드 Line Chart (Recharts)
- TOP 광고 테이블 (페이지네이션)
- Vercel 배포

**배포 환경**:
- Frontend: **Vercel** (Next.js)
- Backend: **Railway** (Node.js Producer + Worker)

---

## 🎯 3가지 옵션 비교

### 옵션 1: Next.js 14 (별도 프로젝트) ⭐ 권장

**구조**:
```
F:/bas_meta/              # 백엔드 (현재 프로젝트)
├── index.js              # Producer + Worker
├── lib/
└── sql/

F:/bas_meta/dashboard/    # 프론트엔드 (새 프로젝트)
├── app/
├── components/
└── lib/
```

**장점**:
- ✅ 프로젝트 명세와 일치
- ✅ 프론트엔드/백엔드 완전 분리 (권장 패턴)
- ✅ Vercel 배포 최적화
- ✅ 독립적인 버전 관리
- ✅ Next.js 14 App Router 활용

**단점**:
- ⚠️ 초기 설정 시간 (30분)
- ⚠️ 2개 프로젝트 관리

**개발 시간**:
- 초기 설정: 30분
- KPI 카드: 1시간
- 차트: 1시간
- 합계: **2.5시간**

---

### 옵션 2: Streamlit (Python)

**구조**:
```
F:/bas_meta/
├── index.js              # Node.js 백엔드
├── dashboard/
│   ├── app.py            # Streamlit 앱
│   ├── components/
│   └── requirements.txt
```

**장점**:
- ✅ 빠른 프로토타이핑 (1시간)
- ✅ Python 데이터 분석 친화적
- ✅ Plotly 내장 지원
- ✅ 코드 간결

**단점**:
- ❌ 프로젝트 명세와 다름
- ❌ 프로덕션 성능 낮음
- ❌ 커스텀 디자인 어려움
- ❌ Vercel 배포 불가 (Railway만 가능)
- ❌ 로그인 기능 제한적

**개발 시간**: **1시간**

---

### 옵션 3: Next.js 14 (현재 프로젝트에 추가)

**구조**:
```
F:/bas_meta/
├── index.js              # 백엔드
├── app/                  # Next.js 프론트엔드
├── components/
└── lib/
```

**장점**:
- ✅ 모노레포 구조
- ✅ 코드 공유 쉬움

**단점**:
- ❌ 백엔드(Node.js Worker)와 프론트엔드(Next.js) 혼재
- ❌ Vercel 배포 시 백엔드 제외 필요
- ❌ Railway 배포 시 Next.js 빌드 불필요
- ❌ 복잡한 배포 설정

---

## 💡 최종 권장: **옵션 1 (Next.js 14 별도 프로젝트)**

### 이유

1. **프로젝트 명세와 일치**
   - Week 3 계획: Next.js 14
   - 배포: Vercel (Frontend) + Railway (Backend)

2. **프로덕션 환경 최적화**
   - Vercel: Next.js 최적 성능
   - Railway: Node.js Worker 전용
   - 독립적인 스케일링

3. **개발 경험**
   - 명확한 폴더 구조
   - 독립적인 개발/배포
   - 버전 충돌 없음

4. **향후 확장성**
   - 멀티 클라이언트 지원 용이
   - Supabase Auth 연동 강력
   - 반응형 디자인 최적화

---

## 🚀 실행 계획 (옵션 1)

### 1단계: Next.js 14 프로젝트 초기화 (10분)

```bash
cd F:/bas_meta
npx create-next-app@latest dashboard --typescript --tailwind --app --no-src-dir
cd dashboard
```

**선택 옵션**:
- ✅ TypeScript
- ✅ Tailwind CSS
- ✅ App Router
- ❌ src/ directory (No)
- ✅ import alias (@/*)

### 2단계: Supabase 클라이언트 설정 (10분)

```bash
npm install @supabase/supabase-js @supabase/auth-helpers-nextjs
```

`lib/supabase.ts` 생성:
```typescript
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
```

### 3단계: 환경 변수 설정 (5분)

`.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
```

### 4단계: 레이아웃 및 KPI 카드 구현 (1시간)

- 메인 레이아웃
- KPI 카드 4개 (총 리드, 총 지출, CPL, CTR)
- 반응형 그리드

### 5단계: Recharts 차트 추가 (1시간)

```bash
npm install recharts
```

- 주간 트렌드 Line Chart
- 플랫폼별 Bar Chart

### 6단계: Vercel 배포 (5분)

```bash
vercel deploy
```

---

## 📦 프로젝트 구조 (최종)

```
F:/bas_meta/                  # 백엔드 프로젝트
├── index.js                  # Producer + Worker
├── lib/
│   ├── worker.js
│   ├── producer.js
│   └── backfill.js
├── sql/
│   ├── 01_schema.sql
│   ├── 02_partitions.sql
│   └── 03_analysis_views.sql
├── .env                      # 백엔드 환경 변수
├── package.json
└── docs/

F:/bas_meta/dashboard/        # 프론트엔드 프로젝트
├── app/
│   ├── page.tsx              # 메인 대시보드
│   ├── layout.tsx
│   └── globals.css
├── components/
│   ├── KPICard.tsx
│   ├── TrendChart.tsx
│   └── TopAdsTable.tsx
├── lib/
│   └── supabase.ts
├── .env.local                # 프론트엔드 환경 변수
├── package.json
├── tailwind.config.ts
└── tsconfig.json
```

---

## ✅ 결정

**선택**: **옵션 1 - Next.js 14 (별도 프로젝트)**

**시작 명령어**:
```bash
cd F:/bas_meta
npx create-next-app@latest dashboard --typescript --tailwind --app --no-src-dir
```

**예상 소요 시간**: 2.5시간
- 초기 설정: 30분
- KPI 카드: 1시간
- 차트: 1시간

---

**작성자**: Claude
**프로젝트**: BAS Meta Ads Analytics
**참고**: docs/PROJECT_SPECIFICATION.md (Week 3)
