require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const TelegramBot = require('node-telegram-bot-api');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN);

async function main() {
  // 10월 월간 리포트 조회
  const { data, error } = await supabase
    .from('telegram_reports')
    .select('*')
    .eq('week_start', '2025-10-01')
    .eq('week_end', '2025-10-31')
    .single();

  if (error || !data) {
    console.log('10월 월간 리포트 없음:', error?.message);
    return;
  }

  console.log('10월 리포트 찾음. ID:', data.id);

  // W1, W2 등을 1주차, 2주차로 교체
  let newText = data.message_text;

  // W1~W5 형식 → 1주차~5주차
  newText = newText.replace(/W(\d+)\\~W(\d+)/g, '$1주차~$2주차');
  newText = newText.replace(/W(\d+)/g, '$1주차');

  // 업데이트
  const { error: updateError } = await supabase
    .from('telegram_reports')
    .update({ message_text: newText })
    .eq('id', data.id);

  if (updateError) {
    console.log('업데이트 실패:', updateError.message);
    return;
  }

  console.log('10월 리포트 수정 완료\n');

  // 테스트 발송
  const chatId = process.argv[2] || '-1003394139746';
  console.log('테스트 발송 중... Chat ID:', chatId);

  // 메시지 분할 (4000자 제한)
  const messages = [];
  const sections = newText.split('---');
  let current = '';

  for (const section of sections) {
    if ((current + section).length > 4000) {
      if (current) messages.push(current.trim());
      current = section;
    } else {
      current += (current ? '---' : '') + section;
    }
  }
  if (current) messages.push(current.trim());

  console.log('분할된 메시지:', messages.length, '개\n');

  for (let i = 0; i < messages.length; i++) {
    let msg = messages[i];
    // MarkdownV2 이스케이프 제거
    msg = msg.replace(/\\([_*\[\]()~`>#+\-=|{}.!])/g, '$1');
    // URL을 HTML 링크로 변환
    msg = msg.replace(/(https:\/\/[^\s]+)/g, '<a href="$1">$1</a>');
    // *bold* → <b>bold</b>
    msg = msg.replace(/\*([^*]+)\*/g, '<b>$1</b>');

    console.log(`메시지 ${i + 1}/${messages.length} 발송 중... (${msg.length}자)`);
    await bot.sendMessage(chatId, msg, { parse_mode: 'HTML', disable_web_page_preview: true });

    if (i < messages.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  console.log('\n✅ 발송 완료!');
}

main().catch(console.error);
