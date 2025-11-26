/**
 * Admin API - 시스템 상태 조회
 *
 * GET: 시스템 전체 상태 (클라이언트 현황, 데이터 현황, 최근 활동)
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

// 관리자 키 검증
function isAdmin(request: NextRequest): boolean {
  const adminKey = request.headers.get('x-admin-key');
  return adminKey === process.env.NEXT_PUBLIC_ADMIN_KEY;
}

// GET: 시스템 전체 상태
export async function GET(request: NextRequest) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // 1. 클라이언트 현황
    const { data: clients, error: clientsError } = await supabaseAdmin
      .from('clients')
      .select('id, client_name, is_active, telegram_chat_id, service_end_date');

    if (clientsError) {
      throw clientsError;
    }

    const totalClients = clients?.length || 0;
    const activeClients = clients?.filter((c) => c.is_active).length || 0;
    const withTelegram = clients?.filter((c) => c.telegram_chat_id).length || 0;

    // 서비스 만료 예정 클라이언트 (7일 이내)
    const now = new Date();
    const sevenDaysLater = new Date(now);
    sevenDaysLater.setDate(sevenDaysLater.getDate() + 7);

    const expiringClients =
      clients?.filter((c) => {
        if (!c.service_end_date || !c.is_active) return false;
        const endDate = new Date(c.service_end_date);
        return endDate <= sevenDaysLater && endDate >= now;
      }) || [];

    // 2. 오늘 수집 데이터
    const today = new Date().toISOString().split('T')[0];
    const { count: todayDataCount } = await supabaseAdmin
      .from('raw_data')
      .select('*', { count: 'exact', head: true })
      .eq('date', today);

    // 3. 어제 수집 데이터
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    const { count: yesterdayDataCount } = await supabaseAdmin
      .from('raw_data')
      .select('*', { count: 'exact', head: true })
      .eq('date', yesterdayStr);

    // 4. 최근 7일 전체 데이터
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const since = sevenDaysAgo.toISOString().split('T')[0];

    const { data: recentData } = await supabaseAdmin
      .from('raw_data')
      .select('impressions, clicks, leads, spend')
      .gte('date', since);

    let recent7DaysTotals = { impressions: 0, clicks: 0, leads: 0, spend: 0 };
    if (recentData && recentData.length > 0) {
      recent7DaysTotals = recentData.reduce(
        (acc, row) => ({
          impressions: acc.impressions + (row.impressions || 0),
          clicks: acc.clicks + (row.clicks || 0),
          leads: acc.leads + (row.leads || 0),
          spend: acc.spend + (parseFloat(row.spend as any) || 0),
        }),
        { impressions: 0, clicks: 0, leads: 0, spend: 0 }
      );
    }

    // 5. 최근 리포트 발송 현황
    const { data: recentReports } = await supabaseAdmin
      .from('telegram_reports')
      .select('id, client_id, report_type, sent_at')
      .order('sent_at', { ascending: false })
      .limit(10);

    const latestReport = recentReports?.[0] || null;

    // 6. 클라이언트별 최신 데이터 현황
    const clientDataStatus = await Promise.all(
      (clients || [])
        .filter((c) => c.is_active)
        .map(async (client) => {
          const { data: latestData } = await supabaseAdmin
            .from('raw_data')
            .select('date')
            .eq('client_id', client.id)
            .order('date', { ascending: false })
            .limit(1);

          return {
            id: client.id,
            name: client.client_name,
            latestDate: latestData?.[0]?.date || null,
            hasTelegram: !!client.telegram_chat_id,
          };
        })
    );

    // 데이터 누락 클라이언트 (2일 이상 데이터 없음)
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
    const twoDaysAgoStr = twoDaysAgo.toISOString().split('T')[0];

    const missingDataClients = clientDataStatus.filter((c) => {
      if (!c.latestDate) return true;
      return c.latestDate < twoDaysAgoStr;
    });

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),

      // 클라이언트 현황
      clients: {
        total: totalClients,
        active: activeClients,
        inactive: totalClients - activeClients,
        withTelegram,
        expiringSoon: expiringClients.length,
        expiringList: expiringClients.map((c) => ({
          id: c.id,
          name: c.client_name,
          endDate: c.service_end_date,
        })),
      },

      // 데이터 수집 현황
      dataCollection: {
        todayRecords: todayDataCount || 0,
        yesterdayRecords: yesterdayDataCount || 0,
        missingDataClients: missingDataClients.length,
        missingList: missingDataClients.map((c) => ({
          id: c.id,
          name: c.name,
          lastDate: c.latestDate,
        })),
      },

      // 최근 7일 전체 성과
      recent7Days: {
        impressions: recent7DaysTotals.impressions,
        clicks: recent7DaysTotals.clicks,
        leads: recent7DaysTotals.leads,
        spend: Math.round(recent7DaysTotals.spend),
        ctr:
          recent7DaysTotals.impressions > 0
            ? parseFloat(
                ((recent7DaysTotals.clicks / recent7DaysTotals.impressions) * 100).toFixed(2)
              )
            : 0,
        cpl:
          recent7DaysTotals.leads > 0
            ? Math.round(recent7DaysTotals.spend / recent7DaysTotals.leads)
            : 0,
      },

      // 리포트 현황
      reports: {
        latestSentAt: latestReport?.sent_at || null,
        latestType: latestReport?.report_type || null,
        recentCount: recentReports?.length || 0,
      },

      // 클라이언트별 데이터 현황
      clientDataStatus,
    });
  } catch (error: any) {
    console.error('Status API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
