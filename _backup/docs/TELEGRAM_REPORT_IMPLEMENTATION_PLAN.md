# 텔레그램 봇 데이터 발송 기획 및 구현 계획

## 📋 현재 상태 분석

### ✅ 이미 구현된 기능 (telegram-cron.js v2.0)

#### 1. 리포트 구조
- **헤더**: 클라이언트명, 기간 표시
- **핵심 성과**: 지출, 리드, CPL, CTR, 노출수, 클릭수
- **전주 대비 변화**: 증감률 + 이모지 강조
- **AI 인사이트**: 자동 생성 (CPL/리드/CTR 분석)
- **광고별 성과**: Top 5 Best + Bottom 2 Worst
- **추천 액션**: 예산 증액/소재 개선 권장
- **대시보드 링크**: 파라미터화된 URL
- **푸터**: 발송 시각, 시스템 정보

#### 2. 자동화 스케줄
- **발송 주기**: 매주 월요일 09:00 (KST)
- **데이터 범위**: 지난주 월요일~일요일
- **스케줄러**: node-cron 사용

#### 3. 데이터 소스
- **Supabase**: `weekly_summary` 테이블
- **집계 방식**: Client별 주간 집계
- **비교 분석**: 전주 데이터와 비교

---

## 🎯 개선 제안 및 추가 기능

### 우선순위 1: 발송 방식 개선

#### 현재 문제점
1. **단일 발송**: 모든 클라이언트에게 동일한 Chat ID로 발송
2. **설정 부족**: 클라이언트별 알림 설정 불가
3. **대시보드 연동 부족**: 설정 페이지와 연동 없음

#### 개선 방안

##### A. 클라이언트별 Telegram Chat ID 관리
```sql
-- clients 테이블에 추가
ALTER TABLE clients ADD COLUMN telegram_chat_id TEXT;
ALTER TABLE clients ADD COLUMN telegram_notifications_enabled BOOLEAN DEFAULT false;
ALTER TABLE clients ADD COLUMN telegram_report_day INTEGER DEFAULT 1; -- 1=월요일
ALTER TABLE clients ADD COLUMN telegram_report_time TEXT DEFAULT '09:00';
```

##### B. 대시보드 설정 페이지 연동
- `/settings` 페이지에서 Telegram 설정 가능
- Chat ID 입력 + 알림 활성화 토글
- 발송 요일/시간 선택

##### C. 발송 방식 선택
**옵션 1: 개별 발송 (권장)**
```javascript
// 각 클라이언트의 telegram_chat_id로 개별 발송
for (const client of clients) {
  if (client.telegram_notifications_enabled && client.telegram_chat_id) {
    await sendTelegramReport(
      client.client_id,
      client.client_name,
      client.telegram_chat_id, // 개별 Chat ID
      weekStart,
      weekEnd
    );
  }
}
```

**옵션 2: 관리자 그룹 발송 (현재 방식)**
```javascript
// TELEGRAM_ADMIN_CHAT_ID로 모든 리포트 발송
// 장점: 중앙 관리 용이
// 단점: 클라이언트가 자신의 리포트만 받을 수 없음
```

---

### 우선순위 2: 발송 주기 다양화

#### 현재: 주간 리포트만 지원

#### 개선: 다양한 주기 지원

##### A. 일일 리포트
```javascript
// 매일 09:00 발송 (전날 데이터)
cron.schedule('0 9 * * *', async () => {
  await sendDailyReports();
}, { timezone: "Asia/Seoul" });
```

**일일 리포트 포맷 (간략화)**:
```
📊 [BAS] {클라이언트명} 일일 리포트
📅 {날짜}
━━━━━━━━━━━━━━━━━━━━━━

📈 어제의 성과

💰 지출: $XX.XX
🎯 리드: X건
💵 CPL: $XX.XX
📊 CTR: X.XX%

━━━━━━━━━━━━━━━━━━━━━━
📊 이번 주 누적 (월~금)

💰 총 지출: $XXX.XX
🎯 총 리드: XX건
💵 평균 CPL: $XX.XX

━━━━━━━━━━━━━━━━━━━━━━
🔗 상세 분석: [대시보드 링크]
```

##### B. 월간 리포트
```javascript
// 매월 1일 09:00 발송 (전월 데이터)
cron.schedule('0 9 1 * *', async () => {
  await sendMonthlyReports();
}, { timezone: "Asia/Seoul" });
```

