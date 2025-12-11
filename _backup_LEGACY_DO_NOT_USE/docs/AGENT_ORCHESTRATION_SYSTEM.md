# Agent Orchestration System - 자동 에이전트 배정 및 스킬 연동

**작성일**: 2025-11-21
**목적**: 사용자 요청 → 에이전트 자동 배정 → 스킬 활용 → 시각적 진행 표시

---

## 📋 시스템 아키텍처

```
사용자 요청
    ↓
┌─────────────────────────────────────────┐
│  🎯 Agent Orchestrator (메타 에이전트)  │
│  - 요청 분석 및 의도 파악               │
│  - 적합한 에이전트 자동 배정             │
│  - 에이전트 간 협업 조율                │
└─────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────┐
│  🤖 Specialized Agents (전문 에이전트)  │
├─────────────────────────────────────────┤
│  1. Development Agent                    │
│     - Skills: TDD, systematic-debugging  │
│  2. Design Agent                         │
│     - Skills: frontend-design, canvas    │
│  3. Testing Agent                        │
│     - Skills: webapp-testing, TDD        │
│  4. Documentation Agent                  │
│     - Skills: docx, pdf, pptx            │
│  5. Security Agent                       │
│     - Skills: defense-in-depth           │
│  6. Research Agent                       │
│     - Skills: auto-research, brainstorm  │
└─────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────┐
│  📊 Progress Visualizer (시각적 표시)   │
│  - 에이전트 상태 트래킹                  │
│  - 스킬 활성화 표시                     │
│  - 작업 진행률 시각화                   │
└─────────────────────────────────────────┘
    ↓
결과 반환
```

---

## 🎯 Agent Orchestrator (메타 에이전트)

### 역할
- 사용자 요청을 분석하여 **의도(Intent)**를 파악
- 작업 복잡도에 따라 **단일/다중 에이전트** 배정
- 에이전트 간 **작업 순서 및 의존성** 관리
- 전체 작업의 **진행 상황 모니터링**

### 의사결정 로직

#### 키워드 기반 에이전트 선택

**개발 관련**:
- 키워드: `코드`, `구현`, `버그`, `테스트`, `리팩토링`, `개발`
- 에이전트: Development Agent
- 스킬: `systematic-debugging`, `test-driven-development`, `brainstorming`

**디자인 관련**:
- 키워드: `UI`, `디자인`, `프론트엔드`, `화면`, `페이지`, `컴포넌트`
- 에이전트: Design Agent
- 스킬: `frontend-design`, `canvas-design`, `theme-factory`

**테스트 관련**:
- 키워드: `테스트`, `TDD`, `검증`, `E2E`, `단위 테스트`
- 에이전트: Testing Agent
- 스킬: `test-driven-development`, `webapp-testing`

**문서 작업**:
- 키워드: `문서`, `보고서`, `Excel`, `PDF`, `Word`, `PPT`
- 에이전트: Documentation Agent
- 스킬: `docx`, `pdf`, `pptx`, `xlsx`

**보안 검토**:
- 키워드: `보안`, `취약점`, `인증`, `권한`, `Vault`
- 에이전트: Security Agent
- 스킬: `defense-in-depth`

**리서치/탐색**:
- 키워드: `조사`, `분석`, `탐색`, `찾기`, `검색`
- 에이전트: Research Agent
- 스킬: `auto-research`, `brainstorming`

---

## 🤖 Specialized Agents 설계

### 1. Development Agent

**책임**:
- 코드 작성, 리팩토링
- 버그 수정 및 디버깅
- 아키텍처 설계

**연동 Skills**:
- `systematic-debugging` - 버그 발생 시
- `test-driven-development` - 새 기능 개발
- `brainstorming` - 설계 단계
- `writing-plans` - 구현 계획
- `executing-plans` - 계획 실행
- `root-cause-tracing` - 근본 원인 분석

**작업 흐름**:
```
1. brainstorming → 설계
2. writing-plans → 계획
3. test-driven-development → 테스트
4. executing-plans → 구현
5. systematic-debugging → 디버깅 (필요 시)
```

---

### 2. Design Agent

**책임**:
- UI/UX 디자인
- 프론트엔드 컴포넌트
- 시각적 자산 생성

**연동 Skills**:
- `frontend-design` - 프로덕션급 UI
- `canvas-design` - 비주얼 자산
- `web-artifacts-builder` - React 컴포넌트
- `theme-factory` - 테마 스타일링

