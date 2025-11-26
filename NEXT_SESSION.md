# 다음 세션 작업 요청

**작성일**: 2025-11-26
**상태**: 클라이언트 관리 기능 구현 완료

---

## 1. 이번 세션 완료 작업

### 플랫폼별 성과 배포 이슈 해결 ✅
- **원인**: `raw_data` 테이블 RLS 정책으로 anon 키 접근 차단
- **해결**: `raw_data` 테이블에 anon 읽기 정책 추가
```sql
CREATE POLICY "Allow anon read access for raw_data"
ON raw_data FOR SELECT TO anon USING (true);
```

### 클라이언트 관리 기능 구현 ✅
- 관리자 페이지: `/admin?admin=관리자키`
- API 라우트: `/api/clients` (CRUD)
- service_role 키 분리 (`lib/supabase-admin.ts`)

### 입력 필드
| 필드 | 필수 | 설명 |
|------|------|------|
| 클라이언트명 | ✅ | 회사/브랜드 이름 |
| 이메일 | ✅ | 연락용 이메일 |
| Meta 광고계정 ID | - | act_XXXXXXXXX |
| Meta Access Token | - | 장기 토큰 (생성 시만) |
| 텔레그램 채팅 ID | - | 리포트 발송용 |
| 플랜 타입 | - | free/basic/premium |
| 월 목표 리드 | - | 숫자 |
| 월 목표 예산 ($) | - | 달러 |
| 목표 CPL ($) | - | 달러 |

### Supabase 마이그레이션 (실행 완료)
```sql
-- clients 테이블에 telegram_chat_id 컬럼 추가
ALTER TABLE clients ADD COLUMN IF NOT EXISTS telegram_chat_id VARCHAR(50);
CREATE INDEX IF NOT EXISTS idx_clients_telegram_chat_id ON clients(telegram_chat_id);
```

---

## 2. 생성된 파일

| 파일 | 설명 |
|------|------|
| `dashboard/lib/supabase-admin.ts` | service_role 키 사용 (서버 전용) |
| `dashboard/app/api/clients/route.ts` | 클라이언트 CRUD API |
| `dashboard/app/admin/page.tsx` | 관리자 페이지 UI |
| `sql/17_raw_data_rls_policy.sql` | raw_data RLS 정책 |
| `sql/18_add_telegram_chat_id.sql` | telegram_chat_id 컬럼 |

---

## 3. Vercel 환경변수 추가 필요

Vercel Dashboard에서 다음 환경변수 추가:
```
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```
(service_role 키 - 클라이언트 관리 API용)

---

## 4. 다음 작업 예정

1. **Vercel 배포 후 테스트**
   - 클라이언트 관리 페이지 테스트
   - 새 클라이언트 생성 테스트

2. **텔레그램 리포트 연동**
   - 클라이언트별 telegram_chat_id 사용하여 리포트 발송

3. **대시보드 기능 개선**
   - 목표 대비 실적 표시
   - 월간 리포트 기능

---

## 5. 개발 서버

```bash
cd F:/bas_meta/dashboard && npm run dev
```

### URL
- **로컬 대시보드**: http://localhost:3000?admin=a3f8c2e1-9d4b-4f7a-b6c5-8e2d1f0a9b3c
- **관리자 페이지**: http://localhost:3000/admin?admin=a3f8c2e1-9d4b-4f7a-b6c5-8e2d1f0a9b3c
- **배포 대시보드**: https://bas-meta-ads-git-main-mkt9834-4301s-projects.vercel.app/?client=79e35fc6-a817-4ccc-9d5d-9a93c1ad4515
