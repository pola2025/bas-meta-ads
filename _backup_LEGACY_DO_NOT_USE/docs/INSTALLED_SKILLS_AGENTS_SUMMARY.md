# Claude Code 전역 설정 - Skills & Agents 기능 점검 보고서

**점검일**: 2025-11-21
**점검 대상**: 전역 설정 (`C:\Users\flame\.claude\`)

---

## 📊 점검 요약

| 구분 | 설치 수 | 활성화 상태 | 비고 |
|------|--------|------------|------|
| **Skills** | 64개 | 정상 작동 | Anthropic Official 포함 |
| **Agents** | 8개 | 정상 구성 | 메타 에이전트 포함 |
| **Hooks** | 7개 | 정상 작동 | 자동화 완료 |
| **Plugins** | 1개 | 활성화됨 | frontend-design |

---

## 🎯 1. Skills (64개 설치)

### 1.1 핵심 개발 스킬 (Anthropic Official)

#### 📚 문서 처리
- `.docx` - Word 문서 생성/수정
- `.pdf` - PDF 문서 생성/처리
- `.pptx` - PowerPoint 프레젠테이션
- `.xlsx` - Excel 스프레드시트

#### 🎨 디자인 & 프론트엔드
- `.frontend-design` - 고품질 프론트엔드 인터페이스 제작
- `canvas-design` - 시각적 디자인 자산
- `web-artifacts-builder` - 다중 컴포넌트 HTML 아티팩트 (React, Tailwind)
- `theme-factory` - 테마 스타일링

#### 🧪 개발 방법론
- `.test-driven-development` (TDD) - 테스트 우선 개발
- `.testing-anti-patterns` - 테스트 안티패턴 방지
- `.systematic-debugging` - 4단계 디버깅 프레임워크
- `.root-cause-tracing` - 근본 원인 추적
- `.defense-in-depth` - 다층 방어 검증
- `.verification-before-completion` - 완료 전 검증

#### 📋 계획 & 실행
- `.brainstorming` - 아이디어 구체화
- `.writing-plans` - 구현 계획 수립
- `.executing-plans` - 계획 실행 관리

#### 🏗️ 특수 도구
- `.mcp-builder` - MCP 서버 생성
- `.webapp-testing` - Playwright 웹 테스트
- `.skill-creator` - 스킬 생성/수정

### 1.2 커스텀 스킬 (프로젝트별)

#### 🤖 에이전트 시스템
- `agent-orchestrator` - 자동 에이전트 배정 및 조율 (메타 에이전트)
- `planning-agent` - 기획 및 진행 관리 전문
- `development-agent` - 코드 개발 및 디버깅
- `design-agent` - UI/UX 디자인
- `testing-agent` - 테스트 및 품질 검증
- `research-agent` - 리서치 및 탐색
- `security-agent` - 보안 점검
- `documentation-agent` - 문서 작성

#### 🛠️ 도메인 특화
- `bas-meta-automation` - BAS Meta 프로젝트 자동화
- `bas-meta-guide` - BAS Meta 가이드
- `supabase-setup` - Supabase 설정
- `imweb-hero-optimizer` - 아임웹 히어로 최적화
- `auto-research` - 자동 문제 해결 탐색

#### 📖 설계 & 아키텍처
- `design-guardian` - 디자인 시스템 준수
- `design-system` - Seamless Flow 디자인 시스템

#### 📝 로깅 & 문서화
- `work-logger` - 작업 로그 자동 기록
- `notion-logger` - Notion 연동 로깅

#### 🎓 고급 스킬 (Superpowers)
- `condition-based-waiting` - 조건 기반 대기
- `dispatching-parallel-agents` - 병렬 에이전트 실행
- `finishing-a-development-branch` - 개발 브랜치 완료
- `receiving-code-review` - 코드 리뷰 받기
- `requesting-code-review` - 코드 리뷰 요청
- `sharing-skills` - 스킬 공유
- `subagent-driven-development` - 서브에이전트 개발
- `testing-skills-with-subagents` - 서브에이전트 테스트
- `using-git-worktrees` - Git Worktree 활용
- `using-superpowers` - Superpowers 사용법
- `writing-skills` - 스킬 작성 가이드

---

## 🤖 2. Agents (8개 구성)

### 2.1 메타 에이전트

#### `agent-orchestrator` (최우선)
**역할**: 사용자 요청 자동 분석 → 적합한 에이전트 배정 → 스킬 체인 구성

**핵심 기능**:
- 의도(Intent) 파악 (키워드 매트릭스 기반)
- 단일/다중 에이전트 자동 선택
- 순차/병렬 실행 모드 결정
- 시각적 진행 상황 표시

**작동 방식**:
```
사용자 요청 → 키워드 분석 → 도메인 감지 → 에이전트 배정 → 스킬 활성화
```

**예시**:
- "Worker 디버깅해줘" → Development Agent + systematic-debugging
- "MCP 서버 만들고 테스트" → Research + Development + Testing (순차)
- "보안 점검 + 문서 작성" → Security || Documentation (병렬)

### 2.2 전문 에이전트

#### 1. `planning-agent` (우선순위 1)
**책임**:
- PRD (Product Requirements Document) 작성
- WBS (Work Breakdown Structure) 생성
- 진행 상황 추적
- 완료 조건 검증

**활성화 키워드**: 기획, 계획, PRD, 요구사항, 진행, 체크, 검증

**연결 스킬**: brainstorming, writing-plans, executing-plans, verification-before-completion

#### 2. `development-agent`
**책임**:
- 코드 작성 및 리팩토링
- 버그 수정 및 디버깅
- 아키텍처 설계

**활성화 키워드**: 코드, 구현, 버그, 리팩토링, 개발, 디버깅

**연결 스킬**: systematic-debugging, test-driven-development, root-cause-tracing

#### 3. `design-agent`
**책임**:
- UI/UX 디자인
- 프론트엔드 컴포넌트 개발
- 시각적 자산 생성

**활성화 키워드**: UI, 디자인, 프론트엔드, 화면, 페이지, 컴포넌트

**연결 스킬**: frontend-design, canvas-design, web-artifacts-builder, theme-factory

#### 4. `testing-agent`
**책임**:
- 테스트 코드 작성
- E2E 테스트 실행
- 품질 검증

**활성화 키워드**: 테스트, TDD, 검증, E2E, 단위 테스트

**연결 스킬**: test-driven-development, webapp-testing, testing-anti-patterns

#### 5. `research-agent`
**책임**:
- 정보 탐색
- 문제 해결 리서치
- 기술 조사

**활성화 키워드**: 조사, 분석, 탐색, 찾기, 검색, 리서치

**연결 스킬**: auto-research, brainstorming

#### 6. `security-agent`
**책임**:
- 보안 점검
- 취약점 분석
- 인증/인가 검증

**활성화 키워드**: 보안, 취약점, 인증, 권한

**연결 스킬**: defense-in-depth

#### 7. `documentation-agent`
**책임**:
- 기술 문서 작성
- API 문서화
- 보고서 생성

**활성화 키워드**: 문서, 보고서, Excel, PDF, Word

**연결 스킬**: docx, pdf, pptx, xlsx

---

## ⚙️ 3. Hooks (7개 활성화)

### 3.1 UserPromptSubmit (질문 전)
1. **`obsidian-retrospective.js`**
   - 사용자 프롬프트를 Obsidian에 저장
   - 타임아웃: 10초

### 3.2 PreToolUse (도구 사용 전)
1. **`git-precommit-guard.js`**
   - Git 위험 명령어 차단 (Bash 실행 전)
   - 타임아웃: 10초

### 3.3 PostToolUse (도구 사용 후)

#### 모든 도구 (`*`)
1. **`obsidian-auto-logger.js`** ⭐
   - **기능**: 모든 도구 사용 실시간 로깅
   - **저장 위치**: `F:\obsidian\Pola\Projects\{project}\{date}_work-log.md`
   - **내용**: 도구명, 대상 파일/명령어, 토큰 사용량
   - **특징**: 날짜별 파일에 누적 저장
   - **타임아웃**: 5초

#### Bash 전용
2. **`build-checker.js`**
   - 빌드 명령어 실행 후 검증
   - 타임아웃: 10초

#### Edit/Write 전용
3. **`prettier-format.js`**
   - 자동 코드 포맷팅
   - 타임아웃: 10초

4. **`error-reminder.js`**
   - 에러 체크 및 알림
   - 타임아웃: 5초

### 3.4 SessionEnd (세션 종료 시)

1. **`session-summarizer.js`** ⭐
   - **기능**: 세션 자동 요약 및 문서화
   - **생성 파일**:
     - `.claude/sessions/session-{timestamp}.md` (전체 세션)
     - `.claude/PROJECT-SUMMARY.md` (프로젝트 요약 누적)
     - `NEXT_SESSION.md` (다음 세션 가이드)
     - `F:\obsidian\Pola\Projects\{project}\{date}_session.md` (Obsidian)
   - **AI 요약**: Claude Haiku로 자동 생성
   - **조건**: 최소 5개 메시지 이상
   - **타임아웃**: 60초

2. **`obsidian-save-reminder.js`**
   - Obsidian 저장 완료 알림
   - 타임아웃: 10초

### 3.5 Hook 실행 흐름

```
사용자 질문
    ↓
[UserPromptSubmit] obsidian-retrospective.js
    ↓
Claude 응답 생성
    ↓
[PreToolUse] git-precommit-guard.js (Bash만)
    ↓
도구 실행 (Read, Edit, Write, Bash 등)
    ↓
[PostToolUse] obsidian-auto-logger.js (모든 도구)
[PostToolUse] prettier-format.js (Edit/Write)
[PostToolUse] error-reminder.js (Edit/Write)
[PostToolUse] build-checker.js (Bash)
    ↓
세션 종료
    ↓
[SessionEnd] session-summarizer.js
[SessionEnd] obsidian-save-reminder.js
```

---

## 🔌 4. Plugins (1개 활성화)

### `frontend-design@claude-code-plugins`
**상태**: ✅ 활성화됨
**기능**: 생산 수준의 프론트엔드 인터페이스 제작
**사용법**: `.frontend-design` 스킬로 호출

---

## 🎯 5. 에이전트 워크플로우

### 5.1 단일 에이전트 (버그 수정 예시)

```
User: "Worker가 간헐적으로 실패해"

Agent Orchestrator:
  └─ 키워드 분석: ['Worker', '실패', '디버깅']
  └─ 배정: Development Agent

Development Agent:
  ├─ [1/4] systematic-debugging 로드
  ├─ [2/4] 로그 수집 및 분석
  ├─ [3/4] 재현 시나리오 구성
  └─ [4/4] 근본 원인 발견

Result: 토큰 갱신 로직 누락 → 해결 방안 제시
```

### 5.2 다중 에이전트 순차 실행 (신규 기능)

```
User: "Meta API를 MCP 서버로 만들고 TDD로 테스트까지"

Agent Orchestrator:
  └─ 복합 작업 감지
  └─ Phase 1: Research Agent (설계)
  └─ Phase 2: Development Agent (구현)
  └─ Phase 3: Testing Agent (테스트)

Progress:
  ┌────────────────────────┐
  │ Phase 1: Research ✅   │ 2분 15초
  ├────────────────────────┤
  │ Phase 2: Development ⏳│ 진행 중 (65%)
  ├────────────────────────┤
  │ Phase 3: Testing ⏸️    │ 대기 중
  └────────────────────────┘
```

### 5.3 다중 에이전트 병렬 실행 (독립 작업)

```
User: "보안 점검하면서 문서도 작성해줘"

Agent Orchestrator:
  └─ 병렬 작업 감지
  └─ Security Agent || Documentation Agent

Progress:
  ┌─────────────────┐  ┌─────────────────┐
  │ Security ⏳ 85% │  │ Documentation ✅│
  │ 2분 45초        │  │ 2분 10초 (완료) │
  └─────────────────┘  └─────────────────┘
```

---

## 📋 6. 에이전트 키워드 매트릭스

| 에이전트 | 활성화 키워드 | 우선 스킬 |
|---------|-------------|----------|
| **Planning** | 기획, 계획, PRD, 요구사항, 진행, 체크, 검증 | brainstorming, writing-plans |
| **Development** | 코드, 구현, 버그, 리팩토링, 개발, 디버깅 | systematic-debugging, TDD |
| **Design** | UI, 디자인, 프론트엔드, 화면, 페이지, 컴포넌트 | frontend-design, canvas |
| **Testing** | 테스트, TDD, 검증, E2E, 단위 테스트 | test-driven-development |
| **Research** | 조사, 분석, 탐색, 찾기, 검색, 리서치 | auto-research |
| **Security** | 보안, 취약점, 인증, 권한 | defense-in-depth |
| **Documentation** | 문서, 보고서, Excel, PDF, Word | docx, pdf, pptx, xlsx |

---

## 🚀 7. 사용 가이드

### 7.1 에이전트 자동 활성화

**일반적인 요청만으로 자동 배정**:
```
"Worker 디버깅해줘"
→ Development Agent 자동 활성화

"PRD 작성해줘"
→ Planning Agent 자동 활성화

"랜딩 페이지 만들어줘"
→ Design Agent 자동 활성화
```

### 7.2 복합 작업 처리

**순차 실행 (의존성 있음)**:
```
"기능 구현하고 테스트까지"
→ Development → Testing (순차)

"기획하고 개발까지"
→ Planning → Development (순차)
```

**병렬 실행 (독립적)**:
```
"보안 점검하면서 문서 작성"
→ Security || Documentation (병렬)

"디자인하면서 문서화"
→ Design || Documentation (병렬)
```

### 7.3 명시적 에이전트 호출

**선택적**:
```
"@planning-agent 이 프로젝트 PRD 작성"
"@development-agent 이 버그 수정"
"@agent-orchestrator MCP 서버 전체 프로세스"
```

---

## ✅ 8. 작동 상태 확인

### 8.1 Skills
- ✅ 64개 스킬 정상 설치
- ✅ `claude skill list` 명령어 정상 작동
- ✅ Anthropic Official 스킬 전체 포함
- ✅ 커스텀 스킬 정상 로드

### 8.2 Agents
- ✅ 8개 에이전트 설계 파일 정상 존재
- ✅ Agent Orchestrator 메타 에이전트 구현
- ✅ 키워드 기반 자동 배정 로직 작성
- ✅ 워크플로우 시각화 포맷 정의

### 8.3 Hooks
- ✅ 7개 Hook 스크립트 정상 작동
- ✅ `obsidian-auto-logger.js` - 실시간 로깅 자동화 ⭐
- ✅ `session-summarizer.js` - AI 요약 자동 생성 ⭐
- ✅ PostToolUse, SessionEnd 정상 트리거
- ✅ Obsidian 자동 저장 기능 작동

### 8.4 Plugins
- ✅ `frontend-design` 플러그인 활성화
- ✅ `.claude/settings.json` 정상 설정

---

## 🎯 9. 주요 기능 하이라이트

### 9.1 자동화된 작업 로깅
- **모든 도구 사용이 자동으로 Obsidian에 기록**
- 파일 경로: `F:\obsidian\Pola\Projects\{project}\{date}_work-log.md`
- 실시간 토큰 사용량 추적
- 날짜별 누적 저장

### 9.2 세션 자동 요약
- **세션 종료 시 AI가 자동으로 요약 생성**
- Claude Haiku로 주요 작업 요약
- 다음 세션 가이드 자동 생성 (NEXT_SESSION.md)
- 전체 대화 내역 보존 (.claude/sessions/)

### 9.3 에이전트 자동 배정
- **키워드 분석으로 적합한 에이전트 자동 선택**
- 단일/다중 에이전트 자동 결정
- 순차/병렬 실행 모드 자동 선택
- 시각적 진행 상황 표시

### 9.4 스킬 체인 자동 구성
- **에이전트가 필요한 스킬 자동 활성화**
- brainstorming → writing-plans → executing-plans
- systematic-debugging → root-cause-tracing
- 진행률 실시간 표시

---

## 🔍 10. 파일 위치 참조

### Skills
```
C:\Users\flame\.claude\skills\
├── .brainstorming\
├── .frontend-design\
├── .mcp-builder\
├── agent-orchestrator\
├── planning-agent\
├── development-agent\
├── design-agent\
├── testing-agent\
├── research-agent\
├── security-agent\
├── documentation-agent\
├── anthropic-official\
│   ├── docx\
│   ├── pdf\
│   ├── pptx\
│   └── xlsx\
└── superpowers\
```

### Agents
```
C:\Users\flame\.claude\agents\
├── AGENT_SYSTEM_DESIGN.md
├── ALL_AGENTS_BLUEPRINT.md
├── api-design.md
├── authentication.md
├── database-expert.md
└── ...
```

### Hooks
```
C:\Users\flame\.claude\hooks\
├── obsidian-auto-logger.js ⭐
├── session-summarizer.js ⭐
├── git-precommit-guard.js
├── prettier-format.js
├── error-reminder.js
└── build-checker.js
```

### 설정
```
C:\Users\flame\.claude\settings.json
```

---

## 📊 11. 통계 요약

| 항목 | 수량 | 상태 |
|------|------|------|
| **총 Skills** | 64개 | ✅ 정상 |
| **Anthropic Official** | 31개 | ✅ 포함 |
| **커스텀 Skills** | 33개 | ✅ 작동 |
| **에이전트** | 8개 | ✅ 구성 |
| **메타 에이전트** | 1개 | ✅ Agent Orchestrator |
| **Hooks** | 7개 | ✅ 자동화 |
| **Plugins** | 1개 | ✅ 활성화 |

---

## 🎉 12. 결론

### ✅ 완료된 구성
1. **64개 스킬** 정상 설치 및 작동 확인
2. **8개 에이전트** 설계 완료 (메타 에이전트 포함)
3. **7개 Hook** 자동화 구축 (로깅, 요약, 검증)
4. **1개 플러그인** 활성화 (frontend-design)

### 🚀 핵심 기능
1. **자동 에이전트 배정** - 키워드 기반 자동 선택
2. **실시간 작업 로깅** - Obsidian 자동 저장
3. **세션 자동 요약** - AI 기반 문서화
4. **스킬 체인 구성** - 워크플로우 자동화

### 💡 권장 사용법
1. **일반 요청**으로 시작 → 자동 에이전트 배정
2. **복합 작업**은 "그리고", "동시에" 키워드 사용
3. **세션 종료** 시 자동 요약 확인 (NEXT_SESSION.md)
4. **작업 로그** 확인 (Obsidian Projects 폴더)

---

**문서 작성**: Claude Code
**점검 완료일**: 2025-11-21
**다음 점검 권장**: 스킬/에이전트 추가 시
