# Railway Cron Job 설정 가이드

## 목적
매주 월요일 09:00 (KST)에 Producer를 자동 실행하여 데이터 수집 작업을 큐에 추가합니다.

## 설정 방법

### 1단계: Railway 대시보드 접속
https://railway.app → 프로젝트 "remarkable-enchantment" 선택

### 2단계: 새 서비스 추가
1. **"New Service"** 버튼 클릭
2. **"GitHub Repo"** 선택
3. 같은 리포지토리 **"pola2025/bas-meta-ads"** 선택

### 3단계: 서비스 기본 설정
**Service Name**: `bas-meta-ads-producer`

**Root Directory**: `/` (기본값)

**Start Command**: `node index.js`

### 4단계: 환경 변수 설정

**중요**: MODE 변수를 **producer**로 설정해야 합니다!

다음 환경 변수를 추가하세요 (Settings > Variables):

```
MODE=producer
META_APP_ID=1474546053653616
META_APP_SECRET=5d3ea72d4293c8f78842334b8558175c
META_ACCESS_TOKEN=EAAU9F4G7pHABP5tFFGrJ2jyVt0GlGYtHAYZADZCGZBRN0Wq0efQbIJvyZAZCIYc0pIKzR0pV87EX56YZCoO4tSspou6tArN2DxZAC2M61vZBUpZAI9ySE4H4Eqg4jVUijh1qpjqQKI3ZBKANnxc3FdnFzviTg9rZCuu9pfUpqSoc15OulZABZAZAsj4AiwXoPsOhnGsQZA0qhqAP1ZA8JwvcInSS
META_AD_ACCOUNT_ID=act_705731635104506
SUPABASE_URL=https://mpljqcuqrrfwzamfyxnz.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1wbGpxY3VxcnJmd3phbWZ5eG56Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzQ5Njk3NiwiZXhwIjoyMDc5MDcyOTc2fQ.bnVOXhB28UGdiPDHYYwMP8dyKAQ6k9zrjUu7cam4HEY
SUPABASE_PROJECT_REF=mpljqcuqrrfwzamfyxnz
SUPABASE_DB_PASSWORD=FhPFRbl8u7LoHTBh
SUPABASE_ACCESS_TOKEN=sbp_3b580e985fef326632a657aafce611f6a586ed7b
UPSTASH_REDIS_URL=rediss://default:AZgyAAIncDIwOTE5OThiMDJjYmE0MjVmOGVmNTc3MTJjZDQ5YmNhMXAyMzg5NjI@settled-thrush-38962.upstash.io:6379
TELEGRAM_BOT_TOKEN=7947112373:AAEs5o3fcm0JoPewh7K5YTUwzq4poWw97pY
TELEGRAM_ADMIN_CHAT_ID=-1003394139746
DATA_DAYS=7
```

**팁**: 기존 bas-meta-ads 서비스의 환경 변수를 복사한 후, MODE만 producer로 변경하면 됩니다!

### 5단계: Cron Schedule 설정

1. **Settings** 탭 클릭
2. **Deploys** 섹션으로 스크롤
3. **Cron Schedule** 입력

**매주 월요일 09:00 (KST) = 매주 월요일 00:00 (UTC)**

```
0 0 * * 1
```

**Cron 표현식 설명**:
- `0` - 분 (0분)
- `0` - 시간 (0시 = 자정 UTC, 한국 시간 09:00)
- `*` - 일 (매일)
- `*` - 월 (매월)
- `1` - 요일 (월요일, 0=일요일, 1=월요일)

### 6단계: Restart Policy 설정

**중요**: Cron 서비스는 작업 완료 후 종료되어야 합니다.

1. **Settings** > **Deploy**
2. **Restart Policy**: **Never** 선택

이렇게 하면 Producer가 작업을 완료하고 정상 종료한 후 재시작하지 않습니다.

### 7단계: 배포 확인

1. **Deploy** 버튼 클릭하여 첫 배포 시작
2. **Logs** 탭에서 다음과 같은 로그 확인:

```
🚀 Starting BAS Meta Ads Analytics in PRODUCER mode
📅 Started at: 2025-11-19T...
📊 Running Producer - Adding data collection jobs to queue
✅ Producer job completed
```

## 테스트

**수동 실행 테스트**:
1. Railway 대시보드 > bas-meta-ads-producer 서비스
2. **Deployments** 탭
3. **Trigger Deploy** 클릭
4. 로그에서 Producer가 정상 실행되는지 확인

## 동작 방식

```
매주 월요일 09:00 (KST)
    ↓
Railway Cron이 Producer 서비스 시작
    ↓
Producer: 데이터 수집 작업을 Upstash Queue에 추가
    ↓
Producer 종료 (Restart Policy: Never)
    ↓
Worker: Queue에서 작업을 가져와 Meta API 호출 및 Supabase 저장
```

## 문제 해결

### Cron이 실행되지 않는 경우
- Cron Schedule 형식 확인: `0 0 * * 1`
- Restart Policy가 Never로 설정되었는지 확인

### Producer가 에러로 종료되는 경우
- 로그에서 에러 메시지 확인
- 환경 변수가 모두 설정되었는지 확인
- MODE=producer로 설정되었는지 확인

### Worker가 작업을 처리하지 않는 경우
- Worker 서비스가 실행 중인지 확인
- Worker 로그에서 Queue 연결 상태 확인
- Upstash Redis 대시보드에서 Queue 상태 확인

## 다음 단계

✅ Railway Cron Job 설정 완료 후:
1. Streamlit 대시보드 배포
2. 전체 시스템 테스트
3. 모니터링 설정
