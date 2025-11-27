/**
 * 텔레그램 리포트 미리보기 (발송 안 함)
 * 2025-11-17 ~ 2025-11-23 데이터로 테스트
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

// 추천 액션 생성
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

// 광고별 성과 순위 (평균 시청 시간 추가)
async function getAdPerformanceRanking(clientId, weekStart, weekEnd) {
  console.log("\n📊 광고 성과 순위 분석 중...");

  // weekly_summary에서 기본 데이터
  const { data: summaryData, error } = await supabase
    .from("weekly_summary")
    .select("ad_id, ad_name, avg_cpl, avg_ctr, total_leads, total_spend, total_video_views")
    .eq("client_id", clientId)
    .eq("week_start", weekStart)
    .eq("week_end", weekEnd);

  if (error || !summaryData || summaryData.length === 0) {
    return { text: "", topAds: [] };
  }

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
    if (ad.avg_watch_time > 0) {
      rankingText += `   ⏱️ 평균 시청: ${ad.avg_watch_time.toFixed(1)}초\n`;
    }
  });

  console.log(`✅ ${adsWithLeads.length}개 광고 분석 완료`);

  return { text: rankingText, topAds: sortedByCpl };
}

// Polarad AI 분석 (Powered by Gemini)
async function generateAIAnalysis(current, prev, currentCpl, prevCpl, currentCtr, prevCtr, topAds) {
  try {
    if (!process.env.GEMINI_API_KEY) {
      console.log("⚠️ Gemini API key 없음 - AI 분석 생략");
      return "";
    }

    console.log("\n🤖 Polarad AI 분석 생성 중...");

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
${topAds.slice(0, 5).map((ad, i) => `${i+1}. ${ad.ad_name}
   CPL: $${ad.avg_cpl.toFixed(2)} | CTR: ${ad.avg_ctr.toFixed(2)}% | 리드: ${ad.total_leads}건${ad.avg_watch_time > 0 ? ` | 시청: ${ad.avg_watch_time.toFixed(1)}초` : ''}`).join('\n')}

**응답 형식** (반드시 준수):

💡 핵심 인사이트

1. [간결한 인사이트 1 - 한 문장 50자 이내]
2. [간결한 인사이트 2 - 한 문장 50자 이내]
3. [간결한 인사이트 3 - 한 문장 50자 이내]

🎯 추천 액션

1. [구체적인 액션 1 - 한 문장 70자 이내, 즉시 실행 가능]
2. [구체적인 액션 2 - 한 문장 70자 이내, 즉시 실행 가능]

**중요**: 구체적인 숫자와 광고명을 포함하여 작성`;

    const model = genAI.getGenerativeModel({
      model: 'gemini-3-pro-preview',
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 512,
      }
    });

    const result = await model.generateContent(prompt);
    const aiResponse = result.response.text();

    console.log("✅ AI 분석 완료");
    return aiResponse;
  } catch (error) {
    console.error("❌ AI 분석 실패:", error.message);
    return "";
  }
}

// 메인 미리보기 함수
async function previewReport() {
  // 명령줄 인자 파싱
  const args = process.argv.slice(2);
  const clientArg = args.find(a => a.startsWith('--client='));
  const filterClient = clientArg ? clientArg.split('=')[1] : null;

  // 클라이언트 조회
  const { createClient } = require('@supabase/supabase-js');
  const supabase2 = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

  let clientQuery = supabase2.from('clients').select('id, client_name').eq('is_active', true);
  if (filterClient) {
    clientQuery = clientQuery.eq('client_name', filterClient);
  }

  const { data: clients } = await clientQuery;
  if (!clients || clients.length === 0) {
    console.log('❌ 클라이언트를 찾을 수 없습니다.');
    return;
  }

  const client = clients[0];
  const clientId = client.id;
  const clientName = client.client_name;

  // 날짜 계산 (가장 최근 완료된 주)
  const now = new Date();
  const dayOfWeek = now.getDay();
  const lastSunday = new Date(now);
  lastSunday.setDate(now.getDate() - dayOfWeek);
  const thisWeekMonday = new Date(lastSunday);
  thisWeekMonday.setDate(lastSunday.getDate() - 6);

  const formatDate = (d) => d.toISOString().split('T')[0];
  const weekStart = formatDate(thisWeekMonday);
  const weekEnd = formatDate(lastSunday);

  console.log(`\n🔍 리포트 미리보기 생성 중...`);
  console.log(`   클라이언트: ${clientName}`);
  console.log(`   기간: ${weekStart} ~ ${weekEnd}\n`);

  // 현재 주 데이터
  const { data: currentData } = await supabase
    .from("weekly_summary")
    .select("*")
    .eq("client_id", clientId)
    .eq("week_start", weekStart)
    .eq("week_end", weekEnd);

  if (!currentData || currentData.length === 0) {
    console.log("❌ 데이터 없음");
    return;
  }

  const current = currentData.reduce((acc, d) => ({
    impressions: acc.impressions + (d.total_impressions || 0),
    clicks: acc.clicks + (d.total_clicks || 0),
    spend: acc.spend + (d.total_spend || 0),
    leads: acc.leads + (d.total_leads || 0),
    videoViews: acc.videoViews + (d.total_video_views || 0)
  }), { impressions: 0, clicks: 0, spend: 0, leads: 0, videoViews: 0 });

  const currentCtr = current.impressions > 0 ? (current.clicks / current.impressions * 100) : 0;
  const currentCpl = current.leads > 0 ? (current.spend / current.leads) : 0;

  // 이전 주 데이터
  const { data: prevData } = await supabase
    .from("weekly_summary")
    .select("*")
    .eq("client_id", clientId)
    .lt("week_end", weekStart)
    .order("week_end", { ascending: false })
    .limit(20);

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
  } else {
    comparisonText = "\n*첫 주차 데이터로 비교 데이터가 없습니다.*\n";
  }

  // 광고별 성과 순위 (평균 시청 시간 포함)
  const { text: adPerformanceText, topAds } = await getAdPerformanceRanking(clientId, weekStart, weekEnd);

  // 인사이트
  const topAd = topAds && topAds.length > 0 ? topAds[0] : null;
  const insightsText = changes ? generateInsights(changes, topAd) : "• 첫 주차 데이터입니다.";

  // 추천 액션
  const actionsText = generateRecommendedActions(current, changes, topAds);

  // AI 분석
  let aiAnalysisText = "";
  if (prev) {
    aiAnalysisText = await generateAIAnalysis(current, prev, currentCpl, prevCpl, currentCtr, prevCtr, topAds);
  }

  // 메시지 구성
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

  console.log("\n" + "━".repeat(60));
  console.log("📝 리포트 미리보기");
  console.log("━".repeat(60));
  console.log(message);
  console.log("━".repeat(60));
  console.log(`\n📏 메시지 길이: ${message.length} / 4096 자`);
  console.log(`\n✅ 미리보기 완료 (실제 발송 안 함)`);
  console.log(`\n📌 확인 후 실제 발송하려면:`);
  console.log(`   node send-report-now.js\n`);
}

previewReport().catch(console.error);
