# 멀티클라이언트 대시보드 기획서

**작성일**: 2025-11-25
**상태**: 기획 완료, 구현 대기
**버전**: 1.1 (피드백 반영)

---

## 0. 검토 의견 반영 사항

### ✅ 반영된 피드백

| 항목 | 원본 | 수정 |
|------|------|------|
| Slug 보안 | `bizactorschool` | `bas-k92m7x` (난수 접미사) |
| Admin Key | 간단한 문자열 | UUID 형식 (복잡한 문자열) |
| AI Insights | 저장 여부 미확인 | DB 저장 확인됨 (ai_insights 컬럼 존재) |
| Admin 초기화면 | 전체 데이터 혼합 | 클라이언트 선택 드롭다운 기본값 |

### ⚠️ 보안 인지 사항
- `NEXT_PUBLIC_` 접두사 환경변수는 브라우저에 노출됨
- Admin URL 유출 시 모든 데이터 접근 가능
- **대응**: Admin Key를 UUID 수준으로 복잡하게 설정

---

## 1. 개요

### 1.1 목적
- 여러 클라이언트의 광고 성과를 개별적으로 관리
- 클라이언트별 전용 대시보드 링크 제공
- 관리자(나)는 전체 클라이언트 데이터 조회 가능

### 1.2 현재 상태
- 단일 클라이언트(비즈액터스쿨)만 지원
- 모든 데이터가 하나의 대시보드에 표시
- 클라이언트 구분 없이 접근 가능

### 1.3 목표 상태
- 클라이언트별 격리된 데이터 조회
- URL 파라미터로 클라이언트 식별
- 관리자 전용 전체 보기 기능

---

## 2. 접근 제어 설계

### 2.1 URL 구조

| 접근 유형 | URL | 권한 |
|----------|-----|------|
| 관리자 전체 보기 | `/reports?admin=ADMIN_SECRET_KEY` | 모든 클라이언트 |
| 클라이언트 전용 | `/reports?client=CLIENT_ID` | 해당 클라이언트만 |
| 파라미터 없음 | `/reports` | **접근 차단** |

### 2.2 환경 변수

```env
# .env.local (대시보드)
# UUID 형식으로 복잡하게 설정 (예시)
NEXT_PUBLIC_ADMIN_KEY=a3f8c2e1-9d4b-4f7a-b6c5-8e2d1f0a9b3c
```

> ⚠️ **주의**: `NEXT_PUBLIC_` 접두사 변수는 브라우저에서 확인 가능합니다.
> Admin Key는 UUID 수준의 복잡한 문자열로 설정하세요.

### 2.3 접근 로직

```typescript
// 접근 제어 순서
1. admin 파라미터 확인 → 일치하면 전체 데이터
2. client 파라미터 확인 → 해당 클라이언트 데이터만
3. 둘 다 없음 → "접근 권한 없음" 표시
```

---

## 3. 데이터베이스 구조

### 3.1 기존 테이블 (변경 없음)

```sql
-- clients 테이블 (이미 존재)
CREATE TABLE clients (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,           -- '비즈액터스쿨'
  slug TEXT UNIQUE,             -- 'bizactorschool' (URL용)
  meta_account_id TEXT,
  telegram_chat_id TEXT,        -- 클라이언트별 텔레그램 채널
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ
);

-- telegram_reports 테이블 (이미 client_id 컬럼 있음)
-- daily_aggregates 테이블 (이미 client_id 컬럼 있음)
```

### 3.2 clients 테이블 slug 컬럼 추가

```sql
-- slug 컬럼 추가 (URL 친화적 식별자)
ALTER TABLE clients ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE;

-- 기존 클라이언트 업데이트 (난수 접미사로 추측 방지)
-- 형식: {prefix}-{random6자}
UPDATE clients SET slug = 'bas-k92m7x' WHERE name = '비즈액터스쿨';

-- 새 클라이언트 추가 시 예시
-- INSERT INTO clients (name, slug, ...) VALUES ('클라이언트B', 'clientb-x8p3q2', ...);
```

