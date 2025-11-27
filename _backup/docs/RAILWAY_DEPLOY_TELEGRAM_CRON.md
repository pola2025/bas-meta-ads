# Railway 텔레그램 Cron 서비스 추가 가이드

## 현재 상태
- **기존 서비스**: `bas-meta-ads` (PRODUCER 모드만 실행 중)
- **필요 작업**: 텔레그램 Cron을 별도 서비스로 추가

## 🚀 Railway Dashboard에서 서비스 추가

### 방법 1: Railway Dashboard 사용 (권장)

#### 1단계: Railway Dashboard 접속
URL: https://railway.com/project/db978182-dd69-42ab-a0cf-f779d03753e2?environmentId=c402d758-184b-4c8e-8d46-58f406814e0e

#### 2단계: 새 서비스 추가
1. **"New"** 버튼 클릭 → **"Service"** 선택
2. **"Empty Service"** 선택
3. 서비스 이름: `telegram-cron`

#### 3단계: GitHub 레포지토리 연결
1. **Source** 탭 클릭
2. **"Connect Repo"** 선택
3. 기존 레포지토리와 동일한 레포 선택
4. **Branch**: main (또는 현재 사용 중인 브랜치)

#### 4단계: Start Command 설정
1. **Settings** 탭 클릭
2. **"Start Command"** 입력:
   ```
   node telegram-cron.js
   ```
3. **"Save"** 클릭

#### 5단계: 환경 변수 복사
기존 `bas-meta-ads` 서비스에서 환경 변수를 복사:

**필수 환경 변수**:
```
TELEGRAM_BOT_TOKEN=7947112373:AAEs5o3fcm0JoPewh7K5YTUwzq4poWw97pY
TELEGRAM_ADMIN_CHAT_ID=-1003394139746
SUPABASE_URL=https://mpljqcuqrrfwzamfyxnz.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**복사 방법**:
1. 기존 서비스의 **Variables** 탭 열기
2. 위 4개 변수를 복사
3. 새 `telegram-cron` 서비스의 **Variables** 탭에 붙여넣기

#### 6단계: 배포 확인
1. 자동으로 배포가 시작됩니다
2. **Deployments** 탭에서 진행 상황 확인
3. **Logs** 탭에서 실행 로그 확인

예상 로그:
```
🤖 BAS Telegram Report Scheduler Started
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Cron job scheduled:
   - Every Monday at 09:00 (KST)
   - Reports last week's data (Monday ~ Sunday)

Press Ctrl+C to stop the scheduler
```

---

## 방법 2: Railway CLI 사용

### 1. 새 서비스 생성
```bash
cd F:/bas_meta

# Railway에 로그인 (이미 로그인되어 있을 수 있음)
railway login

# 프로젝트 연결 확인
railway status
```

### 2. railway.json 생성 (telegram-cron 전용)
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

### 3. 배포
```bash
# 새 서비스로 배포
railway up
```

---

## ✅ 배포 확인 체크리스트

배포 후 다음 사항을 확인하세요:

- [ ] Railway Dashboard에서 `telegram-cron` 서비스가 생성되었는가?
- [ ] 서비스 상태가 **"Running"**인가?
- [ ] 환경 변수가 모두 설정되었는가? (4개)
  - [ ] TELEGRAM_BOT_TOKEN
  - [ ] TELEGRAM_ADMIN_CHAT_ID
  - [ ] SUPABASE_URL
  - [ ] SUPABASE_SERVICE_KEY
- [ ] Logs에 스케줄러 시작 메시지가 표시되는가?
- [ ] 에러 메시지가 없는가?

---

## 🧪 테스트

### 1. 수동 테스트 (로컬)
```bash
# 로컬에서 즉시 실행 테스트
node test-telegram-report.js
```

### 2. Railway 로그 확인
```bash
# CLI로 로그 확인
railway logs --service telegram-cron --tail 100

# 또는 Dashboard에서 Logs 탭 확인
```

### 3. 첫 번째 자동 실행 대기
- **실행 시간**: 다음 월요일 오전 9시 (KST)
- **확인 방법**: 텔레그램 채팅방에서 리포트 수신 확인

---

## 🔧 문제 해결

### 문제 1: 서비스가 즉시 종료됨

**원인**: Start Command 오류 또는 환경 변수 누락

**해결**:
1. **Settings** → **Start Command** 확인:
   ```
   node telegram-cron.js
   ```
2. **Variables** 탭에서 환경 변수 4개 확인
3. **Deployments** → **Deploy Logs** 확인

### 문제 2: "Cannot find module" 오류

**원인**: node_modules 설치 실패 또는 package.json 누락

**해결**:
1. package.json에 node-cron 의존성 확인:
   ```json
   "dependencies": {
     "node-cron": "^4.2.1"
   }
   ```
2. Redeploy 실행

### 문제 3: Cron이 실행되지 않음

**원인**:
- 스케줄 표현식 오류
- 타임존 설정 오류
- 프로세스가 종료됨

**해결**:
1. Logs에서 "Cron job scheduled" 메시지 확인
2. 프로세스가 계속 실행 중인지 확인 (Status: Running)
3. telegram-cron.js의 cron 표현식 확인

---

## 📊 모니터링

### Railway Dashboard
1. **Deployments**: 배포 이력 및 상태
2. **Logs**: 실시간 로그 (스케줄러 실행 확인)
3. **Metrics**: CPU/메모리 사용량
4. **Settings → Health Check**: 선택적으로 설정 가능

### 알림 설정
1. **Project Settings** → **Notifications**
2. **Deployment notifications** 활성화
3. 이메일 또는 Slack 연동

---

## 🎯 다음 단계

1. **즉시**: Railway Dashboard에서 새 서비스 추가
2. **5분 후**: Logs 확인 및 정상 실행 여부 확인
3. **다음 월요일 09:00**: 첫 번째 자동 리포트 발송 확인
4. **이후**: 주간 리포트 수신 확인 및 포맷 조정

---

## 💡 추가 팁

### 여러 서비스 관리
현재 프로젝트 구조:
```
remarkable-enchantment (프로젝트)
├── bas-meta-ads (서비스) - PRODUCER/WORKER
└── telegram-cron (서비스) - Telegram Scheduler
```

### 비용 최적화
- Railway 무료 플랜: 월 $5 크레딧
- 각 서비스 메모리: ~100-200MB 예상
- 2개 서비스 동시 실행 가능

### 로그 보관
- Railway는 최근 7일 로그 보관
- 장기 보관 필요 시 외부 로그 서비스 연동 고려

---

**참고 링크**:
- [Railway 프로젝트](https://railway.com/project/db978182-dd69-42ab-a0cf-f779d03753e2)
- [Railway 문서 - 서비스 추가](https://docs.railway.app/guides/services)
