require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const TelegramBot = require('node-telegram-bot-api');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN);

// 메시지 분할 함수 (4000자 제한)
function splitMessage(text, maxLength = 4000) {
  const messages = [];
  const sections = text.split('---');

  let current = '';
  for (const section of sections) {
    if ((current + section).length > maxLength) {
      if (current) messages.push(current.trim());
      current = section;
    } else {
      current += (current ? '---' : '') + section;
    }
  }
  if (current) messages.push(current.trim());

  return messages;
}

async function resend() {
  const previewOnly = process.argv.includes('--preview');
  const targetChatId = process.argv.find(arg => arg.startsWith('-100')) || process.env.TELEGRAM_ADMIN_CHAT_ID;

  // 가장 최근 리포트 가져오기
  const { data: report, error } = await supabase
    .from('telegram_reports')
    .select('*')
    .order('sent_at', { ascending: false })
    .limit(1)
    .single();

  if (error || !report) {
    console.error('리포트 조회 실패:', error);
    return;
  }

  console.log('📋 리포트 정보:');
  console.log('  기간:', report.week_start, '~', report.week_end);
  console.log('  발송일:', report.sent_at);
  console.log('  리드:', report.total_leads, '건');
  console.log('  메시지 길이:', report.message_text.length, '자');
  console.log('  대상 Chat ID:', targetChatId);

  // 메시지 분할
  const messages = splitMessage(report.message_text);
  console.log('  분할된 메시지 수:', messages.length);

  if (previewOnly) {
    console.log('\n📄 === 메시지 미리보기 ===\n');
    console.log(report.message_text.substring(0, 2000));
    console.log('\n... (이하 생략, 총', report.message_text.length, '자)');
    console.log('\n⚠️ 미리보기 모드입니다. 실제 발송하려면 --preview 옵션을 제거하세요.');
    console.log(`   node resend-report.js ${targetChatId}`);
    return;
  }

  console.log('\n📤 채널로 발송 중... (Chat ID:', targetChatId, ')');

  for (let i = 0; i < messages.length; i++) {
    // 이스케이프 문자 제거 및 링크 활성화
    let msg = messages[i];
    // MarkdownV2 이스케이프 제거
    msg = msg.replace(/\\([_*\[\]()~`>#+\-=|{}.!])/g, '$1');
    // URL을 HTML 링크로 변환
    msg = msg.replace(/(https:\/\/[^\s]+)/g, '<a href="$1">$1</a>');
    // *bold* → <b>bold</b>
    msg = msg.replace(/\*([^*]+)\*/g, '<b>$1</b>');

    console.log(`  메시지 ${i + 1}/${messages.length} 발송 중... (${msg.length}자)`);
    await bot.sendMessage(targetChatId, msg, { parse_mode: 'HTML', disable_web_page_preview: true });
    if (i < messages.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  console.log('✅ 발송 완료!');
}

resend().catch(console.error);
