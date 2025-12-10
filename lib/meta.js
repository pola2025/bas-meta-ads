const fetch = require('node-fetch');

// 날짜 계산 함수
function getDateString(daysAgo) {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString().split('T')[0];
}

// Actions 배열에서 특정 action_type의 값 추출
function getActionValue(actions, actionType) {
  if (!actions || !Array.isArray(actions)) return 0;
  const action = actions.find(a => a.action_type === actionType);
  return action ? parseInt(action.value) || 0 : 0;
}

// Video avg time watched actions에서 값 추출
function getVideoAvgTime(videoActions) {
  if (!videoActions || !Array.isArray(videoActions)) return 0;
  const action = videoActions.find(a => a.action_type === 'video_view');
  return action ? parseFloat(action.value) || 0 : 0;
}

// Cost per action type에서 값 추출
function getCostPerAction(costActions, actionType) {
  if (!costActions || !Array.isArray(costActions)) return 0;
  const action = costActions.find(a => a.action_type === actionType);
  return action ? parseFloat(action.value) || 0 : 0;
}

/**
 * Meta Ads API에서 Insights 데이터 가져오기
 */
async function getMetaAdsInsights() {
  console.log('📡 Meta Ads API 호출 중...');

  const accountId = process.env.META_AD_ACCOUNT_ID;
  const accessToken = process.env.META_ACCESS_TOKEN;
  const dataDays = parseInt(process.env.DATA_DAYS) || 7;

  // API URL
  const url = `https://graph.facebook.com/v22.0/${accountId}/insights`;

  // Query Parameters
  const params = new URLSearchParams({
    access_token: accessToken,
    time_range: JSON.stringify({
      since: getDateString(dataDays),
      until: getDateString(1)
    }),
    fields: 'ad_id,ad_name,campaign_id,campaign_name,impressions,spend,inline_link_clicks,outbound_clicks,reach,actions,video_avg_time_watched_actions,cost_per_action_type',
    breakdowns: 'publisher_platform,device_platform',
    level: 'ad',
    limit: '90',
    time_increment: '1'  // 일별 데이터
  });

  try {
    const response = await fetch(`${url}?${params}`);
    const data = await response.json();

    if (data.error) {
      throw new Error(`Meta API Error: ${data.error.message}`);
    }

    console.log(`✅ Meta API 호출 성공: ${data.data?.length || 0}개 데이터`);

    // 데이터 변환
    const insights = data.data.map(item => ({
      // 기본 정보
      날짜: item.date_start,
      수집일시: new Date().toISOString(),
      광고ID: item.ad_id,
      광고명: item.ad_name,
      캠페인ID: item.campaign_id,
      캠페인명: item.campaign_name,

      // Breakdown
      플랫폼: item.publisher_platform,
      디바이스: item.device_platform,

      // 성과 지표
      노출수: parseInt(item.impressions) || 0,
      도달수: parseInt(item.reach) || 0,
      클릭수: parseInt(item.inline_link_clicks) || 0,
      지출금액: parseFloat(item.spend) || 0,

      // Actions에서 추출
      영상조회: getActionValue(item.actions, 'video_view'),
      페이지참여: getActionValue(item.actions, 'page_engagement'),
      게시물참여: getActionValue(item.actions, 'post_engagement'),
      리드수: getActionValue(item.actions, 'lead'),
      링크클릭_액션: getActionValue(item.actions, 'link_click'),

      // 영상 평균 시청 시간
      평균시청시간: getVideoAvgTime(item.video_avg_time_watched_actions),

      // 결과당 비용
      영상조회당비용: getCostPerAction(item.cost_per_action_type, 'video_view'),
      리드당비용: getCostPerAction(item.cost_per_action_type, 'lead'),

      // 원본 데이터 (디버깅용)
      _raw: item
    }));

    return insights;

  } catch (error) {
    console.error('❌ Meta API 호출 실패:', error.message);
    throw error;
  }
}

/**
 * Meta 광고 계정의 광고 목록 조회 (상태 포함)
 * @param {string} accountId - Meta 광고 계정 ID (act_xxx 형식)
 * @param {string} accessToken - Meta Access Token
 * @returns {Promise<Array>} 광고 목록 (id, name, status, effective_status 등)
 */
