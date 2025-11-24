# Phase 7: Next.js 14 대시보드 개발 가이드

**날짜**: 2025-11-19
**목적**: Next.js 14로 Meta 광고 분석 대시보드 구축 (Vercel 배포)

---

## 📋 목차

1. [프로젝트 개요](#프로젝트-개요)
2. [사전 준비](#사전-준비)
3. [1단계: 프로젝트 초기화](#1단계-프로젝트-초기화)
4. [2단계: Supabase 연결 설정](#2단계-supabase-연결-설정)
5. [3단계: 메인 레이아웃 구성](#3단계-메인-레이아웃-구성)
6. [4단계: KPI 카드 구현](#4단계-kpi-카드-구현)
7. [5단계: 차트 컴포넌트 추가](#5단계-차트-컴포넌트-추가)
8. [6단계: 테이블 컴포넌트](#6단계-테이블-컴포넌트)
9. [7단계: Vercel 배포](#7단계-vercel-배포)
10. [트러블슈팅](#트러블슈팅)

---

## 📊 프로젝트 개요

### 현재 상태 (Phase 6 완료)

✅ **완료된 작업**:

- Node.js Producer + Worker (Railway 배포)
- Supabase 데이터베이스 (파티션 구조)
- 2,332개 레코드 수집 완료
- 10개 분석 뷰 + 8개 KPI 함수 생성
- 주간 요약 자동 생성

### Phase 7 목표

🎯 **구축할 것**:

- Next.js 14 App Router 프로젝트
- Supabase 연동 (분석 뷰 활용)
- KPI 대시보드 (4개 카드)
- 차트 2개 (주간 트렌드, 플랫폼별)
- Top 광고 테이블
- Vercel 배포

### 기술 스택

| 영역 | 기술 |
|------|------|
| **프레임워크** | Next.js 14 (App Router) |
| **언어** | TypeScript |
| **스타일링** | Tailwind CSS |
| **데이터베이스** | Supabase (PostgreSQL) |
| **차트** | Recharts |
| **배포** | Vercel |

### 예상 소요 시간

| 단계 | 소요 시간 |
|------|----------|
| 프로젝트 초기화 | 10분 |
| Supabase 연결 | 10분 |
| 메인 레이아웃 | 10분 |
| KPI 카드 4개 | 1시간 |
| 차트 2개 | 1시간 |
| 테이블 | 30분 |
| Vercel 배포 | 10분 |
| **합계** | **약 3시간** |

---

## 🎯 사전 준비

### 필수 확인 사항

- [ ] Phase 6 완료 (분석 뷰 적용)
- [ ] Supabase Dashboard 접근 가능
- [ ] Node.js 18+ 설치
- [ ] Git 설치
- [ ] Vercel 계정 생성

### 필요한 정보

**Supabase 정보** (Dashboard → Settings → API):

**Supabase 정보** (Dashboard → Settings → API):

```yaml
SUPABASE_URL: https://mpljqcuqrrfwzamfyxnz.supabase.co
SUPABASE_ANON_KEY: (Public anon key)
```

**프로젝트 경로**:

**프로젝트 경로**:

```text
F:\bas_meta\dashboard\
```

---

## 1단계: 프로젝트 초기화

### 1.1 Next.js 프로젝트 생성 (10분)

```bash
# 프로젝트 루트로 이동
cd F:\bas_meta

# Next.js 14 프로젝트 생성
npx create-next-app@latest dashboard --typescript --tailwind --app --no-src-dir

# 프로젝트 폴더로 이동
cd dashboard
```

### 1.2 대화형 설정

### 1.2 대화형 설정

```text
✔ Would you like to use TypeScript? … Yes
✔ Would you like to use ESLint? … Yes
✔ Would you like to use Tailwind CSS? … Yes
✔ Would you like to use `src/` directory? … No
✔ Would you like to use App Router? … Yes
✔ Would you like to customize the default import alias (@/*)? … Yes
✔ What import alias would you like configured? … @/*
```

### 1.3 패키지 설치

```bash
# Supabase 클라이언트
npm install @supabase/supabase-js

# 차트 라이브러리
npm install recharts

# 날짜 처리
npm install date-fns

# 아이콘
npm install lucide-react

# 유틸리티
npm install clsx tailwind-merge
```

### 1.4 개발 서버 실행 (확인)

```bash
npm run dev
```

브라우저에서 `http://localhost:3000` 접속하여 Next.js 기본 페이지 확인

---

## 2단계: Supabase 연결 설정

### 2.1 환경 변수 파일 생성

**파일**: `.env.local`

```env
# Supabase 설정
NEXT_PUBLIC_SUPABASE_URL=https://mpljqcuqrrfwzamfyxnz.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1wbGpxY3VxcnJmd3phbWZ5eG56Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzE1ODQwMDcsImV4cCI6MjA0NzE2MDAwN30.T8DL7aH9Ak4mmbfJpSOnN1N1TfwVHhWO5EbTh-Pm-xU

# 선택: 개발 모드
NODE_ENV=development
```

⚠️ **보안 주의**: `NEXT_PUBLIC_SUPABASE_ANON_KEY`는 브라우저에 노출되므로 안전하지만, `SERVICE_ROLE_KEY`는 절대로 클라이언트 측 환경 변수에 넣으면 안 됩니다.

### 2.2 Supabase 클라이언트 생성 (SSR 호환)

**파일**: `lib/supabase.ts`

```typescript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Check .env.local file.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

> **참고**: 추후 인증(Auth) 기능이 추가되면 `@supabase/ssr` 패키지로 마이그레이션하여 쿠키 기반 세션 관리를 구현해야 합니다. 현재는 공개 데이터 조회 위주이므로 기본 클라이언트를 사용합니다.

### 2.3 타입 정의

**파일**: `types/analytics.ts`

```typescript
// 일별 트렌드
export interface DailyTrend {
  date: string;
  impressions: number;
  clicks: number;
  leads: number;
  spend: number;
  ctr: number;
  cvr: number;
  cpl: number;
}

// 플랫폼별 성과
export interface PlatformPerformance {
  platform: string;
  impressions: number;
  clicks: number;
  leads: number;
  spend: number;
  ctr: number;
  cvr: number;
  cpl: number;
}

// KPI 요약
export interface KPISummary {
  total_leads: number;
  total_spend: number;
  avg_cpl: number;
  avg_ctr: number;
  total_impressions: number;
  total_clicks: number;
  avg_cvr: number;
}

// Top 광고
export interface TopAd {
  ad_name: string;
  campaign_name: string;
  leads: number;
  spend: number;
  cpl: number;
  clicks: number;
  ctr: number;
}
```

### 2.4 API 함수 작성

**파일**: `lib/api.ts`

```typescript
import { supabase } from './supabase';
import { DailyTrend, PlatformPerformance, KPISummary, TopAd } from '@/types/analytics';

// 최근 7일 일별 트렌드
export async function getDailyTrend7d(): Promise<DailyTrend[]> {
  const { data, error } = await supabase
    .from('v_daily_trend_7d')
    .select('*')
    .order('date', { ascending: true });

  if (error) throw error;
  return data || [];
}

// 최근 30일 플랫폼별 성과
export async function getPlatformPerformance30d(): Promise<PlatformPerformance[]> {
  const { data, error } = await supabase
    .from('v_platform_performance_30d')
    .select('*')
    .order('spend', { ascending: false });

  if (error) throw error;
  return data || [];
}

// KPI 요약 (최근 7일)
export async function getKPISummary7d(): Promise<KPISummary> {
  const { data, error } = await supabase
    .from('v_daily_trend_7d')
    .select('impressions, clicks, leads, spend, ctr, cvr, cpl');

  if (error) throw error;
  if (!data || data.length === 0) {
    return {
      total_leads: 0,
      total_spend: 0,
      avg_cpl: 0,
      avg_ctr: 0,
      total_impressions: 0,
      total_clicks: 0,
      avg_cvr: 0
    };
  }

  // 집계 계산
  const total_impressions = data.reduce((sum, d) => sum + d.impressions, 0);
  const total_clicks = data.reduce((sum, d) => sum + d.clicks, 0);
  const total_leads = data.reduce((sum, d) => sum + d.leads, 0);
  const total_spend = data.reduce((sum, d) => sum + d.spend, 0);

  return {
    total_leads,
    total_spend,
    avg_cpl: total_leads > 0 ? total_spend / total_leads : 0,
    avg_ctr: total_impressions > 0 ? (total_clicks / total_impressions) * 100 : 0,
    total_impressions,
    total_clicks,
    avg_cvr: total_clicks > 0 ? (total_leads / total_clicks) * 100 : 0
  };
}

// Top 광고 (최근 7일)
export async function getTopAds7d(limit: number = 10): Promise<TopAd[]> {
  const { data, error } = await supabase
    .from('v_top_ads_7d')
    .select('*')
    .limit(limit);

  if (error) throw error;
  return data || [];
}
```

### 2.5 유틸리티 및 상수 설정 (유지보수성 향상)

**파일**: `lib/utils.ts`

```typescript
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('ko-KR', {
    style: 'currency',
    currency: 'KRW',
    maximumFractionDigits: 0
  }).format(value);
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('ko-KR').format(value);
}
```

**파일**: `lib/constants.ts`

```typescript
export const CHART_COLORS = {
  primary: '#0066CC',
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
  neutral: '#6B7280'
};

export const METADATA = {
  title: 'BAS Meta Ads Dashboard',
  description: '메타 광고 성과 분석 대시보드',
  ogImage: '/og-image.png'
};
```

### 2.6 연결 테스트

개발 서버를 실행한 상태에서 브라우저 콘솔에서 테스트:

```javascript
// 브라우저 콘솔
fetch('/api/test')
  .then(r => r.json())
  .then(console.log);
```

---

## 3단계: 메인 레이아웃 구성

### 3.1 전역 스타일 업데이트

**파일**: `app/globals.css`

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  /* 브랜드 색상 */
  --primary: #0066CC;
  --primary-hover: #0052A3;
  --secondary: #6B7280;
  --accent: #F59E0B;
  --success: #10B981;
  --error: #EF4444;

  /* 중립 색상 */
  --neutral-50: #F9FAFB;
  --neutral-100: #F3F4F6;
  --neutral-200: #E5E7EB;
  --neutral-300: #D1D5DB;
  --neutral-400: #9CA3AF;
  --neutral-500: #6B7280;
  --neutral-600: #4B5563;
  --neutral-700: #374151;
  --neutral-800: #1F2937;
  --neutral-900: #111827;

  /* 타이포그래피 */
  --font-sans: var(--font-pretendard);
}

body {
  background-color: var(--neutral-50);
  color: var(--neutral-900);
  font-family: var(--font-sans);
}

/* 스크롤바 스타일링 */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: var(--neutral-100);
}

::-webkit-scrollbar-thumb {
  background: var(--neutral-400);
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: var(--neutral-500);
}
```

### 3.2 루트 레이아웃

**파일**: `app/layout.tsx`

```typescript
import type { Metadata } from "next";
import localFont from 'next/font/local';
import "./globals.css";
import { METADATA } from "@/lib/constants";

// 폰트 최적화 (Pretendard)
const pretendard = localFont({
  src: '../public/fonts/PretendardVariable.woff2',
  display: 'swap',
  variable: '--font-pretendard',
});

export const metadata: Metadata = {
  title: {
    template: `%s | ${METADATA.title}`,
    default: METADATA.title,
  },
  description: METADATA.description,
  openGraph: {
    title: METADATA.title,
    description: METADATA.description,
    type: 'website',
    locale: 'ko_KR',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className={pretendard.variable}>
      <body className="antialiased font-sans">
        {children}
      </body>
    </html>
  );
}
```

> **참고**: `public/fonts/PretendardVariable.woff2` 파일이 필요합니다. 없으면 Google Fonts(`next/font/google`)의 `Inter` 등을 대안으로 사용하세요.

### 3.3 헤더 컴포넌트

**파일**: `components/Header.tsx`

```typescript
import { BarChart3 } from 'lucide-react';

export function Header() {
  return (
    <header className="bg-white border-b border-neutral-200 sticky top-0 z-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <BarChart3 className="w-8 h-8 text-[var(--primary)]" />
            <div>
              <h1 className="text-xl font-bold text-neutral-900">
                BAS Meta Ads Dashboard
              </h1>
              <p className="text-sm text-neutral-500">
                메타 광고 성과 분석
              </p>
            </div>
          </div>

          <div className="text-sm text-neutral-600">
            최종 업데이트: {new Date().toLocaleDateString('ko-KR')}
          </div>
        </div>
      </div>
    </header>
  );
}
```

### 3.4 메인 페이지 레이아웃

**파일**: `app/page.tsx` (임시)

```typescript
import { Header } from '@/components/Header';
import { Suspense } from 'react';
import Loading from './loading';

// 데이터 최신성 보장을 위해 동적 렌더링 강제
export const dynamic = 'force-dynamic';

export default function Home() {
  return (
    <div className="min-h-screen">
      <Header />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-8">
          {/* KPI 카드 영역 - 즉시 로딩 권장 */}
          <section>
            <h2 className="text-2xl font-bold mb-4">주요 지표 (최근 7일)</h2>
            <Suspense fallback={<div className="h-32 bg-neutral-100 rounded-lg animate-pulse" />}>
              {/* KPI Card Container Component */}
            </Suspense>
          </section>

          {/* 차트 영역 - 스트리밍 적용 */}
          <section>
            <h2 className="text-2xl font-bold mb-4">주간 트렌드</h2>
            <div className="bg-white p-6 rounded-lg border border-neutral-200">
              <Suspense fallback={<div className="h-[400px] flex items-center justify-center text-neutral-400">차트 로딩 중...</div>}>
                 {/* Chart Component */}
              </Suspense>
            </div>
          </section>

          {/* 테이블 영역 */}
          <section>
            <h2 className="text-2xl font-bold mb-4">Top 광고 (최근 7일)</h2>
            <div className="bg-white rounded-lg border border-neutral-200">
              <Suspense fallback={<div className="h-64 bg-neutral-50 animate-pulse" />}>
                {/* Table Component */}
              </Suspense>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
```

### 3.5 로딩 및 에러 UI (UX 개선)

**파일**: `app/loading.tsx`

```typescript
export default function Loading() {
  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="animate-pulse space-y-8">
          <div className="h-8 bg-neutral-200 rounded w-1/4"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 bg-neutral-200 rounded-lg"></div>
            ))}
          </div>
          <div className="h-96 bg-neutral-200 rounded-lg"></div>
        </div>
      </div>
    </div>
  );
}
```

**파일**: `app/error.tsx`

```typescript
'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-neutral-900 mb-4">
          데이터를 불러오는 중 문제가 발생했습니다
        </h2>
        <button
          onClick={() => reset()}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          다시 시도
        </button>
      </div>
    </div>
  );
}
```

**확인**: `npm run dev` 실행 후 레이아웃 확인

---

## 4단계: KPI 카드 구현

### 4.1 KPI 카드 컴포넌트

**파일**: `components/KPICard.tsx`

```typescript
import { LucideIcon } from 'lucide-react';

interface KPICardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  format?: 'number' | 'currency' | 'percentage';
}

export function KPICard({
  title,
  value,
  icon: Icon,
  trend,
  format = 'number'
}: KPICardProps) {
  const formatValue = (val: string | number): string => {
    if (typeof val === 'string') return val;

    switch (format) {
      case 'currency':
        return `₩${val.toLocaleString('ko-KR')}`;
      case 'percentage':
        return `${val.toFixed(2)}%`;
      default:
        return val.toLocaleString('ko-KR');
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg border border-neutral-200 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-neutral-500">{title}</p>
          <p className="text-3xl font-bold mt-2 text-neutral-900">
            {formatValue(value)}
          </p>

          {trend && (
            <div className="flex items-center gap-1 mt-2">
              <span className={`text-sm font-medium ${
                trend.isPositive ? 'text-green-600' : 'text-red-600'
              }`}>
                {trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value).toFixed(1)}%
              </span>
              <span className="text-sm text-neutral-500">vs 지난 주</span>
            </div>
          )}
        </div>

        <div className="p-3 bg-blue-50 rounded-lg">
          <Icon className="w-6 h-6 text-[var(--primary)]" />
        </div>
      </div>
    </div>
  );
}
```

### 4.2 메인 페이지에 KPI 카드 추가

**파일**: `app/page.tsx` (Server Component)

```typescript
import { Header } from '@/components/Header';
import { KPICard } from '@/components/KPICard';
import { TrendingUp, DollarSign, Target, MousePointerClick } from 'lucide-react';
import { getKPISummary7d } from '@/lib/api';

export default async function Home() {
  const kpi = await getKPISummary7d();

  return (
    <div className="min-h-screen">
      <Header />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-8">
          {/* KPI 카드 영역 */}
          <section>
            <h2 className="text-2xl font-bold mb-4">주요 지표 (최근 7일)</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <KPICard
                title="총 리드"
                value={kpi.total_leads}
                icon={Target}
                format="number"
              />

              <KPICard
                title="총 지출"
                value={kpi.total_spend}
                icon={DollarSign}
                format="currency"
              />

              <KPICard
                title="평균 CPL"
                value={kpi.avg_cpl}
                icon={TrendingUp}
                format="currency"
              />

              <KPICard
                title="평균 CTR"
                value={kpi.avg_ctr}
                icon={MousePointerClick}
                format="percentage"
              />
            </div>
          </section>

          {/* 나머지 섹션 */}
        </div>
      </main>
    </div>
  );
}
```

**확인**: KPI 카드 4개가 그리드로 표시되고 실제 데이터가 로드되는지 확인

---

## 5단계: 차트 컴포넌트 추가

### 5.1 주간 트렌드 차트

**파일**: `components/TrendChart.tsx` (Client Component)

```typescript
'use client';

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { DailyTrend } from '@/types/analytics';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

interface TrendChartProps {
  data: DailyTrend[];
}

export function TrendChart({ data }: TrendChartProps) {
  const chartData = data.map(d => ({
    ...d,
    date: format(new Date(d.date), 'MM/dd', { locale: ko })
  }));

  return (
    <div className="bg-white p-6 rounded-lg border border-neutral-200">
      <h3 className="text-lg font-semibold mb-4">일별 트렌드 (최근 7일)</h3>

      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
          <XAxis
            dataKey="date"
            stroke="#6B7280"
            style={{ fontSize: '12px' }}
          />
          <YAxis
            stroke="#6B7280"
            style={{ fontSize: '12px' }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'white',
              border: '1px solid #E5E7EB',
              borderRadius: '8px'
            }}
          />
          <Legend />

          <Line
            type="monotone"
            dataKey="impressions"
            stroke="#0066CC"
            strokeWidth={2}
            name="노출수"
            dot={{ fill: '#0066CC', r: 4 }}
          />
          <Line
            type="monotone"
            dataKey="clicks"
            stroke="#10B981"
            strokeWidth={2}
            name="클릭수"
            dot={{ fill: '#10B981', r: 4 }}
          />
          <Line
            type="monotone"
            dataKey="leads"
            stroke="#F59E0B"
            strokeWidth={2}
            name="리드수"
            dot={{ fill: '#F59E0B', r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
```

### 5.2 플랫폼별 성과 차트

**파일**: `components/PlatformChart.tsx` (Client Component)

```typescript
'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { PlatformPerformance } from '@/types/analytics';

interface PlatformChartProps {
  data: PlatformPerformance[];
}

export function PlatformChart({ data }: PlatformChartProps) {
  return (
    <div className="bg-white p-6 rounded-lg border border-neutral-200">
      <h3 className="text-lg font-semibold mb-4">플랫폼별 성과 (최근 30일)</h3>

      <ResponsiveContainer width="100%" height={400}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
          <XAxis
            dataKey="platform"
            stroke="#6B7280"
            style={{ fontSize: '12px' }}
          />
          <YAxis
            stroke="#6B7280"
            style={{ fontSize: '12px' }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'white',
              border: '1px solid #E5E7EB',
              borderRadius: '8px'
            }}
          />
          <Legend />

          <Bar dataKey="leads" fill="#F59E0B" name="리드수" />
          <Bar dataKey="clicks" fill="#10B981" name="클릭수" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
```

### 5.3 메인 페이지에 차트 추가

**파일**: `app/page.tsx` (업데이트)

```typescript
import { Header } from '@/components/Header';
import { KPICard } from '@/components/KPICard';
import { TrendChart } from '@/components/TrendChart';
import { PlatformChart } from '@/components/PlatformChart';
import { TrendingUp, DollarSign, Target, MousePointerClick } from 'lucide-react';
import { getKPISummary7d, getDailyTrend7d, getPlatformPerformance30d } from '@/lib/api';

export default async function Home() {
  // 병렬로 데이터 로드
  const [kpi, dailyTrend, platformPerformance] = await Promise.all([
    getKPISummary7d(),
    getDailyTrend7d(),
    getPlatformPerformance30d()
  ]);

  return (
    <div className="min-h-screen">
      <Header />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-8">
          {/* KPI 카드 영역 */}
          <section>
            <h2 className="text-2xl font-bold mb-4">주요 지표 (최근 7일)</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <KPICard
                title="총 리드"
                value={kpi.total_leads}
                icon={Target}
                format="number"
              />
              <KPICard
                title="총 지출"
                value={kpi.total_spend}
                icon={DollarSign}
                format="currency"
              />
              <KPICard
                title="평균 CPL"
                value={kpi.avg_cpl}
                icon={TrendingUp}
                format="currency"
              />
              <KPICard
                title="평균 CTR"
                value={kpi.avg_ctr}
                icon={MousePointerClick}
                format="percentage"
              />
            </div>
          </section>

          {/* 차트 영역 */}
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <TrendChart data={dailyTrend} />
            <PlatformChart data={platformPerformance} />
          </section>

          {/* 테이블 영역 (다음 단계) */}
        </div>
      </main>
    </div>
  );
}
```

**확인**: 차트 2개가 표시되고 데이터가 시각화되는지 확인

---

## 6단계: 테이블 컴포넌트

### 6.1 Top 광고 테이블

**파일**: `components/TopAdsTable.tsx` (Client Component)

```typescript
'use client';

import { TopAd } from '@/types/analytics';

interface TopAdsTableProps {
  data: TopAd[];
}

export function TopAdsTable({ data }: TopAdsTableProps) {
  return (
    <div className="bg-white rounded-lg border border-neutral-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-neutral-200">
        <h3 className="text-lg font-semibold">Top 광고 (최근 7일)</h3>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-neutral-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                광고명
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                캠페인
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-neutral-500 uppercase tracking-wider">
                리드
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-neutral-500 uppercase tracking-wider">
                지출
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-neutral-500 uppercase tracking-wider">
                CPL
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-neutral-500 uppercase tracking-wider">
                CTR
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-neutral-200">
            {data.map((ad, index) => (
              <tr key={index} className="hover:bg-neutral-50 transition-colors">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-neutral-900">
                    {ad.ad_name}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-neutral-500">
                    {ad.campaign_name}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <div className="text-sm font-medium text-neutral-900">
                    {ad.leads.toLocaleString('ko-KR')}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <div className="text-sm text-neutral-900">
                    ₩{ad.spend.toLocaleString('ko-KR')}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <div className="text-sm text-neutral-900">
                    ₩{ad.cpl.toLocaleString('ko-KR')}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <div className="text-sm text-neutral-900">
                    {ad.ctr.toFixed(2)}%
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {data.length === 0 && (
        <div className="px-6 py-12 text-center">
          <p className="text-neutral-500">데이터가 없습니다</p>
        </div>
      )}
    </div>
  );
}
```

### 6.2 메인 페이지에 테이블 추가

**파일**: `app/page.tsx` (최종)

```typescript
import { Header } from '@/components/Header';
import { KPICard } from '@/components/KPICard';
import { TrendChart } from '@/components/TrendChart';
import { PlatformChart } from '@/components/PlatformChart';
import { TopAdsTable } from '@/components/TopAdsTable';
import { TrendingUp, DollarSign, Target, MousePointerClick } from 'lucide-react';
import {
  getKPISummary7d,
  getDailyTrend7d,
  getPlatformPerformance30d,
  getTopAds7d
} from '@/lib/api';

export default async function Home() {
  // 병렬로 데이터 로드
  const [kpi, dailyTrend, platformPerformance, topAds] = await Promise.all([
    getKPISummary7d(),
    getDailyTrend7d(),
    getPlatformPerformance30d(),
    getTopAds7d(10)
  ]);

  return (
    <div className="min-h-screen">
      <Header />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-8">
          {/* KPI 카드 영역 */}
          <section>
            <h2 className="text-2xl font-bold mb-4">주요 지표 (최근 7일)</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <KPICard
                title="총 리드"
                value={kpi.total_leads}
                icon={Target}
                format="number"
              />
              <KPICard
                title="총 지출"
                value={kpi.total_spend}
                icon={DollarSign}
                format="currency"
              />
              <KPICard
                title="평균 CPL"
                value={kpi.avg_cpl}
                icon={TrendingUp}
                format="currency"
              />
              <KPICard
                title="평균 CTR"
                value={kpi.avg_ctr}
                icon={MousePointerClick}
                format="percentage"
              />
            </div>
          </section>

          {/* 차트 영역 */}
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <TrendChart data={dailyTrend} />
            <PlatformChart data={platformPerformance} />
          </section>

          {/* 테이블 영역 */}
          <section>
            <TopAdsTable data={topAds} />
          </section>
        </div>
      </main>
    </div>
  );
}
```

**확인**: 전체 대시보드 완성 확인

---

## 7단계: Vercel 배포

### 7.1 Git 저장소 초기화

```bash
# dashboard 폴더에서
cd F:\bas_meta\dashboard

# Git 초기화
git init
git add .
git commit -m "feat: Initial Next.js 14 dashboard"

# GitHub 저장소 생성 후
git remote add origin https://github.com/YOUR_USERNAME/bas-meta-dashboard.git
git branch -M main
git push -u origin main
```

### 7.2 Vercel 배포

#### 방법 1: Vercel CLI

```bash
# Vercel CLI 설치
npm i -g vercel

# 로그인
vercel login

# 배포
vercel
```

#### 방법 2: Vercel Dashboard

1. <https://vercel.com/new> 접속
2. GitHub 저장소 import
3. 프로젝트 설정:
   - Framework Preset: Next.js
   - Root Directory: `dashboard`
   - Build Command: `npm run build`
   - Output Directory: `.next`
4. 환경 변수 추가:

   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://mpljqcuqrrfwzamfyxnz.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
   ```

5. **Deploy** 버튼 클릭

### 7.3 배포 확인

- Vercel이 제공하는 URL 접속 (예: `https://bas-meta-dashboard.vercel.app`)
- KPI, 차트, 테이블 정상 작동 확인

### 7.4 도메인 연결 (선택)

Vercel Dashboard → Settings → Domains에서 커스텀 도메인 추가

---

## 🐛 트러블슈팅

### 문제 1: Supabase 연결 실패

**증상**: "Failed to fetch" 에러

**해결**:

1. `.env.local` 파일 확인
2. Supabase URL과 ANON_KEY 정확한지 확인
3. Supabase Dashboard → Settings → API에서 키 재확인
4. 개발 서버 재시작 (`npm run dev`)

### 문제 2: 차트 렌더링 오류

**증상**: "Element type is invalid" 에러

**해결**:

1. Client Component에 `'use client'` 추가 확인
2. Recharts 설치 확인: `npm install recharts`
3. import 경로 확인

### 문제 3: 데이터 없음 (빈 대시보드)

**증상**: 모든 값이 0 또는 빈 배열

**해결**:

1. Supabase 분석 뷰 생성 확인:

   ```sql
   SELECT viewname FROM pg_views
   WHERE schemaname = 'public' AND viewname LIKE 'v_%';
   ```

2. Backfill 데이터 확인:

   ```sql
   SELECT COUNT(*) FROM raw_data_2025_09;
   ```

3. Phase 6 (분석 뷰 적용) 완료 확인

### 문제 4: 빌드 에러

**증상**: `npm run build` 실패

**해결**:

1. TypeScript 에러 확인: `npm run lint`
2. 타입 정의 확인 (`types/analytics.ts`)
3. 환경 변수 확인 (`.env.local`)

### 문제 5: Vercel 배포 실패

**증상**: Build 단계에서 실패

**해결**:

1. Vercel 환경 변수 설정 확인
2. 로컬에서 `npm run build` 성공 확인
3. Vercel 로그 확인
4. Node.js 버전 확인 (18+)

---

## ✅ 완료 체크리스트

### Phase 7 완료 기준

- [ ] Next.js 14 프로젝트 생성
- [ ] Supabase 연결 설정
- [ ] KPI 카드 4개 구현 (리드, 지출, CPL, CTR)
- [ ] 차트 2개 추가 (일별 트렌드, 플랫폼별)
- [ ] Top 광고 테이블 구현
- [ ] 로컬에서 정상 작동 확인
- [ ] Git 저장소 생성 및 커밋
- [ ] Vercel 배포 성공
- [ ] 배포된 URL에서 정상 작동 확인

---

## 🎯 다음 단계 (Phase 8)

Phase 7 완료 후 다음 작업:

1. **Supabase Auth 연동**
   - 로그인/로그아웃 기능
   - 사용자별 권한 관리

2. **필터링 기능**
   - 날짜 범위 선택
   - 플랫폼별 필터
   - 캠페인별 필터

3. **실시간 업데이트**
   - Supabase Realtime 구독
   - 자동 새로고침

4. **상세 페이지**
   - 캠페인 상세 분석
   - 광고 상세 분석

5. **개발 생산성 향상**
   - Supabase Type Generation (DB 스키마와 타입 동기화)
   - CI/CD 파이프라인 구축

---

## 📚 참고 자료

- **Next.js 14 공식 문서**: <https://nextjs.org/docs>
- **Supabase 공식 문서**: <https://supabase.com/docs>
- **Recharts 공식 문서**: <https://recharts.org/>
- **Tailwind CSS**: <https://tailwindcss.com/docs>
- **Vercel 배포 가이드**: <https://vercel.com/docs>

---

## 📂 최종 프로젝트 구조

```
F:/bas_meta/dashboard/
├── app/
│   ├── layout.tsx
│   ├── page.tsx
│   ├── loading.tsx
│   ├── error.tsx
│   └── globals.css
├── components/
│   ├── Header.tsx
│   ├── KPICard.tsx
│   ├── TrendChart.tsx
│   ├── PlatformChart.tsx
│   └── TopAdsTable.tsx
├── lib/
│   ├── supabase.ts
│   └── api.ts
├── types/
│   └── analytics.ts
├── .env.local
├── .gitignore
├── next.config.js
├── package.json
├── tailwind.config.ts
└── tsconfig.json
```

---

**작성자**: Claude
**프로젝트**: BAS Meta Ads Analytics
**Phase**: 7 (Dashboard Development)
**날짜**: 2025-11-19
**예상 소요 시간**: 3시간
