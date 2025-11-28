import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// 관리자 키 검증
function validateAdmin(request: NextRequest): boolean {
  const adminKey = request.headers.get('x-admin-key');
  return adminKey === process.env.NEXT_PUBLIC_ADMIN_KEY;
}

// D-day 계산
function getDday(endDate: string | null): number | null {
  if (!endDate) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);
  return Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

// GET: 연장관리 목록 조회
export async function GET(request: NextRequest) {
  if (!validateAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { data: clients, error } = await supabase
      .from('clients')
      .select('id, client_name, contact_phone, contact_name, service_start_date, service_end_date, is_active, telegram_chat_id')
      .not('service_end_date', 'is', null)  // 무제한(service_end_date가 null) 클라이언트 제외
      .order('service_end_date', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // D-day 및 상태 추가
    const enrichedClients = (clients || []).map(client => {
      const dday = getDday(client.service_end_date);
      let status = 'normal';
      if (dday === null) status = 'unknown';
      else if (dday < 0) status = 'expired';
      else if (dday <= 3) status = 'urgent';
      else if (dday <= 7) status = 'warning';

      return {
        ...client,
        dday,
        status,
      };
    });

    // 무제한 클라이언트 수 조회
    const { count: unlimitedCount } = await supabase
      .from('clients')
      .select('*', { count: 'exact', head: true })
      .is('service_end_date', null);

    // 통계
    const stats = {
      total: enrichedClients.length,
      active: enrichedClients.filter(c => c.is_active).length,
      expiringSoon: enrichedClients.filter(c => c.dday !== null && c.dday >= 0 && c.dday <= 7).length,
      expired: enrichedClients.filter(c => c.dday !== null && c.dday < 0).length,
      noContact: enrichedClients.filter(c => !c.contact_phone).length,
      unlimited: unlimitedCount || 0,
    };

    return NextResponse.json({ clients: enrichedClients, stats });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// PATCH: 클라이언트 정보 업데이트 (연락처, 종료일 등)
export async function PATCH(request: NextRequest) {
  if (!validateAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { id, contact_phone, contact_name, service_end_date, is_active } = body;

    if (!id) {
      return NextResponse.json({ error: 'Client ID required' }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {};
    if (contact_phone !== undefined) updateData.contact_phone = contact_phone;
    if (contact_name !== undefined) updateData.contact_name = contact_name;
    if (service_end_date !== undefined) updateData.service_end_date = service_end_date;
    if (is_active !== undefined) updateData.is_active = is_active;

    const { data, error } = await supabase
      .from('clients')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, client: data });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
