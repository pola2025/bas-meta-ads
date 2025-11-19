# BAS Meta Ads - Claude Code 설정

이 폴더는 BAS Meta Ads 프로젝트의 Claude Code 설정을 포함합니다.

## 📁 구조

```
.claude/
├── settings.json           # 프로젝트 설정 및 가이드 규칙
├── skills/
│   └── bas-meta-guide/
│       └── skill.md        # 가이드 문서 준수 스킬
└── README.md              # 이 파일
```

## 🎯 자동 적용 규칙

### 1. 가이드 문서 우선
모든 작업은 `docs/PROJECT_SPECIFICATION.md`를 최우선으로 준수합니다.

### 2. 필수 체크 항목

#### 데이터베이스
- ✅ SQL 변수는 `v_` 접두사 사용
- ✅ `currency` 필드 포함 (v1.2)
- ✅ Vault 토큰 ID 사용

#### Meta API
- ✅ 페이지네이션 구현 (90개 이상 광고 대응)
- ✅ Null/undefined 안전 체크
- ✅ Vault 토큰 공백 제거

#### Job Queue
- ✅ Upstash Redis `keepAlive: 30000`
- ✅ Worker `concurrency: 2`
- ✅ Exponential backoff 재시도

#### Streamlit 대시보드
- ✅ KPI 카드: `125건 ↑18% (+19건)` + `전주: 106건`
- ✅ Plotly 차트 사용
- ✅ 빈 데이터 처리

## 🚨 위반 시 동작

1. 작업 즉시 중단
2. 사용자에게 위반 내용 보고
3. 올바른 방법 제시
4. 수정 후 재작업

## 📚 참고 문서

- **설계**: `docs/PROJECT_SPECIFICATION.md` (v1.2.2)
- **구현**: `docs/IMPLEMENTATION_GUIDE.md`
- **진행**: `docs/PROGRESS_SUMMARY.md`

## 🔧 스킬 활성화

`bas-meta-guide` 스킬은 프로젝트 작업 시 자동으로 활성화됩니다.

수동 활성화:
```
/skill bas-meta-guide
```

## ✨ 주요 기능

1. **자동 가이드 체크**: 코드 작성 전 가이드 확인
2. **필수 규칙 강제**: v1.2 개선 사항 자동 적용
3. **문서 우선주의**: 가이드와 불일치 시 문서 우선
4. **즉각 피드백**: 위반 시 즉시 알림

---

**버전**: 1.0.0
**최종 업데이트**: 2025-11-19
