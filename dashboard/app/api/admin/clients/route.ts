/**
 * Admin API - 클라이언트 관리
 *
 * GET:  클라이언트 목록 조회
 * POST: 클라이언트 추가 (토큰 검증 포함)
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { encrypt } from '@/lib/encryption';
import crypto from 'crypto';

// 관리자 키 검증
function isAdmin(request: NextRequest): boolean {
  const adminKey = request.headers.get('x-admin-key');
  return adminKey === process.env.NEXT_PUBLIC_ADMIN_KEY;
}

// 비밀번호 해시 생성
function generatePasswordHash(): string {
  return crypto.randomBytes(32).toString('hex');
}

// 서비스 종료일 계산 (시작일 + 3개월 - 1일)
function calculateEndDate(startDate: string): string {
  const start = new Date(startDate);
  const end = new Date(start);
  end.setMonth(end.getMonth() + 3);
  end.setDate(end.getDate() - 1);
  return end.toISOString().split('T')[0];
}

// Meta API 토큰 검증
async function validateMetaToken(
  accountId: string,
  token: string
): Promise<{ valid: boolean; accountName?: string; error?: string }> {
  try {
    const url = `https://graph.facebook.com/v22.0/${accountId}?fields=name,account_status&access_token=${token}`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.error) {
      let errorMessage = data.error.message;
      if (data.error.code === 190) {
        errorMessage = '토큰이 만료되었거나 유효하지 않습니다.';
      } else if (data.error.code === 100) {
        errorMessage = '광고계정 ID가 잘못되었거나 접근 권한이 없습니다.';
      }
      return { valid: false, error: errorMessage };
    }

    return {
      valid: true,
      accountName: data.name,
    };
  } catch (error: any) {
    return { valid: false, error: `API 호출 실패: ${error.message}` };
  }
}

// GET: 클라이언트 목록 조회
export async function GET(request: NextRequest) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { data: clients, error } = await supabaseAdmin
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
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching clients:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 각 클라이언트의 데이터 현황 조회
    const clientsWithStats = await Promise.all(
      (clients || []).map(async (client) => {
        // 최신 데이터 날짜
        const { data: latestData } = await supabaseAdmin
          .from('raw_data')
          .select('date')
          .eq('client_id', client.id)
          .order('date', { ascending: false })
          .limit(1);

        // 데이터 건수
        const { count } = await supabaseAdmin
          .from('raw_data')
          .select('*', { count: 'exact', head: true })
          .eq('client_id', client.id);

        // 목표값 조회
        const currentMonth = new Date().toISOString().slice(0, 7) + '-01';
        const { data: targets } = await supabaseAdmin
          .from('client_targets')
          .select('target_leads, target_spend, target_cpl')
          .eq('client_id', client.id)
          .eq('target_month', currentMonth)
          .single();

        return {
          ...client,
          latestDataDate: latestData?.[0]?.date || null,
          dataCount: count || 0,
          targets: targets || null,
        };
      })
    );

    return NextResponse.json({
      success: true,
      clients: clientsWithStats,
      total: clientsWithStats.length,
      activeCount: clientsWithStats.filter((c) => c.is_active).length,
    });
  } catch (error: any) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST: 새 클라이언트 생성 (토큰 검증 포함)
export async function POST(request: NextRequest) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      name,
      account,
      token,
      telegram,
      autoBackfill = false,
      backfillDays = 90,
      email,
      plan_type = 'free',
      target_leads,
      target_spend,
      target_cpl,
      service_start_date,
      service_end_date,
      telegram_enabled = true,
      unlimited_service = false,
      skipValidation = false,
    } = body;

    // 필수 필드 검증
    if (!name) {
      return NextResponse.json({ error: '클라이언트명은 필수입니다.' }, { status: 400 });
    }

    // 이메일 기본값 생성
    const clientEmail = email || `${name.toLowerCase().replace(/[^a-z0-9]/g, '')}@bas-meta.local`;

    // 중복 확인 (이름)
    const { data: existingByName } = await supabaseAdmin
      .from('clients')
      .select('id')
      .ilike('client_name', name)
      .limit(1);

    if (existingByName && existingByName.length > 0) {
      return NextResponse.json(
        { success: false, error: `이미 등록된 클라이언트명입니다: ${name}` },
        { status: 409 }
      );
    }

    // 중복 확인 (계정 ID)
    if (account) {
      const { data: existingByAccount } = await supabaseAdmin
        .from('clients')
        .select('id')
        .eq('meta_ad_account_id', account)
        .limit(1);

      if (existingByAccount && existingByAccount.length > 0) {
        return NextResponse.json(
          { success: false, error: `이미 등록된 광고계정입니다: ${account}` },
          { status: 409 }
        );
      }
    }

    // 토큰 검증 (account와 token이 모두 있을 때)
    let validation = { tokenValid: false, accountName: '' };
    if (account && token && !skipValidation) {
      const result = await validateMetaToken(account, token);
      if (!result.valid) {
        return NextResponse.json(
          {
            success: false,
            error: '토큰 검증 실패',
            details: result.error,
          },
          { status: 400 }
        );
      }
      validation = { tokenValid: true, accountName: result.accountName || '' };
    }

    // client_id 생성
    const client_id = name
      .toLowerCase()
      .replace(/[^a-z0-9가-힣]/g, '_')
      .replace(/_+/g, '_')
      .slice(0, 50);

    // 서비스 기간 계산
    const startDate = service_start_date || new Date().toISOString().split('T')[0];
    let endDate: string | null = null;
    if (unlimited_service) {
      endDate = null;
    } else if (service_end_date) {
      endDate = service_end_date;
    } else {
      endDate = calculateEndDate(startDate);
    }

    // 토큰 암호화
    let encryptedToken: string | null = null;
    if (token) {
      try {
        encryptedToken = encrypt(token);
      } catch (encryptError) {
        console.error('Encryption error:', encryptError);
      }
    }

    // 클라이언트 생성
    const { data: newClient, error: clientError } = await supabaseAdmin
      .from('clients')
      .insert({
        client_id,
        client_name: name,
        email: clientEmail,
        password_hash: generatePasswordHash(),
        meta_ad_account_id: account || null,
        encrypted_access_token: encryptedToken,
        telegram_chat_id: telegram || null,
        plan_type,
        is_active: true,
        auth_status: token ? 'active' : 'auth_required',
        service_start_date: startDate,
        service_end_date: endDate,
        telegram_enabled,
      })
      .select()
      .single();

    if (clientError) {
      console.error('Error creating client:', clientError);
      if (clientError.code === '23505') {
        return NextResponse.json(
          { success: false, error: '이미 존재하는 클라이언트입니다.' },
          { status: 409 }
        );
      }
      return NextResponse.json({ success: false, error: clientError.message }, { status: 500 });
    }

    // 목표값 저장
    if (target_leads || target_spend || target_cpl) {
      const currentMonth = new Date().toISOString().slice(0, 7) + '-01';
      await supabaseAdmin.from('client_targets').upsert({
        client_id: newClient.id,
        target_month: currentMonth,
        target_leads: target_leads || null,
        target_spend: target_spend || null,
        target_cpl: target_cpl || null,
      });
    }

    return NextResponse.json(
      {
        success: true,
        client: {
          id: newClient.id,
          name: newClient.client_name,
          account: newClient.meta_ad_account_id,
          isActive: newClient.is_active,
        },
        validation,
        backfill: {
          started: autoBackfill,
          days: autoBackfill ? backfillDays : 0,
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
