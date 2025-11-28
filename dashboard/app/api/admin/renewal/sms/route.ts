import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// 관리자 키 검증
function validateAdmin(request: NextRequest): boolean {
  const adminKey = request.headers.get('x-admin-key');
  return adminKey === process.env.NEXT_PUBLIC_ADMIN_KEY;
}

// NCP SENS 설정
const NCP_ACCESS_KEY = process.env.NCP_ACCESS_KEY;
const NCP_SECRET_KEY = process.env.NCP_SECRET_KEY;
const NCP_SERVICE_ID = process.env.NCP_SERVICE_ID;
const NCP_SENDER_PHONE = process.env.NCP_SENDER_PHONE;

// HMAC-SHA256 서명 생성
function makeSignature(timestamp: string, method: string, url: string): string {
  const space = ' ';
  const newLine = '\n';

  const message = [method, space, url, newLine, timestamp, newLine, NCP_ACCESS_KEY].join('');

  const hmac = crypto.createHmac('sha256', NCP_SECRET_KEY || '');
  hmac.update(message);
  return hmac.digest('base64');
}

// 메시지 템플릿
const SERVICE_NAME = '폴라애드 Meta 리포트';
const PAYMENT_INFO = {
  bank: '우리은행',
  accountNumber: '1005-302-954803',
  accountHolder: '폴라애드 이재호',
  cardPaymentUrl: 'https://booking.naver.com/booking/5/bizes/1304508/items/6516411',
  contactPhone: '010-9897-9834',
};

function getMessageTemplate(type: string, clientName: string, endDate: string): string {
  switch (type) {
    case 'd7':
      return `[${SERVICE_NAME}] 서비스 연장 안내

안녕하세요, ${clientName}님
광고 리포트 서비스가 곧 만료됩니다.

■ 만료일: ${endDate}
■ 남은기간: 7일

연장을 원하시면 아래 안내를 확인해주세요.

▶ 3개월 이용료: 66만원(VAT포함)
  (월 22만원 × 3개월)

▶ 이체결제
${PAYMENT_INFO.bank} ${PAYMENT_INFO.accountNumber}
${PAYMENT_INFO.accountHolder}

▶ 카드결제
${PAYMENT_INFO.cardPaymentUrl}
※ 금액 맞춰서 결제 (오늘 제외 아무날짜 선택)

감사합니다.`;

    case 'd3':
      return `[${SERVICE_NAME}] 서비스 만료 D-3 안내

${clientName}님, 서비스가 3일 후 만료됩니다.

■ 만료일: ${endDate}

미연장 시 서비스가 자동 종료되며,
광고 데이터 리포트를 받아보실 수 없습니다.

▶ 3개월 연장: 66만원(VAT포함)

▶ 이체: ${PAYMENT_INFO.bank} ${PAYMENT_INFO.accountNumber} (${PAYMENT_INFO.accountHolder})
▶ 카드: ${PAYMENT_INFO.cardPaymentUrl}

연장 문의: ${PAYMENT_INFO.contactPhone}`;

    case 'd0':
      return `[${SERVICE_NAME}] 서비스 만료 당일 안내

${clientName}님, 오늘 서비스가 만료됩니다.

■ 만료일: ${endDate} (오늘)

결제 미확인 시 자동 종료됩니다.

▶ 3개월 연장: 66만원
▶ 이체: ${PAYMENT_INFO.bank} ${PAYMENT_INFO.accountNumber}
▶ 카드: ${PAYMENT_INFO.cardPaymentUrl}

문의: ${PAYMENT_INFO.contactPhone}`;

    case 'expired':
      return `[${SERVICE_NAME}] 서비스 종료 안내

${clientName}님, 서비스가 종료되었습니다.

■ 종료일: ${endDate}

재이용을 원하시면 결제 후 연락주세요.

▶ 3개월: 66만원(VAT포함)
▶ 이체: ${PAYMENT_INFO.bank} ${PAYMENT_INFO.accountNumber} (${PAYMENT_INFO.accountHolder})
▶ 카드: ${PAYMENT_INFO.cardPaymentUrl}

그동안 이용해주셔서 감사합니다.
문의: ${PAYMENT_INFO.contactPhone}`;

    default:
      throw new Error(`Unknown message type: ${type}`);
  }
}

// POST: SMS 발송
export async function POST(request: NextRequest) {
  if (!validateAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // NCP 설정 확인
  if (!NCP_ACCESS_KEY || !NCP_SECRET_KEY || !NCP_SERVICE_ID || !NCP_SENDER_PHONE) {
    return NextResponse.json({ error: 'SMS configuration missing' }, { status: 500 });
  }

  try {
    const body = await request.json();
    const { id, type } = body;

    if (!id || !type) {
      return NextResponse.json({ error: 'Client ID and message type required' }, { status: 400 });
    }

    // 클라이언트 조회
    const { data: client, error: fetchError } = await supabase
      .from('clients')
      .select('id, client_name, contact_phone, service_end_date')
      .eq('id', id)
      .single();

    if (fetchError || !client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    if (!client.contact_phone) {
      return NextResponse.json({ error: 'Contact phone not registered' }, { status: 400 });
    }

    // 메시지 생성
    const endDate = client.service_end_date || 'N/A';
    const message = getMessageTemplate(type, client.client_name, endDate);

    // SMS 발송
    const timestamp = Date.now().toString();
    const uri = `/sms/v2/services/${NCP_SERVICE_ID}/messages`;
    const url = `https://sens.apigw.ntruss.com${uri}`;

    const smsBody = {
      type: 'LMS',
      from: NCP_SENDER_PHONE.replace(/-/g, ''),
      content: message,
      messages: [{ to: client.contact_phone.replace(/-/g, '') }],
    };

    const signature = makeSignature(timestamp, 'POST', uri);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'x-ncp-apigw-timestamp': timestamp,
        'x-ncp-iam-access-key': NCP_ACCESS_KEY,
        'x-ncp-apigw-signature-v2': signature,
      },
      body: JSON.stringify(smsBody),
    });

    const result = await response.json();

    if (response.ok && result.statusCode === '202') {
      // 발송 이력 저장
      await supabase.from('sms_logs').insert({
        client_id: client.id,
        message_type: type,
        phone: client.contact_phone,
        status: 'success',
        request_id: result.requestId,
      });

      return NextResponse.json({
        success: true,
        requestId: result.requestId,
        phone: client.contact_phone,
        messageType: type,
      });
    } else {
      // 실패 이력 저장
      await supabase.from('sms_logs').insert({
        client_id: client.id,
        message_type: type,
        phone: client.contact_phone,
        status: 'failed',
        error: result.statusMessage || result.error || 'Unknown error',
      });

      return NextResponse.json(
        { error: result.statusMessage || 'SMS send failed' },
        { status: 500 }
      );
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// GET: SMS 발송 이력 조회
export async function GET(request: NextRequest) {
  if (!validateAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('clientId');

    let query = supabase
      .from('sms_logs')
      .select('*, clients(client_name)')
      .order('sent_at', { ascending: false })
      .limit(50);

    if (clientId) {
      query = query.eq('client_id', clientId);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ logs: data });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
