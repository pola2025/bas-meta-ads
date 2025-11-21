# Vercel 배포 가이드 - 환경 변수 Import 방식

**날짜**: 2025-11-21
**프로젝트**: BAS Meta Ads Dashboard

---

## 🚀 빠른 배포 (환경 변수 Import 방식)

### 1단계: Vercel 대시보드 접속

1. 브라우저에서 https://vercel.com 접속
2. 로그인
3. 프로젝트 선택: **dashboard** (mkt9834-4301s-projects/dashboard)

### 2단계: 환경 변수 Import

#### 방법 1: .env.local 파일 업로드 (가장 빠름)

1. Vercel 프로젝트 대시보드에서 **Settings** 탭 클릭
2. 왼쪽 메뉴에서 **Environment Variables** 선택
3. **Import .env** 버튼 클릭
4. `F:\bas_meta\dashboard\.env.local` 파일 선택 또는 드래그 앤 드롭
5. **Environment** 선택:
   - ✅ Production
   - ✅ Preview
   - ✅ Development (선택사항)
6. **Import** 버튼 클릭

#### 방법 2: 수동 입력

1. **Settings** → **Environment Variables**
2. **Add New** 버튼 클릭
3. 다음 2개 변수 입력:

**변수 1:**
```
Name: NEXT_PUBLIC_SUPABASE_URL
Value: https://mpljqcuqrrfwzamfyxnz.supabase.co
Environment: Production, Preview, Development (모두 체크)
```

**변수 2:**
```
Name: NEXT_PUBLIC_SUPABASE_ANON_KEY
Value: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1wbGpxY3VxcnJmd3phbWZ5eG56Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzE1ODQwMDcsImV4cCI6MjA0NzE2MDAwN30.T8DL7aH9Ak4mmbfJpSOnN1N1TfwVHhWO5EbTh-Pm-xU
Environment: Production, Preview, Development (모두 체크)
```

4. **Save** 버튼 클릭

### 3단계: 재배포

환경 변수 추가 후 자동으로 재배포되거나, 수동으로 재배포:

#### 방법 A: Vercel 대시보드에서

1. **Deployments** 탭 클릭
2. 최신 배포 옆 **···** (점 3개) 메뉴 클릭
3. **Redeploy** 선택
4. **Redeploy** 버튼 클릭

#### 방법 B: Vercel CLI에서

```bash
cd F:\bas_meta\dashboard
vercel --prod
```

### 4단계: 배포 확인

1. 배포 완료 후 URL 확인:
   - Production: `https://dashboard-xxxx.vercel.app`

2. 브라우저에서 접속하여 확인:
   - ✅ KPI 카드 4개 표시
   - ✅ 차트 2개 표시 (일별 트렌드, 플랫폼별 성과)
   - ✅ Top 광고 테이블 표시
   - ✅ 데이터 정상 로드

---

## 🔧 CLI로 환경 변수 설정 (대안)

만약 CLI로 설정하고 싶다면:

```bash
# .env.local 파일을 Vercel에 자동 import
cd F:\bas_meta\dashboard
vercel env pull .env.vercel.local

# 또는 수동으로 추가
vercel env add NEXT_PUBLIC_SUPABASE_URL
# 프롬프트에 값 입력: https://mpljqcuqrrfwzamfyxnz.supabase.co
# Environment 선택: production, preview (스페이스바로 선택)

vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
# 프롬프트에 값 입력: eyJhbGc...
# Environment 선택: production, preview
```

---

## 📋 환경 변수 목록

배포에 필요한 환경 변수:

| 변수명 | 값 | 설명 |
|--------|-----|------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://mpljqcuqrrfwzamfyxnz.supabase.co` | Supabase 프로젝트 URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJhbGc...` | Supabase 공개 익명 키 (브라우저 노출 안전) |

⚠️ **보안 주의**:
- `NEXT_PUBLIC_*` 변수는 브라우저에 노출됩니다
- `ANON_KEY`는 안전하지만, `SERVICE_ROLE_KEY`는 절대 클라이언트 측에 노출하면 안 됩니다

---

## 🐛 트러블슈팅

### 문제 1: "Missing Supabase environment variables" 에러

**원인**: 환경 변수가 Vercel에 설정되지 않음

**해결**:
1. Vercel 대시보드 → Settings → Environment Variables 확인
2. 2개 변수가 모두 있는지 확인
3. Production 환경에 체크되어 있는지 확인
4. 재배포

### 문제 2: 환경 변수 추가 후에도 에러 발생

**원인**: 빌드 캐시에 이전 값이 남아있음

**해결**:
```bash
cd F:\bas_meta\dashboard
vercel --prod --force  # 캐시 무시하고 재배포
```

또는 Vercel 대시보드에서:
1. Deployments 탭
2. Redeploy 선택 시 "Clear cache and redeploy" 체크

### 문제 3: 배포는 성공했지만 데이터가 안 보임

**원인**: Supabase 뷰가 생성되지 않았거나 권한 문제

**해결**:
1. Supabase Dashboard → SQL Editor
2. 다음 쿼리로 뷰 확인:
```sql
SELECT viewname FROM pg_views
WHERE schemaname = 'public' AND viewname LIKE 'v_%';
```

3. 뷰가 없으면 Phase 6 가이드 참조하여 뷰 생성
4. RLS (Row Level Security) 정책 확인

---

## 🎯 배포 완료 체크리스트

- [ ] `.env.local` 파일이 Vercel에 Import되었거나 환경 변수 2개가 수동으로 추가됨
- [ ] Production 환경에 환경 변수가 설정됨
- [ ] 재배포 완료
- [ ] 배포된 URL 접속 성공
- [ ] KPI 카드 4개 정상 표시
- [ ] 차트 2개 정상 표시
- [ ] 테이블 데이터 정상 로드

---

## 📂 배포된 URL

배포 완료 후 다음 URL로 접속 가능:

- **Production**: https://dashboard-[hash].vercel.app
  (예: https://dashboard-54l9zy8n3-mkt9834-4301s-projects.vercel.app)

- **Vercel 프로젝트**: https://vercel.com/mkt9834-4301s-projects/dashboard

---

## 🔄 향후 업데이트 시 배포

코드 변경 후 재배포:

```bash
cd F:\bas_meta\dashboard

# 변경사항 커밋
git add .
git commit -m "feat: Update dashboard features"

# Vercel에 배포
vercel --prod
```

또는 GitHub 연동 시 자동 배포:
1. GitHub 저장소 생성
2. Vercel 프로젝트를 GitHub 저장소와 연동
3. `git push` 시 자동 배포

---

**작성자**: Claude
**프로젝트**: BAS Meta Ads Dashboard
**날짜**: 2025-11-21
