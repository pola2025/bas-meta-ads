/**
 * Admin API - 클라이언트 재활성화
 *
 * POST /api/admin/clients/activate
 *
 * Body:
 * - clientId: string (필수)
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

// 관리자 키 검증
function isAdmin(request: NextRequest): boolean {
  const adminKey = request.headers.get('x-admin-key');
  return adminKey === process.env.NEXT_PUBLIC_ADMIN_KEY;
}

// 텔레그램 알림 발송
async function sendActivationNotification(clientName: string): Promise<void> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID;

  if (!botToken || !adminChatId) return;

  const message = `▶️ <b>클라이언트 재활성화</b>

📋 <b>클라이언트</b>: ${clientName}
⏰ <b>활성화 시각</b>: ${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })} KST

🚀 데이터 수집이 재개됩니다.`;

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
    const { clientId } = body;

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

    // 이미 active인 경우
    if (client.status === 'active') {
      return NextResponse.json(
        { success: false, error: 'Client is already active' },
        { status: 400 }
      );
    }

    // suspended 또는 expired 상태에서만 재활성화 가능
    if (client.status !== 'suspended' && client.status !== 'expired') {
      return NextResponse.json(
        { success: false, error: `Cannot activate from status: ${client.status}` },
        { status: 400 }
      );
    }

    // 재활성화 처리
    const now = new Date().toISOString();

    const { error: updateError } = await supabaseAdmin
      .from('clients')
      .update({
        status: 'active',
        suspended_at: null,
        suspension_reason: null,
        updated_at: now
      })
      .eq('id', clientId);

    if (updateError) {
      console.error('Activation update error:', updateError);
      return NextResponse.json(
        { success: false, error: 'Failed to activate client' },
        { status: 500 }
      );
    }

    // 텔레그램 알림
    await sendActivationNotification(client.client_name);

    return NextResponse.json({
      success: true,
      message: `${client.client_name} 재활성화 완료`,
      client: {
        id: clientId,
        name: client.client_name,
        status: 'active'
      }
    });
  } catch (error: any) {
    console.error('Activation error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
