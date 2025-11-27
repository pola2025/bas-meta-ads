# 다음 세션 작업 요청

> **작성일**: 2025-11-26
> **프로젝트**: BAS Meta Ads Analytics

---

## ✅ 완료된 작업 (2025-11-26)

### Phase 2: Admin 대시보드 API 구현 완료

**생성된 API 엔드포인트:**

| 경로 | 메서드 | 기능 |
|------|--------|------|
| `/api/admin/clients` | GET | 클라이언트 목록 조회 (데이터 현황 포함) |
| `/api/admin/clients` | POST | 클라이언트 추가 (토큰 검증 자동 실행) |
| `/api/admin/clients/[id]` | GET | 클라이언트 상세 조회 |
| `/api/admin/clients/[id]` | PATCH | 클라이언트 수정 |
| `/api/admin/clients/[id]` | DELETE | 클라이언트 삭제 |
| `/api/admin/status` | GET | 시스템 전체 상태 조회 |
| `/api/admin/backfill` | GET | 백필 가능 여부 확인 |
| `/api/admin/backfill` | POST | **SSE 실시간 로그 백필** |

**주요 기능:**
1. ✅ 토큰 자동 검증 - 클라이언트 추가 시 Meta API 토큰 유효성 검사
2. ✅ SSE 실시간 로그 - 백필 실행 시 터미널처럼 실시간 로그 스트리밍
3. ✅ 90일 초과 자동 분할 - 180일, 1년 백필도 30일 단위로 자동 분할
4. ✅ 시스템 현황 대시보드 - 활성 클라이언트, 데이터 수집, 7일 성과, 경고 알림
5. ✅ **Rate Limit 감지 및 1시간 타이머**
   - Meta API Rate Limit 발생 시 자동 감지 (코드 4, 17, 32, 613)
   - 관리자 텔레그램 알림 발송
   - 1시간 카운트다운 타이머 UI (HH:MM:SS)
   - 타이머 종료 후 자동 재시도

**Admin UI 업데이트:**
- 시스템 현황 카드 (접기/펼치기)
- 클라이언트별 데이터 건수, 최신 데이터 날짜 표시
- 백필 모달 (SSE 실시간 로그 터미널)
- 기간 프리셋 (7일, 30일, 90일, 180일, 1년)
- Rate Limit 타이머 시각화 + 진행 바

---

## 🎯 다음 세션 작업 후보

### Option 1: Phase 3 - 영상 데이터 수집
```javascript
// Meta API 필드 추가
fields: '...,video_avg_time_watched_actions,video_p25_watched_actions,video_p50_watched_actions,video_p75_watched_actions,video_p100_watched_actions'
```
- DB 스키마 수정 (video_views, video_avg_time 등)
- VIEW 및 대시보드 영상 지표 표시

### Option 2: CLI 도구 Railway 배포
- `add-client.js`, `backfill-cli.js`, `status.js` Railway 배포
- Cron Job으로 자동 데이터 수집

### Option 3: 대시보드 고급 기능
- 클라이언트별 상세 페이지
- 기간별 비교 차트
- CSV/Excel 내보내기

### Option 4: 텔레그램 봇 고도화
- 대화형 명령어 (`/status`, `/backfill` 등)
- 일일 자동 리포트 스케줄링

---

## 📁 프로젝트 구조

```
bas_meta/
├── dashboard/           # Next.js 대시보드 (Vercel 배포)
│   ├── app/
│   │   ├── admin/       # Admin 페이지
│   │   └── api/
│   │       ├── admin/   # ✅ 신규 Admin API
│   │       │   ├── clients/
│   │       │   ├── backfill/
│   │       │   └── status/
│   │       └── ...
│   └── lib/
├── lib/                 # 공통 라이브러리
├── sql/                 # SQL 스키마
├── _backup/             # 미사용 파일 백업
├── OPERATION_GUIDE.md   # 운영 기획서
└── NEXT_SESSION.md      # 이 파일
```

---

## ⚠️ 주의사항

1. **텔레그램 발송 테스트 시 항상 테스트 채팅 ID 사용**
2. **백필 알림은 관리자 채널만** (`-1003394139746`)
3. **클라이언트 채널로 테스트 메시지 발송 금지**

---

## 🚀 다음 세션 시작 명령

```
다음 작업 진행해줘. Option 선택하거나 새 요청 알려줘.
```