**월간 리포트 포맷 (상세)**:
- 월간 총 성과
- 주간 추이 차트 (텍스트 그래프)
- 월별 Top 10 광고
- 플랫폼별 성과 비교
- 월간 인사이트 + 다음 달 전략

##### C. 실시간 알림 (선택)
```javascript
// CPL 급등/리드 급감 시 즉시 알림
if (currentCpl > prevCpl * 1.5) {
  await sendAlertNotification(
    "⚠️ CPL 50% 이상 급등 감지! 광고 점검이 필요합니다."
  );
}
```

---

### 우선순위 3: 차트 이미지 첨부

#### 현재: 텍스트만 발송

#### 개선: 차트 이미지 추가

##### A. 차트 생성 방법

**옵션 1: QuickChart API (권장)**
```javascript
const chartUrl = `https://quickchart.io/chart?c={
  type: 'line',
  data: {
    labels: ['월', '화', '수', '목', '금', '토', '일'],
    datasets: [{
      label: '리드 수',
      data: [5, 8, 3, 7, 6, 9, 4]
    }]
  }
}`;

// Telegram에 이미지로 발송
await sendPhoto(chatId, chartUrl, { caption: "📊 주간 리드 추이" });
```

**옵션 2: Puppeteer (서버 부담 큼)**
```javascript
// dashboard 페이지를 스크린샷으로 캡처
const browser = await puppeteer.launch();
const page = await browser.newPage();
await page.goto(`${DASHBOARD_URL}/?client=${clientId}`);
const screenshot = await page.screenshot();
```

##### B. 첨부할 차트 종류
1. **일별 리드 추이 차트** (Line Chart)
2. **플랫폼별 성과 비교** (Bar Chart)
3. **CPL 추이** (Line Chart)

---

### 우선순위 4: 인터랙티브 버튼

#### Telegram Inline Keyboard 활용

```javascript
const inlineKeyboard = {
  inline_keyboard: [
    [
      { text: "📊 대시보드 열기", url: dashboardLink },
      { text: "📥 엑셀 다운로드", url: excelDownloadLink }
    ],
    [
      { text: "🔔 알림 설정", callback_data: "settings" },
      { text: "📞 문의하기", url: "https://t.me/support" }
    ]
  ]
};

await sendMessage(chatId, message, { reply_markup: inlineKeyboard });
```

---

## 🚀 구현 단계별 계획

### Phase 1: 기본 배포 및 테스트 (즉시)
- [ ] 현재 `telegram-cron.js` Railway에 배포
- [ ] 환경 변수 설정 (TELEGRAM_BOT_TOKEN, TELEGRAM_ADMIN_CHAT_ID)
- [ ] Cron 스케줄 테스트 (수동 실행)
- [ ] 실제 리포트 발송 테스트

**필요한 환경 변수**:
```env
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_ADMIN_CHAT_ID=your_chat_id_here
DASHBOARD_URL=https://dashboard-3w3wrtt1k-mkt9834-4301s-projects.vercel.app
SUPABASE_URL=...
SUPABASE_SERVICE_KEY=...
```

### Phase 2: 대시보드 연동 (1주 이내)
- [ ] `clients` 테이블에 `telegram_chat_id`, `telegram_notifications_enabled` 컬럼 추가
- [ ] `/settings` 페이지에 Telegram 설정 UI 추가
- [ ] 개별 발송 로직 구현
- [ ] API 엔드포인트 추가: `/api/settings/telegram`

### Phase 3: 다양한 발송 주기 (2주 이내)
- [ ] 일일 리포트 구현
- [ ] 월간 리포트 구현
- [ ] 클라이언트별 발송 주기 설정 가능
- [ ] 발송 요일/시간 커스터마이징

### Phase 4: 고급 기능 (1개월 이내)
- [ ] 차트 이미지 첨부 (QuickChart)
- [ ] 인터랙티브 버튼
- [ ] 실시간 알림
- [ ] 리포트 피드백 수집

---

## 📝 발송 데이터 구조 정리

### 데이터 소스

#### 1. 주간 집계 데이터 (`weekly_summary` 테이블)
```sql
SELECT
  client_id,
  week_start,
  week_end,
  ad_name,
  total_spend,
  total_leads,
  avg_cpl,
  avg_ctr,
  total_impressions,
  total_clicks
FROM weekly_summary
WHERE client_id = ? AND week_start = ? AND week_end = ?
```

#### 2. 전주 비교 데이터
```sql
SELECT * FROM weekly_summary
WHERE client_id = ?
  AND week_start = DATE_SUB(?, INTERVAL 7 DAY)
  AND week_end = DATE_SUB(?, INTERVAL 7 DAY)
```

