# BAS Meta Ads 데이터 테이블 구조

## 핵심 데이터 흐름

```
Meta API → ads_insights_daily (VIEW) → telegram_reports → Dashboard
```

---

## 테이블 목록

### 1. `ads_insights_daily` (VIEW)
**용도**: 일별 광고 성과 데이터 (리포트 생성 시 메인 소스)

**중요한 컬럼**:
| 컬럼명 | 타입 | 설명 |
|--------|------|------|
| `date` | DATE | 📍 **날짜 컬럼 (date_start 아님!)** |
| `client_id` | UUID | 클라이언트 ID |
| `ad_id` | TEXT | 광고 ID |
| `ad_name` | TEXT | 광고명 |
| `campaign_id` | TEXT | 캠페인 ID |
| `campaign_name` | TEXT | 캠페인명 |
| `impressions` | INTEGER | 노출수 |
| `clicks` | INTEGER | 클릭수 |
| `spend` | DECIMAL | 지출액 (USD) |
| `leads` | INTEGER | 리드수 (전환) |

**사용 예시**:
```javascript
supabase
  .from('ads_insights_daily')
  .select('*')
  .gte('date', '2025-12-01')  // ⚠️ 'date' 사용 (date_start 아님!)
  .lte('date', '2025-12-07')
  .eq('client_id', clientId)
```

---

### 2. `telegram_reports`
**용도**: 발송된 주간/월간 리포트 저장

**중요한 컬럼**:
| 컬럼명 | 타입 | 설명 |
|--------|------|------|
| `id` | UUID | 리포트 ID |
| `client_id` | UUID | 클라이언트 ID |
| `report_type` | TEXT | 'weekly' 또는 'monthly' |
| `week_start` | DATE | 리포트 시작일 |
| `week_end` | DATE | 리포트 종료일 |
| `total_leads` | INTEGER | 총 리드수 |
| `total_spend` | DECIMAL | 총 지출액 |
| `avg_cpl` | DECIMAL | 평균 CPL |
| `avg_ctr` | DECIMAL | 평균 CTR |
| `ai_insights` | TEXT | 📍 **AI 인사이트 텍스트** |
| `message_text` | TEXT | 텔레그램 발송 메시지 전문 |
| `report_data` | JSONB | 구조화된 리포트 데이터 |
| `sent_at` | TIMESTAMP | 발송 시각 |

**사용 예시**:
```javascript
// 특정 기간 리포트 조회
supabase
  .from('telegram_reports')
  .select('*')
  .eq('week_start', '2025-12-01')
  .eq('week_end', '2025-12-07')
  .eq('client_id', clientId)
```

---

### 3. `clients`
**용도**: 클라이언트 정보 관리

**중요한 컬럼**:
| 컬럼명 | 타입 | 설명 |
|--------|------|------|
| `id` | UUID | 클라이언트 ID |
| `client_name` | TEXT | 클라이언트 이름 (한글) |
| `slug` | TEXT | URL 슬러그 (영문) |
| `is_active` | BOOLEAN | 활성 상태 |
| `telegram_chat_id` | TEXT | 텔레그램 채팅 ID |
| `meta_account_id` | TEXT | Meta 광고 계정 ID |

---

### 4. `weekly_summary`
**용도**: 주간 요약 데이터 (광고별)

**중요한 컬럼**:
| 컬럼명 | 타입 | 설명 |
|--------|------|------|
| `week_start` | DATE | 주 시작일 |
| `week_end` | DATE | 주 종료일 |
| `ad_id` | TEXT | 광고 ID |
| `ad_name` | TEXT | 광고명 |
| `total_impressions` | INTEGER | 총 노출수 |
| `total_clicks` | INTEGER | 총 클릭수 |
| `total_spend` | DECIMAL | 총 지출액 |
| `total_leads` | INTEGER | 총 리드수 |
| `total_video_views` | INTEGER | 총 영상 조회수 |

---

## 자주 하는 실수

### ❌ 잘못된 코드
```javascript
// ads_insights_daily에서 date_start 사용 - 에러!
.gte('date_start', '2025-12-01')
```

### ✅ 올바른 코드
```javascript
// ads_insights_daily에서 date 사용 - 정상!
.gte('date', '2025-12-01')
```

---

## 클라이언트 ID 매핑 (2025-12 기준)

| 클라이언트명 | slug | client_id |
|-------------|------|-----------|
| 내일채움 | naeilchaeum | a1a34942-edf7-4b1b-ab36-ab1a9f663a0b |
| 비즈액터스쿨 | bas-k92m7x | 79e35fc6-a817-4ccc-9d5d-9a93c1ad4515 |
| YMix | ymix-a7174d | ea9291b7-b685-4e17-ad51-d140da66d4c6 |
| JH 경영지원센터 | jh-gjst-08f7ad | 4617bad3-3eb8-419d-a186-057907c2a1ce |
| JY경영지원센터 | jygjst-598717 | 06a0c02f-b089-4b2a-8aa3-b744252b8adc |
| 솔트 기업성장연구소 | st-gsjgs-cf2071 | 1caedbc1-4e3d-4a4f-a413-fca4010e9a60 |
| 성공K지원파트너스 | sgk-nofq72 | 75faa402-2773-4c3e-9527-c33a1954270f |
| 부자성공파트너 | bjsgptn-bf6a26 | b9dc9687-01ca-49b9-b10b-957aec7fb51c |

---

## 데이터 확인 스크립트

```bash
# 12월 1-7일 데이터 확인 (올바른 방법)
node check-dec-data-correct.js

# AI 인사이트 상태 확인
node check-ai-insights.js
```

---

**최종 수정**: 2025-12-08
**작성자**: Claude Code
