# 🗄️ sql - 데이터베이스 스키마

> Supabase PostgreSQL 스키마 및 마이그레이션 파일

---

## ⭐ 핵심 파일 (현재 사용)

| 파일 | 설명 |
|------|------|
| `01_schema.sql` | 기본 테이블 (clients, raw_data) |
| `17_fix_ads_insights_view.sql` | **ads_insights_daily VIEW** (현재 사용) |

---

## 파일 목록

### 기본 스키마 (01~05)
| 번호 | 파일 | 설명 |
|------|------|------|
| 01 | `01_schema.sql` | clients, raw_data 테이블 |
| 02 | `02_functions_timezone.sql` | 타임존 변환 함수 |
| 03 | `03_analysis_views.sql` | 분석용 VIEW |
| 03 | `03_vault_functions.sql` | Vault RPC 함수 |
| 04 | `04_ads_insights_daily_view.sql` | VIEW 원본 정의 |
| 05 | `05_telegram_reports.sql` | 텔레그램 리포트 테이블 |

### 집계 테이블 (06~11)
| 번호 | 파일 | 설명 |
|------|------|------|
| 06 | `06_daily_aggregates.sql` | 일별 집계 테이블 (레거시) |
| 07 | `07_add_lead_value.sql` | lead_value 컬럼 추가 |
| 08~10 | `08~10_enable_rls*.sql` | RLS 정책 설정 |
| 11 | `11_create_daily_aggregates.sql` | daily_aggregates 생성 |

### 텔레그램 리포트 (12~13)
| 번호 | 파일 | 설명 |
|------|------|------|
| 12 | `12_telegram_reports_simple.sql` | 심플 버전 |
| 13 | `13_add_report_data_column.sql` | report_data 컬럼 |

### 클라이언트 확장 (14~22)
| 번호 | 파일 | 설명 |
|------|------|------|
| 14 | `14_add_client_slug.sql` | slug 컬럼 |
| 15 | `15_ad_cumulative_stats.sql` | 누적 통계 |
| 16 | `16_update_ads_insights_view.sql` | VIEW 업데이트 |
| **17** | `17_fix_ads_insights_view.sql` | **⭐ 현재 사용 VIEW** |
| 17 | `17_raw_data_rls_policy.sql` | raw_data RLS |
| 18 | `18_add_telegram_chat_id.sql` | telegram_chat_id |
| 19 | `19_vault_token_management.sql` | Vault 토큰 관리 |
| 20 | `20_encrypted_token_column.sql` | 암호화 토큰 |
| 21 | `21_payment_history.sql` | 결제 내역 |
| 21 | `21_service_period_columns.sql` | 서비스 기간 |
| 22 | `22_telegram_enabled_column.sql` | 텔레그램 활성화 |

---

## VIEW 확인 방법

현재 VIEW가 `raw_data` 기반인지 확인:
```sql
SELECT definition
FROM pg_views
WHERE viewname = 'ads_insights_daily';
```

VIEW 재생성 필요 시:
```sql
-- sql/17_fix_ads_insights_view.sql 내용 실행
```

---

## 마이그레이션 적용

Supabase SQL Editor에서 직접 실행하거나:
```bash
# 예시 (psql 사용 시)
psql $DATABASE_URL < sql/17_fix_ads_insights_view.sql
```

---

**최종 수정**: 2025-11-26
