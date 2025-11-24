/**
 * ============================================================================
 * 월간 요약 및 리포트 발송
 * ============================================================================
 *
 * 기능:
 * 1. 월간 데이터 집계 (Supabase weekly_summary 기반)
 * 2. 주차별 트렌드 분석
 * 3. 텔레그램 월간 리포트 발송
 *
 * 실행: node lib/monthly-summary.js
 * ============================================================================
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * 월간 데이터 집계
 */
async function generateMonthlySummary(clientId, year, month) {
  try {
    console.log(`📊 Generating monthly summary for ${year}-${month.toString().padStart(2, '0')}...`);

    // 해당 월의 모든 주간 데이터 조회
    const monthStr = month.toString().padStart(2, '0');
    const startDate = `${year}-${monthStr}-01`;

    // 해당 월의 마지막 날 계산
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${monthStr}-${lastDay}`;

    console.log(`   Period: ${startDate} ~ ${endDate}`);

    const { data: weeklyData, error } = await supabase
      .from("weekly_summary")
      .select("*")
      .eq("client_id", clientId)
      .gte("week_start", startDate)
      .lte("week_end", endDate);

    if (error) {
      throw new Error(`Failed to fetch weekly data: ${error.message}`);
    }

    if (!weeklyData || weeklyData.length === 0) {
      console.log("⚠️ No data found for the specified month");
      return null;
    }

    console.log(`✅ Found ${weeklyData.length} weekly records`);

    // 전체 집계
    const total = weeklyData.reduce((acc, d) => ({
      impressions: acc.impressions + (d.total_impressions || 0),
      reach: acc.reach + (d.total_reach || 0),
      clicks: acc.clicks + (d.total_clicks || 0),
      leads: acc.leads + (d.total_leads || 0),
      spend: acc.spend + (d.total_spend || 0),
      videoViews: acc.videoViews + (d.total_video_views || 0)
    }), { impressions: 0, reach: 0, clicks: 0, leads: 0, spend: 0, videoViews: 0 });

    const avgCtr = total.impressions > 0 ? (total.clicks / total.impressions * 100) : 0;
    const avgCpl = total.leads > 0 ? (total.spend / total.leads) : 0;

    // 주차별 데이터 (주차별 CPL 트렌드)
    const weeklyTrend = [];
    const uniqueWeeks = [...new Set(weeklyData.map(d => `${d.week_start}~${d.week_end}`))];

    for (const weekRange of uniqueWeeks) {
      const [weekStart, weekEnd] = weekRange.split('~');
      const weekData = weeklyData.filter(d => d.week_start === weekStart && d.week_end === weekEnd);

      const weekTotal = weekData.reduce((acc, d) => ({
        impressions: acc.impressions + (d.total_impressions || 0),
        clicks: acc.clicks + (d.total_clicks || 0),
        spend: acc.spend + (d.total_spend || 0),
        leads: acc.leads + (d.total_leads || 0)
      }), { impressions: 0, clicks: 0, spend: 0, leads: 0 });

      const weekCpl = weekTotal.leads > 0 ? (weekTotal.spend / weekTotal.leads) : 0;
      const weekCtr = weekTotal.impressions > 0 ? (weekTotal.clicks / weekTotal.impressions * 100) : 0;

      weeklyTrend.push({
        weekStart,
        weekEnd,
        cpl: weekCpl,
        ctr: weekCtr,
        leads: weekTotal.leads,
        spend: weekTotal.spend
      });
    }

    // 주차별 트렌드 정렬 (날짜순)
    weeklyTrend.sort((a, b) => new Date(a.weekStart) - new Date(b.weekStart));

    return {
      year,
      month,
      startDate,
      endDate,
      total,
      avgCtr,
      avgCpl,
      weeklyTrend
    };
  } catch (error) {
    console.error("❌ Error generating monthly summary:", error.message);
    throw error;
  }
}

/**
 * 텔레그램 월간 리포트 발송
 */
async function sendMonthlyTelegramReport(clientId, clientName, year, month) {
  try {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID;

    if (!botToken || !chatId) {
      console.log("⚠️ Telegram credentials not set, skipping report");
      return;
    }

    // 월간 요약 생성
    const summary = await generateMonthlySummary(clientId, year, month);

    if (!summary) {
      console.log("⚠️ No data to send");
      return;
    }

    const { total, avgCtr, avgCpl, weeklyTrend } = summary;
    const monthStr = month.toString().padStart(2, '0');

    // 주차별 트렌드 텍스트 생성
    let trendText = "**📊 주차별 트렌드**\n";
    weeklyTrend.forEach((week, index) => {
      const weekNum = index + 1;
      let changeText = "";

      if (index > 0) {
        const prevCpl = weeklyTrend[index - 1].cpl;
        const change = prevCpl > 0 ? ((week.cpl - prevCpl) / prevCpl) * 100 : 0;
        const sign = change >= 0 ? '▲' : '▼';
        changeText = ` (${sign} ${Math.abs(change).toFixed(1)}%)`;
      }

      trendText += `• ${weekNum}주차 (${week.weekStart}~${week.weekEnd}): CPL $${week.cpl.toFixed(2)}${changeText}\n`;
    });

    // 인사이트 생성
    const insights = generateMonthlyInsights(weeklyTrend, avgCpl);

    // 메시지 구성
    const message = `
📊 **[BAS] ${clientName} 월간 리포트**
기간: ${year}-${monthStr} (${summary.startDate} ~ ${summary.endDate})

**📈 월간 성과 요약**
• 총 노출수: ${total.impressions.toLocaleString()}회
• 총 클릭수: ${total.clicks.toLocaleString()}회
• 총 지출: $${total.spend.toFixed(2)}
• 총 리드: ${total.leads}건
• 평균 CPL: $${avgCpl.toFixed(2)}
• 평균 CTR: ${avgCtr.toFixed(2)}%

${trendText}

**💡 월간 인사이트**
${insights}

---
🤖 BAS Meta Ads Analytics (Monthly Report)
    `.trim();

    console.log("\n📝 Monthly Message:");
    console.log("━".repeat(50));
    console.log(message);
    console.log("━".repeat(50));

    // Telegram API 호출
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
      console.log("✅ Monthly telegram report sent successfully");
    } else {
      const errorText = await response.text();
      console.error("❌ Failed to send monthly telegram report:", errorText);
    }
  } catch (error) {
    console.error("❌ Monthly telegram report error:", error.message);
  }
}

/**
 * 월간 인사이트 생성
 */
function generateMonthlyInsights(weeklyTrend, avgCpl) {
  const insights = [];

  if (weeklyTrend.length < 2) {
    insights.push("• 첫 달 데이터로 트렌드 분석이 제한적입니다");
    return insights.join('\n');
  }

  // 최고/최저 CPL 주차 찾기
  const sortedByCpl = [...weeklyTrend].filter(w => w.cpl > 0).sort((a, b) => a.cpl - b.cpl);

  if (sortedByCpl.length > 0) {
    const bestWeek = sortedByCpl[0];
    const worstWeek = sortedByCpl[sortedByCpl.length - 1];

    const bestWeekNum = weeklyTrend.findIndex(w => w.weekStart === bestWeek.weekStart) + 1;
    const worstWeekNum = weeklyTrend.findIndex(w => w.weekStart === worstWeek.weekStart) + 1;

    insights.push(`• 가장 효율적인 주차: ${bestWeekNum}주차 (CPL $${bestWeek.cpl.toFixed(2)})`);

    if (sortedByCpl.length > 1) {
      insights.push(`• 개선 필요 주차: ${worstWeekNum}주차 (CPL $${worstWeek.cpl.toFixed(2)})`);
    }
  }

  // 전반기 vs 후반기 비교
  const halfPoint = Math.floor(weeklyTrend.length / 2);
  const firstHalf = weeklyTrend.slice(0, halfPoint);
  const secondHalf = weeklyTrend.slice(halfPoint);

  const firstHalfAvgCpl = firstHalf.reduce((sum, w) => sum + w.cpl, 0) / firstHalf.length;
  const secondHalfAvgCpl = secondHalf.reduce((sum, w) => sum + w.cpl, 0) / secondHalf.length;

  const halfChange = ((secondHalfAvgCpl - firstHalfAvgCpl) / firstHalfAvgCpl) * 100;

  if (halfChange < -5) {
    insights.push(`• 월 후반으로 갈수록 CPL이 ${Math.abs(halfChange).toFixed(1)}% 개선되었습니다`);
  } else if (halfChange > 5) {
    insights.push(`• 월 후반으로 갈수록 CPL이 ${halfChange.toFixed(1)}% 증가하여 최적화가 필요합니다`);
  }

  // 전월 대비 비교는 나중에 구현 가능
  // (현재는 해당 월 데이터만 사용)

  if (insights.length === 0) {
    insights.push("• 월간 성과가 안정적으로 유지되고 있습니다");
  }

  return insights.join('\n');
}

/**
 * 메인 실행 함수
 */
async function main() {
  try {
    // 환경 변수에서 클라이언트 정보 가져오기
    // 또는 인자로 받기
    const clientId = process.argv[2] || "79e35fc6-a817-4ccc-9d5d-9a93c1ad4515";
    const clientName = process.argv[3] || "비즈액터스쿨";

    // 현재 날짜 기준 이전 달 계산
    const today = new Date();
    const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const year = lastMonth.getFullYear();
    const month = lastMonth.getMonth() + 1;

    console.log(`🚀 Generating monthly report for ${clientName}...`);
    console.log(`   Year: ${year}, Month: ${month}`);

    await sendMonthlyTelegramReport(clientId, clientName, year, month);

    console.log("\n🎉 Monthly report completed!");
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
}

// 직접 실행 시에만 main() 호출
if (require.main === module) {
  main();
}

module.exports = {
  generateMonthlySummary,
  sendMonthlyTelegramReport
};
