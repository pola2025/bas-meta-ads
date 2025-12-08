/**
 * CPL 경고 시스템
 *
 * CPL이 임계값을 초과할 때 즉시 경고를 발송하고
 * 리포트에 강화된 경고 메시지를 추가합니다.
 */

const TelegramBot = require('node-telegram-bot-api');

// CPL 임계값 상수
const CPL_WARNING_THRESHOLD = 30;  // $30 이상: 경고
const CPL_DANGER_THRESHOLD = 40;   // $40 이상: 위험 (즉시 알림)

/**
 * CPL 상태 분석
 * @param {number} currentCPL - 현재 CPL
 * @param {number} previousCPL - 이전 CPL (주간 비교용)
 * @param {number} avgCPL - 평균 CPL
 * @returns {Object} - { level: 'normal'|'warning'|'danger', message, suggestions }
 */
function analyzeCPL(currentCPL, previousCPL = 0, avgCPL = 0) {
  const result = {
    level: 'normal',
    emoji: '',
    title: '',
    message: '',
    suggestions: [],
    excessCost: 0
  };

  // 위험 수준 ($40 이상)
  if (currentCPL >= CPL_DANGER_THRESHOLD) {
    result.level = 'danger';
    result.emoji = '🚨🔴';
    result.title = '긴급 경고: CPL 위험 수준 도달';

    // 예상 손실 계산 (정상 CPL $20 기준)
    const normalCPL = 20;
    const excessPerLead = currentCPL - normalCPL;
    result.excessCost = excessPerLead;

    result.message = `CPL이 $${currentCPL.toFixed(2)}로 위험 수준($${CPL_DANGER_THRESHOLD})을 초과했습니다!`;
    result.suggestions = [
      '즉시 광고 성과 검토 필요',
      '타겟팅 범위 재설정 권장',
      '소재 A/B 테스트 실행',
      '예산 재배분 검토'
    ];
  }
  // 경고 수준 ($30 이상)
  else if (currentCPL >= CPL_WARNING_THRESHOLD) {
    result.level = 'warning';
    result.emoji = '⚠️🟡';
    result.title = '경고: CPL 상승 감지';
    result.message = `CPL이 $${currentCPL.toFixed(2)}로 경고 수준($${CPL_WARNING_THRESHOLD})에 도달했습니다.`;
    result.suggestions = [
      '광고 성과 모니터링 강화',
      '저효율 소재 파악 및 교체 검토',
      '타겟 오디언스 정밀도 확인'
    ];
  }
  // 급상승 감지 (이전 대비 50% 이상)
  else if (previousCPL > 0 && currentCPL > previousCPL * 1.5) {
    result.level = 'warning';
    result.emoji = '⚠️📈';
    const increase = ((currentCPL - previousCPL) / previousCPL * 100).toFixed(0);
    result.title = `주의: CPL 급상승 (${increase}% 상승)`;
    result.message = `CPL이 $${previousCPL.toFixed(2)}에서 $${currentCPL.toFixed(2)}로 급상승했습니다.`;
    result.suggestions = [
      '급상승 원인 분석 필요',
      '최근 변경사항 검토',
      '경쟁사 동향 확인'
    ];
  }

  return result;
}

/**
 * CPL 위험 광고 목록 생성
 * @param {Array} ads - 광고 배열 [{ad_name, cpl, spend, leads}]
 * @returns {Array} - 위험/경고 수준 광고 목록
 */
function findDangerousAds(ads) {
  return ads
    .filter(ad => ad.cpl !== null && ad.cpl >= CPL_WARNING_THRESHOLD && ad.leads > 0)
    .sort((a, b) => b.cpl - a.cpl)
    .map(ad => ({
      ...ad,
      level: ad.cpl >= CPL_DANGER_THRESHOLD ? 'danger' : 'warning',
      emoji: ad.cpl >= CPL_DANGER_THRESHOLD ? '🔴' : '🟡'
    }));
}

/**
 * 강화된 텍스트 경고 메시지 생성 (MarkdownV2 형식)
 * @param {Object} alert - analyzeCPL 결과
 * @param {string} clientName - 클라이언트명
 * @returns {string} - 경고 메시지
 */
