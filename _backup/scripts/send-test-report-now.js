/**
 * 전체 텔레그램 리포트 즉시 발송 테스트
 * telegram-cron.js의 모든 기능 포함
 */

require('dotenv').config();
const cron = require('node-cron');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// 모든 헬퍼 함수들을 telegram-cron.js에서 복사
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

function generateInsights(changes, topAd, worstAd) {
  const insights = [];

  if (changes.cpl < -10) {
    insights.push(`• CPL이 ${Math.abs(changes.cpl).toFixed(1)}% 감소하여 비용 효율성이 크게 개선되었습니다`);
  } else if (changes.cpl > 15) {
    insights.push(`• CPL이 ${changes.cpl.toFixed(1)}% 증가하여 비용 효율성 개선이 시급합니다`);
  }

  if (changes.leads > 20) {
    insights.push(`• 리드가 ${changes.leads.toFixed(1)}% 증가하여 전환이 성공적입니다`);
  } else if (changes.leads < -20) {
    insights.push(`• 리드가 ${Math.abs(changes.leads).toFixed(1)}% 감소하여 전략 재검토가 필요합니다`);
  }

  if (changes.ctr < -15) {
    insights.push(`• CTR이 ${Math.abs(changes.ctr).toFixed(1)}% 감소하여 광고 소재 개선이 필요합니다`);
  } else if (changes.ctr > 15) {
    insights.push(`• CTR이 ${changes.ctr.toFixed(1)}% 증가하여 광고 소재가 효과적입니다`);
  }

  if (topAd) {
    const adNameShort = topAd.ad_name.length > 15 ? topAd.ad_name.substring(0, 15) + "..." : topAd.ad_name;
    insights.push(`• "${adNameShort}" 광고가 최고 효율을 보이고 있습니다 (CPL: $${topAd.avg_cpl.toFixed(2)})`);
  }

  if (insights.length === 0) {
    insights.push("• 전주와 유사한 성과를 유지하고 있습니다");
  }

  return insights.slice(0, 5).join('\n');
}

function generateRecommendedActions(current, changes, topAds) {
  const actions = [];

  if (!topAds || topAds.length === 0) return '';

  const avgCpl = current.spend / current.leads;

  const bestAds = topAds.filter(ad => ad.avg_cpl < avgCpl * 0.7 && ad.total_leads >= 2);
  if (bestAds.length > 0) {
    const adNameShort = bestAds[0].ad_name.length > 20 ? bestAds[0].ad_name.substring(0, 20) + "..." : bestAds[0].ad_name;
    actions.push(`1. ✅ "${adNameShort}" 광고 예산 20% 증액 고려`);
  }

  if (changes && changes.cpl < -5) {
    actions.push(`2. 📊 비용 효율성이 개선 중입니다 - 현재 전략 유지 권장`);
  }

  const worstAds = topAds.filter(ad => ad.avg_cpl > avgCpl * 1.5);
  if (worstAds.length > 0) {
    const adNameShort = worstAds[worstAds.length - 1].ad_name.length > 20 ? worstAds[worstAds.length - 1].ad_name.substring(0, 20) + "..." : worstAds[worstAds.length - 1].ad_name;
    actions.push(`3. ⚠️ "${adNameShort}" 광고 크리에이티브 A/B 테스트 권장`);
  }

  if (changes && changes.leads < -20) {
    actions.push(`4. 🔴 리드 급감 - 타겟팅 및 예산 점검 필요`);
  }

  return actions.slice(0, 4).join('\n');
}

