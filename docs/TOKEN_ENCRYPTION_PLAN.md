# Meta Access Token 암호화 저장 기획서

## 개요

클라이언트 생성 시 Meta Access Token을 **AES-256-CBC**로 암호화하여 DB에 저장하고, Worker에서 복호화하여 사용하는 기능 구현.

## 완료된 작업

### 1. SQL 마이그레이션 ✅
- **파일**: `sql/20_encrypted_token_column.sql`
- **내용**: `clients` 테이블에 `encrypted_access_token` 컬럼 추가

### 2. 암호화 유틸리티 ✅
- **파일**: `lib/encryption.js`
- **기능**: encrypt, decrypt, validateKey, generateNewKey

### 3. 환경변수 설정 ✅ (로컬)
- **파일**: `.env`에 TOKEN_ENCRYPTION_KEY 추가됨

### 4. Dashboard 암호화 모듈 ✅
- **파일**: `dashboard/lib/encryption.ts` (TypeScript 버전)

### 5. API 수정 ✅
- **파일**: `dashboard/app/api/clients/route.ts`
- **변경**: Vault RPC → AES 암호화 저장

### 6. Worker 수정 ✅
- **파일**: `lib/token-manager.js`
- **변경**: Vault → DB에서 암호화된 토큰 조회 후 복호화
- **Fallback**: 기존 Vault 방식도 지원 (호환성)

### 7. 테스트 스크립트 ✅
- **파일**: `test-encryption.js`
- **결과**: 모든 테스트 통과

---

## 남은 배포 작업 (수동)

### Railway 환경변수 설정
```bash
TOKEN_ENCRYPTION_KEY=3c2cb3678acc60e58e27bd733bad879642d392d98b68e273c15e054815bd1aa7
```

### Vercel 환경변수 설정
```bash
TOKEN_ENCRYPTION_KEY=3c2cb3678acc60e58e27bd733bad879642d392d98b68e273c15e054815bd1aa7
```

---

## 배포 순서

```
1. Railway에 TOKEN_ENCRYPTION_KEY 환경변수 추가
2. Vercel에 TOKEN_ENCRYPTION_KEY 환경변수 추가
3. Railway Worker 재시작
4. Vercel 재배포
5. 클라이언트 생성 테스트
```

---

## 보안 고려사항

| 항목 | 상태 |
|------|------|
| 암호화 알고리즘 | AES-256-CBC (군사급) |
| 키 길이 | 256비트 (32바이트) |
| IV (초기화 벡터) | 매번 랜덤 생성 |
| 키 저장 | 환경변수 (코드에 노출 안 됨) |
| DB 저장 | 암호문만 저장 (평문 노출 없음) |

---

## 테스트 체크리스트

- [x] SQL 마이그레이션 실행
- [x] 환경변수 `TOKEN_ENCRYPTION_KEY` 설정 (로컬)
- [x] 암호화/복호화 테스트 통과 (`test-encryption.js`)
- [ ] Railway 환경변수 설정
- [ ] Vercel 환경변수 설정
- [ ] 클라이언트 생성 시 토큰 암호화 저장 확인
- [ ] DB에서 `encrypted_access_token` 값 확인 (암호문)
- [ ] Worker에서 토큰 복호화 확인
- [ ] Meta API 호출 성공 확인

---

## 롤백 방법

문제 발생 시:
1. Worker는 자동으로 Vault fallback 지원 (기존 클라이언트 호환)
2. API에서 토큰 저장 로직 원복
3. `encrypted_access_token` 컬럼은 유지 (데이터 손실 방지)

---

**작성일**: 2025-11-26
**상태**: 코드 구현 완료 ✅ (배포 대기)
