# BAS Meta Ads Dashboard

Next.js 14 기반 메타 광고 성과 분석 대시보드

![Next.js](https://img.shields.io/badge/Next.js-14.2-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-38B2AC?logo=tailwind-css)
![Supabase](https://img.shields.io/badge/Supabase-Latest-3ECF8E?logo=supabase)

## 📊 주요 기능

- **KPI 카드 4개**: 총 리드, 총 지출, 평균 CPL, 평균 CTR
- **차트 2개**: 일별 트렌드 (최근 7일), 플랫폼별 성과 (최근 30일)
- **Top 광고 테이블**: 최근 7일 성과 Top 10

## 기술 스택

- **Frontend**: Next.js 14 (App Router), React 18, TypeScript
- **Styling**: Tailwind CSS
- **Charts**: Recharts
- **Database**: Supabase (PostgreSQL)
- **Data Source**: Meta Ads API

## 주요 기능

### 1. KPI Cards (핵심 지표)
- 총 지출 (Total Spend)
- 총 리드 (Total Leads)
- 평균 CPL (Average Cost Per Lead)
- 평균 CTR (Average Click-Through Rate)
- 전기 대비 증감률 표시

### 2. CPL 추이 차트
- 주간별 CPL 변화 추이
- Line Chart로 시각화
- 리드 수와 함께 표시

### 3. 광고별 성과 차트
- 광고별 CPL 순위 (낮은 순)
- Horizontal Bar Chart
- CPL 범위별 색상 구분:
  - 녹색: $0-20 (우수)
  - 파란색: $20-40 (양호)
  - 주황색: $40-60 (주의)
  - 빨간색: $60+ (위험)

## 프로젝트 구조

```
dashboard/
├── app/
│   ├── api/
│   │   ├── kpis/route.ts           # KPI 데이터 API
│   │   ├── cpl-trend/route.ts      # CPL 추이 API
│   │   └── ad-performance/route.ts # 광고 성과 API
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx                     # 메인 대시보드
├── components/
│   ├── charts/
│   │   ├── CPLTrendChart.tsx       # CPL 추이 차트
│   │   └── AdPerformanceChart.tsx  # 광고 성과 차트
│   └── KPICard.tsx                 # KPI 카드 컴포넌트
├── lib/
│   └── supabase.ts                 # Supabase 클라이언트
└── package.json
```

## 설치 및 실행

### 1. 의존성 설치
```bash
cd F:/bas_meta/dashboard
npm install
```

### 2. 환경 변수 설정
`.env.local` 파일이 자동으로 생성되어 있습니다.
- `NEXT_PUBLIC_SUPABASE_URL`: Supabase URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Supabase Anon Key

### 3. 개발 서버 실행
```bash
npm run dev
```

브라우저에서 http://localhost:3000 접속

### 4. 빌드 (프로덕션)
```bash
npm run build
npm start
```

## API 엔드포인트

### GET /api/kpis
핵심 지표 조회

**Query Parameters:**
- `start`: 시작일 (YYYY-MM-DD)
- `end`: 종료일 (YYYY-MM-DD)

**Response:**
```json
{
  "total_spend": 1234.56,
  "total_leads": 50,
  "avg_cpl": 24.69,
  "avg_ctr": 2.34,
  "changes": {
    "spend_change": 12.3,
    "leads_change": 25.0,
    "cpl_change": -8.5,
    "ctr_change": 5.2
  }
}
```

### GET /api/cpl-trend
CPL 추이 데이터

**Query Parameters:**
- `start`: 시작일 (YYYY-MM-DD)
- `end`: 종료일 (YYYY-MM-DD)

**Response:**
```json
[
  {
    "week": "11. 4.",
    "cpl": 19.57,
    "leads": 25
  }
]
```

### GET /api/ad-performance
광고별 성과 데이터

**Query Parameters:**
- `start`: 시작일 (YYYY-MM-DD)
- `end`: 종료일 (YYYY-MM-DD)
- `limit`: 결과 개수 (기본: 10)

**Response:**
```json
[
  {
    "ad_name": "20251115_고객이찾아오는영업",
    "avg_cpl": 19.57,
    "total_leads": 25,
    "total_spend": 489.25
  }
]
```

## 데이터 소스

### Supabase Tables
- `weekly_summary`: 주간 집계 데이터
  - client_id: 클라이언트 ID
  - ad_name: 광고명
  - week_start, week_end: 주간 범위
  - total_spend, total_leads: 총계
  - avg_cpl, avg_ctr: 평균값

### 현재 데이터
- Client ID: `79e35fc6-a817-4ccc-9d5d-9a93c1ad4515`
- 기간: 2025년 11월
- 광고 수: 12개

## 디자인 시스템

### 색상 팔레트
```css
--cpl-excellent: #10B981  /* 녹색 - $0-20 */
--cpl-good: #3B82F6       /* 파란색 - $20-40 */
--cpl-warning: #F59E0B    /* 주황색 - $40-60 */
--cpl-danger: #EF4444     /* 빨간색 - $60+ */
```

### 반응형 디자인
- Desktop: 4 컬럼 레이아웃
- Tablet: 2 컬럼 레이아웃
- Mobile: 1 컬럼 스택

## 다음 개선 사항

### 단기 (Phase 5 완료용)
- [ ] 날짜 범위 선택 필터 추가
- [ ] 9월, 10월 데이터 추가 후 3개월 비교
- [ ] 광고 상세 페이지 (`/ads/[ad_id]`)

### 중기
- [ ] 플랫폼별 성과 (Facebook vs Instagram)
- [ ] 디바이스별 성과 (Desktop vs Mobile)
- [ ] 캠페인별 그룹핑
- [ ] 데이터 내보내기 (CSV, Excel)

### 장기
- [ ] 실시간 데이터 업데이트 (Supabase Realtime)
- [ ] 알림 설정 (CPL 임계값 초과 시)
- [ ] 다중 클라이언트 지원
- [ ] 사용자 인증 및 권한 관리

## 배포

### Vercel (권장)
```bash
npm install -g vercel
vercel
```

### 환경 변수 설정
Vercel 대시보드에서 다음 환경 변수 추가:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## 문제 해결

### 데이터가 안 보일 때
1. Supabase 연결 확인
2. 환경 변수 확인 (`.env.local`)
3. 브라우저 콘솔에서 에러 확인
4. API 엔드포인트 직접 테스트: http://localhost:3000/api/kpis

### 차트가 안 그려질 때
1. 데이터 형식 확인 (API 응답)
2. Recharts 버전 확인
3. 브라우저 콘솔에서 에러 확인

## 라이선스

MIT

## 작성자

BAS Meta Ads Analytics Team
