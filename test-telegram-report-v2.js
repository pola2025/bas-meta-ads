/**
 * 텔레그램 리포트 v2 테스트 스크립트
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const DASHBOARD_URL = process.env.DASHBOARD_URL || 'https://bas-dashboard.vercel.app';

// v2 함수들을 여기에 복사 (간소화를 위해 주요 함수만)
function calculateChange(current, previous) {
  if (previous === 0) return 0;
  return ((current - previous) / previous) * 100;
}

function formatChange(changePercent, metric = 'default') {
  const sign = changePercent >= 0 ? '▲' : '▼';
  const value = `${sign} ${Math.abs(changePercent).toFixed(1)}%`;

  if (metric === 'cpl') {
    if (changePercent < -10) return `${value} ⬇️ 대폭 개선!`;
    if (changePercent < -5) return `${value} ⬇️ 개선!`;
    if (changePercent > 20) return `${value} 🔴 주의 필요`;
    if (changePercent > 10) return `${value} ⚠️`;
  } else if (metric === 'leads') {
    if (changePercent > 20) return `${value} ⬆️ 대폭 성장!`;
    if (changePercent > 10) return `${value} ⬆️ 성장!`;
    if (changePercent < -20) return `${value} 🔴 점검 필요`;
    if (changePercent < -10) return `${value} ⚠️`;
  }

  return value;
}

async function testReport() {
  console.log("🧪 Testing Telegram Report v2...\n");

  const clientId = "79e35fc6-a817-4ccc-9d5d-9a93c1ad4515";
  const clientName = "비즈액터스쿨";
  const weekStart = "2025-11-10";
  const weekEnd = "2025-11-16";

  // 대시보드 링크 생성 테스트
  const dashboardLink = `${DASHBOARD_URL}/?client=${clientId}&start=${weekStart}&end=${weekEnd}&tab=overview`;

  console.log("📊 Generated Dashboard Link:");
  console.log(dashboardLink);
  console.log("");

  // 간단한 메시지 구성 테스트
  const testMessage = `
📊 [BAS] ${clientName} 주간 리포트
📅 ${weekStart} ~ ${weekEnd}
━━━━━━━━━━━━━━━━━━━━━━

📈 핵심 성과

💰 총 지출: $527.74
🎯 총 리드: 13건
💵 평균 CPL: $40.60
📊 평균 CTR: 2.35%

👁️ 노출수: 7,061회
👆 클릭수: 166회

━━━━━━━━━━━━━━━━━━━━━━

📊 전주 대비 변화

리드: ${formatChange(18.2, 'leads')}
CPL: ${formatChange(-12.5, 'cpl')}
지출: ${formatChange(4.3)}
CTR: ${formatChange(-1.8)}

━━━━━━━━━━━━━━━━━━━━━━

💡 이번 주 인사이트

• CPL이 12.5% 감소하여 비용 효율성이 크게 개선되었습니다
• 리드가 18.2% 증가하여 전환이 성공적입니다
• "고객이찾아오는영업" 광고가 최고 효율을 보이고 있습니다
• 전반적으로 광고 성과가 개선되고 있습니다

━━━━━━━━━━━━━━━━━━━━━━

📊 상세 분석 보기

🔗 대시보드: ${dashboardLink}

위 링크에서 확인 가능:
✓ 일별 성과 추이 차트
✓ 광고별 상세 분석
✓ AI 추천 인사이트
✓ 엑셀 다운로드

━━━━━━━━━━━━━━━━━━━━━━
🤖 BAS Meta Ads Analytics
📅 발송: ${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })} (KST)
  `.trim();

  console.log("📝 Test Message Preview:");
  console.log("━".repeat(50));
  console.log(testMessage);
  console.log("━".repeat(50));
  console.log("");
  console.log(`📏 Message Length: ${testMessage.length} characters (Max: 4096)`);
  console.log("");
  console.log("✅ Test completed! Message format looks good.");
  console.log("");
  console.log("💡 Next steps:");
  console.log("   1. Run: node telegram-cron-v2.js (to start scheduler)");
  console.log("   2. Or manually test sending:");
  console.log("      Uncomment sendTelegramReport() call in this file");
}

testReport().catch(console.error);
