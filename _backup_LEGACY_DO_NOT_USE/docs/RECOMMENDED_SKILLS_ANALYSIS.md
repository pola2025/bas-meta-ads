# 추천 Claude Skills 분석 및 프로젝트 적용 가이드

**작성일**: 2025-11-21
**출처**: VoltAgent/awesome-claude-skills, Anthropic Official, Community Best Practices
**프로젝트**: BAS Meta Ads 자동화 시스템

---

## 📋 목차

1. [공식 Anthropic Skills](#1-공식-anthropic-skills)
2. [Community High-Value Skills](#2-community-high-value-skills)
3. [BAS Meta 프로젝트 적용 가능 Skills](#3-bas-meta-프로젝트-적용-가능-skills)
4. [설치 및 적용 가이드](#4-설치-및-적용-가이드)

---

## 1. 공식 Anthropic Skills

### 1.1 Document Processing

#### docx, pptx, xlsx, pdf
**출처**: `anthropics/docx`, `anthropics/pptx`, `anthropics/xlsx`, `anthropics/pdf`

**기능**:
- Word 문서: 생성, 편집, 변경 추적
- PowerPoint: 슬라이드 생성, 템플릿 적용
- Excel: 데이터 조작, 수식 계산, 차트
- PDF: 텍스트/테이블 추출, 폼 작성, 병합

**사용 사례**:
```
User: "주간 Meta 광고 리포트를 Excel로 만들어줘"
→ xlsx Skill 활성화 → 데이터 삽입 → 차트 생성 → 파일 저장
```

**BAS Meta 적용**:
- ✅ 주간/월간 Excel 리포트 자동 생성
- ✅ PDF 형식 경영진 보고서
- ⚠️ 현재 Streamlit 대시보드로 대체 가능

**우선순위**: 중간 (Nice-to-have)

---

### 1.2 Development & Design

#### artifacts-builder
**출처**: `anthropics/artifacts-builder`

**기능**:
- React + Tailwind로 인터랙티브 웹 컴포넌트 생성
- 대화 중 실시간 미리보기
- HTML/CSS/JS 아티팩트 구성

**사용 사례**:
```
User: "Meta 광고 성과를 시각화하는 대시보드 만들어줘"
→ artifacts-builder 활성화 → React 컴포넌트 생성 → 미리보기
```

**BAS Meta 적용**:
- ✅ Streamlit 대안으로 React 대시보드 개발
- ✅ 고객용 실시간 리포트 페이지
- ⚠️ 현재 Streamlit으로 충분

**우선순위**: 낮음 (Future Enhancement)

---

#### mcp-builder
**출처**: `anthropics/mcp-builder`

**기능**:
- Model Context Protocol (MCP) 서버 생성
- 외부 API 통합
- 커스텀 도구 개발

**사용 사례**:
```
User: "Meta Marketing API를 MCP 서버로 래핑해줘"
→ mcp-builder 활성화 → TypeScript 코드 생성 → 테스트
```

**BAS Meta 적용**:
- ✅ Meta API를 MCP 서버로 통합
- ✅ Supabase API 추상화
- ✅ Telegram Bot API 래핑

**우선순위**: 높음 (High Impact)

**즉시 적용 가능**:
```bash
# MCP 서버 생성
User: "Meta Marketing API를 위한 MCP 서버 만들어줘"

# 생성되는 파일
mcp-meta-api/
├── package.json
├── src/
│   ├── index.ts
│   ├── tools/
│   │   ├── fetch-ads.ts
│   │   └── get-insights.ts
│   └── resources/
│       └── meta-api-docs.ts
└── README.md
```

---

#### webapp-testing
**출처**: `anthropics/webapp-testing`

**기능**:
- Playwright 기반 브라우저 자동화
- 로컬 앱 테스트
- E2E 테스트 시나리오 생성

**사용 사례**:
```
User: "Streamlit 대시보드의 KPI 카드가 정상 동작하는지 테스트해줘"
→ webapp-testing 활성화 → Playwright 스크립트 생성 → 실행
```

**BAS Meta 적용**:
- ✅ Streamlit 대시보드 자동 테스트
- ✅ 데이터 시각화 검증
- ✅ 회귀 테스트 자동화

**우선순위**: 중간 (Phase 6 이후)

---

### 1.3 Creative Output

#### canvas-design, algorithmic-art, theme-factory
**출처**: `anthropics/canvas-design`, `anthropics/algorithmic-art`, `anthropics/theme-factory`

**기능**:
- 비주얼 자산 생성
- 알고리즘 디자인
- 브랜드 테마 스타일링

**BAS Meta 적용**:
- ⚠️ 프로젝트와 직접 관련 없음

**우선순위**: 낮음 (Not Applicable)

---

## 2. Community High-Value Skills

### 2.1 Productivity & Research

#### content-research-writer
**출처**: `Composio/content-research-writer`

**기능**:
- 리서치 + 작성 통합
- 출처 자동 인용
- 포괄적 컨텐츠 생성

**사용 사례**:
```
User: "Meta 광고 최신 트렌드 조사하고 블로그 글 작성해줘"
→ content-research-writer 활성화 → 웹 검색 → 정리 → 글 작성
```

**BAS Meta 적용**:
- ⚠️ 마케팅 자료 제작 시 유용
- ⚠️ 핵심 기능과 무관

**우선순위**: 낮음

---

#### brainstorming, writing-plans, executing-plans
**출처**: `obra/brainstorming`, `obra/writing-plans`, `obra/executing-plans`

**기능**:
- 전략적 사고 프레임워크
- 계획 수립 자동화
- 실행 단계 관리

**사용 사례**:
```
User: "Meta 광고 최적화 전략을 브레인스토밍해줘"
→ brainstorming 활성화 → 아이디어 도출 → 우선순위 정리
```

**BAS Meta 적용**:
- ✅ 새 기능 기획 시 유용
- ✅ 프로젝트 Phase 계획 수립
- ✅ 문제 해결 전략 도출

**우선순위**: 중간 (Workflow Enhancement)

---

### 2.2 Development Excellence

#### test-driven-development
**출처**: `obra/test-driven-development`

**기능**:
- TDD 방법론 자동 적용
- 테스트 우선 개발
- 품질 향상

**사용 사례**:
```
User: "BullMQ Worker에 TDD 적용해서 리팩토링해줘"
→ test-driven-development 활성화
→ 1. 테스트 작성
→ 2. 구현
→ 3. 리팩토링
```

**BAS Meta 적용**:
- ✅ Worker 로직 테스트
- ✅ API 호출 모킹
- ✅ 회귀 방지

**우선순위**: 높음 (Quality Assurance)

**즉시 적용 가능**:
```javascript
// Before (테스트 없음)
async function processJob(job) {
  const ads = await fetchAds(job.data.clientId);
  await saveToSupabase(ads);
}

// After (TDD 적용)
// 1. 테스트 작성
describe('processJob', () => {
  it('should fetch and save ads', async () => {
    const mockJob = { data: { clientId: 'test-id' } };
    const result = await processJob(mockJob);
    expect(result.status).toBe('success');
  });
});

// 2. 구현
// 3. 리팩토링
```

---

#### systematic-debugging, root-cause-tracing
**출처**: `obra/systematic-debugging`, `obra/root-cause-tracing`

**기능**:
- 체계적 디버깅 프로세스
- 근본 원인 분석
- 문제 해결 패턴

**사용 사례**:
```
User: "Worker가 간헐적으로 실패하는 이유를 찾아줘"
→ systematic-debugging 활성화
→ 1. 로그 분석
→ 2. 재현 시나리오 구성
→ 3. 근본 원인 식별
→ 4. 해결 방안 제시
```

**BAS Meta 적용**:
- ✅ BullMQ Worker 디버깅
- ✅ Meta API 오류 추적
- ✅ Supabase 연결 문제 해결

**우선순위**: 높음 (Critical)

**실전 예시**:
```
🐛 Issue: Worker가 간헐적으로 "Token expired" 오류

systematic-debugging 활성화:

Step 1: 로그 수집
- Railway logs 확인
- 에러 발생 패턴 분석

Step 2: 가설 수립
- 가설 A: 토큰 갱신 로직 누락
- 가설 B: Vault에서 잘못된 토큰 반환
- 가설 C: Meta API rate limit

Step 3: 재현 시나리오
- 만료된 토큰으로 테스트
- 결과: 가설 A 확인

Step 4: 근본 원인
- `token_expires_at` 체크 로직 없음

Step 5: 해결 방안
- 토큰 만료 전 자동 갱신
- Fallback 로직 추가
```

---

#### aws-skills
**출처**: `zxkane/aws-skills`

**기능**:
- AWS 인프라 자동화
- 아키텍처 패턴
- 배포 자동화

**BAS Meta 적용**:
- ⚠️ Railway 사용 중 (AWS 미사용)

**우선순위**: 낮음 (Not Applicable)

---

### 2.3 Specialized Domains

#### claude-scientific-skills
**출처**: `K-Dense-AI/claude-scientific-skills`

**기능**:
- 과학 연구 워크플로우
- 데이터 분석
- 논문 작성

**BAS Meta 적용**:
- ⚠️ 프로젝트와 무관

**우선순위**: 낮음

---

#### defense-in-depth
**출처**: `obra/defense-in-depth`

**기능**:
- 다층 보안 전략
- 취약점 분석
- 위협 모델링

**사용 사례**:
```
User: "Meta access token 저장 방식의 보안 취약점 분석해줘"
→ defense-in-depth 활성화
→ 1. Vault 사용 현황 확인
→ 2. 취약점 식별
→ 3. 개선 방안 제시
```

**BAS Meta 적용**:
- ✅ Vault 토큰 관리 보안 점검
- ✅ API 인증 강화
- ✅ 환경 변수 보안

**우선순위**: 중간 (Security Review)

---

## 3. BAS Meta 프로젝트 적용 가능 Skills

### 3.1 즉시 적용 (High Priority)

#### 1. mcp-builder (Meta API 통합)
**이유**: Meta API 호출을 MCP 서버로 추상화하면 코드 재사용성 향상

**예상 효과**:
- ✅ API 호출 로직 중앙화
- ✅ 에러 처리 일관성
- ✅ 테스트 용이성

**구현 계획**:
```bash
# Step 1: MCP 서버 생성
User: "Meta Marketing API를 MCP 서버로 만들어줘"

# Step 2: 기존 코드 마이그레이션
# lib/producer.js → MCP 도구 호출로 변경

# Step 3: Worker에서 MCP 도구 사용
```

**예상 작업 시간**: 2~3시간

---

#### 2. test-driven-development (Worker 테스트)
**이유**: BullMQ Worker는 프로젝트 핵심이므로 TDD 적용 필수

**예상 효과**:
- ✅ 회귀 버그 방지
- ✅ 리팩토링 안전성
- ✅ 문서화 효과

**구현 계획**:
```javascript
// Step 1: 테스트 프레임워크 설치
npm install --save-dev jest @types/jest

// Step 2: 테스트 작성
// tests/worker.test.js

describe('Meta Ads Worker', () => {
  it('should process job successfully', async () => {
    const mockJob = {
      data: { clientId: 'test-uuid', accountId: 'act_123' }
    };
    const result = await processJob(mockJob);
    expect(result.status).toBe('success');
  });

  it('should handle expired token', async () => {
    // Mock expired token scenario
    const result = await processJob(mockJobWithExpiredToken);
    expect(result.status).toBe('token_refresh_required');
  });
});

// Step 3: 기존 코드 리팩토링
```

**예상 작업 시간**: 3~4시간

---

#### 3. systematic-debugging (Worker 디버깅)
**이유**: 간헐적 오류 해결에 체계적 접근 필요

**예상 효과**:
- ✅ 문제 해결 속도 향상
- ✅ 재발 방지
- ✅ 로그 기반 분석

**구현 계획**:
```markdown
# 디버깅 체크리스트 (SKILL.md에 포함)

## Worker 오류 발생 시

### 1. 로그 수집
- Railway logs 확인
- 에러 메시지 분류

### 2. 재현 시나리오
- 특정 client_id로 테스트
- 타이밍 이슈 확인

### 3. 근본 원인 분석
- 가설 수립 및 검증
- 관련 코드 검토

### 4. 해결 방안
- Hot fix vs 구조적 개선
- 테스트 추가
```

**예상 작업 시간**: 1~2시간 (Skill 작성)

---

### 3.2 Phase 6 이후 적용 (Medium Priority)

#### 4. webapp-testing (Streamlit 테스트)
**이유**: 대시보드 기능이 복잡해지면 자동 테스트 필요

**예상 효과**:
- ✅ UI 회귀 방지
- ✅ 배포 전 검증

**구현 계획**:
```javascript
// playwright.config.js
module.exports = {
  testDir: './tests/e2e',
  use: {
    baseURL: 'http://localhost:8501'  // Streamlit 로컬
  }
};

// tests/e2e/dashboard.spec.js
test('KPI cards display correctly', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.kpi-card')).toHaveCount(4);
});
```

**예상 작업 시간**: 2~3시간

---

#### 5. defense-in-depth (보안 점검)
**이유**: Vault 토큰 관리 및 API 보안 강화

**예상 효과**:
- ✅ 취약점 사전 발견
- ✅ 보안 Best Practice 적용

**구현 계획**:
```markdown
# 보안 체크리스트

## Vault 토큰 관리
- [ ] 토큰 만료 시간 체크
- [ ] 자동 갱신 로직
- [ ] Fallback 처리

## API 인증
- [ ] Rate limit 준수
- [ ] API 키 rotation
- [ ] 로그 마스킹

## 환경 변수
- [ ] Railway Secrets 사용
- [ ] .env 파일 제외
- [ ] 개발/운영 분리
```

**예상 작업 시간**: 2~3시간

---

### 3.3 미래 고려 (Low Priority)

#### 6. docx, xlsx (리포트 자동화)
**이유**: 현재 Streamlit으로 충분하지만, Excel/Word 리포트 요구 시 유용

**예상 작업 시간**: 1~2시간

---

#### 7. brainstorming, writing-plans (기획 지원)
**이유**: 새 기능 기획 시 도움

**예상 작업 시간**: 30분~1시간

---

## 4. 설치 및 적용 가이드

### 4.1 Skill 설치 방법

#### 방법 1: GitHub에서 직접 복사
```bash
# 1. Skills 저장소 clone
git clone https://github.com/anthropics/skills.git temp-skills

# 2. 원하는 Skill 복사
cp -r temp-skills/mcp-builder .claude/skills/

# 3. 임시 폴더 삭제
rm -rf temp-skills
```

#### 방법 2: Claude Code Plugin 사용
```bash
# Plugin Marketplace에서 설치 (지원 시)
/plugin marketplace install anthropics@mcp-builder
```

#### 방법 3: 수동 생성
```bash
# 1. 폴더 생성
mkdir -p .claude/skills/custom-skill

# 2. SKILL.md 작성
cat > .claude/skills/custom-skill/SKILL.md << 'EOF'
---
name: custom-skill
description: "Your skill description"
---

# Custom Skill Instructions
...
EOF
```

### 4.2 Skill 활성화 확인

```bash
# Claude Code 실행 후
User: "사용 가능한 Skills 보여줘"

# 출력 예시
Available Skills:
- meta-ads-guide
- mcp-builder ⭐ 새로 설치됨
- test-driven-development ⭐ 새로 설치됨
- systematic-debugging ⭐ 새로 설치됨
```

### 4.3 Skill 테스트

```bash
# 1. 간단한 요청으로 Skill 트리거
User: "Meta API를 MCP 서버로 만들어줘"

# 2. Skill 활성화 확인
🔧 mcp-builder is loading...

# 3. 결과 확인
[MCP 서버 코드 생성]
```

---

## 5. 다음 단계

### 5.1 즉시 실행 (Phase 3)

1. **mcp-builder 설치 및 적용**
   ```bash
   # Meta API MCP 서버 생성
   User: "Meta Marketing API를 MCP 서버로 만들어줘"
   ```

2. **test-driven-development 설치**
   ```bash
   # Worker 테스트 작성
   User: "BullMQ Worker에 TDD 적용해줘"
   ```

3. **systematic-debugging 설치**
   ```bash
   # 디버깅 체크리스트 생성
   User: "Worker 디버깅을 위한 체계적 접근법 만들어줘"
   ```

### 5.2 Phase 6 이후

4. **webapp-testing 설치**
5. **defense-in-depth 적용**

---

## 6. 참고 자료

### 6.1 공식 저장소
- [Anthropic Official Skills](https://github.com/anthropics/skills)
- [VoltAgent Awesome Claude Skills](https://github.com/VoltAgent/awesome-claude-skills)
- [TravisVN Awesome Claude Skills](https://github.com/travisvn/awesome-claude-skills)

### 6.2 프로젝트 문서
- `CLAUDE_CODE_SKILLS_BEST_PRACTICES.md` - Skills 베스트 프랙티스
- `docs/PROJECT_SPECIFICATION.md` - 프로젝트 설계
- `docs/IMPLEMENTATION_GUIDE.md` - 구현 가이드

---

## 7. 요약

### 7.1 즉시 적용 Skills (3개)

1. **mcp-builder** - Meta API 통합
2. **test-driven-development** - Worker 테스트
3. **systematic-debugging** - 체계적 디버깅

### 7.2 기대 효과

- ✅ **개발 속도 향상**: MCP 서버로 API 호출 추상화
- ✅ **품질 향상**: TDD로 회귀 방지
- ✅ **문제 해결 속도 향상**: 체계적 디버깅
- ✅ **코드 재사용성**: 모듈화된 구조

### 7.3 예상 투자 시간

- mcp-builder 적용: 2~3시간
- TDD 적용: 3~4시간
- Debugging Skill 작성: 1~2시간

**총 예상 시간**: 6~9시간

---

**다음 작업**: mcp-builder로 Meta API MCP 서버 생성
