/**
 * Telegram Notifier - 관리자 메시지 자동 발송
 *
 * 사용법:
 *   const { sendAdminAlert, sendAdminError } = require('./lib/telegram-notifier');
 *   await sendAdminAlert('데이터 수집 완료', '14일치 데이터 수집됨');
 *   await sendAdminError('데이터 수집 실패', error);
 */

require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN);
const ADMIN_CHAT_ID = process.env.TELEGRAM_ERROR_CHAT_ID || process.env.TELEGRAM_ADMIN_CHAT_ID;

/**
 * 관리자에게 일반 알림 전송
 */
async function sendAdminAlert(title, message, options = {}) {
  if (!ADMIN_CHAT_ID) {
    console.warn('⚠️ TELEGRAM_ERROR_CHAT_ID가 설정되지 않아 관리자 알림을 보낼 수 없습니다.');
    return false;
  }

  try {
    const timestamp = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
    let text = `📢 ${title}\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    text += `⏰ ${timestamp}\n\n`;
    text += message;

    await bot.sendMessage(ADMIN_CHAT_ID, text);
    console.log(`✅ 관리자 알림 전송 완료: ${title}`);
    return true;
  } catch (error) {
    console.error(`❌ 관리자 알림 전송 실패: ${error.message}`);
    return false;
  }
}

/**
 * 관리자에게 오류 알림 전송
 */
async function sendAdminError(title, error, context = {}) {
  if (!ADMIN_CHAT_ID) {
    console.warn('⚠️ TELEGRAM_ERROR_CHAT_ID가 설정되지 않아 오류 알림을 보낼 수 없습니다.');
    return false;
  }

  try {
    const timestamp = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
    let text = `🚨 오류 발생: ${title}\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    text += `⏰ ${timestamp}\n\n`;

    if (error) {
      text += `❌ 오류 메시지:\n${error.message || error}\n\n`;
      if (error.stack) {
        text += `📋 Stack Trace:\n${error.stack.split('\n').slice(0, 5).join('\n')}\n\n`;
      }
    }

    if (Object.keys(context).length > 0) {
      text += `📊 컨텍스트:\n`;
      Object.entries(context).forEach(([key, value]) => {
        text += `  • ${key}: ${JSON.stringify(value)}\n`;
      });
    }

    await bot.sendMessage(ADMIN_CHAT_ID, text);
    console.log(`✅ 오류 알림 전송 완료: ${title}`);
    return true;
  } catch (err) {
    console.error(`❌ 오류 알림 전송 실패: ${err.message}`);
    return false;
  }
}

/**
 * 관리자에게 경고 알림 전송
 */
async function sendAdminWarning(title, message, details = {}) {
  if (!ADMIN_CHAT_ID) {
    console.warn('⚠️ TELEGRAM_ERROR_CHAT_ID가 설정되지 않아 경고 알림을 보낼 수 없습니다.');
    return false;
  }

  try {
    const timestamp = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
    let text = `⚠️ 경고: ${title}\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    text += `⏰ ${timestamp}\n\n`;
    text += message;

    if (Object.keys(details).length > 0) {
      text += `\n\n📋 상세 정보:\n`;
      Object.entries(details).forEach(([key, value]) => {
        text += `  • ${key}: ${value}\n`;
      });
    }

    await bot.sendMessage(ADMIN_CHAT_ID, text);
    console.log(`✅ 경고 알림 전송 완료: ${title}`);
    return true;
  } catch (error) {
    console.error(`❌ 경고 알림 전송 실패: ${error.message}`);
    return false;
  }
}

/**
 * 데이터 수집 실패 알림
 */
async function notifyDataCollectionFailure(clientName, period, error) {
  return sendAdminError('데이터 수집 실패', error, {
    클라이언트: clientName,
    기간: period
  });
}

/**
 * 데이터 0건 감지 알림
 */
async function notifyZeroData(period, stats) {
  const message = `데이터 0건이 감지되었습니다.\n\n` +
    `📅 분석 기간: ${period.start} ~ ${period.end}\n` +
    `📊 리드: ${stats.leads}건\n` +
    `💵 지출: $${stats.spend.toFixed(2)}\n\n` +
    `가능한 원인:\n` +
    `  1. Meta API 데이터 수집 실패\n` +
    `  2. daily_aggregates 저장 실패\n` +
    `  3. 데이터 수집 스케줄러 중단\n\n` +
    `확인이 필요합니다.`;

  return sendAdminWarning('데이터 0건 감지', message);
}

/**
 * 시스템 시작 알림
 */
async function notifySystemStart(mode, details = {}) {
  const message = `시스템이 시작되었습니다.\n\n` +
    `모드: ${mode}\n` +
    Object.entries(details).map(([k, v]) => `${k}: ${v}`).join('\n');

  return sendAdminAlert('시스템 시작', message);
}

module.exports = {
  sendAdminAlert,
  sendAdminError,
  sendAdminWarning,
  notifyDataCollectionFailure,
  notifyZeroData,
  notifySystemStart
};
