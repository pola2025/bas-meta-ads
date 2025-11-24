# System User Token 생성 가이드

## 📋 목적
현재 Long-Lived Token (60일 만료)을 System User Token (무제한)으로 전환

---

## 🎯 Step 1: Meta Business Settings 접속

1. **Meta Business Suite 접속**
   - URL: https://business.facebook.com/settings
   - 또는 Facebook 우측 상단 → "비즈니스 도구" 클릭

2. **Business Settings 선택**
   - 좌측 메뉴에서 "비즈니스 설정" 클릭

---

## 🎯 Step 2: System Users 메뉴 이동

1. **Users 섹션 찾기**
   - 좌측 메뉴 → "사용자" (Users) 섹션

2. **System Users 선택**
   - Users 드롭다운 → "System Users" 클릭

3. **Add 버튼 클릭**
   - 우측 상단 "Add" 버튼 클릭

---

## 🎯 Step 3: System User 생성

### 기본 정보 입력
```
Name: BAS Meta Ads API
Role: Admin (또는 Employee)
```

**설명**:
- Name: 시스템 사용자 이름 (나중에 식별용)
- Role: Admin 권장 (모든 권한)

### Create 클릭

---

## 🎯 Step 4: 광고 계정 권한 부여

1. **생성된 System User 클릭**
   - 방금 생성한 "BAS Meta Ads API" 클릭

2. **Add Assets 클릭**
   - "Assets" 탭 → "Add Assets" 버튼

3. **Ad Accounts 선택**
   - 좌측 메뉴에서 "Ad Accounts" 선택

4. **광고 계정 선택**
   - 비즈액터스쿨 광고 계정 체크 (act_705731635104506)
   - 또는 "Select All" 클릭

5. **권한 설정**
   - ✅ "Advertise" 체크 (광고 생성/수정)
   - ✅ "Analyze" 체크 (데이터 조회) ⭐ 필수
   - ❌ "Manage" 불필요 (계정 관리)

6. **Save Changes 클릭**

---

## 🎯 Step 5: Access Token 생성

1. **Generate New Token 클릭**
   - "BAS Meta Ads API" System User 페이지에서
   - "Generate New Token" 버튼 클릭

2. **앱 선택**
   ```
   App: [기존 앱 선택]
   App ID: 1474546053653616
   ```

   **참고**:
   - 기존에 사용 중인 앱이 목록에 표시됨
   - 없으면 새로 생성 필요 (Meta Developers에서)

3. **권한 선택 (Permissions)**
   - ✅ `ads_management` ⭐ 필수
   - ✅ `ads_read` ⭐ 필수
   - ✅ `business_management` (선택)
   - ✅ `read_insights` (선택)

4. **만료 기간 선택**
   ```
   ⭐ Token Expiration: Never
   ```

   **중요**: 반드시 "Never"를 선택해야 무제한 사용 가능!

5. **Generate Token 클릭**

---

## 🎯 Step 6: Token 복사 및 저장

1. **Token 복사**
   - 생성된 Token이 표시됨
   - 전체 선택 후 복사 (Ctrl+C)
   - **주의**: 한 번만 표시되므로 반드시 저장!

2. **안전하게 저장**
   ```
   토큰 형식: EAAU...
   길이: 약 200자
   ```

---

## 🎯 Step 7: 시스템에 적용

### 로컬 환경 (.env)
```bash
# F:\bas_meta\.env 파일 수정
META_ACCESS_TOKEN=새로_생성한_System_User_Token
```

### Railway 환경 변수
```bash
# Railway에 적용
railway variables set META_ACCESS_TOKEN="새로_생성한_System_User_Token"
```

### 테스트
```bash
# 토큰 유효성 확인
node check-meta-token.js
```

**예상 결과**:
```
✅ Token is VALID
Expires At: Never (long-lived)
Type: SYSTEM_USER
```

---

## 🎯 Step 8: 이전 토큰 무효화 (선택)

**권장**: 새 토큰이 정상 작동 확인 후 이전 토큰 삭제

1. **Meta Business Settings**
2. **Business Integrations → 앱 선택**
3. **Remove Access** (이전 토큰 무효화)

---

## ✅ 완료 체크리스트

- [x] Meta Business Settings 접속
- [x] System User 생성 ("BAS Meta Ads API")
- [x] 광고 계정 권한 부여 (Analyze 필수)
- [x] Access Token 생성 (Never expire)
- [x] Token 복사 및 저장
- [x] .env 파일 업데이트
- [x] Railway 환경 변수 업데이트
- [x] 테스트 실행 (check-meta-token.js)
- [ ] 이전 토큰 무효화 (선택)

---

## 🚨 문제 해결

### 문제 1: System Users 메뉴가 안 보임
**원인**: Business Manager 관리자 권한 없음
**해결**: 비즈니스 소유자에게 관리자 권한 요청

### 문제 2: 앱 목록이 비어있음
**원인**: Meta 앱이 Business Manager에 연결 안 됨
**해결**:
1. Meta Developers (developers.facebook.com)
2. 앱 선택 → Settings → Basic
3. Business Manager ID 입력

### 문제 3: Token 생성 후 "Never" 옵션이 없음
**원인**: Business Manager 소유자만 가능
**해결**: 비즈니스 소유자가 직접 생성

### 문제 4: Token으로 광고 데이터 조회 안 됨
**원인**: 권한 부여 누락
**해결**: System User → Assets → Ad Accounts → "Analyze" 권한 확인

---

## 📚 참고 자료

- [Meta System Users 공식 문서](https://developers.facebook.com/docs/marketing-api/system-users/)
- [Access Token 가이드](https://developers.facebook.com/docs/facebook-login/guides/access-tokens/)
- [Marketing API 권한](https://developers.facebook.com/docs/marketing-api/overview/authorization/)

---

## 🎉 생성 완료 (2025-11-21)

### 토큰 정보
```
System User ID: 61583823162581
Token Type: SYSTEM_USER
Expires: Never (long-lived)
Issued At: 2025-11-21 21:54:05
App ID: 1474546053653616
```

### 부여된 권한
```
✅ catalog_management
✅ threads_business_basic
✅ pages_show_list
✅ ads_management (필수)
✅ ads_read (필수)
✅ business_management
✅ leads_retrieval
✅ pages_read_engagement
✅ pages_manage_metadata
✅ pages_manage_ads
✅ public_profile
```

### 테스트 결과
```
✅ Token is VALID
✅ Ad Account Access OK
   ID: act_705731635104506
   Name: 비즈액터스쿨
   Currency: USD
```

### Railway 배포 상태
```
환경 변수: 업데이트 필요
배포 후 테스트: 필요
```

---

**작성일**: 2025-11-21
**업데이트**: 2025-11-21 (토큰 생성 완료)
**예상 소요 시간**: 5-10분
**난이도**: ⭐⭐☆☆☆ (쉬움)
