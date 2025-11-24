/**
 * 텔레그램 자동 리포트 발송 스케줄러
 *
 * 실행: node telegram-cron.js
 *
 * 스케줄:
 * - 매주 월요일 오전 9시 (주간 리포트)
 * - 테스트: 매분마다 실행 (주석 처리됨)
 */

require('dotenv').config();
const cron = require('node-cron');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// 헬퍼 함수: 증감률 계산
function calculateChange(current, previous) {
  if (previous === 0) return 0;
  return ((current - previous) / previous) * 100;
}

// 헬퍼 함수: 증감률 포맷팅
function formatChange(changePercent) {
  const sign = changePercent >= 0 ? '▲' : '▼';
  return `${sign} ${Math.abs(changePercent).toFixed(1)}%`;
}

// 헬퍼 함수: 인사이트 생성
function generateInsights(changes) {
  const insights = [];

  if (changes.cpl < -5) {
    insights.push(`• CPL이 ${Math.abs(changes.cpl).toFixed(1)}% 감소하여 비용 효율성이 크게 개선되었습니다`);
  } else if (changes.cpl > 10) {
    insights.push(`• CPL이 ${changes.cpl.toFixed(1)}% 증가하여 비용 효율성 개선이 필요합니다`);
  }

  if (changes.leads > 20) {
    insights.push(`• 리드가 ${changes.leads.toFixed(1)}% 증가하여 전환이 크게 개선되었습니다`);
  } else if (changes.leads < -20) {
    insights.push(`• 리드가 ${Math.abs(changes.leads).toFixed(1)}% 감소하여 광고 최적화가 필요합니다`);
  }

  if (changes.ctr < -10) {
    insights.push(`• CTR이 ${Math.abs(changes.ctr).toFixed(1)}% 감소하여 광고 소재 개선이 필요합니다`);
  } else if (changes.ctr > 10) {
    insights.push(`• CTR이 ${changes.ctr.toFixed(1)}% 증가하여 광고 소재가 효과적입니다`);
  }

  if (insights.length === 0) {
    insights.push("• 전주와 유사한 성과를 유지하고 있습니다");
  }

  return insights.join('\n');
}

// 헬퍼 함수: 광고별 성과 순위 분석
async function getAdPerformanceRanking(clientId, weekStart, weekEnd) {
  try {
    console.log("\n📊 Analyzing ad performance ranking...");

    // 주간 요약에서 광고별 데이터 조회
    const { data, error } = await supabase
      .from("weekly_summary")
      .select("ad_name, avg_cpl, avg_ctr, total_leads, total_spend")
      .eq("client_id", clientId)
      .eq("week_start", weekStart)
      .eq("week_end", weekEnd);

    if (error || !data || data.length === 0) {
      console.log("⚠️ No ad data found");
      return "";
    }

    console.log(`✅ Found ${data.length} ads`);

    // 리드가 있는 광고만 필터링 (CPL 계산 가능한 광고)
    const adsWithLeads = data.filter(ad => ad.total_leads > 0 && ad.avg_cpl > 0);

    console.log(`   ${adsWithLeads.length} ads with leads (CPL calculable)`);

    if (adsWithLeads.length === 0) {
      return "";
    }

    // CPL 기준 정렬 (낮은 순 = 좋은 성과)
    const sortedByCpl = [...adsWithLeads].sort((a, b) => a.avg_cpl - b.avg_cpl);

    // Top 5 Best Performing (CPL 낮은 순)
    const top5Best = sortedByCpl.slice(0, Math.min(5, sortedByCpl.length));

    // Top 3 Needs Improvement (CPL 높은 순)
    const top3Worst = sortedByCpl.slice(-Math.min(3, sortedByCpl.length)).reverse();

    let rankingText = "\n**🏆 Best Performing 광고 (CPL 기준)**\n";
    top5Best.forEach((ad, index) => {
      const adNameShort = ad.ad_name.length > 20 ? ad.ad_name.substring(0, 20) + "..." : ad.ad_name;
      rankingText += `${index + 1}. ${adNameShort}\n`;
      rankingText += `   CPL: $${ad.avg_cpl.toFixed(2)} | CTR: ${ad.avg_ctr.toFixed(2)}% | 리드: ${ad.total_leads}건\n`;
    });

    // Worst는 전체 광고가 5개 이상일 때만 표시
    if (sortedByCpl.length >= 5) {
      rankingText += "\n**⚠️ Needs Improvement 광고 (CPL 높음)**\n";
      top3Worst.forEach((ad, index) => {
        const adNameShort = ad.ad_name.length > 20 ? ad.ad_name.substring(0, 20) + "..." : ad.ad_name;
        rankingText += `${index + 1}. ${adNameShort}\n`;
        rankingText += `   CPL: $${ad.avg_cpl.toFixed(2)} | CTR: ${ad.avg_ctr.toFixed(2)}% | 리드: ${ad.total_leads}건\n`;
      });
    }

    console.log("✅ Ad performance ranking created");

    return rankingText;
  } catch (error) {
    console.error("❌ Error in getAdPerformanceRanking:", error.message);
    return "";
  }
}

