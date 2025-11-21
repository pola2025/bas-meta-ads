# 텔레그램 봇 Railway 배포 가이드

## 현재 상태 확인 ✅

### 1. 코드 준비 완료
- ✅ `telegram-cron.js` - 주간 리포트 자동 발송 스크립트
- ✅ `Procfile` - Railway 배포 설정 (`cron: node telegram-cron.js`)
- ✅ 모든 의존성 설치 완료 (`node-cron`, `@supabase/supabase-js` 등)

### 2. Railway 환경 변수 설정 완료
현재 Railway에 다음 변수들이 이미 설정되어 있습니다:

```
✅ TELEGRAM_BOT_TOKEN=7947112373:AAEs5o3fcm0JoPewh7K5YTUwzq4poWw97pY
✅ TELEGRAM_ADMIN_CHAT_ID=-1003394139746
✅ SUPABASE_URL=https://mpljqcuqrrfwzamfyxnz.supabase.co
✅ SUPABASE_SERVICE_KEY=[설정됨]
✅ DASHBOARD_URL=[기본값: https://bas-dashboard.vercel.app]
```

### 3. 기존 Railway 서비스
```
1. bas-meta-ads (Worker)
2. bas-meta-ads-dashboard
3. bas-meta-ads-producer
```

---

## 배포 방법

### 옵션 A: 기존 서비스 재활용 (권장)

**bas-meta-ads-producer** 서비스를 telegram-cron으로 전환:

1. Railway 대시보드에서 `bas-meta-ads-producer` 서비스 선택
2. Settings → Environment Variables 확인
3. 필요 시 `MODE` 변수 제거 (telegram-cron.js는 MODE 불필요)
4. Deploy 버튼 클릭

**장점**:
- 기존 환경 변수 재사용
- 새 서비스 생성 불필요
- 즉시 배포 가능

### 옵션 B: 새 서비스 생성

1. Railway 대시보드에서 "New Service" 클릭
2. 이름: `bas-telegram-cron`
3. 환경 변수 복사 (위 목록 참조)
4. Procfile에서 `cron` 프로세스 자동 감지
5. Deploy

---

## 배포 실행

### 1. 서비스 연결
```bash
# 현재 디렉토리에서 Railway 서비스 연결
railway link
```

프롬프트에서 선택:
- Project: `remarkable-enchantment`
- Service: `bas-meta-ads-producer` (또는 새로 생성한 서비스)

### 2. 배포
```bash
# 현재 코드 배포
railway up

# 또는 강제 재배포
railway redeploy
```

### 3. 로그 확인
```bash
# 실시간 로그 모니터링
railway logs -f

# 최근 100줄 확인
railway logs --lines 100
```

**예상 로그**:
```
🤖 BAS Telegram Report Scheduler v2.0 Started
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Cron job scheduled:
   - Every Monday at 09:00 (KST)
   - Reports last week's data (Monday ~ Sunday)

Press Ctrl+C to stop the scheduler
```

---

## 스케줄 동작 방식

### Cron 설정
```javascript
cron.schedule('0 9 * * 1', async () => {
  // 매주 월요일 09:00 (KST) 실행
  await sendWeeklyReports();
}, {
  timezone: "Asia/Seoul"
});
```

### 리포트 기간
- **발송 시점**: 매주 월요일 09:00 KST
- **분석 기간**: 지난 주 월요일 ~ 일요일
- **예시**:
  - 2025-11-24 (월) 09:00 발송
  - 분석 기간: 2025-11-17 ~ 2025-11-23

---

## 리포트 내용

### 📊 주간 성과 요약
- 총 지출 (Total Spend)
- 총 리드 (Total Leads)
- 평균 CPL (Cost Per Lead)
- 평균 CTR (Click Through Rate)
- 노출수, 클릭수

### 📈 전주 대비 변화
- 리드, CPL, 지출, CTR 증감률
- 이모지로 긍정/부정 표시
  - 리드 증가: ⬆️ 성장!
  - CPL 감소: ⬇️ 개선!
  - 주의 필요: ⚠️, 🔴

### 🏆 광고별 성과 순위
- Best Performing 광고 TOP 5 (CPL 기준)
- 개선 필요 광고 2개
- 각 광고별 CPL, CTR, 리드 수

### 💡 AI 인사이트
- CPL, 리드, CTR 변화 분석
- 자동 생성된 인사이트 (최대 5개)
- Best/Worst 광고 강조

### 🎯 추천 액션
- Best 광고 예산 증액 권장
- Worst 광고 개선 제안
- 전략 유지/변경 제안

### 🔗 대시보드 링크
- 상세 분석 페이지 직접 연결
- 일별 차트, 광고별 분석, 엑셀 다운로드 가능

