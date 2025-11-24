# Supabase 2025 최신 가이드

**작성일**: 2025-11-19
**출처**: Supabase 공식 문서, GitHub, Reddit, Google 검색

---

## 🔧 Supabase CLI 사용법 (2025 최신)

### 설치 방법

#### Node.js 환경
```bash
# npx로 직접 실행 (설치 불필요)
npx supabase --help

# 또는 프로젝트 개발 의존성으로 설치
npm install supabase --save-dev
```

#### macOS
```bash
brew install supabase/tap/supabase
```

#### Windows
```bash
# Scoop 패키지 매니저 사용
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase
```

#### Linux
- Homebrew 또는 `.apk`, `.deb`, `.rpm` 패키지 사용 가능

### 기본 사용법

```bash
# 1. 새 로컬 프로젝트 초기화
supabase init

# 2. Supabase 서비스 시작
supabase start
```

**출력 정보**:
- **Studio URL**: http://localhost:54323
- **DB URL**: postgresql://postgres:postgres@localhost:54322/postgres
- **anon key**, **service_role key** 포함

### 데이터베이스 연결

**로컬 개발**:
```bash
postgresql://postgres:postgres@localhost:54322/postgres
```

**원격 프로젝트**:
```bash
supabase link --project-ref <project-ref>
```

**중요**: 엣지 함수에서 로컬 DB 접근 시 `localhost` 대신 `host.docker.internal` 사용

---

## 🌐 Supabase MCP (Model Context Protocol) 사용법

### MCP란?

**Model Context Protocol**은 LLM(대규모 언어 모델)을 Supabase에 연결하는 표준 프로토콜입니다.
AI 어시스턴트(Claude, Cursor 등)가 Supabase 프로젝트와 직접 상호작용할 수 있습니다.

**프로토콜 버전**: `2025-06-18`
**호스팅 URL**: `https://mcp.supabase.com/mcp`

### 지원 AI 도구

- **Cursor**
- **Claude Code**
- **Windsurf**
- **VS Code** (MCP 확장 설치 필요)

### Cursor 연동 방법

#### 자동 설정 (권장)
Supabase 공식 문서에서 제공하는 **원클릭 설치 버튼** 사용

#### 수동 설정
`.cursor/mcp.json` 파일 생성:
```json
{
  "mcpServers": {
    "supabase": {
      "type": "http",
      "url": "https://mcp.supabase.com/mcp"
    }
  }
}
```

### 인증 방식

#### 1. 동적 클라이언트 등록 (기본값 - 권장)
- 별도 PAT(Personal Access Token) 생성 불필요
- 브라우저 기반 OAuth 2.1 자동 인증
- 가장 안전하고 간편한 방법

#### 2. CI 환경 인증
```json
{
  "mcpServers": {
    "supabase": {
      "type": "http",
      "url": "https://mcp.supabase.com/mcp",
      "headers": {
        "Authorization": "Bearer <your-pat-token>"
      }
    }
  }
}
```

#### 3. 수동 OAuth 앱 설정
Supabase 대시보드 → OAuth 앱 섹션에서 애플리케이션 생성

### 주요 기능

#### 데이터베이스 관리
- ✅ 테이블 목록 조회
- ✅ SQL 쿼리 실행
- ✅ 마이그레이션 적용
- ✅ 스키마 변경 추적

#### 계정 관리
- ✅ 프로젝트 목록/생성
- ✅ 조직 정보 조회
- ✅ 프로젝트 일시 정지/복구

#### 개발 지원
- ✅ TypeScript 타입 자동 생성
- ✅ API 키 조회
- ✅ 엣지 함수 배포

#### 디버깅
- ✅ 서비스별 로그 조회 (API, PostgreSQL, Auth 등)
- ✅ 보안 취약점 및 성능 조언

### 보안 설정

#### 읽기 전용 모드
```json
{
  "mcpServers": {
    "supabase": {
      "type": "http",
      "url": "https://mcp.supabase.com/mcp?read_only=true"
    }
  }
}
```

#### 특정 프로젝트 제한
```json
{
  "mcpServers": {
    "supabase": {
      "type": "http",
      "url": "https://mcp.supabase.com/mcp?project_ref=mpljqcuqrrfwzamfyxnz"
    }
  }
}
```

#### 기능 선택 활성화
```json
{
  "mcpServers": {
    "supabase": {
      "type": "http",
      "url": "https://mcp.supabase.com/mcp?features=database,docs"
    }
  }
}
```

**사용 가능한 features**:
- `database` - 데이터베이스 작업
- `docs` - 문서 조회
- `account` - 계정 관리
- `logs` - 로그 조회

### 🚨 보안 권장사항 (필수 준수)

