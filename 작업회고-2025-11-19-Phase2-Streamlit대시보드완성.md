---
tags:
  - 프론트엔드
  - Python
  - Streamlit
  - Plotly
  - 대시보드
  - 데이터시각화
  - Supabase
  - PostgreSQL
  - 한글화
  - UI/UX
  - BAS-Meta-Ads
  - 작업회고
date: 2025-11-19
project: BAS Meta Ads Analytics
status: 완료
type: 대시보드개발
---

# BAS Meta Ads Phase 2 - Streamlit 대시보드 완성 작업 회고

## 📋 작업 개요
- **날짜**: 2025-11-19
- **프로젝트**: BAS Meta Ads Analytics - Streamlit 대시보드 개발
- **작업 범위**: Phase 2 완료 (대시보드 구축, 한글화, DB 연동, 에러 수정)
- **개발 환경**: Python 3.13, Streamlit 1.39.0, Plotly, Supabase, Pandas

## 🎯 작업 목표
1. Streamlit 기반 대시보드 구축
2. 한글화 및 사용자 친화적 UI 구현
3. Supabase 데이터 연동
4. PROJECT_SPECIFICATION.md v1.2.2 준수
5. KPI 카드 형식 정확히 구현 (증감률 + 절대값 + 이전 값)

## 🛠️ 주요 작업 내용

### 1. 프로젝트 구조 생성
```
streamlit-app/
├── app.py                    # 메인 대시보드
├── utils/
│   ├── __init__.py
│   ├── supabase_client.py   # DB 연동
│   └── chart_helpers.py     # Plotly 차트
├── pages/                    # 추가 페이지 (향후)
├── requirements.txt
└── .env
```

### 2. Supabase 연동 및 DB 스키마 에러 해결

**발견한 문제**:
```python
# ❌ 초기 코드 (에러)
APIError: column weekly_summary.client_name does not exist
```

**원인**:
- Python 코드: `client_name` 파라미터 사용
- DB 실제 컬럼: `client_id` (UUID)
- 컬럼명 불일치: `impressions` vs `total_impressions`

**해결**:
```python
# ✅ 수정 후
def get_weekly_summary(
    self,
    client_id: Optional[str] = None,  # client_name → client_id
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None
) -> List[Dict[str, Any]]:
    query = self.client.table('weekly_summary').select('*')

    if client_id:
        query = query.eq('client_id', client_id)  # ✅ client_id 사용
```

**파일 위치**:
- `streamlit-app/utils/supabase_client.py`

**변경된 컬럼명**:
- `client_name` → `client_id`
- `impressions` → `total_impressions`
- `clicks` → `total_clicks`
- `spend` → `total_spend`
- `leads` → `total_leads`
- `date_start` → `date`

### 3. 완전 한글화

**UI 텍스트**:
```python
# 페이지 설정
st.set_page_config(
    page_title="BAS 메타 광고 분석",
    page_icon="📊",
    layout="wide"
)

# KPI 카드
st.metric(
    label="총 노출수",
    value=f"{current_impressions:,}",
    delta=f"{imp_percent:.1f}% ({imp_abs:+,})",
    delta_color="normal"
)
st.caption(f"이전 기간: {prev_impressions:,}")
```

**차트 한글화**:
```python
# Plotly 차트 제목 및 축
metric_names = {
    'total_impressions': '노출수',
    'total_clicks': '클릭수',
    'total_spend': '지출',
    'total_leads': '리드수'
}

fig.update_layout(
    title='노출수 추이',
    xaxis_title='날짜',
    yaxis_title='노출수',
    template='plotly_white'
)
```

**빈 데이터 처리**:
```python
# 데이터 없을 때
fig.add_annotation(
    text="데이터가 없습니다",
    xref="paper", yref="paper",
    x=0.5, y=0.5,
    showarrow=False,
    font=dict(size=20, color="gray")
)
```

### 4. KPI 카드 구현 (기획서 준수)

