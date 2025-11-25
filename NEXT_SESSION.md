# 다음 세션 작업 요청

**작성일**: 2025-11-25
**이전 세션 완료**: 월간 리포트 구현, 리포트 아카이브 대시보드 페이지 생성

---

## 🎯 다음 세션 첫 번째 요청

```
리포트 아카이브 기능 완성해줘.

필요한 작업:
1. Supabase에 report_data JSONB 컬럼 추가 (SQL 실행 필요)
2. 구조화된 데이터로 리포트 재발송 테스트
3. Vercel 배포 및 확인

참고:
- SQL: ALTER TABLE telegram_reports ADD COLUMN IF NOT EXISTS report_data JSONB;
- 테스트 채널: -1003394139746
```

---

## ✅ 이번 세션 완료 내용

### 1. 월간 리포트 구현
- `send-monthly-report.js` 생성
- `MONTHLY_REPORT_SPEC.md` 명세서 작성
- 4개 메시지 구조 (헤더/요약, 주별 트렌드, 광고/캠페인, AI 인사이트)
- 요일별 패턴 분석 추가

### 2. 리포트 저장 시스템
- `lib/report-storage.js` 모듈 생성
- `telegram_reports` 테이블 생성 (Supabase)
- 주간/월간 리포트 자동 저장 기능

### 3. 대시보드 리포트 페이지 (미완성)
- `/reports` 페이지 생성
- 탭 구조: 개요(차트), 광고별(테이블), 캠페인별(파이차트+테이블), 원본
- 구조화된 JSON 데이터 시각화 준비

### 4. 구조화된 데이터 저장 (미완성)
- `report_data` JSONB 컬럼 추가 필요
- 광고별, 캠페인별, 일별/주별 데이터 JSON 저장

---

## 📊 데이터 현황

```
저장된 리포트:
- 월간: 2025-05 (리드 86건, $1,410.63) - 구조화 데이터 없음
- 주간: 2025-11-17~23 (리드 16건, $409.53) - 구조화 데이터 없음
```

---

## 🗂️ 주요 파일

| 파일 | 용도 |
|------|------|
| `send-monthly-report.js` | 월간 리포트 발송 |
| `send-weekly-report.js` | 주간 리포트 발송 |
| `lib/report-storage.js` | 리포트 DB 저장 모듈 |
| `MONTHLY_REPORT_SPEC.md` | 월간 리포트 명세서 |
| `WEEKLY_REPORT_SPEC.md` | 주간 리포트 명세서 |
| `dashboard/app/reports/page.tsx` | 리포트 아카이브 페이지 |
| `sql/13_add_report_data_column.sql` | report_data 컬럼 추가 SQL |

---

## 📱 텔레그램 채널

- 테스트: `-1003394139746`
- 운영: `-1002733338460`

---

## 🔧 남은 작업

### 즉시 필요
1. Supabase에 `report_data` JSONB 컬럼 추가
2. 리포트 재발송 (구조화 데이터 포함)
3. Vercel 배포

### 향후 고려
- 리포트 수동 생성 기능
- 리포트 재발송 기능
- 리포트 PDF 다운로드
- 리포트 비교 기능

---

## 🚀 실행 명령어

```bash
# Supabase 컬럼 추가 후 테스트
REPORT_MONTH=2025-05 TELEGRAM_CHAT_ID=-1003394139746 node send-monthly-report.js

# 주간 리포트 테스트
TELEGRAM_CHAT_ID=-1003394139746 node send-weekly-report.js

# Vercel 배포
cd dashboard && git add . && git commit -m "feat: 리포트 페이지 차트/테이블 시각화" && git push
```