1. ❌ **프로덕션 데이터에 절대 연결 금지**
   - MCP는 개발/테스트 환경 전용

2. ✅ **읽기 전용 모드 사용**
   - 실제 데이터 필요 시 `read_only=true` 설정

3. ✅ **프로젝트 범위 지정**
   - `project_ref` 파라미터로 특정 프로젝트만 접근

4. ✅ **프롬프트 인젝션 방지**
   - 도구 호출 수동 승인 유지
   - AI 어시스턴트가 자동 실행하지 않도록 설정

5. ✅ **최소 권한 원칙**
   - 필요한 features만 활성화

---

## 📊 Supabase 파티션 생성 및 관리

### 파티션 생성 방법

#### 1. 부모 테이블 생성 (Range Partitioning)

```sql
CREATE TABLE raw_data (
  id BIGSERIAL,
  client_id UUID NOT NULL,
  date DATE NOT NULL,
  ad_id VARCHAR(50) NOT NULL,
  -- 기타 컬럼...
  PRIMARY KEY (date, id)  -- ⚠️ 파티셔닝 컬럼 포함 필수
)
PARTITION BY RANGE (date);
```

**중요**: 파티셔닝 컬럼을 **모든 고유 인덱스에 포함**해야 합니다.

#### 2. 파티션 생성

**월별 파티션 예시**:
```sql
-- 2025년 1월
CREATE TABLE raw_data_2025_01 PARTITION OF raw_data
  FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');

-- 2025년 2월
CREATE TABLE raw_data_2025_02 PARTITION OF raw_data
  FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');

-- 2025년 3월
CREATE TABLE raw_data_2025_03 PARTITION OF raw_data
  FOR VALUES FROM ('2025-03-01') TO ('2025-04-01');
```

**범위 규칙**:
- FROM은 **포함** (inclusive)
- TO는 **제외** (exclusive)
- 범위가 겹치면 안 됨

#### 3. Supabase SQL Editor에서 실행

1. Supabase Dashboard 접속
2. **SQL Editor** 탭 클릭
3. 위 SQL 복사 → 붙여넣기
4. **Run** 버튼 클릭

**결과**:
```
Success. No rows returned
```
→ 정상적으로 파티션 생성됨

### 파티셔닝 유형

#### Range Partitioning (범위 기반)
```sql
PARTITION BY RANGE (date)
```
- 날짜, 숫자 범위로 분할
- 예: 월별, 연도별, 금액 범위별

#### List Partitioning (목록 기반)
```sql
PARTITION BY LIST (region)
```
- 특정 값 목록으로 분할
- 예: 지역별, 카테고리별

#### Hash Partitioning (해시 기반)
```sql
PARTITION BY HASH (id)
```
- 해시 함수로 균등 분산
- 예: 부하 분산용

### 파티션 쿼리 방법

**부모 테이블 조회** (권장):
```sql
SELECT * FROM raw_data WHERE date >= '2025-01-01' AND date < '2025-02-01';
```
→ PostgreSQL이 자동으로 `raw_data_2025_01` 파티션만 스캔

**특정 파티션 직접 조회**:
```sql
SELECT * FROM raw_data_2025_01;
```

### 파티션 관리 도구

#### pg_partman (자동화 도구)

**설치**:
```sql
CREATE EXTENSION pg_partman;
```

**기본 설정**:
```sql
SELECT partman.create_parent(
  p_parent_table := 'public.raw_data',
  p_control := 'date',
  p_type := 'native',
  p_interval := 'monthly',
  p_premake := 3  -- 미래 3개월 미리 생성
);
```

**유지보수 함수** (크론 작업 필요):
```sql
CALL partman.run_maintenance();
```

**⚠️ 주의**: Supabase 공식 문서에서는 pg_partman 사용법을 상세히 다루지 않으므로, 수동 생성을 권장합니다.

---

## 🎯 BAS Meta 프로젝트 적용 방법

### 현재 상황

- ✅ **11월, 12월 파티션**: 이미 생성됨 (현재 사용 중)
- ❌ **1~10월 파티션**: 미생성 (Backfill 데이터 저장 불가)

### 해결 방법

#### 방법 1: Supabase SQL Editor에서 수동 생성 (권장)

1. **Supabase Dashboard 접속**
   - https://supabase.com/dashboard/project/mpljqcuqrrfwzamfyxnz

2. **SQL Editor 열기**

3. **다음 SQL 실행**:

```sql
-- 1월 파티션
CREATE TABLE IF NOT EXISTS raw_data_2025_01 PARTITION OF raw_data
  FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');

-- 2월 파티션
CREATE TABLE IF NOT EXISTS raw_data_2025_02 PARTITION OF raw_data
  FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');

-- 3월 파티션
CREATE TABLE IF NOT EXISTS raw_data_2025_03 PARTITION OF raw_data
  FOR VALUES FROM ('2025-03-01') TO ('2025-04-01');

-- 4월 파티션
CREATE TABLE IF NOT EXISTS raw_data_2025_04 PARTITION OF raw_data
  FOR VALUES FROM ('2025-04-01') TO ('2025-05-01');

-- 5월 파티션
CREATE TABLE IF NOT EXISTS raw_data_2025_05 PARTITION OF raw_data
  FOR VALUES FROM ('2025-05-01') TO ('2025-06-01');

-- 6월 파티션
CREATE TABLE IF NOT EXISTS raw_data_2025_06 PARTITION OF raw_data
  FOR VALUES FROM ('2025-06-01') TO ('2025-07-01');

-- 7월 파티션
CREATE TABLE IF NOT EXISTS raw_data_2025_07 PARTITION OF raw_data
  FOR VALUES FROM ('2025-07-01') TO ('2025-08-01');

-- 8월 파티션
CREATE TABLE IF NOT EXISTS raw_data_2025_08 PARTITION OF raw_data
  FOR VALUES FROM ('2025-08-01') TO ('2025-09-01');

-- 9월 파티션
CREATE TABLE IF NOT EXISTS raw_data_2025_09 PARTITION OF raw_data
  FOR VALUES FROM ('2025-09-01') TO ('2025-10-01');

-- 10월 파티션
CREATE TABLE IF NOT EXISTS raw_data_2025_10 PARTITION OF raw_data
  FOR VALUES FROM ('2025-10-01') TO ('2025-11-01');
```

4. **Run 버튼 클릭**

**예상 결과**:
```
Success. No rows returned
```

#### 방법 2: Supabase MCP로 Claude에서 직접 생성

**전제조건**: Cursor 또는 Claude Code에 Supabase MCP 설정 완료

**실행 방법**:
```
Claude에게 요청:
"Supabase MCP를 사용하여 raw_data 테이블의 2025년 1~10월 파티션을 생성해줘"
```

Claude가 자동으로 SQL 실행 및 검증

### 검증 방법

**파티션 목록 확인**:
```sql
SELECT
  tablename,
  pg_size_pretty(pg_total_relation_size('public.' || tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename LIKE 'raw_data_2025%'
ORDER BY tablename;
```

**예상 출력**:
```
tablename          | size
-------------------+--------
raw_data_2025_01  | 8192 bytes
raw_data_2025_02  | 8192 bytes
...
raw_data_2025_11  | 1024 kB
raw_data_2025_12  | 8192 bytes
```

---

## 🔍 알려진 이슈

### 1. CLI에서 RLS 파티션 테이블 오류

**문제**: `supabase db diff` 실행 시 파티션 테이블에 RLS가 활성화되어 있으면 `NotImplementedError` 발생

**원인**: schemainspect 라이브러리가 파티션 테이블의 RLS 메타데이터를 처리하지 못함

**해결**: Supabase CLI 팀에서 수정 중 (Issue #3612)

### 2. Pooler 연결 에러 (`Tenant or user not found`)

**문제**: Pooler URL로 연결 시 인증 실패

**해결**:
```javascript
// ❌ Pooler (6543 포트)
postgresql://postgres.mpljqcuqrrfwzamfyxnz:password@aws-0-us-east-1.pooler.supabase.com:6543/postgres

// ✅ Direct Connection (5432 포트)
postgresql://postgres:password@db.mpljqcuqrrfwzamfyxnz.supabase.co:5432/postgres
```

**권장**: Direct Connection 사용 또는 Supabase JS 클라이언트 사용

---

## 📚 참고 자료

### 공식 문서
- **Supabase CLI**: https://supabase.com/docs/guides/local-development/cli/getting-started
- **Supabase MCP**: https://supabase.com/docs/guides/getting-started/mcp
- **Partitioning**: https://supabase.com/docs/guides/database/partitions
- **pg_partman**: https://supabase.com/docs/guides/database/extensions/pg_partman

### GitHub 리포지토리
- **Supabase CLI**: https://github.com/supabase/cli
- **Supabase MCP**: https://github.com/supabase-community/supabase-mcp

### 커뮤니티 프로젝트
- **alexander-zuev/supabase-mcp-server**: 고급 MCP 서버 (마이그레이션, 로그 등)
- **HenkDz/selfhosted-supabase-mcp**: 자체 호스팅 Supabase용 MCP

---

**마지막 업데이트**: 2025-11-19
**작성자**: Claude (검색 기반)
**프로젝트**: BAS Meta Ads Analytics