---

## 테스트 방법

### 1. 로컬 테스트 (즉시 발송)
```bash
# .env 파일 확인 후
node test-telegram-report.js
```

**test-telegram-report.js** 내용:
```javascript
require('dotenv').config();
const { sendWeeklyReports } = require('./telegram-cron');

// 즉시 실행
(async () => {
  await sendWeeklyReports();
  console.log('✅ Test completed');
  process.exit(0);
})();
```

### 2. Railway에서 수동 트리거
```bash
# Railway CLI로 명령 실행
railway run node test-telegram-report.js
```

### 3. 스케줄 대기
- 배포 후 다음 월요일 09:00 KST까지 대기
- 로그에서 `⏰ Scheduled task triggered` 확인

---

## 트러블슈팅

### ❌ 텔레그램 메시지 발송 실패

**증상**: `Failed to send telegram report`

**원인 및 해결**:
1. **봇 토큰 오류**
   ```bash
   # Railway에서 환경 변수 확인
   railway variables

   # TELEGRAM_BOT_TOKEN 재설정
   railway variables set TELEGRAM_BOT_TOKEN="YOUR_BOT_TOKEN"
   ```

2. **채팅 ID 오류**
   ```bash
   # TELEGRAM_ADMIN_CHAT_ID 확인
   # -1003394139746 (그룹) 또는 개인 chat_id
   railway variables set TELEGRAM_ADMIN_CHAT_ID="-1003394139746"
   ```

3. **봇이 그룹에 추가되지 않음**
   - 텔레그램 그룹에 봇 초대
   - 관리자 권한 부여

### ❌ 데이터 조회 실패

**증상**: `No data found` 또는 `No active clients found`

**원인 및 해결**:
1. **Supabase 연결 확인**
   ```javascript
   // Railway 로그에서 확인
   "✅ Found X active client(s)"
   ```

2. **clients 테이블 점검**
   ```sql
   -- Supabase SQL Editor
   SELECT client_id, client_name, is_active
   FROM clients
   WHERE is_active = true;
   ```

3. **weekly_summary 데이터 확인**
   ```sql
   SELECT * FROM weekly_summary
   WHERE week_start >= CURRENT_DATE - INTERVAL '14 days'
   ORDER BY week_start DESC;
   ```

### ❌ Cron 스케줄 실행 안 됨

**증상**: 월요일 09:00에 리포트 발송 안 됨

**원인 및 해결**:
1. **Railway 서비스 상태 확인**
   ```bash
   railway status
   ```

2. **프로세스 유지 확인**
   - Railway 로그에서 `Press Ctrl+C to stop the scheduler` 메시지 확인
   - 프로세스가 재시작되지 않았는지 확인

3. **시간대 확인**
   ```javascript
   // telegram-cron.js에서 확인
   timezone: "Asia/Seoul" // KST (UTC+9)
   ```

---

## 환경 변수 추가/변경

### DASHBOARD_URL 설정 (선택사항)
```bash
# 대시보드 URL 커스터마이징
railway variables set DASHBOARD_URL="https://your-custom-domain.com"
```

기본값: `https://bas-dashboard.vercel.app`

### 다른 환경 변수
현재 설정된 모든 변수는 이미 올바르게 구성되어 있습니다.

---

## 모니터링

### 1. Railway 대시보드
- 서비스 상태: https://railway.app/project/[PROJECT_ID]
- CPU, Memory 사용량
- 최근 배포 이력

### 2. 로그 확인
```bash
# 실시간 로그
railway logs -f

# 특정 시간 범위
railway logs --since 1h

# 에러만 필터링
railway logs | grep "❌"
```

### 3. 텔레그램 그룹
- 매주 월요일 09:00에 리포트 수신 확인
- 메시지 포맷 및 링크 작동 확인

---

## 다음 단계 체크리스트

- [ ] BotFather로 봇 생성 완료 (이미 완료된 것으로 보임)
- [ ] Railway 환경 변수 확인 ✅
- [ ] 서비스 선택 (bas-meta-ads-producer 재활용 권장)
- [ ] `railway link` 실행
- [ ] `railway up` 또는 `railway redeploy` 실행
- [ ] `railway logs -f`로 로그 확인
- [ ] 로컬에서 `node test-telegram-report.js` 테스트
- [ ] 다음 월요일 09:00까지 대기 또는 수동 테스트

---

## 긴급 상황 대응

### 즉시 중단
```bash
# Railway에서 서비스 중지
railway down
```

### 강제 재시작
```bash
railway redeploy
```

### 로그 다운로드
```bash
railway logs --lines 1000 > telegram-cron-logs.txt
```

---

**작성일**: 2025-11-21
**작성자**: BAS Development Team
**버전**: 1.0
