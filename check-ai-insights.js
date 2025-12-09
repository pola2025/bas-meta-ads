const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function checkAIInsights() {
  // telegram_reports 테이블에서 12월 1일~7일 기간의 리포트 확인
  console.log('=== telegram_reports에서 2025-12-01 ~ 2025-12-07 기간 확인 ===\n');

  const { data, error } = await supabase
    .from('telegram_reports')
    .select('id, client_id, report_type, week_start, week_end, ai_insights, sent_at')
    .eq('week_start', '2025-12-01')
    .eq('week_end', '2025-12-07')
    .order('sent_at', { ascending: false });

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('총 건수:', data.length);

  if (data.length > 0) {
    console.log('\n--- 상세 내역 ---');
    data.forEach(row => {
      console.log(`\n[${row.report_type}] client_id: ${row.client_id}`);
      console.log(`  기간: ${row.week_start} ~ ${row.week_end}`);
      console.log(`  발송: ${row.sent_at}`);
      console.log(`  AI 인사이트: ${row.ai_insights ? '있음 ✅' : '없음 ❌'}`);
      if (row.ai_insights) {
        console.log(`  인사이트 내용 (처음 200자):\n    ${row.ai_insights.substring(0, 200)}...`);
      }
    });
  } else {
    console.log('\n해당 기간(2025-12-01 ~ 2025-12-07)에 발송된 리포트가 없습니다.');
  }

  // 최근 주간 리포트 확인
  console.log('\n\n=== 최근 주간 리포트 10개 ===');
  const { data: recent, error: err2 } = await supabase
    .from('telegram_reports')
    .select('id, client_id, report_type, week_start, week_end, ai_insights, sent_at')
    .eq('report_type', 'weekly')
    .order('week_start', { ascending: false })
    .limit(10);

  if (recent) {
    recent.forEach(row => {
      console.log(`- ${row.week_start} ~ ${row.week_end} | client: ${row.client_id} | AI: ${row.ai_insights ? '✅' : '❌'}`);
    });
  }
}

checkAIInsights();
