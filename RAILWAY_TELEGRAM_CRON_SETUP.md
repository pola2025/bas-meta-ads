# Railway 텔레그램 Cron 스케줄러 배포 가이드

## 📋 개요

텔레그램 자동 리포트 발송 기능을 Railway에 배포하는 가이드입니다.

## 🚀 배포 방법

### 1. Railway 프로젝트 설정

현재 프로젝트에 새로운 서비스를 추가합니다:

```bash
# Railway CLI 확인
railway --version

# 프로젝트 연결 확인
railway status
```

### 2. Telegram Cron 서비스 추가

#### 방법 1: Railway CLI 사용

```bash
# 프로젝트 루트에서 실행
cd F:/bas_meta

# Railway에 새 서비스 추가
railway service

# telegram-cron 서비스 선택 또는 생성
```

#### 방법 2: Railway Dashboard 사용

1. Railway Dashboard 접속: https://railway.app
2. 프로젝트 선택
3. "New Service" 클릭
4. "Empty Service" 선택
5. 서비스 이름: `telegram-cron`

### 3. 환경 변수 설정

Railway Dashboard에서 환경 변수를 추가합니다:

**필수 환경 변수**:
```
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_ADMIN_CHAT_ID=your_chat_id_here
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_KEY=your_supabase_service_key
```

**환경 변수 추가 방법**:
1. Railway Dashboard에서 `telegram-cron` 서비스 선택
2. "Variables" 탭 클릭
3. "New Variable" 클릭하여 각 변수 추가

### 4. Procfile 설정

이미 생성된 `Procfile`에 다음 내용이 포함되어 있습니다:

```
web: MODE=producer node index.js
worker: MODE=worker node index.js
cron: node telegram-cron.js
```

### 5. railway.json 설정 (선택사항)

`telegram-cron` 서비스만 별도로 배포하려면 `railway.json` 생성:

```json
{
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "node telegram-cron.js",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

### 6. 배포 실행

#### 옵션 A: 기존 서비스와 함께 배포

```bash
# 전체 프로젝트 배포
railway up
```

#### 옵션 B: Cron 서비스만 별도 배포

```bash
# telegram-cron 서비스로 전환
railway service telegram-cron

# 배포
railway up
```

### 7. 배포 확인

```bash
# 로그 확인
railway logs

# 서비스 상태 확인
railway status
```

## 📊 스케줄 설정

현재 설정된 스케줄:
- **실행 시간**: 매주 월요일 오전 9시 (KST)
- **대상 기간**: 지난 주 월요일 ~ 일요일
- **타임존**: Asia/Seoul

### 스케줄 변경 방법

`telegram-cron.js` 파일에서 cron 표현식을 수정:

```javascript
// 현재 설정: 매주 월요일 09:00
cron.schedule('0 9 * * 1', async () => {
  // ...
}, {
  timezone: "Asia/Seoul"
});

// 다른 스케줄 예시:
// 매일 오전 9시: '0 9 * * *'
// 매주 금요일 오후 5시: '0 17 * * 5'
// 매월 1일 오전 10시: '0 10 1 * *'
```

## 🧪 테스트

### 로컬 테스트

```bash
# 텔레그램 리포트 테스트
node test-telegram-report.js

# Cron 스케줄러 테스트 (즉시 실행)
# telegram-cron.js에서 주석 해제:
# sendWeeklyReports().catch(console.error);
```

### Railway 테스트

```bash
# Railway 로그 실시간 확인
railway logs --follow

# 특정 서비스 로그만 확인
railway logs --service telegram-cron
```

## 🔧 문제 해결

### 1. 스케줄러가 실행되지 않음

**확인사항**:
- Railway 서비스가 정상 실행 중인지 확인
- 환경 변수가 올바르게 설정되었는지 확인
- 타임존 설정 확인

**해결방법**:
```bash
# 로그 확인
railway logs --service telegram-cron

# 서비스 재시작
railway restart --service telegram-cron
```

### 2. 텔레그램 메시지가 발송되지 않음

**확인사항**:
- `TELEGRAM_BOT_TOKEN` 유효성
- `TELEGRAM_ADMIN_CHAT_ID` 정확성
- 봇이 채팅방에 추가되었는지 확인

**테스트**:
```bash
# 로컬에서 테스트
node test-telegram-report.js
```

### 3. Supabase 연결 오류

**확인사항**:
- `SUPABASE_URL` 정확성
- `SUPABASE_SERVICE_KEY` 권한 (service_role)
- 네트워크 방화벽 설정

### 4. 메모리 부족

Railway 무료 플랜 제한:
- 메모리: 512MB
- CPU: 0.5 vCPU

**해결방법**:
- 불필요한 서비스 분리
- 메모리 사용량 최적화
- Railway Pro 플랜 업그레이드 고려

## 📈 모니터링

### Railway Dashboard

1. **서비스 상태**: Deployments 탭에서 확인
2. **로그**: Logs 탭에서 실시간 확인
3. **메트릭**: Metrics 탭에서 CPU/메모리 사용량 확인

### 알림 설정

Railway Dashboard에서 알림 설정:
1. Project Settings → Notifications
2. Deployment notifications 활성화
3. 이메일 또는 Slack 연동

## 🔄 업데이트

코드 변경 후 재배포:

```bash
# Git 커밋
git add telegram-cron.js
git commit -m "Update telegram cron scheduler"
git push

# Railway 자동 배포 (GitHub 연동된 경우)
# 또는 수동 배포
railway up
```

## 📚 참고 자료

- [Railway 공식 문서](https://docs.railway.app/)
- [node-cron 문서](https://github.com/node-cron/node-cron)
- [Telegram Bot API](https://core.telegram.org/bots/api)

## ✅ 체크리스트

배포 전 확인사항:

- [ ] Railway 프로젝트 생성 및 연결
- [ ] 환경 변수 설정 완료
  - [ ] TELEGRAM_BOT_TOKEN
  - [ ] TELEGRAM_ADMIN_CHAT_ID
  - [ ] SUPABASE_URL
  - [ ] SUPABASE_SERVICE_KEY
- [ ] Procfile 설정 확인
- [ ] 로컬 테스트 완료
- [ ] Railway 배포 성공
- [ ] 배포 후 로그 확인
- [ ] 스케줄 작동 확인 (다음 월요일 9시 대기)

## 🎯 다음 단계

1. 첫 번째 자동 리포트 발송 대기 (다음 월요일 9시)
2. 리포트 수신 확인
3. 필요시 포맷 조정
4. 추가 클라이언트 설정

---

**문의사항**: 프로젝트 이슈 트래커에 등록