// 텔레그램 리포트 발송
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

    console.log(`\n🔍 Querying current week data for ${clientName}...`);
    console.log(`   Client ID: ${clientId}`);
    console.log(`   Period: ${weekStart} ~ ${weekEnd}`);

    // 현재 주 데이터 조회
    const { data: currentData, error: currentError } = await supabase
      .from("weekly_summary")
      .select("*")
      .eq("client_id", clientId)
      .eq("week_start", weekStart)
      .eq("week_end", weekEnd);

    if (currentError) {
      console.error("❌ Supabase query error:", currentError);
      return;
    }

    if (!currentData || currentData.length === 0) {
      console.log("⚠️ No data found for the specified period");
      return;
    }

    console.log(`✅ Found ${currentData.length} records for current week`);

    // 현재 주 데이터 집계
    const current = currentData.reduce((acc, d) => ({
      impressions: acc.impressions + (d.total_impressions || 0),
      clicks: acc.clicks + (d.total_clicks || 0),
      spend: acc.spend + (d.total_spend || 0),
      leads: acc.leads + (d.total_leads || 0)
    }), { impressions: 0, clicks: 0, spend: 0, leads: 0 });

    const currentCtr = current.impressions > 0 ? (current.clicks / current.impressions * 100) : 0;
    const currentCpl = current.leads > 0 ? (current.spend / current.leads) : 0;

    console.log("\n📊 Current week data:");
    console.log(`   Impressions: ${current.impressions.toLocaleString()}`);
    console.log(`   Clicks: ${current.clicks}`);
    console.log(`   Spend: $${current.spend.toFixed(2)}`);
    console.log(`   Leads: ${current.leads}`);
    console.log(`   CTR: ${currentCtr.toFixed(2)}%`);
    console.log(`   CPL: $${currentCpl.toFixed(2)}`);

    // 이전 주 데이터 조회 (7일 전)
    const prevWeekStart = new Date(weekStart);
    prevWeekStart.setDate(prevWeekStart.getDate() - 7);
    const prevWeekEnd = new Date(weekEnd);
    prevWeekEnd.setDate(prevWeekEnd.getDate() - 7);

    console.log(`\n🔍 Querying previous week data...`);
    console.log(`   Period: ${prevWeekStart.toISOString().split('T')[0]} ~ ${prevWeekEnd.toISOString().split('T')[0]}`);

    const { data: prevData } = await supabase
      .from("weekly_summary")
      .select("*")
      .eq("client_id", clientId)
      .eq("week_start", prevWeekStart.toISOString().split('T')[0])
      .eq("week_end", prevWeekEnd.toISOString().split('T')[0]);

    let comparisonText = "";

    if (prevData && prevData.length > 0) {
      console.log(`✅ Found ${prevData.length} records for previous week`);

      // 이전 주 데이터 집계
      const prev = prevData.reduce((acc, d) => ({
        impressions: acc.impressions + (d.total_impressions || 0),
        clicks: acc.clicks + (d.total_clicks || 0),
        spend: acc.spend + (d.total_spend || 0),
        leads: acc.leads + (d.total_leads || 0)
      }), { impressions: 0, clicks: 0, spend: 0, leads: 0 });

      const prevCtr = prev.impressions > 0 ? (prev.clicks / prev.impressions * 100) : 0;
      const prevCpl = prev.leads > 0 ? (prev.spend / prev.leads) : 0;

      console.log("\n📊 Previous week data:");
      console.log(`   Impressions: ${prev.impressions.toLocaleString()}`);
      console.log(`   Clicks: ${prev.clicks}`);
      console.log(`   Spend: $${prev.spend.toFixed(2)}`);
      console.log(`   Leads: ${prev.leads}`);
      console.log(`   CTR: ${prevCtr.toFixed(2)}%`);
      console.log(`   CPL: $${prevCpl.toFixed(2)}`);

      // 증감률 계산
      const changes = {
        impressions: calculateChange(current.impressions, prev.impressions),
        clicks: calculateChange(current.clicks, prev.clicks),
        spend: calculateChange(current.spend, prev.spend),
        leads: calculateChange(current.leads, prev.leads),
        cpl: calculateChange(currentCpl, prevCpl),
        ctr: calculateChange(currentCtr, prevCtr)
      };

      console.log("\n📈 Changes from previous week:");
      console.log(`   Impressions: ${formatChange(changes.impressions)}`);
      console.log(`   Clicks: ${formatChange(changes.clicks)}`);
      console.log(`   Spend: ${formatChange(changes.spend)}`);
      console.log(`   Leads: ${formatChange(changes.leads)}`);
      console.log(`   CPL: ${formatChange(changes.cpl)}`);
      console.log(`   CTR: ${formatChange(changes.ctr)}`);

      // 증감률 텍스트 생성
      comparisonText = `
**📊 전주 대비 증감률**
• 노출수: ${formatChange(changes.impressions)}
• 클릭수: ${formatChange(changes.clicks)}
• 지출: ${formatChange(changes.spend)}
• 리드: ${formatChange(changes.leads)}
• CPL: ${formatChange(changes.cpl)} ${changes.cpl < 0 ? '⬇️ 개선!' : changes.cpl > 5 ? '⚠️' : ''}
• CTR: ${formatChange(changes.ctr)}

**💡 인사이트**
${generateInsights(changes)}
`;
    } else {
      console.log("⚠️ No previous week data found");
      comparisonText = "\n*첫 주차 데이터로 비교 데이터가 없습니다.*\n";
    }

    // 광고별 성과 순위 분석
    const adPerformanceText = await getAdPerformanceRanking(clientId, weekStart, weekEnd);

    // 메시지 구성
    const message = `
📊 **[BAS] ${clientName} 주간 리포트**
기간: ${weekStart} ~ ${weekEnd}

**📈 핵심 성과 요약**
• 노출수: ${current.impressions.toLocaleString()}회
• 클릭수: ${current.clicks}회
• 지출: $${current.spend.toFixed(2)}
• 리드: ${current.leads}건
• CPL: $${currentCpl.toFixed(2)}
• CTR: ${currentCtr.toFixed(2)}%
${comparisonText}
${adPerformanceText}
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

// 지난 주 날짜 계산 (월요일 ~ 일요일)
function getLastWeekRange() {
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0 (일요일) ~ 6 (토요일)

  // 지난 주 일요일
  const lastSunday = new Date(today);
  lastSunday.setDate(today.getDate() - dayOfWeek - 7);

  // 지난 주 월요일
  const lastMonday = new Date(lastSunday);
  lastMonday.setDate(lastSunday.getDate() - 6);

  return {
    weekStart: lastMonday.toISOString().split('T')[0],
    weekEnd: lastSunday.toISOString().split('T')[0]
  };
}

// 주간 리포트 발송 작업
async function sendWeeklyReports() {
  console.log("\n🚀 Starting weekly report job...");
  console.log(`   Time: ${new Date().toISOString()}`);

  const { weekStart, weekEnd } = getLastWeekRange();
  console.log(`   Report period: ${weekStart} ~ ${weekEnd}`);

  // 모든 클라이언트 조회
  const { data: clients, error } = await supabase
    .from("clients")
    .select("client_id, client_name")
    .eq("is_active", true);

  if (error) {
    console.error("❌ Failed to fetch clients:", error);
    return;
  }

  if (!clients || clients.length === 0) {
    console.log("⚠️ No active clients found");
    return;
  }

  console.log(`✅ Found ${clients.length} active client(s)`);

  // 각 클라이언트별로 리포트 발송
  for (const client of clients) {
    console.log(`\n📧 Sending report for: ${client.client_name}`);
    await sendTelegramReport(
      client.client_id,
      client.client_name,
      weekStart,
      weekEnd
    );

    // 다음 리포트 전 1초 대기 (API rate limit 방지)
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log("\n🎉 All reports sent!");
}

// 메인 스케줄러
console.log("🤖 BAS Telegram Report Scheduler Started");
console.log("━".repeat(50));

// 매주 월요일 오전 9시 (KST 기준 - 실제로는 UTC 0시)
// Cron 표현식: 분 시 일 월 요일
// '0 9 * * 1' = 매주 월요일 09:00
cron.schedule('0 9 * * 1', async () => {
  console.log("\n⏰ Scheduled task triggered");
  await sendWeeklyReports();
}, {
  timezone: "Asia/Seoul"
});

console.log("✅ Cron job scheduled:");
console.log("   - Every Monday at 09:00 (KST)");
console.log("   - Reports last week's data (Monday ~ Sunday)");
console.log("");

// 테스트용: 즉시 실행 (주석 처리됨)
// console.log("🧪 Running test report now...");
// sendWeeklyReports().catch(console.error);

// 프로세스 유지
process.on('SIGTERM', () => {
  console.log("\n⚠️ SIGTERM received, shutting down...");
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log("\n⚠️ SIGINT received, shutting down...");
  process.exit(0);
});

console.log("Press Ctrl+C to stop the scheduler");
