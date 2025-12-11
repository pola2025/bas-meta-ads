/**
 * W47 리포트 텔레그램 테스트 발송
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function sendReport() {
  // W47 리포트 조회
  const { data: report } = await supabase
    .from('telegram_reports')
    .select('*')
    .eq('week_start', '2025-11-17')
    .eq('report_type', 'weekly')
    .single();

  if (!report) {
    console.log('리포트 없음');
    return;
  }

  console.log('📊 W47 리포트 발견');
  console.log('기간:', report.week_start, '~', report.week_end);
  console.log('리드:', report.total_leads, '| CPL: $' + report.avg_cpl.toFixed(2));
  console.log('\n메시지 길이:', report.message_text.length, '자');
  console.log('AI 인사이트:', report.ai_insights ? '있음' : '없음');

  // 텔레그램 발송
  const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const CHAT_ID = '-1003394139746';

  // 메시지 조합
  let message = report.message_text;
  if (report.ai_insights) {
    message += '\n\n🤖 AI 인사이트\n' + report.ai_insights;
  }

  console.log('\n📤 텔레그램 발송 중...');
  console.log('Chat ID:', CHAT_ID);

  const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: CHAT_ID,
      text: message,
      parse_mode: 'HTML'
    })
  });

  const result = await response.json();

  if (result.ok) {
    console.log('✅ 발송 성공!');
    console.log('Message ID:', result.result.message_id);
  } else {
    console.log('❌ 발송 실패:', result.description);

    // HTML 파싱 에러면 일반 텍스트로 재시도
    if (result.description.includes('parse')) {
      console.log('\n🔄 일반 텍스트로 재시도...');
      const retry = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: CHAT_ID,
          text: message
        })
      });
      const retryResult = await retry.json();
      if (retryResult.ok) {
        console.log('✅ 재시도 성공!');
      } else {
        console.log('❌ 재시도 실패:', retryResult.description);
      }
    }
  }
}

sendReport().catch(console.error);
