import type { Env, ReportData } from '../types';
import { escapeMd } from './dates';

// 텔레그램 메시지 발송
export async function sendTelegramMessage(
  env: Env,
  chatId: string,
  message: string
): Promise<void> {
  const url = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: message,
      parse_mode: 'MarkdownV2',
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`텔레그램 발송 실패: ${error}`);
  }
}

// 에러 알림 발송
export async function sendErrorAlert(env: Env, errorMessage: string): Promise<void> {
  try {
    const message = `❌ *BAS Meta Report 오류*\\n\\n${escapeMd(errorMessage)}`;
    await sendTelegramMessage(env, env.TELEGRAM_ERROR_CHAT_ID, message);
  } catch (err) {
    console.error('에러 알림 발송 실패:', err);
  }
}

// 데이터 0건 알림
export async function sendZeroDataAlert(env: Env): Promise<void> {
  const message = `⚠️ *주간 리포트 생성 실패*\\n\\n이번 주 데이터가 없습니다\\.\\nMeta API 또는 데이터 수집 스크립트를 확인하세요\\.`;
  await sendTelegramMessage(env, env.TELEGRAM_ERROR_CHAT_ID, message);
}

// 요일 한글 변환
function getDayOfWeekKr(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  return days[date.getDay()];
}

// 이모지 바 생성 (리드 1개 = 블럭 1개)
function generateEmojiBar(leads: number): string {
  return '🟩'.repeat(leads);
}