async function getAdPerformanceRanking(clientId, weekStart, weekEnd) {
  try {
    console.log("\n📊 Analyzing ad performance ranking...");

    const { data, error } = await supabase
      .from("weekly_summary")
      .select("ad_name, avg_cpl, avg_ctr, total_leads, total_spend")
      .eq("client_id", clientId)
      .eq("week_start", weekStart)
      .eq("week_end", weekEnd);

    if (error || !data || data.length === 0) {
      console.log("⚠️ No ad data found");
      return { text: "", topAds: [] };
    }

    console.log(`✅ Found ${data.length} ads`);

    const adsWithLeads = data.filter(ad => ad.total_leads > 0 && ad.avg_cpl > 0);
    console.log(`   ${adsWithLeads.length} ads with leads`);

    if (adsWithLeads.length === 0) {
      return { text: "", topAds: [] };
    }

    const sortedByCpl = [...adsWithLeads].sort((a, b) => a.avg_cpl - b.avg_cpl);
    const top5Best = sortedByCpl.slice(0, Math.min(5, sortedByCpl.length));
    const top3Worst = sortedByCpl.slice(-Math.min(3, sortedByCpl.length)).reverse();

    let rankingText = "\n🏆 Best Performing 광고 (TOP 5)\n";
    top5Best.forEach((ad, index) => {
      const adNameShort = ad.ad_name.length > 20 ? ad.ad_name.substring(0, 20) + "..." : ad.ad_name;
      rankingText += `\n${index + 1}. ${adNameShort}\n`;
      rankingText += `   💵 CPL: $${ad.avg_cpl.toFixed(2)} | 📊 CTR: ${ad.avg_ctr.toFixed(2)}% | 🎯 리드: ${ad.total_leads}건\n`;
    });

    if (sortedByCpl.length >= 5) {
      rankingText += "\n⚠️ 개선 필요 광고\n";
      top3Worst.slice(0, 2).forEach((ad, index) => {
        const adNameShort = ad.ad_name.length > 20 ? ad.ad_name.substring(0, 20) + "..." : ad.ad_name;
        rankingText += `\n${index + 1}. ${adNameShort}\n`;
        rankingText += `   💵 CPL: $${ad.avg_cpl.toFixed(2)} | 📊 CTR: ${ad.avg_ctr.toFixed(2)}% | 🎯 리드: ${ad.total_leads}건\n`;
        rankingText += `   ⚡️ 액션: 광고 소재 개선 또는 타겟팅 조정 권장\n`;
      });
    }

    console.log("✅ Ad performance ranking created");

    return {
      text: rankingText,
      topAds: sortedByCpl
    };
  } catch (error) {
    console.error("❌ Error in getAdPerformanceRanking:", error.message);
    return { text: "", topAds: [] };
  }
}