async function getAdsWithStatus(accountId, accessToken) {
  const url = `https://graph.facebook.com/v22.0/${accountId}/ads`;

  const params = new URLSearchParams({
    access_token: accessToken,
    fields: 'id,name,status,effective_status,configured_status,campaign_id,adset_id,created_time,updated_time',
    limit: '500'
  });

  try {
    const response = await fetch(`${url}?${params}`);
    const data = await response.json();

    if (data.error) {
      throw new Error(`Meta API Error: ${data.error.message}`);
    }

    // 페이지네이션 처리 (모든 광고 가져오기)
    let allAds = data.data || [];
    let nextUrl = data.paging?.next;

    while (nextUrl) {
      const nextResponse = await fetch(nextUrl);
      const nextData = await nextResponse.json();

      if (nextData.error) {
        console.warn('Pagination error:', nextData.error.message);
        break;
      }

      allAds = allAds.concat(nextData.data || []);
      nextUrl = nextData.paging?.next;
    }

    return allAds.map(ad => ({
      id: ad.id,
      name: ad.name,
      status: ad.status, // ACTIVE, PAUSED, DELETED, ARCHIVED
      effective_status: ad.effective_status, // 실제 게재 상태
      configured_status: ad.configured_status,
      campaign_id: ad.campaign_id,
      adset_id: ad.adset_id,
      created_time: ad.created_time,
      updated_time: ad.updated_time
    }));

  } catch (error) {
    console.error('❌ 광고 목록 조회 실패:', error.message);
    throw error;
  }
}

/**
 * 광고 상태 변경 (ACTIVE/PAUSED)
 * @param {string} adId - 광고 ID
 * @param {string} accessToken - Meta Access Token
 * @param {string} status - 변경할 상태 ('ACTIVE' 또는 'PAUSED')
 * @returns {Promise<Object>} 업데이트 결과
 */
async function updateAdStatus(adId, accessToken, status) {
  if (!['ACTIVE', 'PAUSED'].includes(status)) {
    throw new Error('Invalid status. Must be ACTIVE or PAUSED');
  }

  const url = `https://graph.facebook.com/v22.0/${adId}`;

  const params = new URLSearchParams({
    access_token: accessToken,
    status: status
  });

  try {
    const response = await fetch(url, {
      method: 'POST',
      body: params
    });

    const data = await response.json();

    if (data.error) {
      throw new Error(`Meta API Error: ${data.error.message}`);
    }

    console.log(`✅ 광고 ${adId} 상태 변경 완료: ${status}`);
    return { success: true, ad_id: adId, new_status: status };

  } catch (error) {
    console.error(`❌ 광고 상태 변경 실패 (${adId}):`, error.message);
    throw error;
  }
}

/**
 * 여러 광고의 상태를 일괄 변경
 * @param {string[]} adIds - 광고 ID 배열
 * @param {string} accessToken - Meta Access Token
 * @param {string} status - 변경할 상태 ('ACTIVE' 또는 'PAUSED')
 * @returns {Promise<Object>} 일괄 업데이트 결과
 */
async function bulkUpdateAdStatus(adIds, accessToken, status) {
  const results = {
    success: [],
    failed: []
  };

  for (const adId of adIds) {
    try {
      await updateAdStatus(adId, accessToken, status);
      results.success.push(adId);
    } catch (error) {
      results.failed.push({ id: adId, error: error.message });
    }
  }

  return results;
}

/**
 * 단일 광고의 상세 정보 조회
 * @param {string} adId - 광고 ID
 * @param {string} accessToken - Meta Access Token
 * @returns {Promise<Object>} 광고 상세 정보
 */
async function getAdDetails(adId, accessToken) {
  const url = `https://graph.facebook.com/v22.0/${adId}`;

  const params = new URLSearchParams({
    access_token: accessToken,
    fields: 'id,name,status,effective_status,configured_status,campaign{id,name,status},adset{id,name,status},creative{id,name,thumbnail_url},created_time,updated_time'
  });

  try {
    const response = await fetch(`${url}?${params}`);
    const data = await response.json();

    if (data.error) {
      throw new Error(`Meta API Error: ${data.error.message}`);
    }

    return data;

  } catch (error) {
    console.error(`❌ 광고 상세 조회 실패 (${adId}):`, error.message);
    throw error;
  }
}

module.exports = {
  getMetaAdsInsights,
  getAdsWithStatus,
  updateAdStatus,
  bulkUpdateAdStatus,
  getAdDetails
};