// 리포트 메시지 생성 (3개 메시지)
export function generateReportMessages(reportData: ReportData, aiInsights: string): string[] {
  const { dates, thisWeek, lastWeek, thisWeekData, topAds, worstAds, campaigns } = reportData;
  const messages: string[] = [];

  // ========== 메시지 1: 헤더 + 주간 성과 + 광고 분석 (Section 1-4) ==========
  let msg1 = `📊 *Meta 광고 주간 리포트*\n`;
  msg1 += `${escapeMd(dates.thisWeekStart)} \\~ ${escapeMd(dates.thisWeekEnd)}\n`;
  msg1 += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

  // Section 1: 이번 주 성과 요약
  msg1 += `📈 *이번 주 성과 요약*\n\n`;
  msg1 += `• 총 리드: ${thisWeek.leads}건\n`;
  msg1 += `• 총 지출: $${escapeMd(thisWeek.spend.toFixed(2))}\n`;
  msg1 += `• 평균 CPL: $${escapeMd(thisWeek.cpl.toFixed(2))}\n`;
  msg1 += `• CTR: ${escapeMd(thisWeek.ctr.toFixed(2))}%\n`;
  msg1 += `• 노출수: ${escapeMd(thisWeek.impressions.toLocaleString())}회\n`;
  msg1 += `• 클릭수: ${escapeMd(thisWeek.clicks.toLocaleString())}회\n\n`;

  // Section 2: 전주 대비 변화
  msg1 += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  msg1 += `🔄 *전주 대비 변화*\n`;
  msg1 += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

  const leadChange = calculateChange(thisWeek.leads, lastWeek.leads);
  const spendChange = calculateChange(thisWeek.spend, lastWeek.spend);
  const cplChange = calculateChange(thisWeek.cpl, lastWeek.cpl);

  msg1 += `• 리드\n`;
  msg1 += `  지난주: ${lastWeek.leads}건 → 이번주: ${thisWeek.leads}건 \\(${escapeMd(leadChange)}\\)\n\n`;
  msg1 += `• 지출\n`;
  msg1 += `  지난주: $${escapeMd(lastWeek.spend.toFixed(2))} → 이번주: $${escapeMd(thisWeek.spend.toFixed(2))} \\(${escapeMd(spendChange)}\\)\n\n`;
  msg1 += `• CPL\n`;
  msg1 += `  지난주: $${escapeMd(lastWeek.cpl.toFixed(2))} → 이번주: $${escapeMd(thisWeek.cpl.toFixed(2))} \\(${escapeMd(cplChange)}\\)\n\n`;

  // Section 3: 일별 성과 추이
  msg1 += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  msg1 += `📅 *일별 성과 추이*\n`;
  msg1 += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

  if (thisWeekData && thisWeekData.length > 0) {
    const dailyStats: Record<string, { leads: number; spend: number }> = {};
    thisWeekData.forEach((row) => {
      if (!dailyStats[row.date]) {
        dailyStats[row.date] = { leads: 0, spend: 0 };
      }
      dailyStats[row.date].leads += row.leads || 0;
      dailyStats[row.date].spend += parseFloat(String(row.spend)) || 0;
    });

    Object.keys(dailyStats)
      .sort()
      .forEach((date) => {
        const stats = dailyStats[date];
        const cpl = stats.leads > 0 ? stats.spend / stats.leads : 0;
        const dayKr = getDayOfWeekKr(date);
        const dateFormatted = date.substring(5).replace('-', '/');
        const bar = generateEmojiBar(stats.leads); // 리드 1개 = 블럭 1개

        msg1 += `${dayKr} ${dateFormatted}  ${stats.leads}건 \\| ${bar}\n`;
        msg1 += `CPL: ${stats.leads > 0 ? '$' + escapeMd(cpl.toFixed(2)) : '\\-'} │ 지출: $${escapeMd(stats.spend.toFixed(2))}\n\n`;
      });
  } else {
    msg1 += `데이터 없음\n\n`;
  }

  // Section 4: TOP 5 광고
  msg1 += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  msg1 += `🏆 *Best Performing 광고 \\(TOP 5\\)*\n`;
  msg1 += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

  topAds.forEach((ad, idx) => {
    msg1 += `${idx + 1}\\. *${escapeMd(ad.ad_name)}*\n`;
    msg1 += `   💰 지출: $${escapeMd(ad.spend.toFixed(2))}\n`;
    msg1 += `   🎯 리드: ${ad.leads}건\n`;
    msg1 += `   💵 CPL: $${escapeMd(ad.cpl.toFixed(2))}\n`;
    msg1 += `   👁 노출: ${escapeMd(ad.impressions.toLocaleString())}회\n`;
    msg1 += `   👆 클릭: ${escapeMd(ad.clicks.toLocaleString())}회\n`;
    msg1 += `   📊 CTR: ${escapeMd(ad.ctr.toFixed(2))}%\n`;
    msg1 += `   ━━━━━━━━━━━━━━━━━━━━━━\n\n`;
  });

  // WORST 2 (평균 대비 150% 이상)
  if (worstAds.length > 0) {
    msg1 += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    msg1 += `⚠️ *개선 필요 광고*\n`;
    msg1 += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    const avgCPL = thisWeek.cpl;
    worstAds.forEach((ad) => {
      const excess = ((ad.cpl - avgCPL) / avgCPL) * 100;
      msg1 += `• *${escapeMd(ad.ad_name)}*\n`;
      msg1 += `  CPL: $${escapeMd(ad.cpl.toFixed(2))} \\(평균 대비 \\+${escapeMd(excess.toFixed(0))}%\\)\n`;
      msg1 += `  리드: ${ad.leads}건 \\| 노출: ${escapeMd(ad.impressions.toLocaleString())}회 \\| 클릭: ${escapeMd(ad.clicks.toLocaleString())}회\n`;
      msg1 += `  CTR: ${escapeMd(ad.ctr.toFixed(2))}%\n`;
      msg1 += `  제안: 타겟팅 재검토 또는 소재 A/B 테스트\n\n`;
    });
  }

  messages.push(msg1);

  // ========== 메시지 2: 캠페인 효율 + AI 인사이트 (Section 5-6) ==========
  let msg2 = `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  msg2 += `💰 *캠페인별 예산 효율성*\n`;
  msg2 += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

  campaigns.forEach((camp) => {
    msg2 += `*${escapeMd(camp.campaign_name)}*\n`;
    msg2 += `• 지출: $${escapeMd(camp.spend.toFixed(2))} \\(${escapeMd(camp.spendPercent.toFixed(1))}%\\)\n`;
    msg2 += `• 리드: ${camp.leads}건 \\(${escapeMd(camp.leadPercent.toFixed(1))}%\\)\n`;
    msg2 += `• CPL: $${escapeMd(camp.cpl.toFixed(2))}\n`;

    const efficiency = camp.leadPercent - camp.spendPercent;
    if (efficiency > 10) {
      msg2 += `• 평가: ✅ 효율적 \\(예산 대비 리드 비율 높음\\)\n\n`;
    } else if (efficiency < -10) {
      msg2 += `• 평가: ⚠️ 검토 필요 \\(예산 대비 리드 비율 낮음\\)\n\n`;
    } else {
      msg2 += `• 평가: 📊 보통 \\(균형적\\)\n\n`;
    }
  });

  // 예산 재배분 제안
  if (campaigns.length >= 2) {
    const sortedByEfficiency = [...campaigns].sort(
      (a, b) => b.leadPercent - b.spendPercent - (a.leadPercent - a.spendPercent)
    );
    const bestCamp = sortedByEfficiency[0];
    const worstCamp = sortedByEfficiency[sortedByEfficiency.length - 1];

    if (bestCamp && worstCamp && bestCamp !== worstCamp) {
      msg2 += `💡 *예산 재배분 제안*\n`;
      msg2 += `• ${escapeMd(bestCamp.campaign_name)} 예산 \\+20% \\(고효율\\)\n`;
      msg2 += `• ${escapeMd(worstCamp.campaign_name)} 예산 \\-20% 또는 소재 개선\n\n`;
    }
  }

  msg2 += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  msg2 += `🤖 *Polarad AI 인사이트*\n`;
  msg2 += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
  msg2 += escapeMd(aiInsights);

  messages.push(msg2);

  // ========== 메시지 3: 푸터 (Section 7) ==========
  let msg3 = `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  msg3 += `📞 *문의하기*\n`;
  msg3 += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
  msg3 += `질문이나 상담이 필요하시면 언제든 연락주세요\\.\n\n`;
  msg3 += `📧 이메일: mkt@polarad\\.co\\.kr\n\n`;
  msg3 += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  msg3 += `🤖 Powered by Polarad AI\n`;
  msg3 += `자동 생성 리포트 \\| 매주 월요일 오전 9시 발송\n`;

  messages.push(msg3);

  return messages;
}

// 변화율 계산
function calculateChange(current: number, previous: number): string {
  if (!previous || previous === 0) return current > 0 ? '+100%' : '-';
  const change = ((current - previous) / previous) * 100;
  return `${change >= 0 ? '+' : ''}${change.toFixed(2)}%`;
}
