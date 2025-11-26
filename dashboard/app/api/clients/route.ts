import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import crypto from 'crypto';
import { encrypt } from '@/lib/encryption';

// 관리자 키 검증
function isAdmin(request: NextRequest): boolean {
  const adminKey = request.headers.get('x-admin-key');
  return adminKey === process.env.NEXT_PUBLIC_ADMIN_KEY;
}

// 비밀번호 해시 생성 (클라이언트 접근용 랜덤 생성)
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
        created_at,
        updated_at
      `)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching clients:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 각 클라이언트의 목표값도 함께 조회
    const clientsWithTargets = await Promise.all(
      (clients || []).map(async (client) => {
        const currentMonth = new Date().toISOString().slice(0, 7) + '-01';
        const { data: targets } = await supabaseAdmin
          .from('client_targets')
          .select('target_leads, target_spend, target_cpl')
          .eq('client_id', client.id)
          .eq('target_month', currentMonth)
          .single();

        return {
          ...client,
          targets: targets || null
        };
      })
    );

    return NextResponse.json({ clients: clientsWithTargets });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST: 새 클라이언트 생성
export async function POST(request: NextRequest) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      client_name,
      email,
      meta_ad_account_id,
      meta_access_token,
      telegram_chat_id,
      plan_type = 'free',
      target_leads,
      target_spend,
      target_cpl,
      service_start_date
    } = body;

    // 필수 필드 검증
    if (!client_name || !email) {
      return NextResponse.json(
        { error: 'client_name and email are required' },
        { status: 400 }
      );
    }

    // client_id 생성 (소문자 + 언더스코어)
    const client_id = client_name
      .toLowerCase()
      .replace(/[^a-z0-9가-힣]/g, '_')
      .replace(/_+/g, '_')
      .slice(0, 50);

    // 서비스 기간 계산
    const startDate = service_start_date || new Date().toISOString().split('T')[0];
    const endDate = calculateEndDate(startDate);

    // 클라이언트 생성
    const { data: newClient, error: clientError } = await supabaseAdmin
      .from('clients')
      .insert({
        client_id,
        client_name,
        email,
        password_hash: generatePasswordHash(),
        meta_ad_account_id: meta_ad_account_id || null,
        telegram_chat_id: telegram_chat_id || null,
        plan_type,
        is_active: true,
        auth_status: meta_access_token ? 'active' : 'auth_required',
        service_start_date: startDate,
        service_end_date: endDate
      })
      .select()
      .single();

    if (clientError) {
      console.error('Error creating client:', clientError);
      if (clientError.code === '23505') {
        return NextResponse.json(
          { error: 'Client with this email already exists' },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: clientError.message }, { status: 500 });
    }

    // Meta Access Token을 AES 암호화하여 저장
    if (meta_access_token) {
      try {
        const encryptedToken = encrypt(meta_access_token);

        const { error: tokenError } = await supabaseAdmin
          .from('clients')
          .update({
            encrypted_access_token: encryptedToken,
            auth_status: 'active'
          })
          .eq('id', newClient.id);

        if (tokenError) {
          console.error('Error storing encrypted token:', tokenError);
        } else {
          console.log('Meta access token encrypted and stored for client:', newClient.id);
        }
      } catch (encryptError) {
        console.error('Encryption error:', encryptError);
        // 암호화 실패해도 클라이언트 생성은 성공
      }
    }

    // 목표값이 있으면 client_targets에 저장
    if (target_leads || target_spend || target_cpl) {
      const currentMonth = new Date().toISOString().slice(0, 7) + '-01';
      const { error: targetError } = await supabaseAdmin
        .from('client_targets')
        .upsert({
          client_id: newClient.id,
          target_month: currentMonth,
          target_leads: target_leads || null,
          target_spend: target_spend || null,
          target_cpl: target_cpl || null
        });

      if (targetError) {
        console.error('Error saving targets:', targetError);
        // 목표값 저장 실패해도 클라이언트 생성은 성공
      }
    }

    return NextResponse.json({
      success: true,
      client: newClient,
      dashboard_url: `/?client=${newClient.id}`
    }, { status: 201 });

  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT: 클라이언트 수정
export async function PUT(request: NextRequest) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      id,
      client_name,
      email,
      meta_ad_account_id,
      telegram_chat_id,
      plan_type,
      is_active,
      target_leads,
      target_spend,
      target_cpl,
      service_start_date
    } = body;

    if (!id) {
      return NextResponse.json({ error: 'Client ID is required' }, { status: 400 });
    }

    // 클라이언트 업데이트
    const updateData: Record<string, any> = { updated_at: new Date().toISOString() };
    if (client_name !== undefined) updateData.client_name = client_name;
    if (email !== undefined) updateData.email = email;
    if (meta_ad_account_id !== undefined) updateData.meta_ad_account_id = meta_ad_account_id;
    if (telegram_chat_id !== undefined) updateData.telegram_chat_id = telegram_chat_id;
    if (plan_type !== undefined) updateData.plan_type = plan_type;
    if (is_active !== undefined) updateData.is_active = is_active;

    // 서비스 시작일 변경 시 종료일 재계산
    if (service_start_date !== undefined) {
      updateData.service_start_date = service_start_date;
      updateData.service_end_date = calculateEndDate(service_start_date);
    }

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
      const { error: targetError } = await supabaseAdmin
        .from('client_targets')
        .upsert({
          client_id: id,
          target_month: currentMonth,
          target_leads: target_leads || null,
          target_spend: target_spend || null,
          target_cpl: target_cpl || null
        });

      if (targetError) {
        console.error('Error updating targets:', targetError);
      }
    }

    return NextResponse.json({ success: true, client: updatedClient });

  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE: 클라이언트 삭제 (hard delete)
export async function DELETE(request: NextRequest) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Client ID is required' }, { status: 400 });
    }

    // Hard delete: 완전 삭제
    const { error } = await supabaseAdmin
      .from('clients')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting client:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Client deleted' });

  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