**작업 흐름**:
```
1. brainstorming → 디자인 방향
2. frontend-design → UI 생성
3. theme-factory → 테마 적용
4. web-artifacts-builder → 아티팩트
```

---

### 3. Testing Agent

**책임**:
- 테스트 코드 작성
- E2E 테스트 실행
- 품질 검증

**연동 Skills**:
- `test-driven-development` - TDD
- `webapp-testing` - E2E 테스트
- `testing-anti-patterns` - 안티패턴 회피
- `verification-before-completion` - 검증

**작업 흐름**:
```
1. test-driven-development → 테스트 작성
2. webapp-testing → E2E 실행
3. verification-before-completion → 검증
```

---

### 4. Documentation Agent

**책임**:
- 문서 생성 및 편집
- 리포트 작성

**연동 Skills**:
- `docx` - Word 문서
- `pdf` - PDF 생성
- `pptx` - 프레젠테이션
- `xlsx` - 스프레드시트

---

### 5. Security Agent

**책임**:
- 보안 검토
- 취약점 분석

**연동 Skills**:
- `defense-in-depth` - 다층 보안
- `systematic-debugging` - 보안 이슈 추적

---

### 6. Research Agent

**책임**:
- 정보 탐색
- 문제 해결 리서치

**연동 Skills**:
- `auto-research` - 자동 리서치
- `brainstorming` - 아이디어 도출

---

## 📊 Progress Visualizer (시각적 진행 표시)

### 1. 에이전트 배정 단계
```
🎯 Agent Orchestrator
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 요청 분석: "BullMQ Worker 디버깅해줘"
🔍 감지된 의도: ['버그', '디버깅', '코드']
🤖 배정된 에이전트: Development Agent
⚡ 우선순위: High
📦 활성화 예정 스킬:
   └─ systematic-debugging
   └─ root-cause-tracing
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### 2. 스킬 활성화 단계
```
🔧 Development Agent 실행 중...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[1/4] 📖 스킬 로딩: systematic-debugging
      └─ ✅ 로드 완료 (2.3초)

[2/4] 📋 Step 1: 로그 수집 중...
      └─ Railway logs 확인
      └─ 에러 메시지 분류
      └─ ✅ 완료

[3/4] 🔍 Step 2: 재현 시나리오 구성 중...
      └─ 특정 client_id로 테스트
      └─ ⚠️ 문제 재현 성공

[4/4] 💡 Step 3: 근본 원인 분석 중...
      └─ 가설 A: 토큰 갱신 로직 누락 ✅
      └─ 가설 B: Vault 오류 ❌
      └─ 가설 C: Rate limit ❌

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✨ Development Agent 완료
📊 실행 시간: 45초
🎯 결과: 근본 원인 발견 및 해결 방안 제시
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### 3. 다중 에이전트 협업
```
🎯 Multi-Agent Workflow
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 작업: "Meta API를 MCP 서버로 만들고 테스트해줘"

🔄 Phase 1/3: Research Agent
   └─ 🔧 Skill: brainstorming
   └─ 📊 진행률: ████████████████████ 100%
   └─ ✅ 설계 완료

🔄 Phase 2/3: Development Agent
   └─ 🔧 Skill: mcp-builder
   └─ 🔧 Skill: writing-plans
   └─ 🔧 Skill: executing-plans
   └─ 📊 진행률: ████████████░░░░░░░░ 60%
   └─ ⏳ 진행 중...

🔄 Phase 3/3: Testing Agent (대기 중)
   └─ 🔧 Skill: test-driven-development
   └─ 📊 진행률: ░░░░░░░░░░░░░░░░░░░░ 0%
   └─ ⏸️ Phase 2 완료 대기 중

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⏱️ 총 예상 시간: 8분
⏱️ 경과 시간: 3분 20초
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### 4. 스킬 체인 실행
```
🔗 Skill Chain Execution
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

brainstorming
    ↓ (완료)
writing-plans
    ↓ (완료)
test-driven-development
    ↓ (실행 중...)
executing-plans
    ↓ (대기)
verification-before-completion
    ↓ (대기)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 전체 진행률: 40% (2/5 완료)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## 🎨 시각적 요소 디자인

### 아이콘 체계
```
🎯 Agent Orchestrator
🤖 Specialized Agent
🔧 Skill 활성화
📋 Step 진행
✅ 완료
⚠️ 경고
❌ 실패
⏳ 진행 중
⏸️ 대기
🔍 분석
💡 결과
📊 진행률
⏱️ 시간
🔗 연결
```

