import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

// 관리자 키 검증
function isAdmin(request: NextRequest): boolean {
  const adminKey = request.headers.get('x-admin-key');
  return adminKey === process.env.NEXT_PUBLIC_ADMIN_KEY;
}

// GET: 클라이언트별 결제 히스토리 조회
export async function GET(request: NextRequest) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('client_id');

    if (!clientId) {
      return NextResponse.json({ error: 'client_id is required' }, { status: 400 });
    }

    const { data: payments, error } = await supabaseAdmin
      .from('payment_history')
      .select('*')
      .eq('client_id', clientId)
      .order('payment_date', { ascending: false });

    if (error) {
      console.error('Error fetching payments:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ payments: payments || [] });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST: 결제 기록 추가 + 서비스 기간 갱신
export async function POST(request: NextRequest) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      client_id,
      payment_date, // null이면 오늘 날짜
      amount,
      payment_type = 'monthly',
      payment_method,
      memo,
      service_months = 3,
      update_service_dates = true // 서비스 기간도 갱신할지
    } = body;

    if (!client_id) {
      return NextResponse.json({ error: 'client_id is required' }, { status: 400 });
    }

    // 결제일 설정 (없으면 오늘)
    const actualPaymentDate = payment_date || new Date().toISOString().split('T')[0];

    // 1. 결제 히스토리 추가
    const { data: payment, error: paymentError } = await supabaseAdmin
      .from('payment_history')
      .insert({
        client_id,
        payment_date: actualPaymentDate,
        amount: amount || null,
        payment_type,
        payment_method: payment_method || null,
        memo: memo || null,
        service_months
      })
      .select()
      .single();

    if (paymentError) {
      console.error('Error creating payment:', paymentError);
      return NextResponse.json({ error: paymentError.message }, { status: 500 });
    }

    // 2. 서비스 기간 갱신 (옵션)
    if (update_service_dates) {
      const startDate = new Date(actualPaymentDate);
      const endDate = new Date(startDate);
      endDate.setMonth(endDate.getMonth() + service_months);
      endDate.setDate(endDate.getDate() - 1);

      const { error: updateError } = await supabaseAdmin
        .from('clients')
        .update({
          service_start_date: actualPaymentDate,
          service_end_date: endDate.toISOString().split('T')[0],
          is_active: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', client_id);

      if (updateError) {
        console.error('Error updating service dates:', updateError);
        // 결제는 성공했지만 날짜 갱신 실패
        return NextResponse.json({
          success: true,
          payment,
          warning: 'Payment recorded but failed to update service dates'
        });
      }
    }

    return NextResponse.json({
      success: true,
      payment,
      message: update_service_dates
        ? `결제 기록 완료. 서비스 기간: ${actualPaymentDate} ~ +${service_months}개월`
        : '결제 기록 완료'
    }, { status: 201 });

  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE: 결제 기록 삭제
export async function DELETE(request: NextRequest) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Payment ID is required' }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from('payment_history')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting payment:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Payment deleted' });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
