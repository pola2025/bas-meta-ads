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

module.exports = {
  getMetaAdsInsights
};
