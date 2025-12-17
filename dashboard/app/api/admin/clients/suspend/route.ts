/**
 * Admin API - 클라이언트 중지
 *
 * POST /api/admin/clients/suspend
 *
 * Body:
 * - clientId: string (필수)
 * - reason?: string (선택)
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

// 관리자 키 검증
function isAdmin(request: NextRequest): boolean {
  const adminKey = request.headers.get('x-admin-key');
  return adminKey === process.env.NEXT_PUBLIC_ADMIN_KEY;
}

// 텔레그램 알림 발송
async function sendSuspensionNotification(
  clientName: string,
  reason: string
): Promise<void> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID;

  if (!botToken || !adminChatId) return;

  const message = `⚠️ <b>클라이언트 일시 중지</b>

📋 <b>클라이언트</b>: ${clientName}
📝 <b>사유</b>: ${reason || '사유 없음'}
⏰ <b>중지 시각</b>: ${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })} KST

⏸️ 데이터 수집이 중단됩니다.`;

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
    const { clientId, reason } = body;

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

    // 이미 suspended인 경우
    if (client.status === 'suspended') {
      return NextResponse.json(
        { success: false, error: 'Client is already suspended' },
        { status: 400 }
      );
    }

    // 중지 처리
    const now = new Date().toISOString();

    const { error: updateError } = await supabaseAdmin
      .from('clients')
      .update({
        status: 'suspended',
        suspended_at: now,
        suspension_reason: reason || null,
        updated_at: now
      })
      .eq('id', clientId);

    if (updateError) {
      console.error('Suspension update error:', updateError);
      return NextResponse.json(
        { success: false, error: 'Failed to suspend client' },
        { status: 500 }
      );
    }

    // 텔레그램 알림
    await sendSuspensionNotification(client.client_name, reason);

    return NextResponse.json({
      success: true,
      message: `${client.client_name} 일시 중지`,
      client: {
        id: clientId,
        name: client.client_name,
        status: 'suspended',
        suspended_at: now,
        suspension_reason: reason
      }
    });
  } catch (error: any) {
    console.error('Suspension error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
