# Railway Worker 이슈 및 해결 방법

**날짜**: 2025-11-19
**문제**: Railway Worker가 큐에서 작업을 처리하지 않음

---

## 🔍 진단 결과

### 확인된 사항
✅ Railway Worker 서비스 실행 중 (Active)
✅ Upstash Redis 연결 성공
✅ 환경 변수 모두 정상
✅ 로컬 테스트 완벽 작동
✅ Producer가 작업을 큐에 추가 성공

### 문제점
❌ **Railway Worker가 큐에서 작업을 가져가지 않음**
❌ Worker 로그에 `🔄 Processing` 메시지 없음
❌ Supabase에 새 데이터 저장 안 됨
❌ 텔레그램 리포트 발송 안 됨

---

## 🔴 원인 분석

### 1. JobId 중복 문제 (가장 가능성 높음)

**Producer 코드** (`lib/producer.js:172`):
```javascript
jobId: `collect-${client.id}-${weekStart}`, // 멱등성 보장
```

**문제**:
- 동일한 `clientId`와 `weekStart`로 작업을 추가하면 JobId가 중복됨
- BullMQ는 **동일한 JobId의 작업을 중복 추가하지 않음**
- Producer가 "Enqueued: 1"이라고 표시하지만, 실제로는 이미 큐에 있던 작업임
- 해당 작업이 이미 완료(completed) 상태면 Worker가 처리하지 않음

### 2. 작업이 이미 완료된 상태

BullMQ 설정:
```javascript
removeOnComplete: {
  age: 86400 * 7, // 7일 후 삭제
  count: 1000      // 최대 1000개 보관
}
```

- Completed 작업은 7일 동안 보관됨
- 같은 JobId의 작업이 이미 완료되어 있으면 새로 처리 안 함

---

## ✅ 해결 방법

### Option 1: JobId에 타임스탬프 추가 (권장)

**수정 전**:
```javascript
jobId: `collect-${client.id}-${weekStart}`
```

**수정 후**:
```javascript
jobId: `collect-${client.id}-${weekStart}-${Date.now()}`
```

**장점**:
- 매번 새로운 작업으로 인식
- 즉시 작업 처리 보장

**단점**:
- 멱등성 없음 (같은 작업을 여러 번 실행 가능)

---

### Option 2: 기존 Completed Job 제거 후 재추가

큐에서 완료된 작업을 먼저 제거:

```javascript
// Producer에 추가할 코드
const existingJob = await dataCollectionQueue.getJob(jobId);
if (existingJob) {
  await existingJob.remove();
  console.log(`  🗑️  Removed existing job: ${jobId}`);
}
```

**장점**:
- 멱등성 유지
- 데이터 중복 방지

**단점**:
- 코드 복잡도 증가

---

### Option 3: 주간 Cron은 유지하고, 수동 실행 시 다른 기간 사용

**현재 시스템**:
- 매주 월요일 09:00: 지난주 데이터 수집
- 수동 실행: 같은 지난주 데이터 → JobId 중복

**개선안**:
```javascript
// 환경 변수로 기간 오버라이드 가능하게
const START_DATE = process.env.START_DATE || getLastWeekStart();
const END_DATE = process.env.END_DATE || getLastWeekEnd();
```

**사용법**:
```bash
# Railway에서 수동 실행 시 환경 변수 설정
START_DATE=2025-11-01
END_DATE=2025-11-07
```

---

### Option 4: MODE=full 사용 (가장 간단)

**현재 문제**:
- Producer (Cron): 작업 추가만
- Worker (Always Running): 큐 모니터링
- 연결 문제로 Worker가 작업을 못 가져감

**해결**:
Railway Producer 서비스 환경 변수:
```
MODE=full
```

**효과**:
- Producer 실행 후 즉시 Worker 시작
- 큐를 거치지 않고 바로 처리
- 단일 프로세스로 완료

**단점**:
- Cron 실행 시간이 길어짐 (3-5분)
- 에러 발생 시 재시도 없음

---

## 🛠️ 즉시 적용 가능한 해결책

### 1단계: 즉시 해결 (MODE=full)

Railway Dashboard에서:
1. **bas-meta-ads-producer** 서비스 선택
2. **Variables** 탭
3. `MODE` 변수를 `full`로 변경
4. **Redeploy** 클릭

다음 Cron 실행 시 Producer와 Worker가 통합 실행됩니다.

---

### 2단계: 근본 해결 (JobId 개선)

`lib/producer.js` 수정:

```javascript
// 기존 코드 (Line 172)
jobId: `collect-${client.id}-${weekStart}`,

// 새 코드
jobId: `collect-${client.id}-${weekStart}-${Date.now()}`,
```

**배포**:
```bash
git add lib/producer.js
git commit -m "fix: Add timestamp to jobId to prevent duplicates"
git push
```

Railway가 자동으로 재배포합니다.

---

## 🔍 검증 방법

### Railway Dashboard에서 확인

**Producer 로그**:
```
✅ Enqueued: 1
```

**Worker 로그** (30초 이내):
```
🔄 Processing: 비즈액터스쿨
📊 Fetched X records from Meta API
💾 Saved X records to raw_data
📊 Weekly summary generated
📱 Telegram report sent successfully
✅ Completed: 비즈액터스쿨
```

### 텔레그램 확인

리포트 메시지 수신:
```
📊 [BAS] 비즈액터스쿨 주간 리포트
기간: 2025-11-10 ~ 2025-11-16
...
```

### CLI로 확인

```bash
cd F:/bas_meta
railway service bas-meta-ads
railway logs -f
```

---

## 📝 권장 조치

**즉시 조치** (5분):
1. Railway Producer의 `MODE`를 `full`로 변경
2. 수동으로 Cron "Run now" 실행
3. 텔레그램 리포트 수신 확인

**장기 조치** (1일):
1. `lib/producer.js`의 JobId에 타임스탬프 추가
2. GitHub에 푸시
3. Railway 자동 재배포
4. `MODE`를 `producer`로 복구 (원래 아키텍처 유지)

---

## 🎯 결론

**문제**: BullMQ의 JobId 중복으로 인해 Worker가 작업을 처리하지 않음

**해결**:
- 단기: `MODE=full`로 통합 실행
- 장기: JobId에 타임스탬프 추가

**예상 결과**: 매주 월요일 09:00에 자동으로 데이터 수집 및 텔레그램 리포트 발송 ✅

---

## 📚 관련 파일

- `F:\bas_meta\lib\producer.js:172` - JobId 설정
- `F:\bas_meta\index.js:34-53` - MODE=full 구현
- `F:\bas_meta\RAILWAY_CLI_GUIDE.md` - Railway CLI 사용법
- `F:\bas_meta\NEXT_SESSION.md` - 전체 시스템 구조
