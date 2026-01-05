import { NextRequest, NextResponse } from 'next/server';
import { sendMonthlyReports } from '@/lib/cron/monthly-report';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5분

// Vercel Cron 인증 확인
function verifyCronAuth(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
    return true;
  }

  if (process.env.NODE_ENV === 'development') {
    return true;
  }

  return false;
}

export async function GET(request: NextRequest) {
  // 인증 확인
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startTime = Date.now();

  try {
    // URL 파라미터 추출
    const { searchParams } = new URL(request.url);
    const clientName = searchParams.get('client') || undefined;
    const targetMonth = searchParams.get('month') || undefined; // YYYY-MM 형식
    const force = searchParams.get('force') === 'true';
    const dryRun = searchParams.get('dry_run') === 'true';

    console.log('🚀 월간 리포트 발송 시작');
    if (clientName) console.log(`   대상: ${clientName}`);
    if (targetMonth) console.log(`   월: ${targetMonth}`);
    if (force) console.log(`   모드: 강제 재발송`);
    if (dryRun) console.log(`   모드: DRY_RUN`);

    const result = await sendMonthlyReports({
      clientName,
      targetMonth,
      force,
      dryRun
    });

    const duration = Date.now() - startTime;

    const sent = result.results.filter(r => r.status === 'sent').length;
    const skipped = result.results.filter(r => r.status === 'skipped').length;
    const failed = result.results.filter(r => r.status === 'failed').length;

    return NextResponse.json({
      success: result.success,
      duration: `${duration}ms`,
      period: {
        month: result.dates.thisMonth,
        start: result.dates.thisMonthStart,
        end: result.dates.thisMonthEnd
      },
      summary: {
        total: result.results.length,
        sent,
        skipped,
        failed
      },
      results: result.results
    });

  } catch (error) {
    const duration = Date.now() - startTime;

    console.error('❌ 월간 리포트 발송 실패:', error);

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      duration: `${duration}ms`
    }, { status: 500 });
  }
}
