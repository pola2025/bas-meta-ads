require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function checkCollectedData() {
  console.log('🔍 Checking collected data...\n');

  // 1. raw_data 확인
  const { data: rawData, error: rawError } = await supabase
    .from('raw_data')
    .select('*')
    .eq('client_id', '79e35fc6-a817-4ccc-9d5d-9a93c1ad4515')
    .order('date', { ascending: false })
    .limit(5);

  if (rawError) {
    console.error('❌ Failed to fetch raw_data:', rawError);
  } else {
    console.log(`✅ raw_data: ${rawData.length} records found`);
    if (rawData.length > 0) {
      console.log('\n📊 Sample data (first record):');
      console.log(`   Date: ${rawData[0].date}`);
      console.log(`   Ad: ${rawData[0].ad_name}`);
      console.log(`   Campaign: ${rawData[0].campaign_name}`);
      console.log(`   Impressions: ${rawData[0].impressions}`);
      console.log(`   Clicks: ${rawData[0].clicks}`);
      console.log(`   Spend: ${rawData[0].spend} ${rawData[0].currency}`);
    }
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // 2. weekly_summary 확인
  const { data: weeklyData, error: weeklyError } = await supabase
    .from('weekly_summary')
    .select('*')
    .eq('client_id', '79e35fc6-a817-4ccc-9d5d-9a93c1ad4515')
    .order('week_start', { ascending: false })
    .limit(5);

  if (weeklyError) {
    console.error('❌ Failed to fetch weekly_summary:', weeklyError);
  } else {
    console.log(`✅ weekly_summary: ${weeklyData.length} records found`);
    if (weeklyData.length > 0) {
      console.log('\n📊 Sample summary (first record):');
      console.log(`   Week: ${weeklyData[0].week_start} ~ ${weeklyData[0].week_end}`);
      console.log(`   Ad: ${weeklyData[0].ad_name}`);
      console.log(`   Impressions: ${weeklyData[0].total_impressions}`);
      console.log(`   Clicks: ${weeklyData[0].total_clicks}`);
      console.log(`   Spend: ${weeklyData[0].total_spend}`);
      console.log(`   Leads: ${weeklyData[0].total_leads}`);
    }
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('🎉 Data collection verification complete!');
}

checkCollectedData();
