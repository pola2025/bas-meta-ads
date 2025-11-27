/**
 * 텔레그램 리포트 미리보기 (발송 안 함)
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// 증감률 계산
function calculateChange(current, previous) {
  if (previous === 0) return 0;
  return ((current - previous) / previous) * 100;
}

// 증감률 포맷팅
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

// 인사이트 생성
function generateInsights(changes, topAd) {
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

  if (topAd) {
    const adNameShort = topAd.ad_name.length > 15 ? topAd.ad_name.substring(0, 15) + "..." : topAd.ad_name;
    insights.push(`• "${adNameShort}" 광고가 최고 효율을 보이고 있습니다 (CPL: $${topAd.avg_cpl.toFixed(2)})`);
  }

  if (insights.length === 0) {
    insights.push("• 전주와 유사한 성과를 유지하고 있습니다");
  }

  return insights.slice(0, 5).join('\n');
}

// 광고별 성과 순위
async function getAdPerformanceRanking(clientId, weekStart, weekEnd) {
  const { data, error } = await supabase
    .from("weekly_summary")
    .select("ad_name, avg_cpl, avg_ctr, total_leads, total_spend")
    .eq("client_id", clientId)
    .eq("week_start", weekStart)
    .eq("week_end", weekEnd);

  if (error || !data || data.length === 0) {
    return { text: "", topAds: [] };
  }

  const adsWithLeads = data.filter(ad => ad.total_leads > 0 && ad.avg_cpl > 0);
  if (adsWithLeads.length === 0) {
    return { text: "", topAds: [] };
  }

  const sortedByCpl = [...adsWithLeads].sort((a, b) => a.avg_cpl - b.avg_cpl);
  const top5Best = sortedByCpl.slice(0, Math.min(5, sortedByCpl.length));

  let rankingText = "\n🏆 Best Performing 광고 (TOP 5)\n";
  top5Best.forEach((ad, index) => {
    const adNameShort = ad.ad_name.length > 20 ? ad.ad_name.substring(0, 20) + "..." : ad.ad_name;
    rankingText += `\n${index + 1}. ${adNameShort}\n`;
    rankingText += `   💵 CPL: $${ad.avg_cpl.toFixed(2)} | 📊 CTR: ${ad.avg_ctr.toFixed(2)}% | 🎯 리드: ${ad.total_leads}건\n`;
  });

  return { text: rankingText, topAds: sortedByCpl };
}

// Gemini AI 분석
async function generateAIAnalysis(current, prev, currentCpl, prevCpl, currentCtr, prevCtr, topAds) {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return "";
    }

    const prompt = `당신은 메타 광고 전문가입니다. 다음 주간 성과 데이터를 분석하여 **3가지 핵심 인사이트**와 **2가지 실행 가능한 추천 액션**을 제공해주세요.

**현재 주 성과**:
- 총 지출: $${current.spend.toFixed(2)}
- 총 리드: ${current.leads}건
- 평균 CPL: $${currentCpl.toFixed(2)}
- 평균 CTR: ${currentCtr.toFixed(2)}%

**전주 대비 변화**:
- 지출: $${prev.spend.toFixed(2)} → $${current.spend.toFixed(2)} (${calculateChange(current.spend, prev.spend).toFixed(1)}%)
- 리드: ${prev.leads}건 → ${current.leads}건 (${calculateChange(current.leads, prev.leads).toFixed(1)}%)
- CPL: $${prevCpl.toFixed(2)} → $${currentCpl.toFixed(2)} (${calculateChange(currentCpl, prevCpl).toFixed(1)}%)

**응답 형식**:

💡 핵심 인사이트

1. [간결한 인사이트 1]
2. [간결한 인사이트 2]
3. [간결한 인사이트 3]

🎯 추천 액션

1. [구체적인 액션 1]
2. [구체적인 액션 2]`;

    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash-exp',
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 512,
      }
    });

    const result = await model.generateContent(prompt);
    return result.response.text();
  } catch (error) {
    console.error("❌ AI 분석 실패:", error.message);
    return "";
  }
}

// 데이터 완전성 검증 및 자동 수집
async function ensureDataExists(weekStart, weekEnd) {
  const { execSync } = require('child_process');

  console.log(`\n📊 데이터 완전성 검증: ${weekStart} ~ ${weekEnd}`);

  // 1. weekly_summary 데이터 확인
  const { data: weeklyData } = await supabase
    .from("weekly_summary")
    .select("week_start, week_end, ad_name")
    .eq("week_start", weekStart)
    .eq("week_end", weekEnd);

  // 2. 기간 검증 (7일 완전 여부)
  const start = new Date(weekStart);
  const end = new Date(weekEnd);
  const daysDiff = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
  const requiredDays = 7;

  console.log(`   기간: ${daysDiff}일 (요구: ${requiredDays}일)`);
  console.log(`   광고 수: ${weeklyData?.length || 0}개`);

  // 3. 데이터 완전성 판단
  const isComplete = weeklyData && weeklyData.length > 0 && daysDiff >= requiredDays;

  if (isComplete) {
    console.log("✅ 데이터 완전함\n");
    return true;
  }

  // 4. 부족한 경우
  if (daysDiff < requiredDays) {
    console.log(`⚠️ 기간 부족: ${daysDiff}일 < ${requiredDays}일`);
    console.log("❌ 7일 데이터가 모일 때까지 리포트 생성 불가\n");
    return false;
  }

  if (!weeklyData || weeklyData.length === 0) {
    console.log("⚠️ 데이터 없음 - 자동 수집 시작...\n");

    try {
      execSync('node collect-data.js 7', {
        encoding: 'utf-8',
        stdio: 'inherit',
        timeout: 120000
      });

      console.log("\n⏳ Worker 처리 대기 중 (15초)...");
      await new Promise(resolve => setTimeout(resolve, 15000));

      // 재확인
      const { data: recheck } = await supabase
        .from("weekly_summary")
        .select("id")
        .eq("week_start", weekStart)
        .eq("week_end", weekEnd)
        .limit(1);

      if (recheck && recheck.length > 0) {
        console.log("✅ 데이터 수집 완료\n");
        return true;
      } else {
        console.log("❌ 데이터 수집 실패\n");
        return false;
      }
    } catch (error) {
      console.error("❌ 데이터 수집 실패:", error.message);
      return false;
    }
  }

  return false;
}

// 리포트 미리보기 생성
async function previewReport() {
  const clientId = "79e35fc6-a817-4ccc-9d5d-9a93c1ad4515";
  const clientName = "비즈액터스쿨";

  // 실제 데이터가 있는 기간 사용
  const weekStartStr = '2025-11-17';
  const weekEndStr = '2025-11-20';

  // 데이터 확보 확인
  const dataReady = await ensureDataExists(weekStartStr, weekEndStr);
  if (!dataReady) {
    console.log("\n❌ 데이터 준비 실패\n");
    return;
  }

  console.log(`\n🔍 리포트 생성 중: ${weekStartStr} ~ ${weekEndStr}\n`);

  // 현재 주 데이터 조회
  const { data: currentData, error } = await supabase
    .from("weekly_summary")
    .select("*")
    .eq("client_id", clientId)
    .eq("week_start", weekStartStr)
    .eq("week_end", weekEndStr);

  if (error || !currentData || currentData.length === 0) {
    console.log("⚠️ 데이터 없음");
    return;
  }

  console.log(`✅ 데이터 발견: ${currentData.length}개 광고\n`);

  // 데이터 집계
  const current = currentData.reduce((acc, d) => ({
    impressions: acc.impressions + (d.total_impressions || 0),
    clicks: acc.clicks + (d.total_clicks || 0),
    spend: acc.spend + (d.total_spend || 0),
    leads: acc.leads + (d.total_leads || 0)
  }), { impressions: 0, clicks: 0, spend: 0, leads: 0 });

  const currentCtr = current.impressions > 0 ? (current.clicks / current.impressions * 100) : 0;
  const currentCpl = current.leads > 0 ? (current.spend / current.leads) : 0;

  // 이전 주 데이터
  const { data: prevData } = await supabase
    .from("weekly_summary")
    .select("*")
    .eq("client_id", clientId)
    .lt("week_end", weekStartStr)
    .order("week_end", { ascending: false })
    .limit(20);

  let comparisonText = "";
  let changes = null;
  let prev = null;

  if (prevData && prevData.length > 0) {
    prev = prevData.reduce((acc, d) => ({
      impressions: acc.impressions + (d.total_impressions || 0),
      clicks: acc.clicks + (d.total_clicks || 0),
      spend: acc.spend + (d.total_spend || 0),
      leads: acc.leads + (d.total_leads || 0)
    }), { impressions: 0, clicks: 0, spend: 0, leads: 0 });

    const prevCtr = prev.impressions > 0 ? (prev.clicks / prev.impressions * 100) : 0;
    const prevCpl = prev.leads > 0 ? (prev.spend / prev.leads) : 0;

    changes = {
      leads: calculateChange(current.leads, prev.leads),
      cpl: calculateChange(currentCpl, prevCpl),
      spend: calculateChange(current.spend, prev.spend),
      ctr: calculateChange(currentCtr, prevCtr)
    };

    comparisonText = `
📊 전주 대비 변화

리드: ${formatChange(changes.leads, 'leads')}
CPL: ${formatChange(changes.cpl, 'cpl')}
지출: ${formatChange(changes.spend)}
CTR: ${formatChange(changes.ctr)}
`;
  }

  // 광고별 성과
  const { text: adPerformanceText, topAds } = await getAdPerformanceRanking(clientId, weekStartStr, weekEndStr);

  // 인사이트
  const topAd = topAds && topAds.length > 0 ? topAds[0] : null;
  const insightsText = changes ? generateInsights(changes, topAd) : "• 첫 주차 데이터입니다.";

  // AI 분석
  let aiAnalysisText = "";
  if (prev) {
    const prevCtr = prev.impressions > 0 ? (prev.clicks / prev.impressions * 100) : 0;
    const prevCpl = prev.leads > 0 ? (prev.spend / prev.leads) : 0;
    aiAnalysisText = await generateAIAnalysis(current, prev, currentCpl, prevCpl, currentCtr, prevCtr, topAds);
  }

  // 메시지 구성
  const message = `
📊 [BAS] ${clientName} 주간 리포트
📅 ${weekStartStr} ~ ${weekEndStr}
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
${aiAnalysisText ? `━━━━━━━━━━━━━━━━━━━━━━\n\n🤖 Polarad AI 분석리포트\n\n${aiAnalysisText}\n` : ''}
━━━━━━━━━━━━━━━━━━━━━━
🤖 BAS Meta Ads Analytics
📅 발송: ${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })} (KST)
  `.trim();

  console.log("━".repeat(60));
  console.log("📝 리포트 미리보기");
  console.log("━".repeat(60));
  console.log(message);
  console.log("━".repeat(60));
  console.log(`\n📏 메시지 길이: ${message.length} / 4096 자`);
  console.log("\n✅ 미리보기 완료 (실제 발송 안 함)\n");
}

previewReport().catch(console.error);
