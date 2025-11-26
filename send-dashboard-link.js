/**
 * 대시보드 링크 발송 테스트
 */
require('dotenv').config();

const CHAT_ID = '-1003394139746';
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

const clientId = 'bas-k92m7x';
const dashboardUrl = 'https://dashboard-mkt9834-4301s-projects.vercel.app';

const message = `━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 상세 리포트 보기
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

더 자세한 분석은 대시보드에서 확인하세요.

🔗 대시보드 바로가기:
${dashboardUrl}?client=${clientId}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📞 문의하기
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

리포트 관련 문의가 필요하시면 언제든 연락주세요.

📧 이메일: mkt@polarad.co.kr

🕐 운영시간
평일 09:00 ~ 18:00
주말 휴무 (공휴일 포함)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🤖 Powered by Polarad AI
자동 생성 리포트 | 매주 월요일 오전 9시 발송`;

async function send() {
  const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: CHAT_ID,
      text: message
    })
  });

  const result = await response.json();

  if (result.ok) {
    console.log('✅ 발송 완료! Message ID:', result.result.message_id);
    console.log('\n📱 링크:', `${dashboardUrl}?client=${clientId}`);
  } else {
    console.log('❌ 실패:', result.description);
  }
}

send();