**요구사항** (`docs/PROJECT_SPECIFICATION.md` v1.2.2):
```
총 리드
125건 ↑18% (+19건)
전주: 106건
```

**구현**:
```python
def calc_delta(current, previous):
    if previous == 0:
        return 0, current
    percent = ((current - previous) / previous) * 100
    absolute = current - previous
    return percent, absolute

# KPI 카드
st.metric(
    label="총 리드수",
    value=f"{current_leads:,}",
    delta=f"{lead_percent:.1f}% ({lead_abs:+,})",  # ✅ 증감률 + 절대값
    delta_color="normal"
)
st.caption(f"이전 기간: {prev_leads:,}")  # ✅ 이전 값
```

### 5. Plotly 차트 6개 구현

**차트 목록**:
1. **노출수 추이** (Line Chart)
2. **클릭수 추이** (Line Chart)
3. **지출 추이** (Line Chart)
4. **리드수 추이** (Line Chart)
5. **CPL 추이** (Line Chart, 계산 필드)
6. **전환 퍼널** (Funnel Chart)

**CPL 계산**:
```python
def create_cpl_trend_chart(data: List[Dict[str, Any]]) -> go.Figure:
    df = pd.DataFrame(data)

    # CPL 계산
    df['cpl'] = df.apply(
        lambda row: row['total_spend'] / row['total_leads'] if row['total_leads'] > 0 else 0,
        axis=1
    )

    # ✅ Null 체크 (v1.2 개선 사항)
```

**전환 퍼널**:
```python
fig.add_trace(go.Funnel(
    y=['노출', '클릭', '리드'],
    x=[impressions, clicks, leads],
    textinfo='value+percent initial',
    marker=dict(color=['#93C5FD', '#60A5FA', '#3B82F6'])
))
```

### 6. 날짜 필터 문제 해결

**문제**:
- 실제 데이터: 2025-11-09 ~ 2025-11-15
- 기본 필터: "최근 7일" (2025-11-12 ~ 2025-11-19)
- 결과: 데이터 없음

**해결**:
```python
# 기본값을 "최근 30일"로 변경
date_range = st.sidebar.radio(
    "기간",
    ["최근 7일", "최근 30일", "최근 90일", "직접 설정"],
    index=1  # ✅ 기본값: "최근 30일"
)
```

**개선된 안내 메시지**:
```python
st.info("""
**데이터를 보려면:**
- 사이드바에서 **"최근 30일"** 또는 **"최근 90일"**을 선택해보세요
- 또는 **"직접 설정"**으로 원하는 기간을 지정하세요

**참고**: 데이터는 주 단위로 수집되므로, 마지막 데이터 수집 시점에 따라
        최근 몇 일간은 데이터가 없을 수 있습니다.
""")
```

### 7. .claude 프로젝트 스킬 설정

**파일**: `.claude/skills/bas-meta-guide/skill.md`

**주요 규칙**:
- ✅ `docs/PROJECT_SPECIFICATION.md` v1.2.2 준수
- ✅ SQL 변수는 `v_` 접두사 필수
- ✅ Meta API 페이지네이션 구현
- ✅ Null/undefined 체크 필수
- ✅ KPI 카드 형식: 증감률 + 절대값 + 이전 값

**파일**: `.claude/settings.json`

```json
{
  "project": {
    "name": "BAS Meta Ads Analytics",
    "version": "1.2.2"
  },
  "guidelines": {
    "dashboard": {
      "kpi_format": "value + percent + absolute + previous",
      "chart_library": "plotly",
      "enforce_empty_data_handling": true
    }
  }
}
```

## 📊 기대 효과

### 정량적 지표
- ✅ 대시보드 완성도: **100%**
- ✅ 한글화 비율: **100%**
- ✅ 차트 개수: **6개**
- ✅ KPI 카드: **8개** (주요 4개 + 추가 4개)
- ✅ 필터 옵션: **5개** (클라이언트 + 4가지 날짜 범위)

