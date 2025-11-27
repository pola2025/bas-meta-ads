/**
 * 텔레그램 자동 리포트 발송 스케줄러 v2.0
 *
 * 개선 사항:
 * - 이모지로 가독성 향상
 * - 대시보드 링크 추가
 * - 추천 액션 자동 생성
 * - 섹션별 구분선
 *
 * 실행: node telegram-cron-v2.js
 */

require('dotenv').config();
const cron = require('node-cron');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// 대시보드 URL (환경 변수 또는 기본값)
const DASHBOARD_URL = process.env.DASHBOARD_URL || 'https://bas-dashboard.vercel.app';

// 헬퍼 함수: 증감률 계산
function calculateChange(current, previous) {
  if (previous === 0) return 0;
  return ((current - previous) / previous) * 100;
}

// 헬퍼 함수: 증감률 포맷팅 (이모지 포함)
function formatChange(changePercent, metric = 'default') {
  const sign = changePercent >= 0 ? '▲' : '▼';
  const value = `${sign} ${Math.abs(changePercent).toFixed(1)}%`;

  // 지표별 긍정/부정 판단
  if (metric === 'cpl') {
    // CPL은 감소가 좋음
    if (changePercent < -10) return `${value} ⬇️ 대폭 개선!`;
    if (changePercent < -5) return `${value} ⬇️ 개선!`;
    if (changePercent > 20) return `${value} 🔴 주의 필요`;
    if (changePercent > 10) return `${value} ⚠️`;
  } else if (metric === 'leads') {
    // 리드는 증가가 좋음
    if (changePercent > 20) return `${value} ⬆️ 대폭 성장!`;
    if (changePercent > 10) return `${value} ⬆️ 성장!`;
    if (changePercent < -20) return `${value} 🔴 점검 필요`;
    if (changePercent < -10) return `${value} ⚠️`;
  }

  return value;
}

// 헬퍼 함수: 인사이트 생성 (개선 버전)
function generateInsights(changes, topAd, worstAd) {
  const insights = [];

  // CPL 분석
  if (changes.cpl < -10) {
    insights.push(`• CPL이 ${Math.abs(changes.cpl).toFixed(1)}% 감소하여 비용 효율성이 크게 개선되었습니다`);
  } else if (changes.cpl > 15) {
    insights.push(`• CPL이 ${changes.cpl.toFixed(1)}% 증가하여 비용 효율성 개선이 시급합니다`);
  }

  // 리드 분석
  if (changes.leads > 20) {
    insights.push(`• 리드가 ${changes.leads.toFixed(1)}% 증가하여 전환이 성공적입니다`);
  } else if (changes.leads < -20) {
    insights.push(`• 리드가 ${Math.abs(changes.leads).toFixed(1)}% 감소하여 전략 재검토가 필요합니다`);
  }

  // CTR 분석
  if (changes.ctr < -15) {
    insights.push(`• CTR이 ${Math.abs(changes.ctr).toFixed(1)}% 감소하여 광고 소재 개선이 필요합니다`);
  } else if (changes.ctr > 15) {
    insights.push(`• CTR이 ${changes.ctr.toFixed(1)}% 증가하여 광고 소재가 효과적입니다`);
  }

  // Best 광고 강조
  if (topAd) {
    const adNameShort = topAd.ad_name.length > 15 ? topAd.ad_name.substring(0, 15) + "..." : topAd.ad_name;
    insights.push(`• "${adNameShort}" 광고가 최고 효율을 보이고 있습니다 (CPL: $${topAd.avg_cpl.toFixed(2)})`);
  }

  // 일반 상태
  if (insights.length === 0) {
    insights.push("• 전주와 유사한 성과를 유지하고 있습니다");
  }

  return insights.slice(0, 5).join('\n'); // 최대 5개
}

// 헬퍼 함수: 추천 액션 생성
function generateRecommendedActions(current, changes, topAds) {
  const actions = [];

  if (!topAds || topAds.length === 0) return '';

  const avgCpl = current.spend / current.leads;

  // Best 광고 예산 증액 권장
  const bestAds = topAds.filter(ad => ad.avg_cpl < avgCpl * 0.7 && ad.total_leads >= 2);
  if (bestAds.length > 0) {
    const adNameShort = bestAds[0].ad_name.length > 20 ? bestAds[0].ad_name.substring(0, 20) + "..." : bestAds[0].ad_name;
    actions.push(`1. ✅ "${adNameShort}" 광고 예산 20% 증액 고려`);
  }

  // CPL 개선 추세
  if (changes && changes.cpl < -5) {
    actions.push(`2. 📊 비용 효율성이 개선 중입니다 - 현재 전략 유지 권장`);
  }

  // Worst 광고 개선
  const worstAds = topAds.filter(ad => ad.avg_cpl > avgCpl * 1.5);
  if (worstAds.length > 0) {
    const adNameShort = worstAds[worstAds.length - 1].ad_name.length > 20 ? worstAds[worstAds.length - 1].ad_name.substring(0, 20) + "..." : worstAds[worstAds.length - 1].ad_name;
    actions.push(`3. ⚠️ "${adNameShort}" 광고 크리에이티브 A/B 테스트 권장`);
  }

  // 리드 급감 경고
  if (changes && changes.leads < -20) {
    actions.push(`4. 🔴 리드 급감 - 타겟팅 및 예산 점검 필요`);
  }

  return actions.slice(0, 4).join('\n');
}

// 헬퍼 함수: 광고별 성과 순위 분석 (개선 버전)
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

