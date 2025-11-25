-- 14_add_client_slug.sql
-- clients 테이블에 slug 컬럼 추가 (멀티클라이언트 대시보드용)
-- 실행: Supabase SQL Editor에서 실행

-- 1. slug 컬럼 추가 (URL 친화적 식별자)
ALTER TABLE clients ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE;

-- 2. 기존 클라이언트에 slug 값 설정
-- 형식: {짧은이름}-{난수6자} (추측 어렵게)
UPDATE clients
SET slug = 'bas-k92m7x'
WHERE client_name = '비즈액터스쿨' AND slug IS NULL;

-- 3. 인덱스 추가 (조회 성능 향상)
CREATE INDEX IF NOT EXISTS idx_clients_slug ON clients(slug);

-- 4. 확인
SELECT id, name, slug, is_active FROM clients;
