const fetch = require('node-fetch');

/**
 * Telegram으로 메시지 전송
 */
async function sendTelegramMessage(message) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!botToken || !chatId) {
    console.log('⚠️ Telegram 설정이 없어 알림을 건너뜁니다.');
    return null;
  }

  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML'
      })
    });

    const data = await response.json();

    if (data.ok) {
      console.log('✅ Telegram 알림 발송 성공');
      return data.result;
    } else {
      console.error('❌ Telegram 알림 실패:', data.description);
      return null;
    }

  } catch (error) {
    console.error('❌ Telegram 알림 에러:', error.message);
    return null;
  }
}

/**
 * 성공 알림 전송
 */
async function sendSuccessNotification(stats) {
  const message = `
🎉 <b>Meta 광고 데이터 수집 완료</b>

📊 <b>수집 통계:</b>
  • 총 데이터: ${stats.totalRecords}개
  • Airtable 저장: ${stats.savedRecords}개
  • 실패: ${stats.failedRecords}개

📅 <b>수집 기간:</b>
  • ${stats.dateRange}

🔗 <b>광고 계정:</b>
  • ${stats.accountId}

⏰ <b>수집 시각:</b>
  • ${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}
`;

  return await sendTelegramMessage(message);
}

/**
 * 에러 알림 전송
 */
async function sendErrorNotification(error) {
  const message = `
❌ <b>Meta 광고 데이터 수집 실패</b>

🚨 <b>에러 내용:</b>
<code>${error.message}</code>

⏰ <b>발생 시각:</b>
${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}

💡 <b>조치 필요:</b>
로그를 확인하고 문제를 해결해주세요.
`;

  return await sendTelegramMessage(message);
}

module.exports = {
  sendTelegramMessage,
  sendSuccessNotification,
  sendErrorNotification
};
