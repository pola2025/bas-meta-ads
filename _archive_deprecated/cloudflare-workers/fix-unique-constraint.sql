-- daily_aggregates 테이블에 unique constraint 추가
-- (date, ad_id) 조합이 unique해야 Upsert가 작동함

ALTER TABLE daily_aggregates
ADD CONSTRAINT daily_aggregates_date_ad_id_key UNIQUE (date, ad_id);

-- 제약 조건 확인
SELECT conname, contype, conkey
FROM pg_constraint
WHERE conrelid = 'daily_aggregates'::regclass;
