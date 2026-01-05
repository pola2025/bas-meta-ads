/**
 * 월간 리포트 발송 로직 - Vercel Cron용
 *
 * 기존 send-monthly-report.js의 TypeScript 버전 (간소화)
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// 타입 정의
interface Client {
  id: string;
  client_name: string;
  slug: string;
  telegram_chat_id: string | null;
  telegram_enabled: boolean;
}

interface MonthlyStats {
  impressions: number;
  clicks: number;
  leads: number;
  spend: number;
  ctr: number;
  cpl: number;
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
 * 월간 날짜 계산
 */
function getMonthDates(targetMonth?: string): {
  thisMonth: string;
  thisMonthStart: string;
  thisMonthEnd: string;
  prevMonth: string;
  prevMonthStart: string;
  prevMonthEnd: string;
} {
  const now = new Date();
  let year: number, month: number;

  if (targetMonth) {
    [year, month] = targetMonth.split('-').map(Number);
  } else {
    // 기본: 전월
    year = now.getFullYear();
    month = now.getMonth(); // 0-indexed
    if (month === 0) {
      month = 12;
      year--;
    }
  }

  const formatDate = (date: Date): string => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);

  const prevYear = month === 1 ? year - 1 : year;
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevFirstDay = new Date(prevYear, prevMonth - 1, 1);
  const prevLastDay = new Date(prevYear, prevMonth, 0);

  return {
    thisMonth: `${year}-${String(month).padStart(2, '0')}`,
    thisMonthStart: formatDate(firstDay),
    thisMonthEnd: formatDate(lastDay),
    prevMonth: `${prevYear}-${String(prevMonth).padStart(2, '0')}`,
    prevMonthStart: formatDate(prevFirstDay),
    prevMonthEnd: formatDate(prevLastDay)
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
 * 월간 데이터 조회
 */
async function fetchMonthlyData(
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
 * 월간 통계 계산
 */
function calculateMonthlySummary(data: Array<{
  impressions: number;
  clicks: number;
  leads: number;
  spend: number;
}> | null): MonthlyStats {
  if (!data || data.length === 0) {
    return {
      impressions: 0,
      clicks: 0,
      leads: 0,
      spend: 0,
      ctr: 0,
      cpl: 0
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

  return {
    ...totals,
    ctr: totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0,
    cpl: totals.leads > 0 ? totals.spend / totals.leads : 0
  };
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
  month: string
): Promise<boolean> {
  const { data } = await supabase
    .from('telegram_reports')
    .select('id')
    .eq('client_id', clientId)
    .eq('report_type', 'monthly')
    .eq('week_start', `${month}-01`)
    .single();

  return !!data;
}

/**
 * 리포트 저장
 */
async function saveReport(
  supabase: SupabaseClient,
  clientId: string,
  month: string,
  monthStart: string,
  monthEnd: string,
  thisStats: MonthlyStats
): Promise<void> {
  await supabase.from('telegram_reports').upsert({
    client_id: clientId,
    report_type: 'monthly',
    week_start: monthStart,
    week_end: monthEnd,
    stats: thisStats,
    sent_at: new Date().toISOString()
  }, {
    onConflict: 'client_id,week_start,week_end,report_type'
  });
}

/**
 * 변화율 계산
 */
function calculateChange(current: number, previous: number): string {
  if (!previous || previous === 0) return current > 0 ? '+∞' : '-';
  const change = ((current - previous) / previous) * 100;
  return `${change >= 0 ? '+' : ''}${change.toFixed(1)}%`;
}

/**
 * 단일 클라이언트 리포트 발송
 */
async function sendClientReport(
  supabase: SupabaseClient,
  client: Client,
  dates: ReturnType<typeof getMonthDates>,
  options: { force?: boolean; dryRun?: boolean }
): Promise<ReportResult> {
  const { force = false, dryRun = false } = options;

  console.log(`\n📊 ${client.client_name} 월간 리포트 처리 중...`);

  // 중복 체크
  if (!force) {
    const alreadySent = await checkAlreadySent(supabase, client.id, dates.thisMonth);
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
  const [thisMonthData, prevMonthData] = await Promise.all([
    fetchMonthlyData(supabase, dates.thisMonthStart, dates.thisMonthEnd, client.id),
    fetchMonthlyData(supabase, dates.prevMonthStart, dates.prevMonthEnd, client.id)
  ]);

  const thisStats = calculateMonthlySummary(thisMonthData);
  const prevStats = calculateMonthlySummary(prevMonthData);

  // 데이터 없음 체크
  if (thisStats.leads === 0 && thisStats.spend === 0) {
    console.log(`⚠️ 이번 달 데이터 없음`);
    return { client: client.client_name, status: 'skipped', reason: 'no_data' };
  }

  console.log(`✅ 데이터: 리드 ${thisStats.leads}건, 지출 $${thisStats.spend.toFixed(2)}`);

  // 메시지 생성
  const reportUrl = `${DASHBOARD_URL}/reports?client=${client.slug}`;
  const month = dates.thisMonth.split('-')[1];

  let message = `📊 *${escapeMd(client.client_name)} ${month}월 리포트*\n\n`;
  message += `💰 지출: $${escapeMd(thisStats.spend.toFixed(0))} \\(${escapeMd(calculateChange(thisStats.spend, prevStats.spend))}\\)\n`;
  message += `🎯 리드: ${thisStats.leads}건 \\(${escapeMd(calculateChange(thisStats.leads, prevStats.leads))}\\)\n`;
  message += `📈 CPL: $${escapeMd(thisStats.cpl.toFixed(2))} \\(${escapeMd(calculateChange(thisStats.cpl, prevStats.cpl))}\\)\n\n`;
  message += `📊 [상세보기](${reportUrl})\n`;

  // DRY_RUN 모드
  if (dryRun) {
    console.log(`🧪 DRY_RUN 모드 - 발송 생략`);
    await saveReport(supabase, client.id, dates.thisMonth, dates.thisMonthStart, dates.thisMonthEnd, thisStats);
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
    await saveReport(supabase, client.id, dates.thisMonth, dates.thisMonthStart, dates.thisMonthEnd, thisStats);
    return { client: client.client_name, status: 'sent', chatId: client.telegram_chat_id };
  } else {
    console.log(`❌ 발송 실패`);
    return { client: client.client_name, status: 'failed', error: 'Telegram send failed' };
  }
}

/**
 * 메인 월간 리포트 함수
 */
export async function sendMonthlyReports(options: {
  clientName?: string;
  targetMonth?: string;
  force?: boolean;
  dryRun?: boolean;
} = {}): Promise<{
  success: boolean;
  results: ReportResult[];
  dates: ReturnType<typeof getMonthDates>;
}> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const dates = getMonthDates(options.targetMonth);

  console.log('📊 월간 리포트 발송 시작');
  console.log(`📅 대상 월: ${dates.thisMonth}`);

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
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  // 결과 요약
  const sent = results.filter(r => r.status === 'sent').length;
  const skipped = results.filter(r => r.status === 'skipped').length;
  const failed = results.filter(r => r.status === 'failed').length;

  console.log(`\n📊 발송 결과: 성공 ${sent}, 생략 ${skipped}, 실패 ${failed}`);

  return {
    success: failed === 0,
    results,
    dates
  };
}
