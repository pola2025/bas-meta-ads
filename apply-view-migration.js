/**
 * ============================================================================
 * ads_insights_daily 뷰 마이그레이션 스크립트
 * ============================================================================
 * 목적: 대시보드 뷰를 daily_aggregates 기반으로 변경
 *
 * 실행: node apply-view-migration.js
 *
 * 변경 내용:
 * - 기존: raw_data 테이블 기반 (1월~6월 초만)
 * - 변경: daily_aggregates 테이블 기반 (1월~6월 + 11월)
 * ============================================================================
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function applyMigration() {
  console.log('🚀 ads_insights_daily 뷰 마이그레이션 시작\n');

  // 1. 기존 뷰 상태 확인
  console.log('1️⃣ 기존 뷰 상태 확인...');
  const { data: oldData, error: oldError } = await supabase
    .from('ads_insights_daily')
    .select('date')
    .order('date', { ascending: false })
    .limit(5);

  if (oldData) {
    const dates = oldData.map(d => d.date);
    console.log('   기존 뷰 최근 날짜:', dates.join(', '));
  }

  // 2. daily_aggregates 상태 확인
  console.log('\n2️⃣ daily_aggregates 상태 확인...');
  const { data: newData } = await supabase
    .from('daily_aggregates')
    .select('date')
    .order('date', { ascending: false })
    .limit(5);

  if (newData) {
    const dates = newData.map(d => d.date);
    console.log('   daily_aggregates 최근 날짜:', dates.join(', '));
  }

  // 3. SQL 실행 (Supabase RPC 사용)
  console.log('\n3️⃣ 뷰 재생성 SQL 실행...');

  const sql = `
    -- 기존 뷰 삭제
    DROP VIEW IF EXISTS ads_insights_daily;

    -- 새 뷰 생성 (daily_aggregates 기반)
    CREATE OR REPLACE VIEW ads_insights_daily AS
    SELECT
      date,
      'Meta' as platform,
      campaign_name,
      ad_name,
      ad_id,
      client_id,
      SUM(impressions) as impressions,
      SUM(reach) as reach,
      SUM(clicks) as clicks,
      SUM(leads) as leads,
      SUM(spend) as spend,
      SUM(video_views) as video_views,
      AVG(avg_watch_time) as avg_watch_time,
      CASE
        WHEN SUM(impressions) > 0 THEN ROUND((SUM(clicks)::DECIMAL / SUM(impressions) * 100), 2)
        ELSE 0
      END as ctr,
      CASE
        WHEN SUM(clicks) > 0 THEN ROUND((SUM(leads)::DECIMAL / SUM(clicks) * 100), 2)
        ELSE 0
      END as cvr,
      CASE
        WHEN SUM(leads) > 0 THEN ROUND((SUM(spend) / SUM(leads)), 2)
        ELSE 0
      END as cpl,
      CASE
        WHEN SUM(clicks) > 0 THEN ROUND((SUM(spend) / SUM(clicks)), 2)
        ELSE 0
      END as cpc,
      CASE
        WHEN SUM(impressions) > 0 THEN ROUND((SUM(spend) / SUM(impressions) * 1000), 2)
        ELSE 0
      END as cpm
    FROM daily_aggregates
    GROUP BY date, campaign_name, ad_name, ad_id, client_id
    ORDER BY date DESC, spend DESC;
  `;

  // Supabase에서는 직접 SQL 실행이 제한되어 있어 RPC 또는 대시보드 사용 필요
  console.log('   ⚠️ Supabase 대시보드에서 직접 SQL 실행 필요');
  console.log('   📋 SQL 파일 위치: sql/16_update_ads_insights_view.sql');
  console.log('\n   Supabase SQL Editor에서 다음 SQL 실행:');
  console.log('   ─────────────────────────────────────────');
  console.log(sql);
  console.log('   ─────────────────────────────────────────');

  // 4. 대안: API를 직접 daily_aggregates 사용하도록 수정
  console.log('\n4️⃣ 대안: API 직접 수정 권장');
  console.log('   뷰 대신 API에서 daily_aggregates를 직접 조회하도록 수정하면');
  console.log('   Supabase SQL 실행 없이도 적용 가능합니다.');

  console.log('\n✅ 마이그레이션 준비 완료');
}

applyMigration().catch(console.error);
