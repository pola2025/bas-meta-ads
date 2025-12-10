const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'dashboard/.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  // ad_cache의 광고 ID
  const { data: cache } = await supabase
    .from('ad_cache')
    .select('ads_data')
    .eq('client_id', '79e35fc6-a817-4ccc-9d5d-9a93c1ad4515')
    .single();

  const cacheData = cache.ads_data || {};

  // raw_data에 있는 광고 ID 목록
  const rawAdIds = [
    '120221870255320456',
    '120221993037550456',
    '120222217421220456',
    '120224964233610456',
    '120227550071120456',
    '120228218467450456',
    '120230555690990456',
    '120233848921920456'
  ];

  console.log('raw_data 광고가 ad_cache에 있는지 확인:');
  rawAdIds.forEach(id => {
    const found = cacheData[id];
    if (found) {
      console.log('O', id, '-', found.ad_name, '- 상태:', found.status);
    } else {
      console.log('X', id, '- 캐시에 없음');
    }
  });
}

check().catch(console.error);
