# 월간 리포트 개선 기획서

**작성일**: 2025-11-26
**목적**: 월간 리포트 양식 개선 및 일관성 확보

---

## 1. 현재 상황 분석

### 1.1 월간 리포트 현황
- **파일**: `send-monthly-report.js`
- **구조**: 4개 메시지로 분할 발송 (MarkdownV2)
- **저장**: `telegram_reports` 테이블에 `report_data` JSON으로 저장
- **문제**:
  - `message_content` 필드 비어있음 (텍스트 미저장)
  - 주차 표기가 ISO 주차 (41주차, 42주차 등)

### 1.2 주간 리포트 현황 (참고)
- **파일**: `send-weekly-report.js`
- **구조**: 단일 메시지 (253자 내외)
- **문제**: "W43 주간 리포트" 형태 (ISO 주차)

### 1.3 저장된 10월 데이터
```json
{
  "summary": {
    "leads": 164,
    "spend": 2782.51,
    "cpl": 16.97,
    "ctr": 2.82,
    "conversion_rate": 13.49
  },
  "weekly_stats": [
    { "week": 41, "label": "10-06 ~ 10-12", "leads": 45, "cpl": 15.63 },
    { "week": 42, "label": "10-13 ~ 10-19", "leads": 42, "cpl": 15.31 },
    { "week": 43, "label": "10-20 ~ 10-26", "leads": 39, "cpl": 12.76 },
    { "week": 44, "label": "10-27 ~ 11-02", "leads": 18, "cpl": 35.15 }
  ],
  "ad_performance": [8개 광고],
  "day_of_week_stats": [7일],
  "campaign_performance": []
}
```

---

## 2. 개선 목표

### 2.1 주차 형식 변경
| 현재 | 개선 후 |
|------|---------|
| 41주차 (10-06 ~ 10-12) | 1주차 (10/06~10/12) |
| 42주차 (10-13 ~ 10-19) | 2주차 (10/13~10/19) |
| 43주차 (10-20 ~ 10-26) | 3주차 (10/20~10/26) |
| 44주차 (10-27 ~ 11-02) | 4주차 (10/27~11/02) |

**원칙**: 해당 월 기준 1주차부터 시작 (ISO 주차 번호 사용 X)

### 2.2 월간 리포트 상세화
주간 리포트보다 더 상세한 정보 포함:
- ✅ 전월 대비 변화율
- ✅ 주차별 트렌드 (이모지 막대 그래프)
- ✅ 요일별 패턴 분석
- ✅ TOP 5 광고 성과
- ✅ 캠페인별 예산 효율성
- ✅ AI 인사이트 (Gemini)
- 🆕 대시보드 링크 추가

### 2.3 대시보드 URL 업데이트
```
현재: (없음 또는 구버전)
변경: https://bas-meta-ads-git-main-mkt9834-4301s-projects.vercel.app
```

### 2.4 텔레그램 채널 정리

#### 환경변수 체계
| 환경변수 | 용도 | 설명 |
|----------|------|------|
| `TELEGRAM_ADMIN_CHAT_ID` | 본 채널 | 실제 리포트 발송 대상 |
| `TELEGRAM_ERROR_CHAT_ID` | 에러 알림 | 시스템 오류 알림용 |
| `TELEGRAM_CHAT_ID` | 일반 발송 | 리포트 발송 시 우선 사용 |

#### 테스트 채널
- **테스트 채널 ID**: `-1003394139746`
- 테스트 시 `TELEGRAM_CHAT_ID=-1003394139746` 환경변수로 지정
- 실수 방지를 위해 본채널 ID는 항상 환경변수로만 사용

#### 파일별 사용 현황
| 파일 | 사용 환경변수 |
|------|--------------|
| `send-monthly-report.js` | `TELEGRAM_CHAT_ID` > `TELEGRAM_ADMIN_CHAT_ID` > `TELEGRAM_CHANNEL_ID` |
| `send-weekly-report.js` | `TELEGRAM_CHAT_ID` > `TELEGRAM_ADMIN_CHAT_ID` > `TELEGRAM_CHANNEL_ID` |
| `telegram-cron.js` | `TELEGRAM_ADMIN_CHAT_ID` |
| `lib/telegram-notifier.js` | `TELEGRAM_ERROR_CHAT_ID` > `TELEGRAM_ADMIN_CHAT_ID` |

