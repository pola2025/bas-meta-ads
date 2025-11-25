#!/usr/bin/env node
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function test() {
  console.log('🔍 telegram_reports 테이블 확인 중...\n');

  // 1. 테이블 존재 확인
  const { data: tables, error: tableError } = await supabase
    .from('information_schema.tables')
    .select('table_name')
    .eq('table_schema', 'public')
    .eq('table_name', 'telegram_reports');

  if (tableError) {
    console.log('정보 스키마 조회 실패, 직접 쿼리 시도...');
  }

  // 2. 직접 SELECT 시도
  const { data, error } = await supabase
    .from('telegram_reports')
    .select('id')
    .limit(1);

  if (error) {
    console.error('❌ 테이블 접근 실패:', error.message);
    console.log('\n테이블이 생성되지 않았거나 RLS 정책 문제입니다.');
    console.log('Supabase Dashboard에서 SQL Editor로 다음을 실행하세요:\n');
    console.log('sql/12_telegram_reports_simple.sql 파일 내용');
    return;
  }

  console.log('✅ 테이블 접근 성공!');
  console.log('현재 레코드 수:', data.length);

  // 3. 테스트 INSERT
  console.log('\n📝 테스트 레코드 삽입 시도...');

  const testData = {
    client_id: '79e35fc6-a817-4ccc-9d5d-9a93c1ad4515',
    week_start: '2025-05-01',
    week_end: '2025-05-31',
    report_type: 'monthly',
    message_text: '테스트 리포트 메시지',
    total_spend: 1410.63,
    total_leads: 86,
    avg_cpl: 16.40,
    avg_ctr: 2.15,
    total_impressions: 50000,
    total_clicks: 1075,
    spend_change: -1.0,
    leads_change: 7.5,
    cpl_change: -7.92,
    ctr_change: 8.59,
    ai_insights: '테스트 AI 인사이트',
    sent_at: new Date().toISOString()
  };

  const { data: insertData, error: insertError } = await supabase
    .from('telegram_reports')
    .upsert(testData, {
      onConflict: 'client_id,week_start,week_end,report_type'
    })
    .select()
    .single();

  if (insertError) {
    console.error('❌ INSERT 실패:', insertError.message);
    return;
  }

  console.log('✅ INSERT 성공!');
  console.log('저장된 ID:', insertData.id);

  // 4. 전체 레코드 조회
  const { data: allData, error: allError } = await supabase
    .from('telegram_reports')
    .select('*')
    .order('week_start', { ascending: false });

  if (!allError) {
    console.log('\n📊 저장된 리포트 목록:');
    allData.forEach(r => {
      console.log(`- ${r.report_type}: ${r.week_start} ~ ${r.week_end} (리드 ${r.total_leads}건)`);
    });
  }
}

test().catch(console.error);