> 💡 **Slug 생성 규칙**: `{짧은이름}-{난수6자}` 형식으로 추측 어렵게

---

## 4. 대시보드 페이지 수정

### 4.1 /reports 페이지

#### 4.1.1 접근 제어 컴포넌트

```typescript
// app/reports/page.tsx

'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

const ADMIN_KEY = process.env.NEXT_PUBLIC_ADMIN_KEY;

export default function ReportsPage() {
  const searchParams = useSearchParams();
  const [accessMode, setAccessMode] = useState<'admin' | 'client' | 'denied'>('denied');
  const [clientId, setClientId] = useState<string | null>(null);
  const [clientName, setClientName] = useState<string>('');

  useEffect(() => {
    const adminKey = searchParams.get('admin');
    const clientSlug = searchParams.get('client');

    if (adminKey === ADMIN_KEY) {
      // 관리자 접근: 전체 데이터
      setAccessMode('admin');
      setClientId(null);
    } else if (clientSlug) {
      // 클라이언트 접근: 해당 클라이언트만
      setAccessMode('client');
      fetchClientBySlug(clientSlug);
    } else {
      // 접근 거부
      setAccessMode('denied');
    }
  }, [searchParams]);

  async function fetchClientBySlug(slug: string) {
    const { data } = await supabase
      .from('clients')
      .select('id, name')
      .eq('slug', slug)
      .single();

    if (data) {
      setClientId(data.id);
      setClientName(data.name);
    } else {
      setAccessMode('denied');
    }
  }

  // 접근 거부 화면
  if (accessMode === 'denied') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">접근 권한 없음</h1>
          <p className="text-gray-600">유효한 링크를 통해 접속해주세요.</p>
        </div>
      </div>
    );
  }

  // 이하 기존 코드...
  // fetchReports() 호출 시 clientId 조건 추가
}
```

#### 4.1.2 데이터 조회 수정

```typescript
async function fetchReports() {
  let query = supabase
    .from('telegram_reports')
    .select('*')
    .order('week_start', { ascending: false })
    .limit(50);

  // 클라이언트 모드면 필터링
  if (accessMode === 'client' && clientId) {
    query = query.eq('client_id', clientId);
  }

  // 리포트 타입 필터
  if (filterType !== 'all') {
    query = query.eq('report_type', filterType);
  }

  const { data, error } = await query;
  // ...
}
```

#### 4.1.3 헤더에 클라이언트 표시

```typescript
// 클라이언트 모드일 때 헤더에 표시
{accessMode === 'client' && (
  <div className="mb-4 px-4 py-2 bg-blue-50 rounded-lg">
    <span className="text-blue-700 font-medium">{clientName}</span>
    <span className="text-blue-500 ml-2">리포트</span>
  </div>
)}

{accessMode === 'admin' && (
  <div className="mb-4 px-4 py-2 bg-purple-50 rounded-lg flex items-center justify-between">
    <div>
      <span className="text-purple-700 font-medium">🔐 관리자 모드</span>
    </div>
    {/* 클라이언트 선택 드롭다운 (기본: 선택 안됨) */}
    <select
      className="border rounded px-3 py-1 text-sm"
      value={selectedClientId || ''}
      onChange={(e) => setSelectedClientId(e.target.value || null)}
    >
      <option value="">클라이언트 선택...</option>
      {clients.map(c => (
        <option key={c.id} value={c.id}>{c.name}</option>
      ))}
    </select>
  </div>
)}
```

### 4.2 메인 대시보드 (/) 페이지

동일한 접근 제어 패턴 적용:

```typescript
// app/page.tsx

// 관리자: 전체 데이터 + 클라이언트 선택 드롭다운
// 클라이언트: 본인 데이터만
// 파라미터 없음: 접근 차단
```

---

## 5. 텔레그램 리포트 연동

### 5.1 리포트 발송 시 대시보드 링크 추가

