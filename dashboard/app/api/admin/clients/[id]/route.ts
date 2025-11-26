/**
 * Admin API - 개별 클라이언트 관리
 *
 * GET:    클라이언트 상세 조회
 * PATCH:  클라이언트 정보 수정
 * DELETE: 클라이언트 삭제 (비활성화)
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { encrypt } from '@/lib/encryption';

// 관리자 키 검증
function isAdmin(request: NextRequest): boolean {
  const adminKey = request.headers.get('x-admin-key');
  return adminKey === process.env.NEXT_PUBLIC_ADMIN_KEY;
}

// 서비스 종료일 계산 (시작일 + 3개월 - 1일)
function calculateEndDate(startDate: string): string {
  const start = new Date(startDate);
  const end = new Date(start);
  end.setMonth(end.getMonth() + 3);
  end.setDate(end.getDate() - 1);
  return end.toISOString().split('T')[0];
}

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET: 클라이언트 상세 조회
export async function GET(request: NextRequest, { params }: RouteParams) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    // 클라이언트 기본 정보
    const { data: client, error } = await supabaseAdmin
      .from('clients')
      .select(`
        id,
        client_id,
        client_name,
        email,
        meta_ad_account_id,
        telegram_chat_id,
        plan_type,
        is_active,
        auth_status,
        service_start_date,
        service_end_date,
        telegram_enabled,
        created_at,
        updated_at
      `)
      .eq('id', id)
      .single();

    if (error || !client) {
      return NextResponse.json({ error: '클라이언트를 찾을 수 없습니다.' }, { status: 404 });
    }

    // 데이터 현황 조회
    const { count: totalCount } = await supabaseAdmin
      .from('raw_data')
      .select('*', { count: 'exact', head: true })
      .eq('client_id', id);

    // 데이터 범위 조회
    const { data: dateRange } = await supabaseAdmin
      .from('raw_data')
      .select('date')
      .eq('client_id', id)
      .order('date', { ascending: true })
      .limit(1);

    const { data: latestDate } = await supabaseAdmin
      .from('raw_data')
      .select('date')
      .eq('client_id', id)
      .order('date', { ascending: false })
      .limit(1);

    // 최근 7일 성과 요약
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const since = sevenDaysAgo.toISOString().split('T')[0];

    const { data: recentData } = await supabaseAdmin
      .from('raw_data')
      .select('impressions, clicks, leads, spend')
      .eq('client_id', id)
      .gte('date', since);

    let recent7DaysStats = null;
    if (recentData && recentData.length > 0) {
      const totals = recentData.reduce(
        (acc, row) => ({
          impressions: acc.impressions + (row.impressions || 0),
          clicks: acc.clicks + (row.clicks || 0),
          leads: acc.leads + (row.leads || 0),
          spend: acc.spend + (parseFloat(row.spend as any) || 0),
        }),
        { impressions: 0, clicks: 0, leads: 0, spend: 0 }
      );

      const ctr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;
      const cpl = totals.leads > 0 ? totals.spend / totals.leads : 0;

      recent7DaysStats = {
        ...totals,
        ctr: parseFloat(ctr.toFixed(2)),
        cpl: parseFloat(cpl.toFixed(0)),
      };
    }

    // 최근 리포트 조회
    const { data: reports } = await supabaseAdmin
      .from('telegram_reports')
      .select('report_type, week_start, week_end, sent_at')
      .eq('client_id', id)
      .order('sent_at', { ascending: false })
      .limit(5);

    // 목표값 조회
    const currentMonth = new Date().toISOString().slice(0, 7) + '-01';
    const { data: targets } = await supabaseAdmin
      .from('client_targets')
      .select('target_leads, target_spend, target_cpl')
      .eq('client_id', id)
      .eq('target_month', currentMonth)
      .single();

    return NextResponse.json({
      success: true,
      client: {
        ...client,
        targets: targets || null,
      },
      dataStats: {
        totalRecords: totalCount || 0,
        dateRange: {
          start: dateRange?.[0]?.date || null,
          end: latestDate?.[0]?.date || null,
        },
      },
      recent7Days: recent7DaysStats,
      recentReports: reports || [],
    });
  } catch (error: any) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH: 클라이언트 정보 수정
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const body = await request.json();
    const {
      client_name,
      email,
      meta_ad_account_id,
      meta_access_token, // 새 토큰 (암호화하여 저장)
      telegram_chat_id,
      plan_type,
      is_active,
      target_leads,
      target_spend,
      target_cpl,
      service_start_date,
      service_end_date,
      telegram_enabled,
      unlimited_service,
    } = body;

    // 업데이트 데이터 구성
    const updateData: Record<string, any> = { updated_at: new Date().toISOString() };

    if (client_name !== undefined) updateData.client_name = client_name;
    if (email !== undefined) updateData.email = email;
    if (meta_ad_account_id !== undefined) updateData.meta_ad_account_id = meta_ad_account_id;
    if (telegram_chat_id !== undefined) updateData.telegram_chat_id = telegram_chat_id;
    if (plan_type !== undefined) updateData.plan_type = plan_type;
    if (is_active !== undefined) updateData.is_active = is_active;
    if (telegram_enabled !== undefined) updateData.telegram_enabled = telegram_enabled;

    // 새 토큰이 있으면 암호화하여 저장
    if (meta_access_token) {
      try {
        updateData.encrypted_access_token = encrypt(meta_access_token);
        updateData.auth_status = 'active';
      } catch (encryptError) {
        console.error('Encryption error:', encryptError);
      }
    }

    // 서비스 기간 처리
    if (service_start_date !== undefined) {
      updateData.service_start_date = service_start_date;
    }

    if (unlimited_service === true) {
      updateData.service_end_date = null;
    } else if (service_end_date !== undefined) {
      if (service_end_date) {
        updateData.service_end_date = service_end_date;
      } else if (service_start_date) {
        updateData.service_end_date = calculateEndDate(service_start_date);
      }
    }

    // 클라이언트 업데이트
    const { data: updatedClient, error: updateError } = await supabaseAdmin
      .from('clients')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating client:', updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // 목표값 업데이트
    if (target_leads !== undefined || target_spend !== undefined || target_cpl !== undefined) {
      const currentMonth = new Date().toISOString().slice(0, 7) + '-01';
      await supabaseAdmin.from('client_targets').upsert({
        client_id: id,
        target_month: currentMonth,
        target_leads: target_leads || null,
        target_spend: target_spend || null,
        target_cpl: target_cpl || null,
      });
    }

    return NextResponse.json({ success: true, client: updatedClient });
  } catch (error: any) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE: 클라이언트 삭제 (soft delete - 비활성화)
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const { searchParams } = new URL(request.url);
    const hardDelete = searchParams.get('hard') === 'true';

    if (hardDelete) {
      // 완전 삭제
      const { error } = await supabaseAdmin.from('clients').delete().eq('id', id);

      if (error) {
        console.error('Error deleting client:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, message: '클라이언트가 완전히 삭제되었습니다.' });
    } else {
      // 비활성화 (soft delete)
      const { error } = await supabaseAdmin
        .from('clients')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) {
        console.error('Error deactivating client:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, message: '클라이언트가 비활성화되었습니다.' });
    }
  } catch (error: any) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