---

## 3. 수정 대상 파일

### 3.1 `send-monthly-report.js`
- [ ] `getWeekRanges()` 함수: week 번호를 1부터 시작하도록 변경
- [ ] `generateTelegramMessages()`: 주차 라벨 형식 변경
- [ ] 대시보드 URL 추가
- [ ] 메시지 합본 저장 (message_text 필드)

### 3.2 `lib/monthly-summary.js`
- [ ] 주차 라벨 형식 통일

### 3.3 `send-weekly-report.js`
- [ ] 대시보드 URL 추가 (선택)

---

## 4. 구현 계획

### Phase 1: 주차 형식 변경
1. `getWeekRanges()` 함수 수정
   - `week: 41` → `week: 1` (월 기준)
   - `label: "10-06 ~ 10-12"` → `label: "10/06~10/12"`

2. `generateTelegramMessages()` 수정
   - "41주차" → "1주차"

### Phase 2: 대시보드 URL 추가
1. 환경변수 또는 상수로 정의
   ```javascript
   const DASHBOARD_URL = 'https://bas-meta-ads-git-main-mkt9834-4301s-projects.vercel.app';
   ```

2. 메시지 4 (AI 인사이트 섹션)에 링크 추가
   ```
   📊 상세 대시보드: {DASHBOARD_URL}
   ```

### Phase 3: 10월 리포트 재생성
1. 테스트 채널(-1003394139746)로 먼저 발송
2. 확인 후 필요시 본채널 발송

### Phase 4: 저장 로직 개선
1. 4개 메시지 합쳐서 `message_text`에 저장
2. 기존 `report_data` JSON 구조 유지

---

## 5. 테스트 계획

### 5.1 단위 테스트
```bash
# 주차 계산 테스트
node -e "
const getWeekRanges = require('./send-monthly-report.js').getWeekRanges;
console.log(getWeekRanges(2025, 10));
"
```

### 5.2 통합 테스트
```bash
# 테스트 채널로 10월 리포트 발송
REPORT_MONTH=2025-10 TELEGRAM_CHAT_ID=-1003394139746 node send-monthly-report.js
```

### 5.3 검증 항목
- [ ] 주차 번호가 1~5로 표시되는지
- [ ] 대시보드 링크 클릭 가능한지
- [ ] 모든 데이터가 정확히 표시되는지
- [ ] AI 인사이트가 정상 생성되는지

---

## 6. 롤백 계획

문제 발생 시:
1. `send-monthly-report.js.bak` 복원
2. 또는 git checkout으로 이전 버전 복구

---

## 7. 일정

| 단계 | 작업 | 예상 시간 |
|------|------|----------|
| 1 | 기획서 작성 | ✅ 완료 |
| 2 | 주차 형식 변경 | 10분 |
| 3 | 대시보드 URL 추가 | 5분 |
| 4 | 10월 리포트 재생성 (테스트) | 5분 |
| 5 | 검증 및 본채널 발송 (선택) | 5분 |

---

## 8. 참고 사항

### 8.1 관련 파일 구조
```
F:\bas_meta\
├── send-monthly-report.js    # 메인 월간 리포트
├── send-weekly-report.js     # 주간 리포트
├── lib/
│   ├── monthly-summary.js    # 월간 요약 로직
│   ├── report-storage.js     # 리포트 저장
│   └── telegram-notifier.js  # 텔레그램 알림
└── docs/
    └── MONTHLY_REPORT_IMPROVEMENT.md  # 이 문서
```

### 8.2 환경변수
```env
TELEGRAM_BOT_TOKEN=xxx
TELEGRAM_ADMIN_CHAT_ID=xxx (본채널)
TELEGRAM_CHAT_ID=xxx (발송 대상)
GEMINI_API_KEY=xxx
SUPABASE_URL=xxx
SUPABASE_SERVICE_KEY=xxx
```

---

**작성자**: Claude AI
**최종 수정**: 2025-11-26