// 텔레그램 리포트 발송 (v2)
async function sendTelegramReport(clientId, clientName, weekStart, weekEnd) {
  try {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID;

    if (!botToken || !chatId) {
      console.log("⚠️ Telegram credentials not set");
      return;
    }

    console.log(`\n🔍 Querying current week data for ${clientName}...`);

    // 현재 주 데이터 조회
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

    // 데이터 집계
    const current = currentData.reduce((acc, d) => ({
      impressions: acc.impressions + (d.total_impressions || 0),
      clicks: acc.clicks + (d.total_clicks || 0),
      spend: acc.spend + (d.total_spend || 0),
      leads: acc.leads + (d.total_leads || 0)
    }), { impressions: 0, clicks: 0, spend: 0, leads: 0 });

    const currentCtr = current.impressions > 0 ? (current.clicks / current.impressions * 100) : 0;
    const currentCpl = current.leads > 0 ? (current.spend / current.leads) : 0;

    // 이전 주 데이터 조회
    const prevWeekStart = new Date(weekStart);
    prevWeekStart.setDate(prevWeekStart.getDate() - 7);
    const prevWeekEnd = new Date(weekEnd);
    prevWeekEnd.setDate(prevWeekEnd.getDate() - 7);

    const { data: prevData } = await supabase
      .from("weekly_summary")
      .select("*")
      .eq("client_id", clientId)
      .eq("week_start", prevWeekStart.toISOString().split('T')[0])
      .eq("week_end", prevWeekEnd.toISOString().split('T')[0]);

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

    // 광고별 성과 순위 분석
    const { text: adPerformanceText, topAds } = await getAdPerformanceRanking(clientId, weekStart, weekEnd);

    // 인사이트 생성
    const topAd = topAds && topAds.length > 0 ? topAds[0] : null;
    const worstAd = topAds && topAds.length > 0 ? topAds[topAds.length - 1] : null;
    const insightsText = changes ? generateInsights(changes, topAd, worstAd) : "• 첫 주차 데이터입니다. 다음 주부터 트렌드 분석이 가능합니다.";

    // 추천 액션 생성
    const actionsText = generateRecommendedActions(current, changes, topAds);

    // 대시보드 링크 생성
    const dashboardLink = `${DASHBOARD_URL}/?client=${clientId}&start=${weekStart}&end=${weekEnd}&tab=overview`;

    // 메시지 구성 (v2)
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

// 지난 주 날짜 계산 (월요일 ~ 일요일)
function getLastWeekRange() {
  const today = new Date();
  const dayOfWeek = today.getDay();
  const lastSunday = new Date(today);
  lastSunday.setDate(today.getDate() - dayOfWeek - 7);
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

  const { data: clients, error } = await supabase
    .from("clients")
    .select("client_id, client_name")
    .eq("is_active", true);

  if (error || !clients || clients.length === 0) {
    console.log("⚠️ No active clients found");
    return;
  }

  console.log(`✅ Found ${clients.length} active client(s)`);

  for (const client of clients) {
    console.log(`\n📧 Sending report for: ${client.client_name}`);
    await sendTelegramReport(
      client.client_id,
      client.client_name,
      weekStart,
      weekEnd
    );
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log("\n🎉 All reports sent!");
}

// 메인 스케줄러
console.log("🤖 BAS Telegram Report Scheduler v2.0 Started");
console.log("━".repeat(50));

// 주간 리포트: 매주 월요일 09:00 KST
cron.schedule('0 9 * * 1', async () => {
  console.log("\n⏰ Weekly report scheduled task triggered");
  await sendWeeklyReports();
}, {
  timezone: "Asia/Seoul"
});

// 월간 리포트: 매월 1일 09:00 KST
cron.schedule('0 9 1 * *', async () => {
  console.log("\n⏰ Monthly report scheduled task triggered");
  await sendMonthlyReports();
}, {
  timezone: "Asia/Seoul"
});

console.log("✅ Cron jobs scheduled:");
console.log("   📅 Weekly:  Every Monday at 09:00 (KST) - Last week's data");
console.log("   📅 Monthly: 1st of every month at 09:00 (KST) - Previous month's data");
console.log("");

// 월간 리포트 발송 작업
async function sendMonthlyReports() {
  console.log("\n📊 Starting monthly report job...");
  console.log(`   Time: ${new Date().toISOString()}`);

  const { data: clients, error } = await supabase
    .from("clients")
    .select("client_id, client_name")
    .eq("is_active", true);

  if (error || !clients || clients.length === 0) {
    console.log("⚠️ No active clients found");
    return;
  }

  console.log(`✅ Found ${clients.length} active client(s)`);

  // send-monthly-report.js를 각 클라이언트별로 실행
  const { spawn } = require('child_process');

  for (const client of clients) {
    console.log(`\n📧 Sending monthly report for: ${client.client_name}`);

    try {
      await new Promise((resolve, reject) => {
        const child = spawn('node', ['send-monthly-report.js'], {
          env: {
            ...process.env,
            CLIENT_ID: client.client_id
          },
          cwd: process.cwd(),
          stdio: 'inherit'
        });

        child.on('close', (code) => {
          if (code === 0) {
            console.log(`✅ Monthly report sent for ${client.client_name}`);
            resolve();
          } else {
            console.error(`❌ Monthly report failed for ${client.client_name} (code: ${code})`);
            resolve(); // 실패해도 다음 클라이언트 진행
          }
        });

        child.on('error', (err) => {
          console.error(`❌ Error spawning process for ${client.client_name}:`, err.message);
          resolve(); // 에러나도 다음 클라이언트 진행
        });
      });

      // 클라이언트 간 딜레이 (API 레이트 리밋 방지)
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error) {
      console.error(`❌ Error sending monthly report for ${client.client_name}:`, error.message);
    }
  }

  console.log("\n🎉 All monthly reports sent!");
}

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