function generateAlertMessage(alert, clientName) {
  if (alert.level === 'normal') return '';

  // MarkdownV2 이스케이프
  const escapeMd = (text) => {
    if (!text) return '';
    return text.toString().replace(/[-_*[\]()~`>#+\=|{}.!]/g, '\\$&');
  };

  let msg = '';

  if (alert.level === 'danger') {
    msg += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `${alert.emoji} *${escapeMd(alert.title)}*\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    msg += `${escapeMd(alert.message)}\n\n`;

    if (alert.excessCost > 0) {
      msg += `💸 *예상 초과 비용*: 리드당 \\+$${escapeMd(alert.excessCost.toFixed(2))}\n`;
      msg += `   \\(정상 CPL $20 기준\\)\n\n`;
    }

    msg += `🎯 *즉시 조치 필요*:\n`;
    alert.suggestions.forEach((s, i) => {
      msg += `   ${i + 1}\\. ${escapeMd(s)}\n`;
    });
    msg += `\n`;
  } else if (alert.level === 'warning') {
    msg += `\n${alert.emoji} *${escapeMd(alert.title)}*\n`;
    msg += `${escapeMd(alert.message)}\n`;
    msg += `📋 *권장 조치*: `;
    msg += alert.suggestions.slice(0, 2).map(s => escapeMd(s)).join(', ');
    msg += `\n\n`;
  }

  return msg;
}

/**
 * 위험 광고 목록 메시지 생성
 * @param {Array} dangerAds - findDangerousAds 결과
 * @param {number} avgCPL - 평균 CPL
 * @returns {string} - 경고 메시지
 */
function generateDangerAdsMessage(dangerAds, avgCPL) {
  if (dangerAds.length === 0) return '';

  const escapeMd = (text) => {
    if (!text) return '';
    return text.toString().replace(/[-_*[\]()~`>#+\=|{}.!]/g, '\\$&');
  };

  let msg = `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `🚨 *CPL 위험 광고 목록*\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

  dangerAds.forEach((ad, idx) => {
    const excess = ((ad.cpl - avgCPL) / avgCPL * 100).toFixed(0);
    msg += `${ad.emoji} *${escapeMd(ad.ad_name)}*\n`;
    msg += `   CPL: $${escapeMd(ad.cpl.toFixed(2))} \\(평균 대비 \\+${escapeMd(excess)}%\\)\n`;
    msg += `   리드: ${ad.leads}건 \\| 지출: $${escapeMd(ad.spend.toFixed(2))}\n`;

    if (ad.level === 'danger') {
      msg += `   ⚡ *즉시 검토 필요*\n`;
    }
    msg += `\n`;
  });

  return msg;
}

/**
 * 즉시 알림 발송 (CPL 위험 수준 도달 시)
 * @param {Object} options - { botToken, chatId, clientName, cpl, ads }
 */
async function sendImmediateAlert(options) {
  const { botToken, chatId, clientName, cpl, ads = [] } = options;

  if (!botToken || !chatId) {
    console.warn('⚠️ 즉시 알림 발송 불가: botToken 또는 chatId 없음');
    return false;
  }

  const alert = analyzeCPL(cpl);

  // 위험 수준이 아니면 발송하지 않음
  if (alert.level !== 'danger') {
    return false;
  }

  const bot = new TelegramBot(botToken);

  const escapeMd = (text) => {
    if (!text) return '';
    return text.toString().replace(/[-_*[\]()~`>#+\=|{}.!]/g, '\\$&');
  };

  let message = `🚨🔴 *CPL 위험 알림* 🔴🚨\n\n`;
  message += `📊 *${escapeMd(clientName)}*\n\n`;
  message += `현재 CPL: *$${escapeMd(cpl.toFixed(2))}*\n`;
  message += `위험 기준: $${CPL_DANGER_THRESHOLD}\n\n`;
  message += `⚠️ CPL이 위험 수준을 초과했습니다\\!\n`;
  message += `즉시 광고 성과를 검토해주세요\\.\n\n`;

  // 위험 광고 목록 추가
  const dangerAds = findDangerousAds(ads).filter(a => a.level === 'danger').slice(0, 3);
  if (dangerAds.length > 0) {
    message += `🔴 *위험 광고*:\n`;
    dangerAds.forEach(ad => {
      message += `• ${escapeMd(ad.ad_name.substring(0, 30))}: $${escapeMd(ad.cpl.toFixed(2))}\n`;
    });
    message += `\n`;
  }

  message += `🕐 발송 시각: ${escapeMd(new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }))}\n`;

  try {
    await bot.sendMessage(chatId, message, {
      parse_mode: 'MarkdownV2',
      disable_web_page_preview: true
    });
    console.log(`🚨 ${clientName}: CPL 위험 알림 발송 완료`);
    return true;
  } catch (error) {
    console.error(`❌ ${clientName}: 즉시 알림 발송 실패:`, error.message);
    return false;
  }
}

/**
 * 일일 CPL 체크 및 알림
 * @param {Object} supabase - Supabase 클라이언트
 * @param {Object} bot - Telegram Bot
 */
async function checkDailyCPL(supabase, botToken) {
  console.log('🔍 일일 CPL 체크 시작...');

  // 오늘 날짜
  const today = new Date().toISOString().split('T')[0];

  // 활성 클라이언트 조회
  const { data: clients, error: clientError } = await supabase
    .from('clients')
    .select('id, client_name, telegram_chat_id, telegram_enabled')
    .eq('is_active', true);

  if (clientError || !clients) {
    console.error('❌ 클라이언트 조회 실패:', clientError?.message);
    return;
  }

  for (const client of clients) {
    if (!client.telegram_chat_id || client.telegram_enabled === false) continue;

    // 오늘 데이터 조회
    const { data: todayData } = await supabase
      .from('ads_insights_daily')
      .select('spend, leads')
      .eq('client_id', client.id)
      .eq('date', today);

    if (!todayData || todayData.length === 0) continue;

    const totals = todayData.reduce((acc, row) => {
      acc.spend += parseFloat(row.spend) || 0;
      acc.leads += row.leads || 0;
      return acc;
    }, { spend: 0, leads: 0 });

    if (totals.leads === 0) continue;

    const cpl = totals.spend / totals.leads;

    // CPL 위험 수준 체크
    if (cpl >= CPL_DANGER_THRESHOLD) {
      await sendImmediateAlert({
        botToken,
        chatId: client.telegram_chat_id,
        clientName: client.client_name,
        cpl,
        ads: []
      });
    }
  }

  console.log('✅ 일일 CPL 체크 완료');
}

module.exports = {
  CPL_WARNING_THRESHOLD,
  CPL_DANGER_THRESHOLD,
  analyzeCPL,
  findDangerousAds,
  generateAlertMessage,
  generateDangerAdsMessage,
  sendImmediateAlert,
  checkDailyCPL
};
