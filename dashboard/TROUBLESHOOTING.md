# 대시보드 트러블슈팅 가이드

**날짜**: 2025-11-21
**프로젝트**: BAS Meta Ads Dashboard

---

## 🐛 "Server Components render error" 해결

### 증상

```
Error: An error occurred in the Server Components render.
The specific message is omitted in production builds to avoid leaking sensitive details.
```

### 원인

1. **Supabase 뷰가 생성되지 않음**
2. **데이터가 없음**
3. **RLS (Row Level Security) 정책 문제**
4. **환경 변수 오류**

---

## ✅ 해결 방법

### 1단계: Supabase 뷰 확인

1. Supabase Dashboard 접속: https://supabase.com/dashboard
2. 프로젝트 선택: `mpljqcuqrrfwzamfyxnz`
3. **SQL Editor** 메뉴 클릭
4. 다음 SQL 실행:

```sql
-- 뷰 목록 확인
SELECT viewname
FROM pg_views
WHERE schemaname = 'public'
AND viewname LIKE 'v_%'
ORDER BY viewname;
```

**예상 결과** (3개 뷰가 있어야 함):
```
v_daily_trend_7d
v_platform_performance_30d
v_top_ads_7d
```

### 2단계: 뷰가 없는 경우 - 뷰 생성

`check-supabase-views.sql` 파일을 Supabase SQL Editor에서 실행하여 확인 후, 뷰가 없다면 다음 파일 참조:

📁 **참조 파일**: `F:\bas_meta\sql\03_analysis_views.sql`

1. Supabase SQL Editor에서 `03_analysis_views.sql` 내용 붙여넣기
2. **Run** 버튼 클릭
3. 성공 메시지 확인

### 3단계: 데이터 확인

```sql
-- 각 뷰의 데이터 개수 확인
SELECT 'v_daily_trend_7d' AS view_name, COUNT(*) AS row_count
FROM v_daily_trend_7d
UNION ALL
SELECT 'v_platform_performance_30d', COUNT(*)
FROM v_platform_performance_30d
UNION ALL
SELECT 'v_top_ads_7d', COUNT(*)
FROM v_top_ads_7d;
```

**예상 결과**:
```
view_name                      | row_count
-------------------------------+-----------
v_daily_trend_7d              | 7 (최근 7일)
v_platform_performance_30d    | 2-5 (플랫폼 수)
v_top_ads_7d                  | 10 (Top 10)
```

**데이터가 0인 경우**:
- `raw_data_YYYY_MM` 테이블에 데이터가 있는지 확인
- Backfill 작업 실행 필요 (`F:\bas_meta\lib\backfill.js`)

### 4단계: RLS (Row Level Security) 비활성화

뷰는 기본적으로 RLS가 적용되지 않지만, 만약 문제가 있다면:

```sql
-- RLS 상태 확인
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public';

-- 필요시 RLS 비활성화 (개발 환경만)
ALTER TABLE raw_data_2025_09 DISABLE ROW LEVEL SECURITY;
ALTER TABLE raw_data_2025_10 DISABLE ROW LEVEL SECURITY;
ALTER TABLE raw_data_2025_11 DISABLE ROW LEVEL SECURITY;
```

⚠️ **주의**: 프로덕션 환경에서는 RLS를 적절히 설정하세요.

### 5단계: Vercel 환경 변수 재확인

1. Vercel Dashboard → Settings → Environment Variables
2. 다음 2개 변수 확인:

```
NEXT_PUBLIC_SUPABASE_URL = https://mpljqcuqrrfwzamfyxnz.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY = eyJhbGc... (전체 키)
```

3. **Redeploy** (캐시 클리어)

### 6단계: 로컬 테스트

로컬에서 먼저 확인:

```bash
cd F:\bas_meta\dashboard
npm run dev
```

브라우저에서 http://localhost:3000 접속
- 에러 발생 시 콘솔에 자세한 에러 메시지 표시됨

### 7단계: Vercel 재배포 (캐시 클리어)

```bash
cd F:\bas_meta\dashboard
vercel --prod --force
```

---

## 🔍 상세 디버깅

### 로컬 개발 서버 에러 확인

```bash
cd F:\bas_meta\dashboard
npm run dev
```

터미널에 표시되는 에러 메시지:
- `Missing Supabase environment variables` → `.env.local` 확인
- `relation "v_daily_trend_7d" does not exist` → Supabase 뷰 생성
- `no rows returned` → 데이터 backfill 필요

### Vercel 런타임 로그 확인

```bash
vercel logs https://dashboard-[your-hash].vercel.app
```

페이지를 새로고침하면 실시간 에러 로그 확인 가능

### Supabase에서 직접 쿼리 테스트

Supabase SQL Editor에서:

```sql
-- API와 동일한 쿼리 실행
SELECT * FROM v_daily_trend_7d ORDER BY date ASC;
SELECT * FROM v_platform_performance_30d ORDER BY spend DESC;
SELECT * FROM v_top_ads_7d LIMIT 10;
```

에러 발생 시 에러 메시지로 원인 파악

---

## 📋 체크리스트

문제 해결을 위한 순서:

- [ ] 1. Supabase 뷰 3개 존재 확인
- [ ] 2. 각 뷰에 데이터가 있는지 확인
- [ ] 3. RLS 정책 확인 (필요시 비활성화)
- [ ] 4. Vercel 환경 변수 2개 설정 확인
- [ ] 5. 로컬 개발 서버에서 정상 작동 확인
- [ ] 6. Vercel 재배포 (캐시 클리어)
- [ ] 7. 배포된 URL 접속하여 확인

---

## 🚨 여전히 안 되는 경우

### 임시 해결책: Mock 데이터 사용

`lib/api.ts` 파일에 fallback 추가:

```typescript
export async function getDailyTrend7d(): Promise<DailyTrend[]> {
  try {
    const { data, error } = await supabase
      .from('v_daily_trend_7d')
      .select('*')
      .order('date', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching daily trend:', error);
    // Fallback: 빈 배열 반환
    return [];
  }
}
```

이렇게 하면 에러가 발생해도 빈 대시보드가 표시됩니다.

---

## 📞 지원

추가 도움이 필요하면:

1. **Supabase 상태 확인**: https://status.supabase.com
2. **Vercel 상태 확인**: https://www.vercel-status.com
3. **프로젝트 문서**: `PHASE6_SUPABASE_VIEWS_MANUAL.md` 참조

---

**작성일**: 2025-11-21
**프로젝트**: BAS Meta Ads Dashboard
