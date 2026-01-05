import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const maxDuration = 30;

// Vercel Cron 인증 확인
function verifyCronAuth(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  // Vercel Cron은 자동으로 CRON_SECRET을 Bearer 토큰으로 전송
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
    return true;
  }

  // 개발 환경에서는 인증 스킵
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
  const results: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    checks: {}
  };

  try {
    // 1. Supabase 연결 확인
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: clientCount, error: clientError } = await supabase
      .from('clients')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true);

    results.checks = {
      ...results.checks as object,
      supabase: {
        status: clientError ? 'error' : 'ok',
        activeClients: clientError ? null : clientCount,
        error: clientError?.message
      }
    };

    // 2. 환경변수 확인
    const requiredEnvs = [
      'NEXT_PUBLIC_SUPABASE_URL',
      'SUPABASE_SERVICE_ROLE_KEY',
      'TELEGRAM_BOT_TOKEN',
      'TOKEN_ENCRYPTION_KEY'
    ];

    const envStatus: Record<string, boolean> = {};
    requiredEnvs.forEach(env => {
      envStatus[env] = !!process.env[env];
    });

    results.checks = {
      ...results.checks as object,
      environment: {
        status: Object.values(envStatus).every(v => v) ? 'ok' : 'warning',
        variables: envStatus
      }
    };

    // 3. 최근 데이터 수집 확인 (어제 데이터 존재 여부)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    const { count: rawDataCount, error: rawError } = await supabase
      .from('raw_data')
      .select('*', { count: 'exact', head: true })
      .eq('date', yesterdayStr);

    results.checks = {
      ...results.checks as object,
      dataCollection: {
        status: rawError ? 'error' : (rawDataCount && rawDataCount > 0 ? 'ok' : 'warning'),
        date: yesterdayStr,
        recordCount: rawDataCount || 0,
        error: rawError?.message
      }
    };

    // 4. 텔레그램 봇 확인
    let telegramStatus = 'unknown';
    try {
      const botToken = process.env.TELEGRAM_BOT_TOKEN;
      if (botToken) {
        const response = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
        const botInfo = await response.json();
        telegramStatus = botInfo.ok ? 'ok' : 'error';
        results.checks = {
          ...results.checks as object,
          telegram: {
            status: telegramStatus,
            botUsername: botInfo.result?.username
          }
        };
      } else {
        results.checks = {
          ...results.checks as object,
          telegram: { status: 'missing_token' }
        };
      }
    } catch {
      results.checks = {
        ...results.checks as object,
        telegram: { status: 'error' }
      };
    }

    // 최종 상태 계산
    const checks = results.checks as Record<string, { status: string }>;
    const allStatuses = Object.values(checks).map(c => c.status);
    const hasError = allStatuses.includes('error');
    const hasWarning = allStatuses.includes('warning');

    results.status = hasError ? 'unhealthy' : hasWarning ? 'degraded' : 'healthy';
    results.duration = `${Date.now() - startTime}ms`;

    // 텔레그램 알림 (문제 있을 때만)
    if (hasError || hasWarning) {
      const botToken = process.env.TELEGRAM_BOT_TOKEN;
      const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID;

      if (botToken && adminChatId) {
        const message = `⚠️ **[BAS] 헬스체크 ${results.status}**\n\n` +
          `시간: ${results.timestamp}\n` +
          `상태: ${results.status}\n\n` +
          Object.entries(checks)
            .map(([key, val]) => `• ${key}: ${val.status}`)
            .join('\n');

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

    return NextResponse.json(results);

  } catch (error) {
    return NextResponse.json({
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
      duration: `${Date.now() - startTime}ms`
    }, { status: 500 });
  }
}
