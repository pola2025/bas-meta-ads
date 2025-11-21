// 캠페인 필터 Supabase 연동 테스트
// Node.js 환경에서 실행

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Supabase 환경 변수가 설정되지 않았습니다.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testCampaignFilter() {
  console.log('🔍 캠페인 필터 테스트 시작...\n');

  // 테스트 1: 전체 캠페인 목록 (최대 20개)
  console.log('📋 테스트 1: 전체 캠페인 목록 (최대 20개)');
  try {
    const { data, error } = await supabase
      .from('raw_data')
      .select('campaign_name')
      .order('campaign_name', { ascending: true })
      .limit(20);

    if (error) throw error;

    const uniqueCampaigns = Array.from(
      new Set(
        data
          .map(item => item.campaign_name)
          .filter((name) => name !== null && name !== '')
      )
    ).slice(0, 20);

    console.log(`✅ 성공: ${uniqueCampaigns.length}개의 캠페인 발견`);
    console.log('캠페인 목록:', uniqueCampaigns.slice(0, 5).join(', '), '...\n');
  } catch (error) {
    console.error('❌ 실패:', error.message, '\n');
  }

  // 테스트 2: 검색어로 필터링 (ILIKE)
  console.log('📋 테스트 2: 검색어 "광고" 포함 캠페인 검색');
  try {
    const searchTerm = '광고';
    const { data, error } = await supabase
      .from('raw_data')
      .select('campaign_name')
      .ilike('campaign_name', `%${searchTerm}%`)
      .order('campaign_name', { ascending: true })
      .limit(20);

    if (error) throw error;

    const uniqueCampaigns = Array.from(
      new Set(
        data
          .map(item => item.campaign_name)
          .filter((name) => name !== null && name !== '')
      )
    ).slice(0, 20);

    console.log(`✅ 성공: ${uniqueCampaigns.length}개의 캠페인 발견`);
    console.log('캠페인 목록:', uniqueCampaigns.slice(0, 3).join(', '), '...\n');
  } catch (error) {
    console.error('❌ 실패:', error.message, '\n');
  }

  // 테스트 3: 빈 검색어
  console.log('📋 테스트 3: 빈 검색어');
  try {
    const searchTerm = '';
    let query = supabase
      .from('raw_data')
      .select('campaign_name')
      .order('campaign_name', { ascending: true });

    if (searchTerm) {
      query = query.ilike('campaign_name', `%${searchTerm}%`);
    }

    const { data, error } = await query.limit(20);

    if (error) throw error;

    const uniqueCampaigns = Array.from(
      new Set(
        data
          .map(item => item.campaign_name)
          .filter((name) => name !== null && name !== '')
      )
    ).slice(0, 20);

    console.log(`✅ 성공: ${uniqueCampaigns.length}개의 캠페인 발견`);
    console.log('캠페인 목록:', uniqueCampaigns.slice(0, 5).join(', '), '...\n');
  } catch (error) {
    console.error('❌ 실패:', error.message, '\n');
  }

  console.log('✅ 모든 테스트 완료!');
}

testCampaignFilter();
