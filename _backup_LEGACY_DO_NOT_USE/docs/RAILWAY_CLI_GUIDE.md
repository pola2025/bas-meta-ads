# Railway CLI 사용 가이드

**최종 업데이트**: 2025-11-19
**Railway CLI 버전**: 4.10.0+

---

## 📦 설치 확인

```bash
railway --version
# Output: railway 4.10.0
```

---

## 🔐 인증

### 로그인
```bash
railway login
```
브라우저가 열리고 Railway 계정으로 로그인합니다.

### 로그아웃
```bash
railway logout
```

---

## 📂 프로젝트 관리

### 현재 프로젝트 상태 확인
```bash
railway status
```
**출력 예시**:
```
Project: remarkable-enchantment
Environment: production
Service: bas-meta-ads-producer
```

### 프로젝트 목록 보기
```bash
railway list
```

### 프로젝트 연결
```bash
railway link
```
현재 디렉토리를 Railway 프로젝트와 연결합니다.

---

## 🎯 서비스 선택 및 관리

### 서비스 목록 보기 및 선택
```bash
railway service
```
인터랙티브하게 서비스를 선택할 수 있습니다.

### 특정 서비스 직접 연결
```bash
railway service [SERVICE_NAME]
```
**예시**:
```bash
railway service bas-meta-ads          # Worker 서비스 선택
railway service bas-meta-ads-producer # Producer 서비스 선택
```

---

## 📊 로그 확인 (핵심!)

### 기본 로그 보기
```bash
railway logs
```
현재 연결된 서비스의 최신 로그를 표시합니다.

### 특정 서비스의 로그 보기
```bash
railway logs -s bas-meta-ads          # Worker 로그
railway logs -s bas-meta-ads-producer # Producer 로그
```

### 실시간 로그 스트리밍
```bash
railway logs -f
# 또는
railway logs --follow
```

### 특정 라인 수만 보기 (v4.9.0+)
```bash
railway logs -n 50     # 최근 50줄만
railway logs --lines 100  # 최근 100줄만
```

### 로그 필터링 (v4.9.0+)
```bash
railway logs --filter "ERROR"
railway logs --filter "Telegram"
railway logs --filter "success"
```

### 빌드 로그 보기
```bash
railway logs --build
# 또는
railway logs -b
```

### 배포 로그 보기
```bash
railway logs --deployment
# 또는
railway logs -d
```

### JSON 형식으로 출력
```bash
railway logs --json
```

---

## 🚀 배포 관리

### 배포하기
```bash
railway up
```
현재 디렉토리의 코드를 배포합니다.

### 특정 서비스에 배포
```bash
railway up -s bas-meta-ads
```

### 백그라운드 배포 (로그 안 보기)
```bash
railway up --detach
```

### 재배포 (코드 변경 없이)
```bash
railway redeploy
# 또는 특정 서비스
railway redeploy -s bas-meta-ads
```

### 최근 배포 제거
```bash
railway down
# 확인 없이 바로 삭제
railway down -y
```

---

## 🔧 환경 변수 관리

### 환경 변수 보기
```bash
railway variables
```

### 환경 변수로 명령어 실행
```bash
railway run node index.js
railway run npm start
```

### 특정 서비스의 환경 변수로 실행
```bash
railway run -s bas-meta-ads node lib/worker.js
```

### .env 파일로 내보내기
```bash
railway variables --json > .env.json
```

---

## 🌍 환경(Environment) 관리

### 환경 목록 보기
```bash
railway environment
```

### 환경 전환
```bash
railway environment production
railway environment staging
```

---

## 🔍 멀티 서비스 프로젝트 워크플로우

### BAS Meta Ads 프로젝트 예시

#### 1. Worker 서비스 로그 확인
```bash
cd F:/bas_meta
railway service bas-meta-ads
railway logs -f --lines 100
```

**확인할 로그**:
- `⚙️  Running Worker - Processing jobs from queue`
- `🔄 Processing: 비즈액터스쿨`
- `📊 Fetched X records from Meta API`
- `💾 Saved X records to raw_data`
- `📱 Telegram report sent successfully`
- `✅ Completed: 비즈액터스쿨`

#### 2. Producer 서비스 로그 확인
```bash
railway service bas-meta-ads-producer
railway logs --lines 50
```

**확인할 로그**:
- `📋 Found 1 active clients`
- `✅ Enqueued: 1`
- `✅ Producer completed`

#### 3. Producer 재실행 (수동 트리거)
```bash
railway service bas-meta-ads-producer
railway redeploy
```

#### 4. Worker 재시작
```bash
railway service bas-meta-ads
railway redeploy
```

---

## 🛠️ 유용한 조합 명령어

### Worker가 작동하는지 실시간 확인
```bash
railway service bas-meta-ads && railway logs -f --filter "Processing"
```

### Producer 실행 후 바로 Worker 로그 확인
```bash
# Terminal 1: Producer 재실행
railway service bas-meta-ads-producer && railway redeploy

# Terminal 2: Worker 로그 실시간 모니터링
railway service bas-meta-ads && railway logs -f
```

### 에러만 필터링
```bash
railway logs -f --filter "ERROR\|Failed\|❌"
```

### 텔레그램 관련 로그만 보기
```bash
railway logs --filter "Telegram\|📱"
```

---

## 📋 Railway MCP Server (AI 통합)

Railway MCP Server를 사용하면 Claude가 직접 Railway를 관리할 수 있습니다.

### 설치 (이미 완료)
```bash
claude mcp add railway-mcp-server -- npx -y @railway/mcp-server
```

### 사용 가능한 기능
- ✅ 프로젝트 생성 및 목록 조회
- ✅ 서비스 배포 및 템플릿 배포
- ✅ 환경 생성 및 변수 관리
- ✅ 빌드 및 배포 로그 조회
- ✅ 도메인 생성

### 예시 명령어 (Claude에게 요청)
```
"Railway Worker 서비스의 최근 로그를 보여줘"
"Railway Producer를 재배포해줘"
"Railway에서 bas-meta-ads 서비스의 환경 변수를 확인해줘"
```

---

## ⚠️ 주의 사항

1. **서비스 선택**: 멀티 서비스 프로젝트에서는 항상 `-s` 플래그로 서비스를 명시하거나 `railway service`로 먼저 선택하세요.

2. **로그 필터**: 한글 필터는 작동하지 않을 수 있으므로 영어나 이모지로 필터링하세요.

3. **실시간 로그**: `-f` 플래그 사용 시 Ctrl+C로 종료할 수 있습니다.

4. **재배포**: `railway redeploy`는 코드 변경 없이 재시작하므로, 코드 변경 후에는 `railway up`을 사용하세요.

---

## 🎯 빠른 참조

| 작업 | 명령어 |
|------|--------|
| 프로젝트 상태 확인 | `railway status` |
| 서비스 선택 | `railway service [NAME]` |
| 로그 보기 | `railway logs` |
| 실시간 로그 | `railway logs -f` |
| 특정 서비스 로그 | `railway logs -s [SERVICE]` |
| 로그 필터 | `railway logs --filter "TEXT"` |
| 재배포 | `railway redeploy` |
| 환경 변수 보기 | `railway variables` |

---

## 📚 참고 자료

- **공식 문서**: https://docs.railway.com/reference/cli-api
- **GitHub**: https://github.com/railwayapp/cli
- **MCP Server**: https://docs.railway.com/reference/mcp-server
- **로그 가이드**: https://docs.railway.com/guides/logs

---

**다음**: Worker 서비스 로그를 확인하여 문제를 진단하세요!

```bash
railway service bas-meta-ads
railway logs -f --lines 100
```