### 진행률 바
```
████████████████████ 100%  (완료)
████████████░░░░░░░░  60%  (진행 중)
░░░░░░░░░░░░░░░░░░░░   0%  (대기)
```

---

## 🔄 작업 흐름 예시

### 예시 1: 단일 에이전트 (버그 수정)

**사용자 요청**: "Worker가 간헐적으로 실패하는 이유를 찾아줘"

```
1. 🎯 Agent Orchestrator
   └─ 요청 분석: "Worker", "실패", "이유"
   └─ 의도 감지: 디버깅
   └─ 배정: Development Agent
   └─ 스킬: systematic-debugging, root-cause-tracing

2. 🤖 Development Agent 실행
   └─ 🔧 systematic-debugging 활성화
       ├─ Step 1: 로그 수집 ✅
       ├─ Step 2: 재현 시나리오 ✅
       ├─ Step 3: 근본 원인 분석 ✅
       └─ Step 4: 해결 방안 제시 ✅

3. ✨ 결과 반환
   └─ 근본 원인: 토큰 갱신 로직 누락
   └─ 해결 방안: 자동 갱신 추가
```

---

### 예시 2: 다중 에이전트 (신규 기능)

**사용자 요청**: "Meta API를 MCP 서버로 만들고 TDD로 테스트까지"

```
1. 🎯 Agent Orchestrator
   └─ 복합 작업 감지
   └─ 에이전트 체인:
       ├─ Research Agent (설계)
       ├─ Development Agent (구현)
       └─ Testing Agent (테스트)

2. 🔗 Multi-Agent Workflow

   Phase 1/3: Research Agent
   └─ 🔧 brainstorming
       ├─ MCP 아키텍처 설계 ✅
       └─ API 엔드포인트 정의 ✅

   Phase 2/3: Development Agent
   └─ 🔧 mcp-builder
       ├─ package.json 생성 ✅
       └─ src/ 구현 ✅

   Phase 3/3: Testing Agent
   └─ 🔧 test-driven-development
       ├─ 테스트 작성 ✅
       └─ 테스트 실행 ✅

3. ✨ 전체 작업 완료
   └─ MCP 서버 생성 완료
   └─ TDD 테스트 통과
```

---

### 예시 3: 병렬 에이전트

**사용자 요청**: "보안 점검하면서 문서도 작성해줘"

```
1. 🎯 Agent Orchestrator
   └─ 병렬 처리 가능
   └─ 병렬 에이전트:
       ├─ Security Agent
       └─ Documentation Agent

2. 🔀 Parallel Execution

   ┌───────────────────────┐  ┌───────────────────────┐
   │ 🤖 Security Agent     │  │ 🤖 Documentation Agent│
   ├───────────────────────┤  ├───────────────────────┤
   │ 🔧 defense-in-depth   │  │ 🔧 docx               │
   │ ├─ Vault 점검 ✅     │  │ ├─ 체크리스트 작성 ✅│
   │ ├─ API 인증 검토 ✅  │  │ ├─ 취약점 정리 ✅    │
   │ └─ 환경 변수 보안 ✅ │  │ └─ 개선 방안 문서 ✅ │
   │ 📊 진행률: 100%       │  │ 📊 진행률: 100%       │
   └───────────────────────┘  └───────────────────────┘

3. ✨ 병렬 작업 완료
   └─ 보안 점검 완료 (3분)
   └─ 문서 작성 완료 (2분)
   └─ 총 소요 시간: 3분
```

---

## 📁 파일 구조

```
C:\Users\flame\.claude\skills\
├── agent-orchestrator/
│   └── SKILL.md
│
├── development-agent/
│   └── SKILL.md
│
├── design-agent/
│   └── SKILL.md
│
├── testing-agent/
│   └── SKILL.md
│
├── documentation-agent/
│   └── SKILL.md
│
├── security-agent/
│   └── SKILL.md
│
└── research-agent/
    └── SKILL.md
```

---

## ✅ 다음 단계

1. Agent Orchestrator Skill 생성
2. 각 Specialized Agent Skill 작성
3. Progress Visualizer 구현
4. 실제 프로젝트에서 테스트
5. 피드백 기반 개선

---

**작성자**: Claude
**문서 버전**: 1.0.0
