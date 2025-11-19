/**
 * 텔레그램 리포트 테스트 스크립트
 *
 * 실행: node test-telegram-report.js
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function sendTelegramReport(clientId, clientName, weekStart, weekEnd) {
  try {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID;

    if (!botToken || !chatId) {
      console.log("⚠️ Telegram credentials not set");
      console.log("TELEGRAM_BOT_TOKEN:", botToken ? "✅ Set" : "❌ Not set");
      console.log("TELEGRAM_ADMIN_CHAT_ID:", chatId ? "✅ Set" : "❌ Not set");
      return;
    }

    console.log(`\n🔍 Querying weekly_summary for ${clientName}...`);
    console.log(`   Client ID: ${clientId}`);
    console.log(`   Period: ${weekStart} ~ ${weekEnd}`);

    // Supabase에서 주간 요약 데이터 조회
    const { data, error } = await supabase
      .from("weekly_summary")
      .select("*")
      .eq("client_id", clientId)
      .eq("week_start", weekStart)
      .eq("week_end", weekEnd);

    if (error) {
      console.error("❌ Supabase query error:", error);
      return;
    }

    if (!data || data.length === 0) {
      console.log("⚠️ No data found for the specified period");
      return;
    }

    console.log(`✅ Found ${data.length} records`);

    // 데이터 집계
    const total = data.reduce((acc, d) => ({
      impressions: acc.impressions + (d.total_impressions || 0),
      clicks: acc.clicks + (d.total_clicks || 0),
      spend: acc.spend + (d.total_spend || 0),
      leads: acc.leads + (d.total_leads || 0)
    }), { impressions: 0, clicks: 0, spend: 0, leads: 0 });

    const ctr = total.impressions > 0 ? (total.clicks / total.impressions * 100) : 0;
    const cpl = total.leads > 0 ? (total.spend / total.leads) : 0;

    console.log("\n📊 Aggregated data:");
    console.log(`   Impressions: ${total.impressions.toLocaleString()}`);
    console.log(`   Clicks: ${total.clicks}`);
    console.log(`   Spend: $${total.spend.toFixed(2)}`);
    console.log(`   Leads: ${total.leads}`);
    console.log(`   CTR: ${ctr.toFixed(2)}%`);
    console.log(`   CPL: $${cpl.toFixed(2)}`);

    // 메시지 구성
    const message = `
📊 **[BAS] ${clientName} 주간 리포트**
기간: ${weekStart} ~ ${weekEnd}

**📈 핵심 성과 요약**
• 노출수: ${total.impressions.toLocaleString()}회
• 클릭수: ${total.clicks}회
• 지출: $${total.spend.toFixed(2)}
• 리드: ${total.leads}건
• CPL: $${cpl.toFixed(2)}
• CTR: ${ctr.toFixed(2)}%

---
🤖 BAS Meta Ads Analytics
    `.trim();

    console.log("\n📝 Message to send:");
    console.log("━".repeat(50));
    console.log(message);
    console.log("━".repeat(50));

    // Telegram API 호출
    console.log("\n📱 Sending to Telegram...");
    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: "Markdown"
        })
      }
    );

    if (response.ok) {
      const result = await response.json();
      console.log("✅ Telegram report sent successfully!");
      console.log(`   Message ID: ${result.result.message_id}`);
    } else {
      const errorText = await response.text();
      console.error("❌ Failed to send telegram report:");
      console.error(errorText);
    }
  } catch (error) {
    console.error("❌ Error:", error.message);
    console.error(error.stack);
  }
}

// 메인 실행
async function main() {
  console.log("🚀 Testing Telegram Report...\n");

  // 테스트 파라미터
  const clientId = "79e35fc6-a817-4ccc-9d5d-9a93c1ad4515";
  const clientName = "비즈액터스쿨";
  const weekStart = "2025-11-10";
  const weekEnd = "2025-11-16";

  await sendTelegramReport(clientId, clientName, weekStart, weekEnd);

  console.log("\n🎉 Test completed!");
}

main().catch(console.error);
