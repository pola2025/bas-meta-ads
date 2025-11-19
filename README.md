# BAS Meta Ads Analytics Platform

**자동화된 Meta 광고 분석 및 대시보드 플랫폼**

Meta(Facebook/Instagram) 광고 데이터를 자동 수집하여 Supabase에 저장하고, Next.js 대시보드로 시각화하는 SaaS 플랫폼입니다.

---

## 🚀 프로젝트 개요

### 핵심 기능

- ✅ **자동 데이터 수집**: 매주 월요일 09:00 자동 실행 (Job Queue)
- ✅ **실시간 분석**: 주간/월간/분기/연간 통계 자동 집계
- ✅ **웹 대시보드**: Next.js 14 + Supabase
- ✅ **멀티 클라이언트**: 여러 광고주 동시 관리
- ✅ **자동 알림**: Telegram 주간 리포트

### 기술 스택

| 분류 | 기술 |
|------|------|
| **Backend** | Node.js 20, BullMQ, Upstash Redis |
| **Database** | Supabase (PostgreSQL 15 + pg_cron) |
| **Frontend** | Next.js 14, Tailwind CSS, Recharts |
| **Deploy** | Railway (Worker), Vercel (Dashboard) |
| **Queue** | BullMQ + Upstash Redis |

---

## 📁 프로젝트 구조

```
bas_meta/
├── docs/
│   ├── PROJECT_SPECIFICATION.md    # 📋 전체 프로젝트 기획서
│   └── IMPLEMENTATION_GUIDE.md     # 🔧 구현 가이드
├── lib/
│   ├── producer.js                 # Job Queue Producer
│   ├── worker.js                   # Job Queue Worker (TODO)
│   ├── token-manager.js            # Access Token 자동 갱신
│   ├── chart-generator.js          # 차트 이미지 생성
│   ├── meta.js                     # Meta API 클라이언트
│   └── telegram.js                 # Telegram 알림
├── sql/
│   ├── 01_schema.sql               # DB 스키마 (TODO)
│   └── 02_functions_timezone.sql   # SQL Functions (pg_cron)
├── .env.example                    # 환경 변수 템플릿
├── package.json
└── README.md                       # 이 파일
```

---

## 🛠️ 개발 시작하기

### 1. 환경 변수 설정

`.env.example`을 복사하여 `.env` 파일 생성:

```bash
cp .env.example .env
```

필수 환경 변수:
- `META_APP_ID`, `META_APP_SECRET`: Meta 앱 정보
- `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`: Supabase 프로젝트
- `UPSTASH_REDIS_URL`: Upstash Redis (Job Queue)
- `TELEGRAM_BOT_TOKEN`, `TELEGRAM_ADMIN_CHAT_ID`: 알림용

### 2. Dependencies 설치

```bash
npm install
```

### 3. Supabase 설정

1. Supabase 프로젝트 생성
2. SQL 스크립트 실행:
   - `sql/01_schema.sql` (스키마)
   - `sql/02_functions_timezone.sql` (Functions + pg_cron)

### 4. 로컬 테스트

```bash
# Producer 테스트
node lib/producer.js

# Token 갱신 테스트
node lib/token-manager.js
```

---

## 📚 문서

| 문서 | 설명 |
|------|------|
| [PROJECT_SPECIFICATION.md](docs/PROJECT_SPECIFICATION.md) | 전체 프로젝트 기획서 (v1.1) |
| [IMPLEMENTATION_GUIDE.md](docs/IMPLEMENTATION_GUIDE.md) | 단계별 구현 가이드 |

---

## 🗓️ 개발 로드맵

### Phase 1: MVP (3주) - 목표: 2025년 12월 9일

- **Week 1**: Supabase + Job Queue 인프라
- **Week 2**: 데이터 수집 자동화
- **Week 3**: 웹 대시보드

### Phase 2: 고급 기능 (2주) - 목표: 2025년 12월 23일

- 차트 시각화
- PDF + Telegram 리포트

### Phase 3: 멀티 클라이언트 (2주) - 목표: 2026년 1월 6일

- JWT 인증
- Admin 패널

---

## 💰 비용

| 단계 | 클라이언트 수 | 월 비용 |
|------|--------------|---------|
| **MVP** | 1~10 | $10 |
| **성장** | 10~50 | $30 |
| **확장** | 50~100 | $65 |

---

## 🔒 보안

- ✅ Supabase Vault: Access Token 암호화 저장
- ✅ Row Level Security: 클라이언트별 데이터 격리
- ✅ JWT: 웹 대시보드 인증
- ✅ OAuth: Meta Token 자동 갱신

---

## 📞 문의

프로젝트 관련 문의: [이슈 등록](https://github.com/yourorg/bas-meta/issues)

---

**버전**: 1.1.0
**최종 업데이트**: 2025-11-18
