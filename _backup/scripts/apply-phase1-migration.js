#!/usr/bin/env node

/**
 * Phase 1 마이그레이션 스크립트
 *
 * 1. 새 테이블 3개 생성 (ad_cumulative_stats, ad_daily_snapshot, client_targets)
 * 2. 집계 함수 4개 생성
 * 3. 기존 11월 데이터로 누적 통계 및 스냅샷 생성
 *
 * 실행: node apply-phase1-migration.js
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function main() {
  console.log('🚀 Phase 1 Migration Starting...\n');

  // =============================================
  // Step 1: SQL 스크립트 실행 (테이블 + 함수 생성)
  // =============================================
  console.log('📦 Step 1: Creating tables and functions...');

  const sqlPath = path.join(__dirname, 'sql', '15_ad_cumulative_stats.sql');
  const sqlContent = fs.readFileSync(sqlPath, 'utf-8');

  // SQL을 개별 문장으로 분리 (세미콜론 기준, 함수 내부 제외)
  // Supabase는 단일 쿼리 실행이 필요하므로 전체를 한 번에 실행
  try {
    // Supabase SQL Editor에서 직접 실행해야 하므로 가이드 출력
    console.log('\n⚠️  테이블과 함수는 Supabase SQL Editor에서 직접 실행해야 합니다.');
    console.log('📋 SQL 파일 경로: sql/15_ad_cumulative_stats.sql\n');
    console.log('   1. https://supabase.com/dashboard 접속');
    console.log('   2. SQL Editor 메뉴 선택');
    console.log('   3. sql/15_ad_cumulative_stats.sql 내용 붙여넣기');
    console.log('   4. "Run" 버튼 클릭\n');

    // 테이블 존재 확인
    const { data: tables, error: checkError } = await supabase
      .from('ad_cumulative_stats')
      .select('id')
      .limit(1);

    if (checkError && checkError.code === '42P01') {
      console.log('❌ ad_cumulative_stats 테이블이 없습니다.');
      console.log('   → SQL Editor에서 먼저 스크립트를 실행해주세요.\n');
      console.log('테이블 생성 후 이 스크립트를 다시 실행하면 데이터 마이그레이션이 진행됩니다.');
      process.exit(0);
    }

    console.log('✅ 테이블 확인됨. 데이터 마이그레이션 진행...\n');

  } catch (err) {
    console.error('Error checking tables:', err.message);
  }

  // =============================================
  // Step 2: 활성 클라이언트 조회
  // =============================================
  console.log('📋 Step 2: Fetching active clients...');

  const { data: clients, error: clientError } = await supabase
    .from('clients')
    .select('id, client_name')
    .eq('is_active', true);

  if (clientError) {
    console.error('❌ Failed to fetch clients:', clientError);
    process.exit(1);
  }

  console.log(`   Found ${clients.length} active clients\n`);

  // =============================================
  // Step 3: 각 클라이언트 데이터 마이그레이션
  // =============================================
  console.log('📊 Step 3: Migrating data for each client...\n');

  for (const client of clients) {
    console.log(`\n🔄 Processing: ${client.client_name}`);

    try {
      // 3-1. 누적 통계 업데이트
      console.log('   → Updating cumulative stats...');
      const { data: cumResult, error: cumError } = await supabase.rpc(
        'update_ad_cumulative_stats',
        { p_client_id: client.id }
      );

      if (cumError) {
        console.error(`   ❌ Cumulative stats error: ${cumError.message}`);
        continue;
      }

      if (cumResult && cumResult.length > 0) {
        console.log(`   ✅ ${cumResult[0].message}`);
      }

      // 3-2. 11월 각 날짜별 스냅샷 생성
      console.log('   → Creating daily snapshots...');

      // 11월 1일부터 오늘까지의 날짜 목록 생성
      const startDate = new Date('2025-11-01');
      const endDate = new Date();
      const dates = [];

      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        dates.push(d.toISOString().split('T')[0]);
      }

      let snapshotCount = 0;
      for (const date of dates) {
        const { data: snapResult, error: snapError } = await supabase.rpc(
          'save_daily_snapshot',
          { p_client_id: client.id, p_date: date }
        );

        if (!snapError && snapResult && snapResult[0]?.rows_affected > 0) {
          snapshotCount++;
        }
      }

      console.log(`   ✅ Created ${snapshotCount} daily snapshots`);

      // 3-3. 11월 목표값 설정 (없으면)
      console.log('   → Setting monthly targets...');
      const { data: targetResult } = await supabase.rpc(
        'set_default_targets',
        { p_client_id: client.id, p_month: '2025-11-01' }
      );

      if (targetResult && targetResult.length > 0) {
        console.log(`   ✅ ${targetResult[0].message}`);
      }

    } catch (err) {
      console.error(`   ❌ Error processing ${client.client_name}: ${err.message}`);
    }
  }

  // =============================================
  // Step 4: 결과 확인
  // =============================================
  console.log('\n\n📊 Step 4: Verifying migration results...\n');

  // 누적 통계 개수
  const { count: cumCount } = await supabase
    .from('ad_cumulative_stats')
    .select('*', { count: 'exact', head: true });

  console.log(`   ad_cumulative_stats: ${cumCount} records`);

  // 일별 스냅샷 개수
  const { count: snapCount } = await supabase
    .from('ad_daily_snapshot')
    .select('*', { count: 'exact', head: true });

  console.log(`   ad_daily_snapshot: ${snapCount} records`);

  // 목표값 개수
  const { count: targetCount } = await supabase
    .from('client_targets')
    .select('*', { count: 'exact', head: true });

  console.log(`   client_targets: ${targetCount} records`);

  // TOP 5 광고 출력
  console.log('\n📈 TOP 5 Ads by CPL:\n');

  const { data: topAds } = await supabase
    .from('ad_cumulative_stats')
    .select('ad_name, total_leads, total_spend, lifetime_cpl, cpl_rank')
    .gt('total_leads', 0)
    .order('lifetime_cpl', { ascending: true })
    .limit(5);

  if (topAds) {
    topAds.forEach((ad, i) => {
      console.log(`   ${i + 1}. ${ad.ad_name?.substring(0, 40) || 'Unknown'}...`);
      console.log(`      Leads: ${ad.total_leads} | Spend: $${ad.total_spend} | CPL: $${ad.lifetime_cpl}`);
    });
  }

  console.log('\n\n✅ Phase 1 Migration Completed!\n');
  console.log('다음 단계:');
  console.log('1. 대시보드에서 데이터 확인');
  console.log('2. Phase 2 (시각화 개선) 진행\n');
}

main().catch(console.error);
