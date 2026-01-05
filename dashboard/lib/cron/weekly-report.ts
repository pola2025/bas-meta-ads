/**
 * 주간 리포트 발송 로직 - Vercel Cron용
 *
 * 기존 send-weekly-report.js의 TypeScript 버전 (간소화)
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';

// 타입 정의
interface Client {
  id: string;
  client_name: string;
  slug: string;
  telegram_chat_id: string | null;
  telegram_enabled: boolean;
}

interface WeeklyStats {
  impressions: number;
  clicks: number;
  leads: number;
  spend: number;
  ctr: number;
  cpl: number;
  conversion_rate: number;
}

interface ReportResult {
  client: string;
  status: 'sent' | 'skipped' | 'failed' | 'dry_run';
  reason?: string;
  error?: string;
  chatId?: string;
}

// 대시보드 URL
const DASHBOARD_URL = 'https://bas-meta-ads-git-main-mkt9834-4301s-projects.vercel.app';

/**
 * 날짜 계산 (가장 최근 완료된 주 기준: 월~일)
 */
function getWeekDates(): {
  thisWeekStart: string;
  thisWeekEnd: string;
  lastWeekStart: string;
  lastWeekEnd: string;
} {
  const now = new Date();
  const dayOfWeek = now.getDay();

  const lastSunday = new Date(now);
  lastSunday.setDate(now.getDate() - dayOfWeek);

  const thisWeekStart = new Date(lastSunday);
  thisWeekStart.setDate(lastSunday.getDate() - 6);

  const lastWeekEnd = new Date(thisWeekStart);
  lastWeekEnd.setDate(thisWeekStart.getDate() - 1);

  const lastWeekStart = new Date(lastWeekEnd);
  lastWeekStart.setDate(lastWeekEnd.getDate() - 6);

  const formatDate = (date: Date): string => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  return {
    thisWeekStart: formatDate(thisWeekStart),
    thisWeekEnd: formatDate(lastSunday),
    lastWeekStart: formatDate(lastWeekStart),
    lastWeekEnd: formatDate(lastWeekEnd)
  };
}

/**
 * MarkdownV2 이스케이프
 */
