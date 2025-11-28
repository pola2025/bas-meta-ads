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

// POST: 서비스 연장 처리
export async function POST(request: NextRequest) {
  if (!validateAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { id, months = 3 } = body;

    if (!id) {
      return NextResponse.json({ error: 'Client ID required' }, { status: 400 });
    }

    // 현재 클라이언트 정보 조회
    const { data: client, error: fetchError } = await supabase
      .from('clients')
      .select('id, client_name, service_end_date')
      .eq('id', id)
      .single();

    if (fetchError || !client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    // 새 종료일 계산
    const currentEnd = client.service_end_date ? new Date(client.service_end_date) : new Date();
    const today = new Date();

    // 만료된 경우 오늘부터, 아니면 현재 종료일부터 연장
    const startDate = currentEnd < today ? today : currentEnd;
    const newEndDate = new Date(startDate);
    newEndDate.setMonth(newEndDate.getMonth() + months);

    // 업데이트
    const { data, error } = await supabase
      .from('clients')
      .update({
        service_end_date: newEndDate.toISOString().split('T')[0],
        is_active: true,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      client: data,
      extension: {
        previousEndDate: client.service_end_date,
        newEndDate: newEndDate.toISOString().split('T')[0],
        months,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
