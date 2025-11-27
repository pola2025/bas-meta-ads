# 📚 lib - 핵심 라이브러리

> 시스템 전반에서 사용되는 공용 모듈

---

## 파일 목록

### 🔐 인증/보안
| 파일 | 설명 |
|------|------|
| `encryption.js` | AES-256-CBC 토큰 암호화/복호화 |
| `token-manager.js` | 클라이언트별 토큰 관리, Vault 연동 |

### 📡 Meta API
| 파일 | 설명 |
|------|------|
| `meta.js` | Meta Graph API 호출 (광고 데이터) |
| `backfill.js` | 백필 로직 (과거 데이터 재수집) |

### 📱 텔레그램
| 파일 | 설명 |
|------|------|
| `telegram.js` | 텔레그램 Bot API 기본 호출 |
| `telegram-notifier.js` | 알림 발송 (시스템/클라이언트) |
| `telegram-chart.js` | 텔레그램용 차트 이미지 생성 |

### 📊 리포트
| 파일 | 설명 |
|------|------|
| `chart-generator.js` | QuickChart 기반 차트 생성 |
| `monthly-summary.js` | 월간 요약 데이터 생성 |
| `report-storage.js` | 리포트 DB 저장/조회 |
| `reporter/` | 리포트 생성 모듈 (디렉토리) |

### 🔧 유틸리티
| 파일 | 설명 |
|------|------|
| `data-integrity.js` | 데이터 무결성 검사 |

---

## 주요 사용처

```
collect-all-clients.js
  └─→ encryption.js (토큰 복호화)

send-weekly-report.js
  ├─→ telegram-notifier.js (발송)
  ├─→ chart-generator.js (차트)
  └─→ report-storage.js (저장)

dashboard/app/api/backfill/route.ts
  └─→ (자체 구현, lib 미사용)
```

---

## 백업된 파일 (_backup/lib/)

Redis 의존 라이브러리 (현재 미사용):
- `producer.js` - BullMQ 작업 큐
- `worker.js` - BullMQ 워커
- `aggregation-worker.js` - 집계 워커

---

**최종 수정**: 2025-11-26
