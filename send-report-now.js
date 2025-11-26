/**
 * 텔레그램 주간 리포트 즉시 발송
 */

require('dotenv').config();
const cron = require('node-cron');
const { createClient } = require('@supabase/supabase-js');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

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

// 헬퍼 함수: 광고별 성과 순위 분석 (평균 시청 시간 포함)
async function getAdPerformanceRanking(clientId, weekStart, weekEnd) {
  try {
    console.log("\n📊 Analyzing ad performance ranking...");

    // weekly_summary에서 기본 데이터
    const { data: summaryData, error } = await supabase
      .from("weekly_summary")
      .select("ad_id, ad_name, avg_cpl, avg_ctr, total_leads, total_spend, total_video_views")
      .eq("client_id", clientId)
      .eq("week_start", weekStart)
      .eq("week_end", weekEnd);

    if (error || !summaryData || summaryData.length === 0) {
      console.log("⚠️ No ad data found");
      return { text: "", topAds: [] };
    }

    console.log(`✅ Found ${summaryData.length} ads`);

    // raw_data에서 평균 시청 시간 계산
    const { data: rawData } = await supabase
      .from("raw_data")
      .select("ad_id, avg_watch_time, video_views")
      .eq("client_id", clientId)
      .gte("date", weekStart)
      .lte("date", weekEnd);

    // ad_id별 평균 시청 시간 계산
    const watchTimeByAd = {};
    if (rawData && rawData.length > 0) {
      const adGroups = {};
      rawData.forEach(row => {
        if (!adGroups[row.ad_id]) {
          adGroups[row.ad_id] = { totalWatchTime: 0, totalViews: 0 };
        }
        adGroups[row.ad_id].totalWatchTime += (row.avg_watch_time || 0) * (row.video_views || 0);
        adGroups[row.ad_id].totalViews += (row.video_views || 0);
      });

      Object.keys(adGroups).forEach(adId => {
        const group = adGroups[adId];
        watchTimeByAd[adId] = group.totalViews > 0
          ? group.totalWatchTime / group.totalViews
          : 0;
      });
    }

    // 시청 시간 데이터 병합
    const adsWithWatchTime = summaryData.map(ad => ({
      ...ad,
      avg_watch_time: watchTimeByAd[ad.ad_id] || 0
    }));

    const adsWithLeads = adsWithWatchTime.filter(ad => ad.total_leads > 0 && ad.avg_cpl > 0);
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
      if (ad.avg_watch_time > 0) {
        rankingText += `   ⏱️ 평균 시청: ${ad.avg_watch_time.toFixed(1)}초\n`;
      }
    });

    if (sortedByCpl.length >= 5) {
      rankingText += "\n⚠️ 개선 필요 광고\n";
      top3Worst.slice(0, 2).forEach((ad, index) => {
        const adNameShort = ad.ad_name.length > 20 ? ad.ad_name.substring(0, 20) + "..." : ad.ad_name;
        rankingText += `\n${index + 1}. ${adNameShort}\n`;
        rankingText += `   💵 CPL: $${ad.avg_cpl.toFixed(2)} | 📊 CTR: ${ad.avg_ctr.toFixed(2)}% | 🎯 리드: ${ad.total_leads}건\n`;
        if (ad.avg_watch_time > 0) {
          rankingText += `   ⏱️ 평균 시청: ${ad.avg_watch_time.toFixed(1)}초\n`;
        }
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

// Polarad AI 분석 함수 (Powered by Gemini)
async function generateAIAnalysis(current, prev, currentCpl, prevCpl, currentCtr, prevCtr, topAds) {
  try {
    if (!process.env.GEMINI_API_KEY) {
      console.log("⚠️ Gemini API key not set, skipping AI analysis");
      return "";
    }

    console.log("\n🤖 Generating Polarad AI analysis...");

    const prompt = `당신은 메타 광고 전문가입니다. 다음 주간 성과 데이터를 분석하여 **3가지 핵심 인사이트**와 **2가지 실행 가능한 추천 액션**을 제공해주세요.

**현재 주 성과**:
- 총 지출: $${current.spend.toFixed(2)}
- 총 리드: ${current.leads}건
- 평균 CPL: $${currentCpl.toFixed(2)}
- 평균 CTR: ${currentCtr.toFixed(2)}%
- 노출수: ${current.impressions.toLocaleString()}회
- 클릭수: ${current.clicks}회

**전주 대비 변화**:
- 지출: $${prev.spend.toFixed(2)} → $${current.spend.toFixed(2)} (${calculateChange(current.spend, prev.spend).toFixed(1)}%)
- 리드: ${prev.leads}건 → ${current.leads}건 (${calculateChange(current.leads, prev.leads).toFixed(1)}%)
- CPL: $${prevCpl.toFixed(2)} → $${currentCpl.toFixed(2)} (${calculateChange(currentCpl, prevCpl).toFixed(1)}%)
- CTR: ${prevCtr.toFixed(2)}% → ${currentCtr.toFixed(2)}% (${calculateChange(currentCtr, prevCtr).toFixed(1)}%)

**광고별 성과 (CPL 낮은 순)**:
${topAds.slice(0, 6).map((ad, i) => `${i+1}. ${ad.ad_name}
   CPL: $${ad.avg_cpl.toFixed(2)} | CTR: ${ad.avg_ctr.toFixed(2)}% | 리드: ${ad.total_leads}건${ad.avg_watch_time > 0 ? ` | 시청: ${ad.avg_watch_time.toFixed(1)}초` : ''}`).join('\n')}

**응답 형식** (반드시 아래 형식 준수):

💡 핵심 인사이트

1. [간결한 인사이트 1 - 한 문장으로 요약]
2. [간결한 인사이트 2 - 한 문장으로 요약]
3. [간결한 인사이트 3 - 한 문장으로 요약]

🎯 추천 액션

1. [구체적인 액션 1 - 즉시 실행 가능]
2. [구체적인 액션 2 - 즉시 실행 가능]

**중요**:
- 각 인사이트는 **1문장 50자 이내**로 간결하게 작성
- 각 액션은 **1문장 70자 이내**로 구체적으로 작성
- 텔레그램 메시지에 포함되므로 매우 간결하게 작성
- 구체적인 숫자와 광고명 포함`;

    const model = genAI.getGenerativeModel({
      model: 'gemini-3-pro-preview',
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 512,
      }
    });

    const result = await model.generateContent(prompt);
    const aiResponse = result.response.text();

    console.log("✅ AI analysis generated");
    return aiResponse;
  } catch (error) {
    console.error("❌ Error generating AI analysis:", error.message);
    return "";
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
      leads: acc.leads + (d.total_leads || 0),
      videoViews: acc.videoViews + (d.total_video_views || 0)
    }), { impressions: 0, clicks: 0, spend: 0, leads: 0, videoViews: 0 });

    const currentCtr = current.impressions > 0 ? (current.clicks / current.impressions * 100) : 0;
    const currentCpl = current.leads > 0 ? (current.spend / current.leads) : 0;

    // 이전 주 데이터 조회 (더 유연한 방식)
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
    let prev = null;
    let prevCtr = 0;
    let prevCpl = 0;

    if (prevData && prevData.length > 0) {
      prev = prevData.reduce((acc, d) => ({
        impressions: acc.impressions + (d.total_impressions || 0),
        clicks: acc.clicks + (d.total_clicks || 0),
        spend: acc.spend + (d.total_spend || 0),
        leads: acc.leads + (d.total_leads || 0)
      }), { impressions: 0, clicks: 0, spend: 0, leads: 0 });

      prevCtr = prev.impressions > 0 ? (prev.clicks / prev.impressions * 100) : 0;
      prevCpl = prev.leads > 0 ? (prev.spend / prev.leads) : 0;

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

    // AI 분석 생성 (이전 주 데이터가 있을 때만)
    let aiAnalysisText = "";
    if (prev) {
      aiAnalysisText = await generateAIAnalysis(current, prev, currentCpl, prevCpl, currentCtr, prevCtr, topAds);
    }

    // 메시지 구성 (v2 - AI 분석 포함)
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
🎬 동영상 조회: ${current.videoViews.toLocaleString()}회

━━━━━━━━━━━━━━━━━━━━━━
${comparisonText}
━━━━━━━━━━━━━━━━━━━━━━

💡 이번 주 인사이트

${insightsText}

━━━━━━━━━━━━━━━━━━━━━━
${adPerformanceText}
${actionsText ? `━━━━━━━━━━━━━━━━━━━━━━\n\n🎯 이번 주 추천 액션\n\n${actionsText}\n` : ''}
${aiAnalysisText ? `━━━━━━━━━━━━━━━━━━━━━━\n\n🤖 Polarad AI 분석리포트\n\n${aiAnalysisText}\n` : ''}
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
          disable_web_page_preview: false
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

// 이번 주 날짜 계산 (최근 7일: 어제부터 역산)
function getLastWeekRange() {
  const today = new Date();
  const weekEnd = new Date(today);
  weekEnd.setDate(today.getDate() - 1); // 어제

  const weekStart = new Date(weekEnd);
  weekStart.setDate(weekEnd.getDate() - 6); // 7일 전

  return {
    weekStart: weekStart.toISOString().split('T')[0],
    weekEnd: weekEnd.toISOString().split('T')[0]
  };
}

// 데이터 수집 여부 확인
async function checkAndCollectData(weekStart, weekEnd) {
  const { execSync } = require('child_process');

  console.log("\n📊 데이터 수집 상태 확인...");

  // weekly_summary에서 해당 기간 데이터 확인
  const { data: existingData } = await supabase
    .from("weekly_summary")
    .select("week_start, week_end")
    .eq("week_start", weekStart)
    .eq("week_end", weekEnd)
    .limit(1);

  if (existingData && existingData.length > 0) {
    console.log(`✅ 데이터 존재: ${weekStart} ~ ${weekEnd}`);
    return true;
  }

  console.log(`⚠️ 데이터 없음: ${weekStart} ~ ${weekEnd}`);
  console.log("🔄 자동 데이터 수집 시작...\n");

  // 기간 계산 (오늘부터 weekStart까지 일수)
  const today = new Date();
  const startDate = new Date(weekStart);
  const daysDiff = Math.ceil((today - startDate) / (1000 * 60 * 60 * 24));
  const daysToCollect = Math.min(daysDiff, 30); // 최대 30일

  console.log(`   수집 기간: 최근 ${daysToCollect}일`);

  try {
    // Producer 실행 (Windows 호환)
    const isWindows = process.platform === 'win32';
    const command = isWindows
      ? `set DATA_DAYS=${daysToCollect} && set MODE=producer && node index.js`
      : `DATA_DAYS=${daysToCollect} MODE=producer node index.js`;

    execSync(command, {
      encoding: 'utf-8',
      stdio: 'inherit',
      timeout: 120000,
      shell: isWindows ? 'cmd.exe' : '/bin/sh'
    });

    console.log("\n✅ 데이터 수집 완료");

    // 잠시 대기 (데이터베이스 반영 시간)
    await new Promise(resolve => setTimeout(resolve, 5000));

    return true;
  } catch (error) {
    console.error("❌ 데이터 수집 실패:", error.message);
    return false;
  }
}

// 주간 리포트 발송 작업
async function sendWeeklyReports() {
  console.log("\n🚀 Starting weekly report job...");
  console.log(`   Time: ${new Date().toISOString()}`);

  const { weekStart, weekEnd } = getLastWeekRange();
  console.log(`   Report period: ${weekStart} ~ ${weekEnd}`);

  // 데이터 수집 확인 및 자동 수집
  const dataReady = await checkAndCollectData(weekStart, weekEnd);
  if (!dataReady) {
    console.log("❌ 데이터 준비 실패 - 리포트 발송 중단");
    process.exit(1);
  }

  const { data: clients, error } = await supabase
    .from("clients")
    .select("client_id, client_name")
    .eq("is_active", true);

  if (error || !clients || clients.length === 0) {
    console.log("⚠️ No active clients found");
    return;
  }

  console.log(`✅ Found ${clients.length} active client(s)`);

  console.log("\n" + "=".repeat(50));
  console.log("📋 리포트 준비 완료");
  console.log("=".repeat(50));
  console.log(`\n대상 클라이언트: ${clients.map(c => c.client_name).join(', ')}`);
  console.log(`리포팅 기간: ${weekStart} ~ ${weekEnd}`);
  console.log("\n⚠️ 텔레그램 발송은 수동으로 진행해주세요:");
  console.log(`   node -e "require('./send-report-now.js').sendTelegramReport('${clients[0].client_id}', '${clients[0].client_name}', '${weekStart}', '${weekEnd}')"`);
  console.log("");

  process.exit(0);
}

// 외부에서 호출 가능하도록 export
module.exports = { sendTelegramReport };

// 즉시 실행
sendWeeklyReports().catch(console.error);
