import { NextRequest, NextResponse } from 'next/server';
import { collectAllClientsData } from '@/lib/cron/data-collection';

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
    // URL 파라미터에서 days 추출 (기본: 7)
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '7');

    console.log(`🚀 데이터 수집 시작 (${days}일)`);

    const result = await collectAllClientsData(days);

    const duration = Date.now() - startTime;

    return NextResponse.json({
      success: result.success,
      duration: `${duration}ms`,
      dateRange: result.dateRange,
      summary: {
        success: result.results.success.length,
        failed: result.results.failed.length,
        skipped: result.results.skipped.length,
        totalFetched: result.results.success.reduce((sum, r) => sum + r.fetched, 0),
        totalSaved: result.results.success.reduce((sum, r) => sum + r.saved, 0)
      },
      details: result.results
    });

  } catch (error) {
    const duration = Date.now() - startTime;

    console.error('❌ 데이터 수집 실패:', error);

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      duration: `${duration}ms`
    }, { status: 500 });
  }
}