```javascript
// send-weekly-report.js / send-monthly-report.js

// 클라이언트 slug 조회
const { data: client } = await supabase
  .from('clients')
  .select('slug')
  .eq('id', clientId)
  .single();

// 대시보드 링크 생성
const dashboardUrl = `https://your-dashboard.vercel.app/reports?client=${client.slug}`;

// 메시지 푸터에 추가
const footerWithLink = `
━━━━━━━━━━━━━━━━━━━━━━
📊 *상세 리포트 보기*
${escapeMd(dashboardUrl)}
━━━━━━━━━━━━━━━━━━━━━━
`;
```

### 5.2 환경 변수 추가

```env
# .env
DASHBOARD_URL=https://your-dashboard.vercel.app
```

---

## 6. 개요 탭 AI 인사이트 추가

### 6.1 renderOverview() 수정

```typescript
function renderOverview() {
  // 기존 차트들...

  return (
    <div className="space-y-6">
      {/* 기존 트렌드 차트 */}
      {/* ... */}

      {/* AI 인사이트 섹션 추가 */}
      {selectedReport?.ai_insights && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200 p-4">
          <h4 className="text-sm font-semibold text-blue-800 mb-3 flex items-center gap-2">
            <span>🤖</span> AI 인사이트
          </h4>
          <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
            {cleanMarkdown(selectedReport.ai_insights)}
          </div>
        </div>
      )}
    </div>
  );
}
```

---

## 7. 구현 순서 (체크리스트)

### Phase 1: DB 준비 및 기본 접근 제어
- [ ] telegram_reports 테이블 ai_insights 컬럼 확인 (이미 존재)
- [ ] clients 테이블에 slug 컬럼 추가
- [ ] 기존 클라이언트에 slug 값 설정 (`bas-k92m7x` 형식)
- [ ] NEXT_PUBLIC_ADMIN_KEY 환경 변수 설정 (UUID 형식)
- [ ] /reports 페이지 접근 제어 구현
- [ ] 파라미터 없으면 "접근 권한 없음" 표시

### Phase 2: 데이터 필터링
- [ ] fetchReports()에 client_id 필터 추가
- [ ] 관리자 모드: 클라이언트 선택 드롭다운 (기본값: "선택...")
- [ ] 클라이언트 모드: 헤더에 클라이언트명 표시
- [ ] 최근 데이터 기본 표시 확인

### Phase 3: 텔레그램 연동
- [ ] send-weekly-report.js에 대시보드 링크 추가
- [ ] send-monthly-report.js에 대시보드 링크 추가
- [ ] DASHBOARD_URL 환경 변수 추가

### Phase 4: UI 개선
- [ ] 개요 탭에 AI 인사이트 섹션 추가
- [ ] 클라이언트별 브랜딩 (선택)
- [ ] 모바일 반응형 개선

### Phase 5: 메인 대시보드 (/)
- [ ] 동일한 접근 제어 패턴 적용
- [ ] 클라이언트별 데이터 필터링

### Phase 6: 테스트 (마지막)
- [ ] 접근 제어 테스트 (8.1 시나리오)
- [ ] 데이터 격리 테스트 (8.2 시나리오)
- [ ] AI 인사이트 표시 테스트

---

## 8. 테스트 시나리오

### 8.1 접근 제어 테스트

| 테스트 | URL | 예상 결과 |
|--------|-----|----------|
| 파라미터 없음 | `/reports` | "접근 권한 없음" |
| 잘못된 admin 키 | `/reports?admin=wrong` | "접근 권한 없음" |
| 올바른 admin 키 | `/reports?admin=correct` | 전체 데이터 |
| 존재하는 클라이언트 | `/reports?client=bizactorschool` | 해당 클라이언트 데이터 |
| 존재하지 않는 클라이언트 | `/reports?client=invalid` | "접근 권한 없음" |

### 8.2 데이터 격리 테스트

| 테스트 | 예상 결과 |
|--------|----------|
| 클라이언트 A 접속 시 | A 데이터만 표시, B 데이터 안 보임 |
| 클라이언트 B 접속 시 | B 데이터만 표시, A 데이터 안 보임 |
| 관리자 접속 시 | A, B 모든 데이터 표시 |

---

## 9. 보안 고려사항

### 9.1 현재 구현 (기본 보안)
- URL 파라미터 기반 접근 제어
- 관리자 키는 환경 변수로 관리
- 클라이언트는 slug만 알면 접근 가능

### 9.2 향후 강화 옵션
- **옵션 A**: 클라이언트별 고유 토큰 발급
- **옵션 B**: Supabase Auth 로그인 시스템
- **옵션 C**: 만료되는 임시 링크 (JWT 토큰)

### 9.3 현재 수준 평가
- 경쟁사가 아닌 일반 클라이언트 대상
- 민감한 개인정보 없음 (광고 성과 데이터)
- URL slug 추측 어려움 (랜덤 문자열 권장)
- **결론**: 현재 수준으로 충분, 필요시 강화

---

## 10. 비용 영향

| 항목 | 현재 | 10 클라이언트 | 50 클라이언트 |
|------|------|--------------|--------------|
| Vercel 호스팅 | $0 | $0 | $0 |
| Supabase DB | $0 | $0 | $0~25 |
| Gemini AI | $0 | $0.50/월 | $2.50/월 |
| **총 예상** | **$0** | **$0~1** | **$3~28** |

---

## 11. 파일 변경 목록

### 대시보드 (dashboard/)
```
dashboard/
├── app/
│   ├── page.tsx                 # 메인 대시보드 접근 제어
│   └── reports/
│       └── page.tsx             # 리포트 페이지 접근 제어
├── lib/
│   └── access-control.ts        # (신규) 접근 제어 유틸리티
└── .env.local                   # NEXT_PUBLIC_ADMIN_KEY 추가
```

### 백엔드 (루트)
```
/
├── send-weekly-report.js        # 대시보드 링크 추가
├── send-monthly-report.js       # 대시보드 링크 추가
├── .env                         # DASHBOARD_URL 추가
└── sql/
    └── 14_add_client_slug.sql   # (신규) slug 컬럼 추가