### 정성적 개선
- **사용자 경험**: 직관적인 한글 UI
- **데이터 시각화**: Plotly 인터랙티브 차트
- **필터링**: 클라이언트 및 날짜 범위 유연하게 선택
- **정보 밀도**: 한 화면에 주요 지표 + 추세 + 상세 데이터

## 🔧 기술 스택

### Frontend
- **Streamlit** 1.39.0: 웹 대시보드 프레임워크
- **Plotly** 5.24.1: 인터랙티브 차트
- **Pandas** 2.2.3: 데이터 처리
- **Altair** 5.4.1: 추가 차트 옵션

### Database
- **Supabase** 2.9.1: PostgreSQL 클라이언트
- **PostgreSQL** 15: 데이터베이스

### Utilities
- **python-dotenv**: 환경 변수 관리
- **python-dateutil**: 날짜 처리

## 💡 배운 점

### 기술적 배움

1. **Streamlit 캐싱**
   - `@st.cache_resource`: 리소스 캐싱 (Supabase client)
   - `@st.cache_data`: 데이터 캐싱 (TTL 300초)
   - 캐시 무효화: 서버 재시작 필요

2. **Plotly 차트 커스터마이징**
   - 한글 폰트 지원 자동 처리
   - `template='plotly_white'`: 깔끔한 차트 스타일
   - `hovertemplate`: 호버 정보 커스터마이징

3. **Supabase Python SDK**
   - `.eq()`, `.gte()`, `.lte()`: 필터링
   - `.order()`: 정렬
   - `.limit()`: 개수 제한
   - `.execute()`: 쿼리 실행

4. **Pandas DataFrame 활용**
   - `sum()`: 집계
   - `apply()`: 커스텀 계산 (CPL)
   - `sort_values()`: 정렬
   - `head()`: 상위 N개

### 프로세스 개선

1. **Read-Write-Test (RWT) 준수**
   - 파일 수정 전 항상 Read
   - 실제 데이터로 검증
   - 에러 발생 시 즉시 수정

2. **가이드 문서 우선**
   - `PROJECT_SPECIFICATION.md` 참조
   - DB 스키마 확인
   - 기획 의도 파악

3. **점진적 개선**
   - 기본 기능 먼저 구현
   - 에러 수정
   - 한글화
   - UX 개선

## 🐛 발생한 이슈 및 해결

### 이슈 1: DB 컬럼명 불일치

**문제**:
```
APIError: column weekly_summary.client_name does not exist
```

**원인**:
- Python 코드에서 `client_name` 파라미터 사용
- 실제 DB는 `client_id` (UUID) 사용

**해결**:
```python
# Before
def get_weekly_summary(self, client_name: Optional[str] = None):
    query.eq('client_name', client_name)

# After
def get_weekly_summary(self, client_id: Optional[str] = None):
    query.eq('client_id', client_id)
```

**파일**:
- `streamlit-app/utils/supabase_client.py` (전체 수정)
- `streamlit-app/utils/chart_helpers.py` (컬럼명 수정)
- `streamlit-app/app.py` (client_id 사용)

---

### 이슈 2: Streamlit 캐싱 문제

**문제**:
```
TypeError: SupabaseDataFetcher.get_weekly_summary() got an unexpected keyword argument 'client_id'
```

**원인**:
- Streamlit의 `@st.cache_data`가 이전 버전 함수 캐싱
- 코드 수정 후에도 캐시된 함수 사용

**해결**:
```bash
# 서버 재시작으로 캐시 초기화
streamlit run app.py --server.port 8080
```

**재발 방지**:
- 코드 변경 후 항상 서버 재시작
- 개발 시 `--server.runOnSave true` 사용 고려

---

### 이슈 3: 날짜 범위 필터 데이터 없음

**문제**:
- 기본 "최근 7일" 선택 시 데이터 없음
- 실제 데이터는 1주일 전 (2025-11-09 ~ 2025-11-15)