#### 3. 클라이언트 정보
```sql
SELECT
  client_id,
  client_name,
  telegram_chat_id,
  telegram_notifications_enabled
FROM clients
WHERE is_active = true
```

---

## 🔧 Railway 배포 가이드

### 1. Procfile 작성
```
worker: node telegram-cron.js
```

### 2. Railway 환경 변수 설정
```bash
railway variables set TELEGRAM_BOT_TOKEN="..."
railway variables set TELEGRAM_ADMIN_CHAT_ID="..."
railway variables set DASHBOARD_URL="https://dashboard-3w3wrtt1k-mkt9834-4301s-projects.vercel.app"
```

### 3. 배포 명령어
```bash
cd F:\bas_meta
railway up
```

### 4. 로그 확인
```bash
railway logs
```

---

## 💡 추천 발송 전략

### 옵션 A: 관리자 중심 (현재 방식, 빠른 구현)
- **대상**: TELEGRAM_ADMIN_CHAT_ID 하나로 모든 리포트 발송
- **장점**: 중앙 관리 용이, 빠른 배포
- **단점**: 클라이언트별 개별 수신 불가
- **적합**: 클라이언트 5개 이하, 내부 팀 확인용

### 옵션 B: 클라이언트별 개별 발송 (권장)
- **대상**: 각 클라이언트의 telegram_chat_id로 개별 발송
- **장점**: 클라이언트가 자신의 데이터만 수신
- **단점**: 설정 페이지 구현 필요
- **적합**: 클라이언트 10개 이상, 서비스 확장 시

### 옵션 C: 하이브리드
- **대상**: 관리자 그룹 + 클라이언트 개별 동시 발송
- **장점**: 중앙 관리 + 클라이언트 만족도
- **단점**: 발송량 2배
- **적합**: 프리미엄 서비스

---

## 🎯 의사결정이 필요한 사항

### 1. 발송 방식
- [ ] **옵션 A**: 관리자 그룹으로만 발송 (빠른 구현)
- [ ] **옵션 B**: 클라이언트별 개별 발송 (권장)
- [ ] **옵션 C**: 하이브리드 (관리자 + 클라이언트)

### 2. 발송 주기
- [ ] 주간 리포트만 (현재)
- [ ] 주간 + 일일 리포트
- [ ] 주간 + 일일 + 월간 리포트

### 3. 차트 이미지
- [ ] 텍스트만 (현재, 가볍고 빠름)
- [ ] QuickChart API로 차트 첨부 (권장)
- [ ] Puppeteer 스크린샷 (고급, 서버 부담)

### 4. 인터랙티브 기능
- [ ] 텍스트 + 링크만 (현재)
- [ ] Inline Keyboard 버튼 추가 (권장)
- [ ] 챗봇 명령어 지원 (고급)

---

## 📊 예상 효과

### Phase 1 구현 시
- ✅ 매주 자동으로 성과 리포트 수신
- ✅ 수동 작업 시간 80% 절감
- ✅ 데이터 기반 의사결정 속도 향상

### Phase 2 구현 시
- ✅ 클라이언트 만족도 향상
- ✅ 셀프 서비스 가능 (설정 페이지)
- ✅ 관리 부담 감소

### Phase 3-4 구현 시
- ✅ 시각적 인사이트 제공 (차트)
- ✅ 사용자 경험 향상 (버튼)
- ✅ 실시간 대응 가능 (알림)

---

## 🚀 다음 액션

### 즉시 실행 가능
1. **BotFather로 봇 생성** (아직 없는 경우)
2. **Chat ID 확인** (본인 또는 그룹)
3. **Railway 환경 변수 설정**
4. **테스트 발송** (수동 실행)
5. **Cron 배포** (자동 발송)

### 준비사항
```bash
# 1. BotFather로 봇 생성
/newbot
Bot Name: BAS Meta Ads Report Bot
Username: bas_meta_ads_bot

# 2. Bot Token 복사
Your bot token: 123456789:ABCdefGHIjklMNOpqrsTUVwxyz

# 3. Chat ID 확인
https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates

# 4. Railway에 설정
railway variables set TELEGRAM_BOT_TOKEN="123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
railway variables set TELEGRAM_ADMIN_CHAT_ID="your_chat_id"
```

---

**작성일**: 2025-11-21
**버전**: 1.0
**담당**: Claude Code Agent