```

---

## 12. 실행 명령어

### SQL 실행
```sql
-- Supabase SQL Editor에서 실행
ALTER TABLE clients ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE;
UPDATE clients SET slug = 'bizactorschool' WHERE name = '비즈액터스쿨';
```

### 환경 변수 설정
```bash
# Vercel 환경 변수 추가
vercel env add NEXT_PUBLIC_ADMIN_KEY
# 값 입력: your-secret-admin-key-here
```

### 배포
```bash
cd dashboard && git add . && git commit -m "feat: 멀티클라이언트 접근 제어" && git push
```

---

## 13. 다음 세션 시작 명령

```
멀티클라이언트 대시보드 구현 시작해줘.
기획서: MULTI_CLIENT_DASHBOARD_SPEC.md
Phase 1부터 순서대로 진행해줘.
테스트는 Phase 6에서 마지막에 진행.
```

---

## 14. AI 인사이트 관련 메모

### 14.1 현재 상태
- `telegram_reports.ai_insights` 컬럼: ✅ 존재
- 리포트 발송 시 AI 생성 → DB 저장: ✅ 구현됨
- 대시보드 "원본" 탭에서 표시: ✅ 구현됨

### 14.2 추가 구현 (Phase 4)
- "개요" 탭에 AI 인사이트 섹션 추가
- 마크다운 클린업 후 보기 좋게 표시

### 14.3 AI 인사이트 활성화
```bash
# 리포트 발송 시 AI 인사이트 포함 (SKIP_AI 제거)
TELEGRAM_CHAT_ID=-1003394139746 node send-weekly-report.js

# AI 제외하고 싶을 때만
SKIP_AI=true TELEGRAM_CHAT_ID=-1003394139746 node send-weekly-report.js
```

---

**작성자**: Claude
**버전**: 1.1
**최종 수정**: 2025-11-25 (피드백 반영)