**원인**:
- 데이터 수집 주기: 주 1회
- 마지막 수집: 2025-11-15
- "최근 7일": 2025-11-12 ~ 2025-11-19 (범위 벗어남)

**해결**:
```python
# 기본값을 "최근 30일"로 변경
date_range = st.sidebar.radio(
    "기간",
    ["최근 7일", "최근 30일", "최근 90일", "직접 설정"],
    index=1  # ✅ Default to "최근 30일"
)
```

**추가 개선**:
- 데이터 없을 때 도움말 메시지 표시
- 주 단위 수집 주기 안내

---

### 이슈 4: 포트 3000 사용 경고

**문제**:
```
Port 3000 is reserved for internal development.
It is strongly recommended to select an alternative port.
```

**원인**:
- Streamlit 내부 개발용 포트 3000
- 프로덕션 사용 권장하지 않음

**해결**:
```bash
# 8080번 포트로 변경
streamlit run app.py --server.port 8080
```

## 📝 작업 파일 목록

### 생성된 파일

1. **streamlit-app/app.py** (315줄)
   - 메인 대시보드 앱
   - KPI 카드, 차트, 필터 구현

2. **streamlit-app/utils/supabase_client.py** (180줄)
   - Supabase 데이터 조회 클래스
   - `get_weekly_summary()`, `get_clients()` 등

3. **streamlit-app/utils/chart_helpers.py** (240줄)
   - Plotly 차트 생성 함수
   - `create_kpi_trend_chart()`, `create_funnel_chart()` 등

4. **streamlit-app/requirements.txt**
   - Python 패키지 목록
   - Streamlit, Plotly, Supabase, Pandas 등

5. **streamlit-app/.env**
   - Supabase 환경 변수

6. **.claude/skills/bas-meta-guide/skill.md**
   - 프로젝트 가이드 스킬

7. **.claude/settings.json**
   - 프로젝트 설정 및 규칙

8. **test-dashboard-query.js**
   - 대시보드 쿼리 테스트 스크립트

### 수정된 파일

1. **.gitignore**
   - Python, Streamlit 관련 추가

2. **NEXT_SESSION.md**
   - Phase 3 작업 계획 업데이트

## 🎯 향후 작업 계획

### 단기 (Phase 3 - 자동화)
- [ ] **자동 데이터 수집 스케줄링** (최우선)
  - Railway Cron 또는 GitHub Actions
  - 매주 월요일 09:00 자동 실행
  - Producer 자동 트리거

- [ ] **Railway 배포**
  - Worker 24/7 실행
  - 환경 변수 설정
  - 로그 모니터링

- [ ] **Telegram 알림 강화**
  - Producer 완료 알림
  - Worker 실패 알림
  - 주간 요약 리포트

### 중기 (Phase 4 - 확장)
- [ ] **추가 클라이언트 등록**
  - 2-3개 클라이언트 테스트
  - 멀티 클라이언트 검증

- [ ] **Streamlit 대시보드 추가 페이지**
  - 월간 리포트
  - 캠페인 상세 분석
  - 설정 페이지

- [ ] **Streamlit Cloud 배포**
  - 무료 호스팅
  - 퍼블릭 URL

### 장기 (Phase 5 - 고도화)
- [ ] **PDF 리포트 생성**
  - 주간/월간 리포트
  - 이메일 자동 발송

- [ ] **다채널 통합**
  - Google Ads
  - Naver Ads

- [ ] **AI 기반 인사이트**
  - 성과 예측
  - 최적화 제안

## 🔍 회고 및 개선 사항

### 잘한 점 ✅

1. **체계적인 에러 해결**
   - DB 스키마 에러 → Node.js로 실제 데이터 확인
   - 테스트 스크립트 작성 (`test-dashboard-query.js`)
   - 원인 파악 → 수정 → 검증

