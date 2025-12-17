/**
 * Admin API - 클라이언트 승인
 *
 * POST /api/admin/clients/approve
 *
 * Body:
 * - clientId: string (필수)
 * - contractStartDate?: string (선택, YYYY-MM-DD)
 * - contractEndDate?: string (선택, YYYY-MM-DD)
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

// 관리자 키 검증
function isAdmin(request: NextRequest): boolean {
  const adminKey = request.headers.get('x-admin-key');
  return adminKey === process.env.NEXT_PUBLIC_ADMIN_KEY;
}

// 텔레그램 알림 발송
async function sendApprovalNotification(
  clientName: string,
  approvedBy: string
): Promise<void> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID;

  if (!botToken || !adminChatId) return;

  const message = `✅ <b>클라이언트 승인 완료</b>

📋 <b>클라이언트</b>: ${clientName}
👤 <b>승인자</b>: ${approvedBy}
⏰ <b>승인 시각</b>: ${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })} KST

🚀 데이터 수집이 시작됩니다.`;

  try {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: adminChatId,
        text: message,
        parse_mode: 'HTML'
      })
    });
  } catch (error) {
    console.error('Telegram notification error:', error);
  }
}

export async function POST(request: NextRequest) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { clientId, contractStartDate, contractEndDate, approvedBy = 'admin' } = body;

    if (!clientId) {
      return NextResponse.json(
        { success: false, error: 'clientId is required' },
        { status: 400 }
      );
    }

    // 클라이언트 조회
    const { data: client, error: fetchError } = await supabaseAdmin
      .from('clients')
      .select('id, client_name, auth_type, status')
      .eq('id', clientId)
      .single();

    if (fetchError || !client) {
      return NextResponse.json(
        { success: false, error: 'Client not found' },
        { status: 404 }
      );
    }

    // OAuth 클라이언트만 승인 가능
    if (client.auth_type !== 'oauth') {
      return NextResponse.json(
        { success: false, error: 'Only OAuth clients can be approved' },
        { status: 400 }
      );
    }

    // 이미 active인 경우
    if (client.status === 'active') {
      return NextResponse.json(
        { success: false, error: 'Client is already active' },
        { status: 400 }
      );
    }

    // 승인 처리
    const now = new Date().toISOString();
    const defaultStartDate = new Date().toISOString().split('T')[0];
    const defaultEndDate = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) // 90일 후
      .toISOString()
      .split('T')[0];

    const { error: updateError } = await supabaseAdmin
      .from('clients')
      .update({
        status: 'active',
        approved_at: now,
        approved_by: approvedBy,
        contract_start_date: contractStartDate || defaultStartDate,
        contract_end_date: contractEndDate || defaultEndDate,
        service_start_date: contractStartDate || defaultStartDate,
        service_end_date: contractEndDate || defaultEndDate,
        updated_at: now
      })
      .eq('id', clientId);

    if (updateError) {
      console.error('Approval update error:', updateError);
      return NextResponse.json(
        { success: false, error: 'Failed to approve client' },
        { status: 500 }
      );
    }

    // 텔레그램 알림
    await sendApprovalNotification(client.client_name, approvedBy);

    return NextResponse.json({
      success: true,
      message: `${client.client_name} 승인 완료`,
      client: {
        id: clientId,
        name: client.client_name,
        status: 'active',
        approved_at: now,
        approved_by: approvedBy
      }
    });
  } catch (error: any) {
    console.error('Approval error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
