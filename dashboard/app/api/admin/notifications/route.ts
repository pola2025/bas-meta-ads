/**
 * Admin API - 알림 히스토리 관리
 *
 * GET:  알림 로그 조회
 * DELETE: 오래된 알림 삭제
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

// 관리자 키 검증
function isAdmin(request: NextRequest): boolean {
  const adminKey = request.headers.get('x-admin-key');
  return adminKey === process.env.NEXT_PUBLIC_ADMIN_KEY;
}

// GET: 알림 로그 조회
export async function GET(request: NextRequest) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const clientId = searchParams.get('client_id');
    const type = searchParams.get('type');

    // 쿼리 빌더
    let query = supabaseAdmin
      .from('notification_logs')
      .select(`
        id,
        client_id,
        notification_type,
        message,
        sent_at,
        created_at,
        clients!inner(client_name)
      `, { count: 'exact' })
      .order('sent_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // 필터 적용
    if (clientId) {
      query = query.eq('client_id', clientId);
    }
    if (type) {
      query = query.eq('notification_type', type);
    }

    const { data, error, count } = await query;

    if (error) {
      // 테이블이 없는 경우 빈 배열 반환
      if (error.message.includes('does not exist')) {
        return NextResponse.json({
          success: true,
          notifications: [],
          total: 0,
          stats: { total: 0, today: 0, byType: {} }
        });
      }
      throw error;
    }

    // 통계 계산
    const today = new Date().toISOString().split('T')[0];
    const { data: statsData } = await supabaseAdmin
      .from('notification_logs')
      .select('notification_type, sent_at');

    const stats = {
      total: statsData?.length || 0,
      today: statsData?.filter(n => n.sent_at?.startsWith(today)).length || 0,
      byType: {} as Record<string, number>
    };

    statsData?.forEach(n => {
      const type = n.notification_type || 'unknown';
      stats.byType[type] = (stats.byType[type] || 0) + 1;
    });

    // 클라이언트 이름 추출
    const notifications = (data || []).map(n => ({
      id: n.id,
      clientId: n.client_id,
      clientName: (n.clients as any)?.client_name || 'Unknown',
      type: n.notification_type,
      message: n.message,
      sentAt: n.sent_at,
      createdAt: n.created_at
    }));

    return NextResponse.json({
      success: true,
      notifications,
      total: count || 0,
      stats
    });
  } catch (error: any) {
    console.error('Notifications API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE: 오래된 알림 삭제
export async function DELETE(request: NextRequest) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '30');

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const { data, error } = await supabaseAdmin
      .from('notification_logs')
      .delete()
      .lt('sent_at', cutoffDate.toISOString())
      .select('id');

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      deleted: data?.length || 0,
      message: `${days}일 이전 알림 ${data?.length || 0}개 삭제됨`
    });
  } catch (error: any) {
    console.error('Delete notifications error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
