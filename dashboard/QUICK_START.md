# Quick Start Guide

BAS Meta Ads Dashboard를 5분 안에 실행하는 방법

## 1. 의존성 설치

```bash
cd F:/bas_meta/dashboard
npm install
```

## 2. 환경 변수 확인

`.env.local` 파일이 이미 생성되어 있습니다. 확인만 하세요:

```env
NEXT_PUBLIC_SUPABASE_URL=https://mpljqcuqrrfwzamfyxnz.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[service_role_key]
```

## 3. 개발 서버 실행

```bash
npm run dev
```

## 4. 브라우저 접속

http://localhost:3000 (또는 3001, 3002)

## 5. 확인 사항

대시보드에서 다음을 확인하세요:

- [x] 4개 KPI Cards (총 지출, 리드, CPL, CTR)
- [x] CPL 추이 Line Chart
- [x] 광고별 성과 Horizontal Bar Chart

## API 테스트

### KPI 조회
```bash
curl "http://localhost:3000/api/kpis?start=2025-11-01&end=2025-11-30"
```

### CPL 추이
```bash
curl "http://localhost:3000/api/cpl-trend?start=2025-11-01&end=2025-11-30"
```

### 광고 성과
```bash
curl "http://localhost:3000/api/ad-performance?start=2025-11-01&end=2025-11-30&limit=10"
```

## 트러블슈팅

### 데이터가 안 보일 때
1. 브라우저 콘솔 확인 (F12)
2. Supabase 연결 확인
3. 환경 변수 확인

### 포트 충돌
- Next.js가 자동으로 다른 포트로 변경합니다
- 터미널에서 실제 포트 확인: `Local: http://localhost:XXXX`

## 다음 단계

자세한 내용은 다음 문서를 참고하세요:

- `README.md`: 전체 프로젝트 문서
- `PROJECT_SUMMARY.md`: 프로젝트 완료 보고서

---

**도움이 필요하면**: 터미널 출력 또는 브라우저 콘솔 에러 메시지를 공유해주세요.
