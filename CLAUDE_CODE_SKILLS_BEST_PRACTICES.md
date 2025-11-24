# Claude Code Skills & Agent 최적화 가이드

**작성일**: 2025-11-21
**출처**: Anthropic 공식 문서, GitHub 우수 사례, 커뮤니티 베스트 프랙티스
**프로젝트**: BAS Meta Ads 자동화 시스템

---

## 📋 목차

1. [Claude Skills 핵심 개념](#1-claude-skills-핵심-개념)
2. [Progressive Disclosure 아키텍처](#2-progressive-disclosure-아키텍처)
3. [Skill 작성 베스트 프랙티스](#3-skill-작성-베스트-프랙티스)
4. [사용자 상태 표시 시스템](#4-사용자-상태-표시-시스템)
5. [토큰 최적화 전략](#5-토큰-최적화-전략)
6. [평가 기반 개발 (Evaluation-Driven Development)](#6-평가-기반-개발)
7. [프로젝트 적용 계획](#7-프로젝트-적용-계획)

---

## 1. Claude Skills 핵심 개념

### 1.1 Skills란?

> "Skills are specialized prompt templates that inject domain-specific instructions into the conversation context."

**정의**:
- 전문 지식과 워크플로우를 패키징한 재사용 가능한 AI 역량
- 폴더 구조로 관리되는 지침서, 스크립트, 참조 자료 모음
- Claude가 태스크 수행 시 자동으로 발견하고 로드하는 동적 컨텍스트

**핵심 특징**:
- **모델 호출 방식**: Claude가 설명(description)을 보고 자동으로 선택
- **토큰 효율**: 메타데이터만 pre-load, 전체 내용은 필요 시에만 로드
- **독립성**: 각 Skill은 자체 컨텍스트로 실행, 메인 대화와 분리

### 1.2 Skills vs Commands vs Subagents vs Plugins

| 구분 | Skills | Commands | Subagents | Plugins |
|------|--------|----------|-----------|---------|
| **실행 방식** | 모델 자동 선택 | 사용자 명령 | 독립 실행 | 명령어/Skill 제공 |
| **컨텍스트** | 메인에 주입 | 메인에 프롬프트 추가 | 독립 컨텍스트 | 다양 |
| **토큰 효율** | ⭐⭐⭐ 매우 높음 | ⭐ 낮음 | ⭐⭐ 높음 | 다양 |
| **사용 사례** | 자동 전문가 | 수동 워크플로우 | 독립 작업 | 통합 도구 |

**언제 무엇을 사용할까?**

1. **Skills**: 반복적인 전문 작업 (예: Git commit 메시지 생성, Excel 분석)
2. **Commands**: 특정 워크플로우 실행 (예: `/review-code`, `/deploy`)
3. **Subagents**: 복잡한 독립 작업 (예: 코드 리뷰, 테스트 실행)
4. **Plugins**: 여러 기능 묶음 배포 (예: Next.js 15 init, Card News Generator)

---

## 2. Progressive Disclosure 아키텍처

### 2.1 핵심 설계 원칙

> "Progressive disclosure is the core design principle that makes Agent Skills flexible and scalable - like a well-organized manual, skills let Claude load information only as needed."

**3단계 정보 노출**:

```
1. Frontmatter Metadata (최소)
   ↓ 항상 로드 (수십 토큰)
   - name: "meta-ads-analyzer"
   - description: "Meta 광고 데이터 분석 및 인사이트 생성"

2. SKILL.md Content (중간)
   ↓ Skill 선택 시 로드 (수백~수천 토큰)
   - 워크플로우 지침
   - 예시 코드
   - 체크리스트

3. Resources (필요시)
   ↓ 참조 시에만 로드 (수천~수만 토큰)
   - /references/META_API_GUIDE.md
   - /scripts/fetch-ads.js
   - /templates/report-template.md
```

**토큰 소비 비교**:

| 방식 | 토큰 소비 | 설명 |
|------|----------|------|
| **전통적 프롬프트** | ~5,000 | 매 대화마다 전체 지침 반복 |
| **Skills (Frontmatter만)** | ~50 | 메타데이터만 pre-load |
| **Skills (활성화 시)** | ~2,000 | 필요한 내용만 로드 |
| **Skills (참조 포함)** | ~2,000 + α | 참조 파일은 별도 로드 |

**결과**: 73% 토큰 절감 (Anthropic 내부 벤치마크)

### 2.2 Dual-Message Communication

Skills 실행 시 두 개의 메시지 주입:

```javascript
// Message 1: Status Indicator (isMeta: false)
{
  role: "user",
  content: "🔧 meta-ads-analyzer skill activated",
  isMeta: false  // ✅ 사용자 UI에 표시
}

// Message 2: Full Instructions (isMeta: true)
{
  role: "user",
  content: "[SKILL.md 전체 내용]",
  isMeta: true   // ❌ UI에 숨김, Claude에게만 전달
}
```

**장점**:
- 사용자에게 투명성 제공 (어떤 Skill이 실행 중인지 표시)
- Claude에게 전체 컨텍스트 제공
- UI 깔끔하게 유지

---

## 3. Skill 작성 베스트 프랙티스

### 3.1 Description 작성 (가장 중요)

> "The description field is critical for Claude to discover when to use your Skill."

**필수 요소**:
1. **What**: 무엇을 하는가?
2. **When**: 언제 사용하는가?
3. **Key Terms**: 사용자가 언급할 핵심 키워드

**✅ 올바른 예시**:
```yaml
---
name: meta-ads-analyzer
description: "Meta 광고 데이터를 분석하고 성과 인사이트를 생성합니다. Meta 광고, 페이스북 광고, Instagram 광고, ROAS, CPC, CTR 분석이 필요할 때 사용하세요."
---
```

**❌ 잘못된 예시**:
```yaml
# 너무 모호함
description: "광고 데이터 분석"

# 1인칭 사용 (금지)
description: "I can analyze Meta ads data"

# When이 없음
description: "Meta 광고 성과 지표를 계산합니다"
```

**제한 사항**:
- 최대 1024자
- 3인칭만 사용 (avoid "I", "you")
- 구체적인 트리거 용어 포함

### 3.2 파일 구조

**기본 구조** (단순한 Skill):
```
meta-ads-analyzer/
├── SKILL.md          # 필수: 메인 지침
```

**확장 구조** (복잡한 Skill):
```
meta-ads-analyzer/
├── SKILL.md                        # 메인 지침 (< 500줄)
├── references/                     # 참조 문서 (로드 시에만)
│   ├── META_API_GUIDE.md
│   ├── ROAS_CALCULATION.md
│   └── COMMON_ISSUES.md
├── scripts/                        # 실행 스크립트
│   ├── fetch-ads.js
│   └── analyze-performance.py
└── templates/                      # 출력 템플릿
    └── report-template.md
```

**규칙**:
- ✅ SKILL.md는 500줄 이하로 유지
- ✅ 참조 파일은 1단계 깊이만 (no nesting)
- ✅ 100줄 이상 파일은 목차 포함
- ✅ Unix 스타일 경로 (`/`만 사용, `\` 금지)
- ❌ Windows 스타일 경로 금지

### 3.3 SKILL.md 작성 패턴

**체크리스트 워크플로우** (복잡한 다단계 작업):
```markdown
## Meta 광고 분석 워크플로우

작업 시작 전 이 체크리스트를 복사하여 진행 상황을 추적하세요:

- [ ] 1. Supabase에서 광고 데이터 조회
- [ ] 2. 필수 지표 계산 (ROAS, CPC, CTR)
- [ ] 3. 이상치 감지
- [ ] 4. 인사이트 생성
- [ ] 5. 보고서 작성
- [ ] 6. 사용자에게 요약 전달
```

**Feedback Loop** (검증 필요 작업):
```markdown
## 분석 → 검증 → 실행 패턴

1. **분석**: 광고 데이터를 읽고 이상 패턴 식별
2. **검증**: 사용자에게 발견 사항 확인 요청
3. **실행**: 승인 후 자동화 작업 진행
```

**템플릿 제공** (일관된 출력):
```markdown
## 보고서 템플릿

보고서는 항상 다음 형식을 따르세요:

### 주간 Meta 광고 성과 요약

**기간**: {start_date} ~ {end_date}
**총 지출**: ${total_spend}
**총 전환**: {total_conversions}
**평균 ROAS**: {roas}

#### 주요 인사이트
1. [인사이트 1]
2. [인사이트 2]

#### 개선 권장사항
- [권장사항 1]
- [권장사항 2]
```

### 3.4 토큰 최적화 기법

#### 3.4.1 참조 파일 분리

**Before (비효율)**:
```markdown
# SKILL.md (2000줄)

## Meta API 가이드
[500줄의 API 문서]

## ROAS 계산 방법
[300줄의 계산 로직]

## 일반적인 문제 해결
[200줄의 트러블슈팅]
```

**After (효율)**:
```markdown
# SKILL.md (200줄)

## Meta API 사용법
상세 가이드는 `/references/META_API_GUIDE.md` 참조

## ROAS 계산
계산 로직은 `/references/ROAS_CALCULATION.md` 참조
```

**토큰 절감**: 2000 → 200 (90% 절감)

#### 3.4.2 스크립트 실행 vs 참조

**스크립트 실행** (토큰 소비 없음):
```markdown
## 광고 데이터 가져오기

다음 스크립트를 실행하세요:
```bash
node scripts/fetch-ads.js --client-id {client_id}
```
```

**코드 생성** (토큰 소비 많음):
```markdown
## 광고 데이터 가져오기

다음 코드를 작성하세요:
```javascript
// [50줄의 코드 예시]
```
```

**권장**: 복잡한 작업은 스크립트로 제공

#### 3.4.3 Conditional Loading

**상호 배타적 컨텍스트 분리**:
```markdown
# SKILL.md

## 작업 유형 선택

### A. 일간 분석
- `/references/DAILY_ANALYSIS.md` 참조

### B. 주간 리포트
- `/references/WEEKLY_REPORT.md` 참조

### C. 월간 요약
- `/references/MONTHLY_SUMMARY.md` 참조
```

**장점**: A 작업 시 B, C 문서 로드 안 함

---

## 4. 사용자 상태 표시 시스템

### 4.1 현재 Claude Code의 상태 표시

**Skill 실행 시**:
```
🔧 meta-ads-analyzer is loading...
```
→ UI에 표시되는 상태 메시지 (isMeta: false)

**Subagent 실행 시**:
```
🤖 code-reviewer subagent started
...
✅ code-reviewer subagent completed
```
→ 시작/종료 명확히 표시

**Tool 실행 시**:
```
Reading file: F:\bas_meta\lib\worker.js
Running: node test-telegram-report.js
```
→ 각 도구 실행 표시

### 4.2 향상된 상태 표시 제안

#### 4.2.1 Skill 실행 단계 표시

**현재**:
```
🔧 meta-ads-analyzer is loading...
[작업 진행]
```

**개선안**:
```
🔧 meta-ads-analyzer activated

📊 Step 1/5: Supabase에서 데이터 조회 중...
✅ Step 1/5: 완료 (125건 조회)

📊 Step 2/5: ROAS 계산 중...
✅ Step 2/5: 완료 (평균 ROAS: 3.2)

📊 Step 3/5: 이상치 감지 중...
✅ Step 3/5: 완료 (3개 이상치 발견)

[...]

🎉 meta-ads-analyzer 작업 완료
```

**구현 방법**:
SKILL.md에 명시적 상태 출력 지침 추가

```markdown
## 상태 표시 규칙

각 단계 시작 시 다음 형식으로 출력:
📊 Step {current}/{total}: {작업명}...

각 단계 완료 시:
✅ Step {current}/{total}: 완료 ({결과 요약})
```

#### 4.2.2 Agent 상태 추적

**개선 제안**:
```
🤖 Agents Status:

✅ meta-ads-analyzer (active)
   └─ Step 3/5: 이상치 감지 중...

⏸️ code-reviewer (idle)
   └─ Last run: 2 minutes ago

🔄 test-runner (running)
   └─ 15/23 tests passed
```

**구현**: `.claude/settings.json`에 agent status hook 추가 가능

### 4.3 토큰 사용량 실시간 표시

**개선안**:
```
📊 Token Usage

Session: 45,229 / 200,000 (22.6%)
Remaining: 154,771 tokens
Estimated remaining queries: ~20

Breakdown:
- User prompts: 5,000 tokens (11%)
- Tool results: 15,000 tokens (33%)
- Skills loaded: 2,500 tokens (5.5%)
- Agent outputs: 22,729 tokens (50%)
```

---

## 5. 토큰 최적화 전략

### 5.1 Skill Tool의 동적 Description

> "The Skill tool's description rebuilds dynamically for each request, subject to a 15,000-character budget."

**제약**:
- Skill tool의 전체 description은 15,000자 제한
- 모든 Skills의 name + description 합산
- 초과 시 일부 Skill이 보이지 않을 수 있음

**최적화 방법**:

1. **Description 간결화**:
```yaml
# Before (150자)
description: "이 Skill은 Meta 광고 계정의 광고 데이터를 자동으로 수집하고, ROAS, CPC, CTR 등의 성과 지표를 계산하여, 주간 또는 월간 리포트를 생성합니다."

# After (80자)
description: "Meta 광고 성과 분석 및 리포트 생성. Meta, 페이스북, Instagram 광고 분석 시 사용."
```

2. **Skill 개수 제한**:
- 프로젝트당 10~15개 이하 권장
- 유사 기능 통합

3. **조건부 Skill 로딩**:
```json
// .claude/settings.json
{
  "skills": {
    "load_if": {
      "meta-ads-analyzer": ["*.js", "lib/**"],
      "python-debugger": ["*.py"]
    }
  }
}
```

### 5.2 Multi-Model 전략

**모델별 토큰 소비**:

| 모델 | 컨텍스트 윈도우 | 속도 | 비용 | 권장 용도 |
|------|----------------|------|------|----------|
| **Opus** | 200k | 느림 | 높음 | 복잡한 분석, 아키텍처 설계 |
| **Sonnet** | 200k | 중간 | 중간 | 일반 개발, 코드 작성 |
| **Haiku** | 200k | 빠름 | 낮음 | 단순 작업, 반복 작업 |

**Skill별 모델 지정**:
```yaml
---
name: simple-formatter
description: "코드 포맷팅"
model: haiku  # ⭐ 단순 작업은 Haiku
---
```

```yaml
---
name: architecture-reviewer
description: "시스템 아키텍처 리뷰"
model: opus  # ⭐ 복잡한 분석은 Opus
---
```

**토큰 절감**: Haiku 사용 시 Opus 대비 ~80% 비용 절감

---

## 6. 평가 기반 개발 (Evaluation-Driven Development)

### 6.1 핵심 원칙

> "Start with evaluation by identifying specific gaps in your agents' capabilities through running them on representative tasks and observing where they struggle."

**전통적 개발**:
```
문서 작성 → 코드 구현 → 테스트 → 수정
```

**평가 기반 개발**:
```
테스트 시나리오 작성 → 최소 구현 → 평가 → 반복
```

### 6.2 3단계 평가 프로세스

#### Step 1: 대표 시나리오 생성

**예시 (Meta 광고 분석 Skill)**:
```markdown
# Evaluation Scenarios

## Scenario 1: 일간 데이터 조회
- Input: "어제 Meta 광고 성과 보여줘"
- Expected: Supabase 조회 → ROAS, CPC, CTR 계산 → 요약 출력

## Scenario 2: 이상치 감지
- Input: "최근 1주일간 ROAS가 급격히 떨어진 광고 찾아줘"
- Expected: 7일 데이터 조회 → ROAS 변화율 계산 → 이상치 필터링

## Scenario 3: 주간 리포트 생성
- Input: "이번 주 Meta 광고 리포트 작성해줘"
- Expected: 주간 데이터 집계 → 인사이트 생성 → 템플릿 적용
```

#### Step 2: Baseline 측정

**Without Skill**:
```
🧪 Baseline Test: Scenario 1

User: "어제 Meta 광고 성과 보여줘"
Claude: [Supabase 연결 실패, SQL 문법 오류, 재시도 3회]
Result: ❌ 실패 (10분 소요)
```

**With Skill (v0.1)**:
```
🧪 Skill Test: Scenario 1

User: "어제 Meta 광고 성과 보여줘"
Skill: meta-ads-analyzer activated
Claude: [1회 만에 성공]
Result: ✅ 성공 (30초 소요)
```

#### Step 3: 반복 개선

**관찰 포인트**:
- ✅ 예상 경로를 따라가는가?
- ❌ 불필요한 단계를 거치는가?
- ⚠️ 특정 섹션을 무시하는가?
- 🔄 반복적으로 같은 실수를 하는가?

**개선 사이클**:
```
v0.1: 기본 지침 → 테스트 → 문제 발견
v0.2: 에러 처리 추가 → 테스트 → 개선
v0.3: 참조 문서 분리 → 테스트 → 최적화
v1.0: Production 배포
```

### 6.3 계층적 테스트

**2-Agent 시스템**:

1. **Expert Agent** (개발용):
   - SKILL.md 작성 및 개선
   - 평가 시나리오 실행
   - 문제점 식별

2. **Worker Agent** (테스트용):
   - 실제 작업 수행
   - 실전과 동일한 환경
   - 동작 패턴 관찰

**프로세스**:
```
Expert: SKILL.md v0.1 작성
  ↓
Worker: Scenario 실행
  ↓
Expert: 관찰 결과 분석 → v0.2 개선
  ↓
Worker: Scenario 재실행
  ↓
[반복]
```

---

## 7. 프로젝트 적용 계획

### 7.1 현재 상태 분석

**기존 Skill**:
```
.claude/skills/bas-meta-guide/
└── skill.md  (214줄)
```

**문제점**:
- ✅ Description 없음 (자동 선택 불가)
- ⚠️ 단일 파일에 모든 내용 (토큰 비효율)
- ❌ 평가 시나리오 없음
- ❌ 상태 표시 지침 없음

### 7.2 개선 계획

#### Phase 1: Skill 재구조화

**목표 구조**:
```
.claude/skills/
├── meta-ads-guide/
│   ├── SKILL.md                     # 메인 (< 200줄)
│   ├── references/
│   │   ├── DATABASE_SCHEMA.md      # 분리
│   │   ├── META_API_GUIDE.md       # 분리
│   │   └── BULLMQ_CONFIG.md        # 분리
│   └── evaluations/
│       └── test-scenarios.md
├── meta-ads-analyzer/               # 새 Skill
│   ├── SKILL.md
│   ├── scripts/
│   │   ├── fetch-ads.js
│   │   └── calculate-metrics.js
│   └── templates/
│       └── weekly-report.md
└── streamlit-dashboard/             # 새 Skill
    └── SKILL.md
```

#### Phase 2: Description 작성

**meta-ads-guide**:
```yaml
---
name: meta-ads-guide
description: "BAS Meta Ads 프로젝트 가이드. 데이터베이스 스키마, Meta API, BullMQ 설정을 참조합니다. 프로젝트 작업 시 자동으로 활성화됩니다."
allowed-tools: "Read,Grep,Glob"
---
```

**meta-ads-analyzer**:
```yaml
---
name: meta-ads-analyzer
description: "Meta 광고 데이터를 Supabase에서 조회하고 ROAS, CPC, CTR 등 성과 지표를 분석합니다. Meta 광고, 페이스북 광고, Instagram 광고, 성과 분석, 주간 리포트 관련 요청 시 사용합니다."
allowed-tools: "Bash,Read,Write"
model: "sonnet"
---
```

**streamlit-dashboard**:
```yaml
---
name: streamlit-dashboard
description: "Streamlit 대시보드 개발 및 수정. Plotly 차트, KPI 카드, Supabase 연동을 지원합니다. 대시보드, 시각화, 차트 관련 작업 시 사용합니다."
allowed-tools: "Read,Write,Edit,Bash"
model: "sonnet"
---
```

#### Phase 3: 평가 시나리오 생성

**test-scenarios.md**:
```markdown
# Meta Ads Project Evaluation Scenarios

## Scenario 1: 데이터 조회
**User**: "최근 7일간 Meta 광고 데이터 보여줘"
**Expected**:
1. meta-ads-analyzer 활성화
2. Supabase 쿼리 실행
3. 결과 테이블 출력

## Scenario 2: 이상치 감지
**User**: "ROAS가 비정상적으로 낮은 광고 찾아줘"
**Expected**:
1. 전체 광고 데이터 조회
2. 평균 ROAS 계산
3. 임계값 이하 필터링
4. 원인 분석

## Scenario 3: 대시보드 수정
**User**: "대시보드에 CTR 차트 추가해줘"
**Expected**:
1. streamlit-dashboard 활성화
2. 기존 코드 읽기
3. Plotly 차트 추가
4. 테스트 실행
```

#### Phase 4: 상태 표시 통합

**SKILL.md에 추가**:
```markdown
## 🔔 상태 표시 규칙

### 작업 시작 시
📊 Step 1/{total}: {작업명}...

### 단계 완료 시
✅ Step 1/{total}: 완료 ({결과 요약})

### 최종 완료 시
🎉 {skill-name} 작업 완료

### 예시
📊 Step 1/5: Supabase에서 광고 데이터 조회 중...
✅ Step 1/5: 완료 (125건 조회)
```

#### Phase 5: 토큰 최적화

**Before**:
```markdown
# SKILL.md (214줄)
[모든 내용 포함]
```

**After**:
```markdown
# SKILL.md (50줄)

## 데이터베이스
상세 스키마: `/references/DATABASE_SCHEMA.md` 참조

## Meta API
페이지네이션 가이드: `/references/META_API_GUIDE.md` 참조

## BullMQ
Worker 설정: `/references/BULLMQ_CONFIG.md` 참조
```

**예상 토큰 절감**: 2,000 → 500 (75% 절감)

### 7.3 구현 체크리스트

#### Skill 재구조화
- [ ] `meta-ads-guide` 분리 (SKILL.md + references/)
- [ ] `meta-ads-analyzer` 생성
- [ ] `streamlit-dashboard` 생성
- [ ] Description 작성 (모든 Skill)
- [ ] `allowed-tools` 설정

#### 평가 시스템
- [ ] `evaluations/test-scenarios.md` 작성
- [ ] Baseline 측정 (Skill 없이)
- [ ] Skill 테스트 (v0.1)
- [ ] 개선 사항 식별

#### 상태 표시
- [ ] 단계별 출력 규칙 정의
- [ ] SKILL.md에 지침 추가
- [ ] 예시 추가

#### 토큰 최적화
- [ ] 참조 문서 분리
- [ ] 스크립트 실행으로 전환
- [ ] Multi-model 전략 적용

---

## 8. 추가 참고 자료

### 8.1 공식 문서
- [Agent Skills - Claude Code Docs](https://docs.claude.com/en/docs/claude-code/skills)
- [Skill Authoring Best Practices](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices)
- [Anthropic Official Skills Repository](https://github.com/anthropics/skills)

### 8.2 커뮤니티 자료
- [awesome-claude-skills](https://github.com/travisvn/awesome-claude-skills)
- [Claude Skills Deep Dive](https://leehanchung.github.io/blogs/2025/10/26/claude-skills-deep-dive/)
- [SkillsMP Marketplace](https://skillsmp.com/)

### 8.3 프로젝트 문서
- `docs/PROJECT_SPECIFICATION.md` - 전체 프로젝트 설계
- `docs/IMPLEMENTATION_GUIDE.md` - 구현 가이드
- `docs/PROGRESS_SUMMARY.md` - 진행 상황

---

## 9. 핵심 요약

### 9.1 Golden Rules

1. **Description이 전부다**: Claude가 Skill을 발견하는 유일한 방법
2. **500줄 제한**: SKILL.md는 간결하게, 상세 내용은 참조 파일로
3. **평가 우선**: 문서 작성 전에 테스트 시나리오부터
4. **토큰 절약**: Progressive Disclosure 활용
5. **상태 표시**: 사용자에게 투명하게

### 9.2 기대 효과

- ✅ **토큰 73% 절감** (Anthropic 벤치마크)
- ✅ **작업 속도 향상** (반복 프롬프트 제거)
- ✅ **일관성 유지** (표준화된 워크플로우)
- ✅ **투명성 향상** (명확한 상태 표시)
- ✅ **유지보수 용이** (모듈화된 구조)

---

**다음 단계**: Phase 1 (Skill 재구조화) 시작
