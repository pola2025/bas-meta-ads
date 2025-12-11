#!/usr/bin/env node
/**
 * 직접 데이터 수집 스크립트 (Redis 없이)
 * Meta API → Supabase 직접 저장
 *
 * 사용법:
 *   node collect-direct.js              # 기본 7일
 *   DATA_DAYS=14 node collect-direct.js # 14일
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// 날짜 계산
function getDateRange(days) {
  const end = new Date();
  end.setDate(end.getDate() - 1); // 어제까지

  const start = new Date(end);
  start.setDate(end.getDate() - (days - 1));

  return {
    since: start.toISOString().split('T')[0],
    until: end.toISOString().split('T')[0]
  };
}

// Actions에서 값 추출
function getActionValue(actions, actionType) {
  if (!actions || !Array.isArray(actions)) return 0;
  const action = actions.find(a => a.action_type === actionType);
  return action ? parseInt(action.value) || 0 : 0;
}

// Meta API 호출
async function fetchMetaInsights(days) {
  const accountId = process.env.META_AD_ACCOUNT_ID;
  const accessToken = process.env.META_ACCESS_TOKEN;
  const dateRange = getDateRange(days);

  console.log(`📡 Meta API 호출 중... (${dateRange.since} ~ ${dateRange.until})`);

  const url = `https://graph.facebook.com/v22.0/${accountId}/insights`;
  const params = new URLSearchParams({
    access_token: accessToken,
    time_range: JSON.stringify(dateRange),
    fields: 'ad_id,ad_name,campaign_id,campaign_name,impressions,spend,inline_link_clicks,reach,actions,cost_per_action_type',
    level: 'ad',
    limit: '500',
    time_increment: '1'
  });

  const response = await fetch(`${url}?${params}`);
  const data = await response.json();

  if (data.error) {
    throw new Error(`Meta API Error: ${data.error.message}`);
  }

  console.log(`✅ ${data.data?.length || 0}개 레코드 수신`);
  return data.data || [];
}

// Supabase에 저장
async function saveToSupabase(insights) {
  if (!insights || insights.length === 0) {
    console.log('⚠️ 저장할 데이터 없음');
    return;
  }

  // 날짜별로 집계
  const dailyAggregates = {};

  insights.forEach(item => {
    const date = item.date_start;
    const adId = item.ad_id;
    const key = `${date}_${adId}`;

    if (!dailyAggregates[key]) {
      dailyAggregates[key] = {
        client_id: '79e35fc6-a817-4ccc-9d5d-9a93c1ad4515', // 비즈액터스쿨
        date,
        ad_id: adId,
        ad_name: item.ad_name,
        campaign_id: item.campaign_id,
        campaign_name: item.campaign_name,
        impressions: 0,
        clicks: 0,
        spend: 0,
        leads: 0,
        reach: 0
      };
    }

    dailyAggregates[key].impressions += parseInt(item.impressions) || 0;
    dailyAggregates[key].clicks += parseInt(item.inline_link_clicks) || 0;
    dailyAggregates[key].spend += parseFloat(item.spend) || 0;
    dailyAggregates[key].leads += getActionValue(item.actions, 'lead');
    dailyAggregates[key].reach += parseInt(item.reach) || 0;
  });

  const records = Object.values(dailyAggregates);
  console.log(`📊 ${records.length}개 일별 레코드로 집계됨`);

  // 기존 데이터 삭제 후 새로 삽입
  const dates = [...new Set(records.map(r => r.date))].sort();
  const minDate = dates[0];
  const maxDate = dates[dates.length - 1];

  console.log(`🗑️  기존 데이터 삭제 중... (${minDate} ~ ${maxDate})`);

  const { error: deleteError } = await supabase
    .from('daily_aggregates')
    .delete()
    .gte('date', minDate)
    .lte('date', maxDate);

  if (deleteError) {
    console.error('❌ 삭제 실패:', deleteError.message);
    return;
  }

  // 새 데이터 삽입 (하나씩)
  console.log(`📥 새 데이터 삽입 중... (${records.length}개)`);

  let successCount = 0;
  let errorCount = 0;

  for (const record of records) {
    const { error: insertError } = await supabase
      .from('daily_aggregates')
      .insert(record);

    if (insertError) {
      console.error(`❌ 삽입 실패 (${record.date}, ${record.ad_name}):`, insertError.message);
      console.error('   데이터:', JSON.stringify(record, null, 2));
      errorCount++;
      if (errorCount >= 3) {
        console.error('❌ 3개 이상 실패, 중단');
        break;
      }
    } else {
      successCount++;
    }
  }

  console.log(`✅ 저장 완료: ${successCount}개 성공, ${errorCount}개 실패`);
}

// 결과 확인
async function verifyData(days) {
  const dateRange = getDateRange(days);

  const { data, error } = await supabase
    .from('daily_aggregates')
    .select('date, leads, spend')
    .gte('date', dateRange.since)
    .lte('date', dateRange.until)
    .order('date');

  if (error) {
    console.error('❌ 검증 실패:', error.message);
    return;
  }

  // 날짜별 집계
  const byDate = {};
  data.forEach(row => {
    if (!byDate[row.date]) byDate[row.date] = { leads: 0, spend: 0 };
    byDate[row.date].leads += row.leads || 0;
    byDate[row.date].spend += parseFloat(row.spend) || 0;
  });

  console.log('\n📅 저장된 데이터:');
  console.log('─'.repeat(40));

  let totalLeads = 0;
  let totalSpend = 0;

  Object.keys(byDate).sort().forEach(date => {
    const d = byDate[date];
    totalLeads += d.leads;
    totalSpend += d.spend;
    console.log(`${date}: 리드 ${d.leads}건, $${d.spend.toFixed(2)}`);
  });

  console.log('─'.repeat(40));
  console.log(`합계: 리드 ${totalLeads}건, $${totalSpend.toFixed(2)}`);
  console.log(`기간: ${Object.keys(byDate).length}일`);
}

// 메인
async function main() {
  const days = parseInt(process.env.DATA_DAYS) || 14;

  console.log('━'.repeat(50));
  console.log('🚀 직접 데이터 수집 시작');
  console.log('━'.repeat(50));
  console.log(`📅 수집 기간: ${days}일\n`);

  try {
    // 1. Meta API에서 데이터 수집
    const insights = await fetchMetaInsights(days);

    // 2. Supabase에 저장
    await saveToSupabase(insights);

    // 3. 검증
    await verifyData(days);

    console.log('\n✅ 데이터 수집 완료!');

  } catch (error) {
    console.error('\n❌ 오류 발생:', error.message);
    process.exit(1);
  }
}

main();