async function sendTelegramReport(clientId, clientName, weekStart, weekEnd) {
  try {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID;

    if (!botToken || !chatId) {
      console.log("⚠️ Telegram credentials not set");
      return;
    }

    console.log(`\n🔍 Querying current week data for ${clientName}...`);

    const { data: currentData, error: currentError } = await supabase
      .from("weekly_summary")
      .select("*")
      .eq("client_id", clientId)
      .eq("week_start", weekStart)
      .eq("week_end", weekEnd);

    if (currentError || !currentData || currentData.length === 0) {
      console.log("⚠️ No data found");
      return;
    }

    const current = currentData.reduce((acc, d) => ({
      impressions: acc.impressions + (d.total_impressions || 0),
      clicks: acc.clicks + (d.total_clicks || 0),
      spend: acc.spend + (d.total_spend || 0),
      leads: acc.leads + (d.total_leads || 0)
    }), { impressions: 0, clicks: 0, spend: 0, leads: 0 });

    const currentCtr = current.impressions > 0 ? (current.clicks / current.impressions * 100) : 0;
    const currentCpl = current.leads > 0 ? (current.spend / current.leads) : 0;

    // 이전 주 데이터 조회 (개선된 로직)
    const { data: prevData } = await supabase
      .from("weekly_summary")
      .select("*")
      .eq("client_id", clientId)
      .lt("week_end", weekStart)
      .order("week_end", { ascending: false })
      .limit(20);

    console.log(`   Previous week records: ${prevData?.length || 0}`);

    let comparisonText = "";
    let changes = null;

    if (prevData && prevData.length > 0) {
      const prev = prevData.reduce((acc, d) => ({
        impressions: acc.impressions + (d.total_impressions || 0),
        clicks: acc.clicks + (d.total_clicks || 0),
        spend: acc.spend + (d.total_spend || 0),
        leads: acc.leads + (d.total_leads || 0)
      }), { impressions: 0, clicks: 0, spend: 0, leads: 0 });

      const prevCtr = prev.impressions > 0 ? (prev.clicks / prev.impressions * 100) : 0;
      const prevCpl = prev.leads > 0 ? (prev.spend / prev.leads) : 0;

      changes = {
        impressions: calculateChange(current.impressions, prev.impressions),
        clicks: calculateChange(current.clicks, prev.clicks),
        spend: calculateChange(current.spend, prev.spend),
        leads: calculateChange(current.leads, prev.leads),
        cpl: calculateChange(currentCpl, prevCpl),
        ctr: calculateChange(currentCtr, prevCtr)
      };

      comparisonText = `
📊 전주 대비 변화

리드: ${formatChange(changes.leads, 'leads')}
CPL: ${formatChange(changes.cpl, 'cpl')}
지출: ${formatChange(changes.spend)}
CTR: ${formatChange(changes.ctr)}
`;
    } else {
      comparisonText = "\n*첫 주차 데이터로 비교 데이터가 없습니다.*\n";
    }

    const { text: adPerformanceText, topAds } = await getAdPerformanceRanking(clientId, weekStart, weekEnd);

    const topAd = topAds && topAds.length > 0 ? topAds[0] : null;
    const worstAd = topAds && topAds.length > 0 ? topAds[topAds.length - 1] : null;
    const insightsText = changes ? generateInsights(changes, topAd, worstAd) : "• 첫 주차 데이터입니다. 다음 주부터 트렌드 분석이 가능합니다.";

    const actionsText = generateRecommendedActions(current, changes, topAds);

    const message = `
📊 [BAS] ${clientName} 주간 리포트
📅 ${weekStart} ~ ${weekEnd}
━━━━━━━━━━━━━━━━━━━━━━

📈 핵심 성과

💰 총 지출: $${current.spend.toFixed(2)}
🎯 총 리드: ${current.leads}건
💵 평균 CPL: $${currentCpl.toFixed(2)}
📊 평균 CTR: ${currentCtr.toFixed(2)}%

👁️ 노출수: ${current.impressions.toLocaleString()}회
👆 클릭수: ${current.clicks}회

━━━━━━━━━━━━━━━━━━━━━━
${comparisonText}
━━━━━━━━━━━━━━━━━━━━━━

💡 이번 주 인사이트

${insightsText}

━━━━━━━━━━━━━━━━━━━━━━
${adPerformanceText}
${actionsText ? `━━━━━━━━━━━━━━━━━━━━━━\n\n🎯 이번 주 추천 액션\n\n${actionsText}\n` : ''}
━━━━━━━━━━━━━━━━━━━━━━
🤖 BAS Meta Ads Analytics
📅 발송: ${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })} (KST)
    `.trim();

    console.log("\n📝 Message to send:");
    console.log("━".repeat(50));
    console.log(message);
    console.log("━".repeat(50));

    console.log("\n📱 Sending to Telegram...");
    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: "Markdown",
          disable_web_page_preview: true
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

// 즉시 실행
(async () => {
  console.log("\n🚀 Sending Full Telegram Report Now...");
  console.log(`   Time: ${new Date().toISOString()}`);

  const clientId = '79e35fc6-a817-4ccc-9d5d-9a93c1ad4515';
  const clientName = '비즈액터스쿨';
  const weekStart = '2025-11-10';
  const weekEnd = '2025-11-16';

  await sendTelegramReport(clientId, clientName, weekStart, weekEnd);

  console.log("\n🎉 Test completed!");
  process.exit(0);
})();