2. **가이드 문서 우선**
   - `PROJECT_SPECIFICATION.md` 먼저 확인
   - KPI 카드 형식 정확히 구현
   - 기획 의도 반영

3. **사용자 경험 고려**
   - 완전 한글화
   - 기본값 "최근 30일" (데이터 보이도록)
   - 데이터 없을 때 도움말 표시

4. **재사용 가능한 코드**
   - `chart_helpers.py`: 차트 함수 모듈화
   - `supabase_client.py`: DB 조회 클래스화
   - 향후 확장 용이

### 아쉬운 점 ⚠️

1. **초기 DB 스키마 확인 부족**
   - Python 코드 작성 전 DB 스키마 확인했다면 에러 방지 가능
   - Node.js의 `check-collected-data.js` 먼저 실행했어야 함

2. **Streamlit 캐싱 이해 부족**
   - 코드 변경 후 캐시 초기화 필요성 몰랐음
   - 서버 재시작으로 해결했지만, 개발 시간 소요

3. **날짜 필터 기본값 고려 부족**
   - 실제 데이터 범위 확인 후 기본값 설정했어야 함
   - 초기 "최근 7일" → "데이터 없음" 사용자 혼란

### 개선 방안 💡

1. **개발 전 체크리스트**
   ```bash
   # 대시보드 개발 시작 전
   1. node check-collected-data.js  # 실제 데이터 확인
   2. docs/PROJECT_SPECIFICATION.md 읽기
   3. DB 스키마 파악
   4. Python 코드 작성
   ```

2. **Streamlit 개발 팁**
   ```bash
   # 개발 시 자동 리로드
   streamlit run app.py --server.runOnSave true

   # 캐시 클리어 단축키
   # Ctrl+R (브라우저 새로고침)
   # 또는 'c' 키 (캐시 클리어)
   ```

3. **테스트 우선 개발**
   ```python
   # 함수 작성 전 테스트 데이터 확인
   test_data = fetcher.get_weekly_summary(
       client_id='79e35fc6-a817-4ccc-9d5d-9a93c1ad4515',
       start_date=datetime(2025, 11, 9),
       end_date=datetime(2025, 11, 15)
   )
   print(test_data)  # 실제 데이터 구조 파악
   ```

4. **문서화 강화**
   - README.md에 빠른 시작 가이드 추가
   - 환경 변수 설정 방법 명시
   - 트러블슈팅 섹션 추가

## 📚 참고 자료

- [Streamlit Documentation](https://docs.streamlit.io/)
- [Plotly Python Documentation](https://plotly.com/python/)
- [Supabase Python Client](https://supabase.com/docs/reference/python/introduction)
- [Pandas Documentation](https://pandas.pydata.org/docs/)
- [PROJECT_SPECIFICATION.md](docs/PROJECT_SPECIFICATION.md) v1.2.2

## 🎉 결론

**Phase 2 대시보드 개발 100% 완료!**

### 성과 요약
- ✅ Streamlit 기반 인터랙티브 대시보드 완성
- ✅ 완전 한글화 UI
- ✅ Supabase 데이터 정상 연동
- ✅ KPI 카드 기획서대로 정확히 구현
- ✅ Plotly 차트 6개 구현
- ✅ 클라이언트 및 날짜 필터링
- ✅ 프로젝트 가이드 스킬 적용

### 최종 검증 데이터
**대시보드 접속**: http://localhost:8080
- **클라이언트**: 비즈액터스쿨
- **기간**: 2025-11-09 ~ 2025-11-15
- **총 노출수**: 851
- **총 클릭수**: 21
- **총 지출**: $72.87
- **총 리드수**: 2
- **CTR**: 2.47%
- **CPL**: $36.44

이제 안정적인 대시보드 위에 자동화 및 확장 기능을 추가할 준비가 완료되었습니다! 🚀

다음 단계는 **자동 데이터 수집 스케줄링 (Railway Cron)**이 최우선입니다.
