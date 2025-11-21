# 프로덕션 데이터 안 보임 문제 해결

## 🐛 증상
- ✅ 로컬 (localhost:3000): 데이터 정상 표시
- ❌ 프로덕션 (Vercel): 데이터 안 보임

## 🔍 원인 분석

### 가능성 1: Vercel 환경 변수 미설정 또는 오타 (90%)
로컬 `.env.local`과 Vercel 환경 변수가 다를 수 있음

### 가능성 2: Supabase RLS (Row Level Security) (8%)
익명 사용자(anon)가 뷰 조회 권한 없음

### 가능성 3: CORS 설정 (2%)
Vercel 도메인이 Supabase에서 차단됨

---

## ✅ 해결 방법

### 1단계: Vercel 환경 변수 재확인

1. **Vercel Dashboard 접속**
   - https://vercel.com/mkt9834-4301s-projects/dashboard/settings/environment-variables

2. **환경 변수 확인**

   다음 2개 변수가 **정확히** 설정되어 있는지 확인:

   ```
   NEXT_PUBLIC_SUPABASE_URL
   값: https://mpljqcuqrrfwzamfyxnz.supabase.co
   Environment: Production, Preview, Development (모두 체크)
   ```

   ```
   NEXT_PUBLIC_SUPABASE_ANON_KEY
   값: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1wbGpxY3VxcnJmd3phbWZ5eG56Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzE1ODQwMDcsImV4cCI6MjA0NzE2MDAwN30.T8DL7aH9Ak4mmbfJpSOnN1N1TfwVHhWO5EbTh-Pm-xU
   Environment: Production, Preview, Development (모두 체크)
   ```

3. **주의사항**
   - 변수명 앞뒤 공백 없는지 확인
   - 값에 따옴표 없는지 확인 (따옴표 제거)
   - Production 환경에 체크되어 있는지 확인

### 2단계: 환경 변수 수정 후 재배포

환경 변수를 수정했다면 **반드시 재배포** 필요:

```bash
cd F:\bas_meta\dashboard
vercel --prod --force
```

또는 Vercel Dashboard에서:
1. Deployments 탭
2. 최신 배포 오른쪽 ... 메뉴
3. "Redeploy" 클릭
4. "Use existing Build Cache" 체크 해제
5. Redeploy 버튼 클릭

### 3단계: Supabase RLS 확인 (환경 변수 정상인데도 안 되는 경우)

Supabase SQL Editor에서 실행:

```sql
-- 1. RLS 상태 확인
SELECT
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND tablename LIKE 'raw_data%';

-- 2. RLS가 활성화되어 있다면 정책 확인
SELECT
  schemaname,
  tablename,
  policyname,
  roles,
  cmd
FROM pg_policies
WHERE schemaname = 'public';

-- 3. 뷰에 대한 권한 확인
SELECT
  grantor,
  grantee,
  table_schema,
  table_name,
  privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
AND table_name LIKE 'v_%';
```

**RLS 비활성화 (개발 단계만)**:
```sql
-- 주의: 프로덕션에서는 RLS를 적절히 설정해야 함
ALTER TABLE raw_data_2025_09 DISABLE ROW LEVEL SECURITY;
ALTER TABLE raw_data_2025_10 DISABLE ROW LEVEL SECURITY;
ALTER TABLE raw_data_2025_11 DISABLE ROW LEVEL SECURITY;
```

**또는 익명 사용자에게 SELECT 권한 부여**:
```sql
-- anon 역할에게 뷰 조회 권한 부여
GRANT SELECT ON v_daily_trend_7d TO anon;
GRANT SELECT ON v_platform_performance_30d TO anon;
GRANT SELECT ON v_top_ads_7d TO anon;

-- 모든 테이블에 대한 SELECT 권한
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
```

### 4단계: 브라우저 콘솔 확인

Vercel 프로덕션 URL에서:
1. F12 (개발자 도구)
2. Console 탭 확인
3. Network 탭에서 API 요청 확인
4. 에러 메시지 복사

특히 다음 에러를 찾아보세요:
```
Error fetching daily trend: [에러 내용]
Error fetching platform performance: [에러 내용]
Error fetching KPI summary: [에러 내용]
Error fetching top ads: [에러 내용]
```

---

## 🔧 빠른 테스트

### 로컬에서 프로덕션 환경 변수로 테스트

```bash
# .env.local을 .env.local.backup으로 백업
cd F:\bas_meta\dashboard
copy .env.local .env.local.backup

# .env.production 복사
copy .env.production .env.local

# 개발 서버 재시작
npm run dev
```

로컬에서도 안 보이면 → 환경 변수 문제
로컬에서 잘 보이면 → Vercel 환경 변수 설정 문제

테스트 후 원래대로:
```bash
copy .env.local.backup .env.local
```

---

## 📊 체크리스트

배포 후 확인:

- [ ] Vercel 환경 변수 2개 정확히 설정됨
- [ ] Production 환경에 체크됨
- [ ] 환경 변수 값에 따옴표 없음
- [ ] 재배포 완료 (캐시 클리어)
- [ ] Supabase RLS 비활성화 또는 권한 부여
- [ ] 브라우저 콘솔에 에러 없음
- [ ] Network 탭에서 데이터 로드 확인

---

## 🚨 여전히 안 되는 경우

다음 명령어로 Vercel 로그 확인:

```bash
vercel logs https://dashboard-b0fa4jh7h-mkt9834-4301s-projects.vercel.app
```

또는 Vercel Dashboard:
1. Deployments 탭
2. 최신 배포 클릭
3. "Runtime Logs" 확인

에러 메시지를 공유해주세요!

---

**작성일**: 2025-11-21
**우선순위**: 🔴 긴급
