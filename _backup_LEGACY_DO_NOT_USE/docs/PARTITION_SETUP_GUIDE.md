# 🔧 Supabase 파티션 생성 가이드

## 즉시 수행 필요!

과거 데이터(1~10월)를 저장하려면 Supabase에서 파티션을 생성해야 합니다.

---

## 단계별 가이드

### 1단계: Supabase 대시보드 열기

```
https://supabase.com/dashboard
```

프로젝트 선택: **BAS Meta Ads**

---

### 2단계: SQL Editor 열기

왼쪽 메뉴에서:
```
SQL Editor 클릭
```

---

### 3단계: SQL 복사 & 실행

아래 SQL을 복사하여 SQL Editor에 붙여넣고 **RUN** 클릭:

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

---

### 4단계: 파티션 생성 확인

다음 SQL을 실행하여 파티션이 생성되었는지 확인:

```sql
SELECT
  tablename,
  pg_size_pretty(pg_total_relation_size('public.'||tablename)) AS size
FROM pg_tables
WHERE tablename LIKE 'raw_data_2025_%'
ORDER BY tablename;
```

**예상 결과**:
```
raw_data_2025_01
raw_data_2025_02
raw_data_2025_03
...
raw_data_2025_10
raw_data_2025_11 (이미 존재)
```

---

### 5단계: Backfill 재실행

파티션 생성 후 다시 데이터 수집:

```bash
cd F:/bas_meta
node lib/backfill.js
```

이제 2,332개 레코드가 모두 저장됩니다!

---

## 문제 해결

### Q: "permission denied" 에러가 발생해요
**A**: Supabase 프로젝트의 **Database Settings** → **Connection String**에서 **Password**를 확인하고 `.env` 파일 업데이트

### Q: 파티션이 이미 존재한다고 나와요
**A**: 정상입니다! `IF NOT EXISTS` 때문에 중복 생성되지 않습니다.

### Q: Backfill 실행 시 여전히 에러가 나요
**A**:
1. Supabase에서 파티션이 정말 생성되었는지 확인 (4단계)
2. `.env` 파일의 `SUPABASE_SERVICE_KEY` 확인
3. 에러 메시지를 확인하여 다른 문제인지 파악

---

**작성일**: 2025-11-19
**프로젝트**: BAS Meta Ads Analytics
