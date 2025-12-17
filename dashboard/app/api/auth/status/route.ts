/**
 * OAuth Status API - 클라이언트 상태 확인
 *
 * GET /api/auth/status?clientId=xxx
 *
 * 반환:
 * - status: 'pending' | 'active' | 'suspended' | 'expired'
 * - auth_type: 'manual' | 'oauth'
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET(request: NextRequest) {
  const clientId = request.nextUrl.searchParams.get('clientId');

  if (!clientId) {
    return NextResponse.json(
      { error: 'clientId is required' },
      { status: 400 }
    );
  }

  try {
    const { data: client, error } = await supabaseAdmin
      .from('clients')
      .select(`
        id,
        client_name,
        auth_type,
        status,
        auth_status,
        is_active,
        approved_at,
        service_start_date,
        service_end_date
      `)
      .eq('id', clientId)
      .single();

    if (error || !client) {
      return NextResponse.json(
        { error: 'Client not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      client: {
        id: client.id,
        name: client.client_name,
        auth_type: client.auth_type,
        status: client.status,
        auth_status: client.auth_status,
        is_active: client.is_active,
        approved_at: client.approved_at,
        service_start_date: client.service_start_date,
        service_end_date: client.service_end_date,
        // OAuth 클라이언트용 메시지
        message: getStatusMessage(client)
      }
    });
  } catch (err) {
    console.error('Status check error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

function getStatusMessage(client: any): string {
  if (client.auth_type !== 'oauth') {
    return '기존 클라이언트 (수동 등록)';
  }

  switch (client.status) {
    case 'pending':
      return '관리자 승인 대기 중입니다. 승인 후 서비스를 이용하실 수 있습니다.';
    case 'active':
      return '서비스가 활성화되었습니다.';
    case 'suspended':
      return '서비스가 일시 중지되었습니다. 관리자에게 문의하세요.';
    case 'expired':
      return '계약이 만료되었습니다. 연장을 원하시면 관리자에게 문의하세요.';
    default:
      return '';
  }
}