function escapeMd(text: string | number): string {
  if (!text) return '';
  return text.toString().replace(/[-_*[\]()~`>#+\=|{}.!]/g, '\\$&');
}

/**
 * 주간 데이터 조회
 */
async function fetchWeeklyData(
  supabase: SupabaseClient,
  startDate: string,
  endDate: string,
  clientId: string
) {
  const { data, error } = await supabase
    .from('ads_insights_daily')
    .select('*')
    .gte('date', startDate)
    .lte('date', endDate)
    .eq('client_id', clientId)
    .order('date', { ascending: true });

  if (error) {
    console.error('❌ 데이터 조회 오류:', error.message);
    return null;
  }

  return data;
}

/**
 * 주간 통계 계산
 */
function calculateWeeklySummary(data: Array<{
  impressions: number;
  clicks: number;
  leads: number;
  spend: number;
}> | null): WeeklyStats {
  if (!data || data.length === 0) {
    return {
      impressions: 0,
      clicks: 0,
      leads: 0,
      spend: 0,
      ctr: 0,
      cpl: 0,
      conversion_rate: 0
    };
  }

  const totals = data.reduce(
    (acc, row) => {
      acc.impressions += row.impressions || 0;
      acc.clicks += row.clicks || 0;
      acc.leads += row.leads || 0;
      acc.spend += parseFloat(String(row.spend)) || 0;
      return acc;
    },
    { impressions: 0, clicks: 0, leads: 0, spend: 0 }
  );

  const ctr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;
  const cpl = totals.leads > 0 ? totals.spend / totals.leads : 0;
  const conversion_rate = totals.clicks > 0 ? (totals.leads / totals.clicks) * 100 : 0;

  return {
    ...totals,
    ctr,
    cpl,
    conversion_rate
  };
}

/**
 * AI 인사이트 생성 (Gemini)
 */
async function generateAIInsights(
  thisStats: WeeklyStats,
  lastStats: WeeklyStats
): Promise<string | null> {
  if (!process.env.GEMINI_API_KEY) {
    return null;
  }

  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const prompt = `
당신은 Meta 광고 성과를 분석하는 마케팅 전문가입니다.

## 데이터
- 지난 주: 리드 ${lastStats.leads}건, CPL $${lastStats.cpl.toFixed(2)}, CTR ${lastStats.ctr.toFixed(2)}%, 지출 $${lastStats.spend.toFixed(2)}
- 이번 주: 리드 ${thisStats.leads}건, CPL $${thisStats.cpl.toFixed(2)}, CTR ${thisStats.ctr.toFixed(2)}%, 지출 $${thisStats.spend.toFixed(2)}

## 요청
2-3문장으로 간결하게 핵심 인사이트를 제공하세요. 구체적 수치를 포함하세요.
`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error('AI 인사이트 생성 실패:', (error as Error).message);
    return null;
  }
}

/**
 * 텔레그램 메시지 발송
 */
async function sendTelegramMessage(
  botToken: string,
  chatId: string,
  message: string
): Promise<boolean> {
  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'MarkdownV2',
        disable_web_page_preview: true
      })
    });

    const result = await response.json();
    return result.ok;
  } catch (error) {
    console.error('텔레그램 발송 실패:', (error as Error).message);
    return false;
  }
}

/**
 * 중복 발송 체크
 */
async function checkAlreadySent(
  supabase: SupabaseClient,
  clientId: string,
  weekStart: string,
  weekEnd: string
): Promise<boolean> {
  const { data } = await supabase
    .from('telegram_reports')
    .select('id')
    .eq('client_id', clientId)
    .eq('week_start', weekStart)
    .eq('week_end', weekEnd)
    .eq('report_type', 'weekly')
    .single();

  return !!data;
}

/**
 * 리포트 저장
 */
async function saveReport(
  supabase: SupabaseClient,
  clientId: string,
  weekStart: string,
  weekEnd: string,
  thisStats: WeeklyStats,
  aiInsights: string | null
): Promise<void> {
  await supabase.from('telegram_reports').upsert({
    client_id: clientId,
    report_type: 'weekly',
    week_start: weekStart,
    week_end: weekEnd,
    stats: thisStats,
    ai_insights: aiInsights,
    sent_at: new Date().toISOString()
  }, {
    onConflict: 'client_id,week_start,week_end,report_type'
  });
}

/**
 * 단일 클라이언트 리포트 발송
 */
async function sendClientReport(
  supabase: SupabaseClient,
  client: Client,
  dates: ReturnType<typeof getWeekDates>,
  options: { force?: boolean; dryRun?: boolean; skipAI?: boolean }
): Promise<ReportResult> {
  const { force = false, dryRun = false, skipAI = false } = options;

  console.log(`\n📊 ${client.client_name} 리포트 처리 중...`);

  // 중복 체크
  if (!force) {
    const alreadySent = await checkAlreadySent(supabase, client.id, dates.thisWeekStart, dates.thisWeekEnd);
    if (alreadySent) {
      console.log(`⏭️ 이미 발송됨`);
      return { client: client.client_name, status: 'skipped', reason: 'already_sent' };
    }
  }

  // 텔레그램 비활성화 체크
  if (client.telegram_enabled === false) {
    console.log(`⏭️ 텔레그램 비활성화`);
    return { client: client.client_name, status: 'skipped', reason: 'telegram_disabled' };
  }

  // 채팅 ID 체크
  if (!client.telegram_chat_id) {
    console.log(`⏭️ telegram_chat_id 미설정`);
    return { client: client.client_name, status: 'skipped', reason: 'no_chat_id' };
  }

  // 데이터 조회
  const [thisWeekData, lastWeekData] = await Promise.all([
    fetchWeeklyData(supabase, dates.thisWeekStart, dates.thisWeekEnd, client.id),
    fetchWeeklyData(supabase, dates.lastWeekStart, dates.lastWeekEnd, client.id)
  ]);

  const thisStats = calculateWeeklySummary(thisWeekData);
  const lastStats = calculateWeeklySummary(lastWeekData);

  // 데이터 없음 체크
  if (thisStats.leads === 0 && thisStats.spend === 0) {
    console.log(`⚠️ 이번 주 데이터 없음`);
    return { client: client.client_name, status: 'skipped', reason: 'no_data' };
  }

  console.log(`✅ 데이터: 리드 ${thisStats.leads}건, 지출 $${thisStats.spend.toFixed(2)}`);

  // AI 인사이트 (옵션)
  let aiInsights: string | null = null;
  if (!skipAI) {
    aiInsights = await generateAIInsights(thisStats, lastStats);
  }

  // 메시지 생성
  const reportUrl = `${DASHBOARD_URL}/reports?client=${client.slug}`;

  let message = `📊 *${escapeMd(client.client_name)} 주간 리포트*\n`;
  message += `${escapeMd(dates.thisWeekStart)} \\~ ${escapeMd(dates.thisWeekEnd)}\n\n`;
  message += `💰 $${escapeMd(thisStats.spend.toFixed(0))} \\| 🎯 ${thisStats.leads}건 \\| CPL $${escapeMd(thisStats.cpl.toFixed(2))}\n\n`;
  message += `📊 [상세보기](${reportUrl})\n`;

  // DRY_RUN 모드
  if (dryRun) {
    console.log(`🧪 DRY_RUN 모드 - 발송 생략`);
    await saveReport(supabase, client.id, dates.thisWeekStart, dates.thisWeekEnd, thisStats, aiInsights);
    return { client: client.client_name, status: 'dry_run', chatId: client.telegram_chat_id };
  }

  // 내일채움 전용 봇 토큰
  const NAEILCHAEUM_BOT_TOKEN = '7963284811:AAGBE0V2dt_Ht6KmhJmntxH_kbw5XqoiEiE';
  const botToken = client.client_name === '내일채움'
    ? NAEILCHAEUM_BOT_TOKEN
    : process.env.TELEGRAM_BOT_TOKEN!;

  // 발송
  const sent = await sendTelegramMessage(botToken, client.telegram_chat_id, message);

  if (sent) {
    console.log(`✅ 발송 완료`);
    await saveReport(supabase, client.id, dates.thisWeekStart, dates.thisWeekEnd, thisStats, aiInsights);
    return { client: client.client_name, status: 'sent', chatId: client.telegram_chat_id };
  } else {
    console.log(`❌ 발송 실패`);
    return { client: client.client_name, status: 'failed', error: 'Telegram send failed' };
  }
}

/**
 * 메인 주간 리포트 함수
 */
export async function sendWeeklyReports(options: {
  clientName?: string;
  force?: boolean;
  dryRun?: boolean;
  skipAI?: boolean;
} = {}): Promise<{
  success: boolean;
  results: ReportResult[];
  dates: ReturnType<typeof getWeekDates>;
}> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const dates = getWeekDates();

  console.log('📊 주간 리포트 발송 시작');
  console.log(`📅 기간: ${dates.thisWeekStart} ~ ${dates.thisWeekEnd}`);

  // 클라이언트 조회
  let query = supabase
    .from('clients')
    .select('id, client_name, slug, telegram_chat_id, telegram_enabled')
    .eq('is_active', true);

  if (options.clientName) {
    query = query.eq('client_name', options.clientName);
  }

  const { data: clients, error } = await query.order('client_name');

  if (error) {
    console.error('❌ 클라이언트 조회 오류:', error.message);
    throw new Error(error.message);
  }

  if (!clients || clients.length === 0) {
    console.log('❌ 대상 클라이언트 없음');
    return { success: true, results: [], dates };
  }

  console.log(`👥 대상 클라이언트: ${clients.length}개`);

  const results: ReportResult[] = [];

  for (let i = 0; i < clients.length; i++) {
    const client = clients[i] as Client;

    try {
      const result = await sendClientReport(supabase, client, dates, options);
      results.push(result);
    } catch (error) {
      console.error(`❌ ${client.client_name} 오류:`, (error as Error).message);
      results.push({
        client: client.client_name,
        status: 'failed',
        error: (error as Error).message
      });
    }

    // Rate limit 방지
    if (i < clients.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }

  // 결과 요약
  const sent = results.filter(r => r.status === 'sent').length;
  const skipped = results.filter(r => r.status === 'skipped').length;
  const failed = results.filter(r => r.status === 'failed').length;

  console.log(`\n📊 발송 결과: 성공 ${sent}, 생략 ${skipped}, 실패 ${failed}`);

  // 관리자 알림 (실패가 있을 때)
  if (failed > 0) {
    const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
    const botToken = process.env.TELEGRAM_BOT_TOKEN;

    if (adminChatId && botToken) {
      const failedClients = results.filter(r => r.status === 'failed');
      const message = `🚨 *주간 리포트 발송 실패*\n\n` +
        `📅 ${dates.thisWeekStart} ~ ${dates.thisWeekEnd}\n\n` +
        `❌ 실패 클라이언트:\n` +
        failedClients.map(r => `• ${r.client}: ${r.error}`).join('\n');

      await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: adminChatId,
          text: message,
          parse_mode: 'Markdown'
        })
      });
    }
  }

  return {
    success: failed === 0,
    results,
    dates
  };
}
