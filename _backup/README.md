# 📦 _backup - 미사용 파일 백업

> **주의**: 이 폴더의 파일들은 현재 시스템에서 사용되지 않습니다.
> 삭제해도 시스템 운영에 영향 없음.

---

## 폴더 구조

```
_backup/
├── scripts/      # 레거시/일회성 스크립트 (56개)
├── lib/          # Redis 의존 라이브러리 (4개)
├── docs/         # 이전 프로젝트 문서들
│   └── 회고/     # 작업 회고록
└── sql/          # (비어있음)
```

---

## scripts/ - 레거시 스크립트

### 데이터 수집 (레거시)
- `collect-direct.js` - 비즈액터스쿨 단일 수집 → `collect-all-clients.js`로 대체
- `telegram-cron.js`, `telegram-cron-v1-backup.js`, `telegram-cron-v2.js` - 이전 버전

### 일회성 마이그레이션
- `apply-*.js`, `run-*.js`, `execute-sql.js` - DB 마이그레이션 (완료됨)
- `create-*.js` - 테이블/뷰 생성 (완료됨)

### 집계/수정 (레거시)
- `aggregate-*.js` - 이전 집계 로직 (VIEW로 대체)
- `fix-*.js` - 일회성 데이터 수정

### 테스트
- `test-*.js` - 개발 중 테스트용 (56개 파일)

### 토큰/클라이언트 설정
- `exchange-token*.js`, `save-token-to-vault.js` - 토큰 설정
- `insert-test-client.js`, `update-client-*.js` - 클라이언트 설정

---

## lib/ - Redis 의존 라이브러리

> Redis/BullMQ 사용 시절의 라이브러리. 현재는 직접 실행 방식 사용.

- `producer.js` - BullMQ 작업 큐 추가
- `worker.js` - BullMQ 작업 처리
- `aggregation-worker.js` - 집계 워커
- `worker.js.backup` - 백업

---

## docs/ - 이전 문서

### 에이전트/스킬 관련
- `AGENT_*.md`, `PLANNING_*.md`, `WEB_SERVICE_*.md`
- `*_SKILLS_*.md`, `RECOMMENDED_SKILLS_ANALYSIS.md`

### 프로젝트 진행 기록
- `PHASE*.md` - Phase 1~9 진행 문서
- `BACKFILL_PROGRESS.md` - 백필 진행 상황
- `PROJECT_STATUS_REPORT.md` - 프로젝트 상태

### 인프라/배포 가이드
- `RAILWAY_*.md` - Railway 설정
- `SUPABASE_*.md` - Supabase 설정
- `CLOUDFLARE_WORKERS_MIGRATION.md` - CF Workers 검토

### 기능 스펙
- `TELEGRAM_*.md` - 텔레그램 리포트
- `*_REPORT_*.md` - 리포트 설계
- `MULTI_CLIENT_DASHBOARD_SPEC.md` - 대시보드 스펙

### 회고/
- `작업회고-*.md` - 일일 작업 회고록 (20개)
- `다음세션-*.md` - 세션 인계 문서

---

## 복원이 필요할 때

특정 파일이 필요하면 루트로 복사:
```bash
cp _backup/scripts/파일명.js ./
cp _backup/lib/파일명.js ./lib/
```

---

**생성일**: 2025-11-26
