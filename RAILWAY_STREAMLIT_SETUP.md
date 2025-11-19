# Railway Streamlit 대시보드 배포 가이드

## 목적
Streamlit 대시보드를 Railway에 배포하여 웹에서 Meta 광고 성과를 실시간으로 확인할 수 있습니다.

## 설정 방법

### 1단계: Railway 대시보드 접속
https://railway.app → 프로젝트 "remarkable-enchantment" 선택

### 2단계: 새 서비스 추가
1. **"New Service"** 버튼 클릭
2. **"GitHub Repo"** 선택
3. 같은 리포지토리 **"pola2025/bas-meta-ads"** 선택

### 3단계: 서비스 기본 설정

**Service Name**: `bas-meta-ads-dashboard`

**Root Directory**: `streamlit-app`
- **중요**: 반드시 Root Directory를 `streamlit-app`으로 설정해야 합니다!
- Settings > General > Root Directory

**Start Command**:
```bash
streamlit run app.py --server.port $PORT --server.address 0.0.0.0 --server.headless true
```

### 4단계: 환경 변수 설정

Streamlit 앱은 Supabase 연결만 필요합니다.

Settings > Variables에서 다음 환경 변수를 추가하세요:

```
SUPABASE_URL=https://mpljqcuqrrfwzamfyxnz.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1wbGpxY3VxcnJmd3phbWZ5eG56Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzQ5Njk3NiwiZXhwIjoyMDc5MDcyOTc2fQ.bnVOXhB28UGdiPDHYYwMP8dyKAQ6k9zrjUu7cam4HEY
```

**참고**: PORT 환경 변수는 Railway가 자동으로 설정합니다.

### 5단계: Python 버전 설정 (선택사항)

Railway는 자동으로 Python을 감지하지만, 특정 버전을 원하면:

1. **Settings** > **Environment**
2. **PYTHON_VERSION** 환경 변수 추가: `3.11` 또는 `3.12`

### 6단계: 배포 확인

1. **Deploy** 버튼 클릭하여 첫 배포 시작
2. **Logs** 탭에서 배포 진행 상황 확인:

```
Collecting streamlit==1.39.0
Installing collected packages: streamlit, pandas, numpy, ...
Successfully installed streamlit-1.39.0 ...

You can now view your Streamlit app in your browser.

Network URL: http://0.0.0.0:xxxx
External URL: http://xxx.up.railway.app
```

3. **Deployments** 탭에서 **Domain** 확인
   - 자동 생성된 Railway 도메인: `https://xxx-production.up.railway.app`

### 7단계: 커스텀 도메인 설정 (선택사항)

원하는 도메인이 있다면:

1. **Settings** > **Domains**
2. **Add Domain** 클릭
3. 도메인 입력 (예: `dashboard.yourdomain.com`)
4. DNS 설정 안내에 따라 CNAME 레코드 추가

## 배포 후 확인 사항

### 1. 대시보드 접속
Railway에서 제공한 URL로 접속하여 대시보드가 정상 작동하는지 확인:

```
https://xxx-production.up.railway.app
```

### 2. 기능 테스트
- [ ] 클라이언트 선택 드롭다운 작동
- [ ] 날짜 범위 필터 작동
- [ ] 주간 성과 데이터 로드
- [ ] 차트 정상 표시
- [ ] KPI 카드 정상 표시

### 3. Supabase 연결 확인
대시보드에서 다음 확인:
- [ ] 클라이언트 목록 정상 로드
- [ ] 주간 성과 데이터 정상 표시
- [ ] "마지막 업데이트" 시간 정상 표시

## 문제 해결

### "No module named 'streamlit'" 에러
**원인**: requirements.txt를 찾지 못함
**해결**: Root Directory가 `streamlit-app`으로 설정되었는지 확인

### "Connection refused" 또는 Supabase 연결 실패
**원인**: 환경 변수 미설정
**해결**:
1. Settings > Variables에서 SUPABASE_URL, SUPABASE_SERVICE_KEY 확인
2. 값이 올바른지 확인 (공백, 따옴표 없이)

### 대시보드가 빈 화면으로 표시
**원인**: Start Command 오류
**해결**:
1. Settings > Deploys > Start Command 확인:
```bash
streamlit run app.py --server.port $PORT --server.address 0.0.0.0 --server.headless true
```

### PORT 관련 에러
**원인**: Railway가 자동 설정한 PORT를 사용하지 않음
**해결**: Start Command에서 `--server.port $PORT` 사용 (환경 변수)

## 성능 최적화

### 1. 캐싱 활용
Streamlit 앱은 이미 `@st.cache_data`를 사용하여 데이터를 캐싱합니다.

### 2. 리소스 제한
Railway Free Tier:
- 메모리: 512MB
- CPU: 공유
- 대역폭: 100GB/월

대시보드가 많은 데이터를 처리하면 메모리 부족 발생 가능. 필요 시 Pro Plan 업그레이드 고려.

### 3. 자동 재시작
Railway는 앱이 크래시하면 자동으로 재시작합니다.

## 보안

### 1. 인증 추가 (선택사항)
현재 대시보드는 공개 접근 가능. 인증을 추가하려면:

1. Streamlit의 `streamlit_authenticator` 패키지 사용
2. 또는 Railway의 Private Networking 사용 (Pro Plan)

### 2. 환경 변수 보호
- SUPABASE_SERVICE_KEY는 절대 코드에 하드코딩하지 않기
- Railway Variables에만 저장

## 모니터링

### 1. Railway 로그 확인
```bash
# 로컬에서 로그 확인
cd F:/bas_meta
railway logs --service bas-meta-ads-dashboard
```

### 2. Metrics 확인
Railway 대시보드 > bas-meta-ads-dashboard > Metrics:
- CPU 사용률
- 메모리 사용률
- 네트워크 사용량

## 업데이트 배포

코드 변경 후 자동 배포:
1. GitHub에 push
2. Railway가 자동으로 감지하여 재배포
3. 배포 완료까지 약 2-3분 소요

수동 재배포:
1. Railway 대시보드 > Deployments
2. **Trigger Deploy** 클릭

## 다음 단계

✅ Streamlit 대시보드 배포 완료 후:
1. URL을 팀원들과 공유
2. 주간 데이터 수집 확인 (Cron Job 대기)
3. 대시보드 사용법 문서 작성
4. 커스텀 도메인 설정 (선택사항)
