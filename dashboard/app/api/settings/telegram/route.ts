import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { enabled, reportTime, reportDays } = body;

    // TODO: 실제 구현에서는 데이터베이스에 저장
    console.log('Telegram settings updated:', {
      enabled,
      reportTime,
      reportDays
    });

    return NextResponse.json({
      success: true,
      message: '텔레그램 설정이 저장되었습니다.'
    });

  } catch (error) {
    console.error('Telegram settings error:', error);
    return NextResponse.json(
      { error: '설정 저장 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    // TODO: 실제 구현에서는 데이터베이스에서 읽기
    const settings = {
      enabled: false,
      reportTime: '09:00',
      reportDays: ['MON']
    };

    return NextResponse.json(settings);

  } catch (error) {
    console.error('Telegram settings error:', error);
    return NextResponse.json(
      { error: '설정 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
