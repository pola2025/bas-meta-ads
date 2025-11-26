-- ============================================================================
-- raw_data 테이블 RLS 정책 추가
-- ============================================================================
-- 목적: anon 키로 raw_data 테이블 읽기 허용 (플랫폼별 성과 조회용)
-- 날짜: 2025-11-26
--
-- 배경:
-- - 배포 환경에서 anon 키 사용 시 raw_data 접근 불가 문제
-- - getPlatformPerformance() 함수가 raw_data에서 facebook/instagram 구분 조회
-- - 로컬에서는 service_role 키로 RLS 우회하여 정상 작동
--
-- 보안 고려사항:
-- - raw_data에는 개인정보 없음 (광고 성과 지표만 포함)
-- - 대시보드 접근은 client UUID로 제어됨
-- - UUID는 추측 불가능한 랜덤 값
-- ============================================================================

-- raw_data 테이블에 anon 읽기 정책 추가
CREATE POLICY "Allow anon read access for raw_data"
ON raw_data
FOR SELECT
TO anon
USING (true);

-- 정책 확인
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE tablename = 'raw_data';
