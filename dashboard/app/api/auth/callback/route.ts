/**
 * OAuth Callback API - Meta OAuth 콜백 처리
 *
 * GET /api/auth/callback?code=xxx&state=xxx
 *
 * 처리 순서:
 * 1. CSRF state 토큰 검증
 * 2. Authorization Code → Access Token 교환
 * 3. Short-lived → Long-lived Token 변환
 * 4. Meta 사용자 정보 조회
 * 5. 광고 계정 목록 조회
 * 6. 클라이언트 DB 저장 (auth_type='oauth', status='pending')
 * 7. 관리자 텔레그램 알림
 * 8. /pending 페이지로 리다이렉트
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { encrypt } from '@/lib/encryption';
import {
  validateOAuthState,
  exchangeCodeForToken,
  exchangeForLongLivedToken,
  getMetaUserInfo,
  getAdAccounts,
  sendAdminNotification
} from '@/lib/oauth-handler';
import crypto from 'crypto';

// 사이트 URL
const getSiteUrl = () =>
  process.env.NEXT_PUBLIC_SITE_URL || 'https://bas-meta-ads.vercel.app';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');

  // 1. 에러 체크 (사용자가 취소한 경우 등)
  if (error) {
    console.error('OAuth error:', error, errorDescription);
    return NextResponse.redirect(
      new URL(`/login?error=${error}&message=${encodeURIComponent(errorDescription || '')}`, getSiteUrl())
    );
  }

  // 2. 필수 파라미터 체크
  if (!code || !state) {
    return NextResponse.redirect(
      new URL('/login?error=missing_params', getSiteUrl())
    );
  }

  try {
    // 3. CSRF state 토큰 검증
    const isValidState = await validateOAuthState(state);
    if (!isValidState) {
      return NextResponse.redirect(
        new URL('/login?error=invalid_state', getSiteUrl())
      );
    }

    // 4. Authorization Code → Short-lived Token 교환
    const tokenResult = await exchangeCodeForToken(code);
    if (!tokenResult) {
      return NextResponse.redirect(
        new URL('/login?error=token_exchange_failed', getSiteUrl())
      );
    }

    // 5. Short-lived → Long-lived Token 변환 (60일)
    const longLivedResult = await exchangeForLongLivedToken(tokenResult.access_token);
    if (!longLivedResult) {
      return NextResponse.redirect(
        new URL('/login?error=long_lived_token_failed', getSiteUrl())
      );
    }

    const { access_token: longLivedToken, expires_in } = longLivedResult;

    // 6. Meta 사용자 정보 조회
    const userInfo = await getMetaUserInfo(longLivedToken);
    if (!userInfo) {
      return NextResponse.redirect(
        new URL('/login?error=user_info_failed', getSiteUrl())
      );
    }

    // 7. 광고 계정 목록 조회
    const adAccounts = await getAdAccounts(longLivedToken);
    if (adAccounts.length === 0) {
      return NextResponse.redirect(
        new URL('/login?error=no_ad_accounts', getSiteUrl())
      );
    }

    // 첫 번째 광고 계정 사용 (추후 선택 UI 추가 가능)
    const primaryAccount = adAccounts[0];

    // 8. 기존 등록 여부 확인 (광고 계정 ID 또는 Meta User ID)
    const { data: existingClient } = await supabaseAdmin
      .from('clients')
      .select('id, client_name, status')
      .or(`meta_ad_account_id.eq.${primaryAccount.id},meta_user_id.eq.${userInfo.id}`)
      .single();

    if (existingClient) {
      // 이미 등록된 클라이언트
      if (existingClient.status === 'pending') {
        return NextResponse.redirect(new URL('/pending', getSiteUrl()));
      }
      // 활성 클라이언트면 대시보드로
      return NextResponse.redirect(
        new URL(`/?clientId=${existingClient.id}`, getSiteUrl())
      );
    }

    // 9. 토큰 암호화
    const encryptedToken = encrypt(longLivedToken);
    const tokenExpiresAt = new Date(Date.now() + expires_in * 1000);

    // 10. 클라이언트 ID 생성
    const clientId = userInfo.name
      .toLowerCase()
      .replace(/[^a-z0-9가-힣]/g, '_')
      .replace(/_+/g, '_')
      .slice(0, 50);

    // 11. DB에 새 클라이언트 저장
    const { data: newClient, error: insertError } = await supabaseAdmin
      .from('clients')
      .insert({
        client_id: clientId,
        client_name: userInfo.name,
        email: `${clientId}@oauth.bas-meta.local`,
        password_hash: crypto.randomBytes(32).toString('hex'),
        meta_ad_account_id: primaryAccount.id,
        encrypted_access_token: encryptedToken,
        token_expires_at: tokenExpiresAt.toISOString(),
        // OAuth 하이브리드 핵심 필드
        auth_type: 'oauth',
        status: 'pending', // 관리자 승인 대기
        auth_status: 'active', // 토큰은 유효함
        meta_user_id: userInfo.id,
        meta_user_name: userInfo.name,
        oauth_registered_at: new Date().toISOString(),
        // 기본 설정
        is_active: true,
        telegram_enabled: false,
        plan_type: 'free',
        service_start_date: new Date().toISOString().split('T')[0]
      })
      .select()
      .single();

    if (insertError) {
      console.error('Client insert error:', insertError);
      return NextResponse.redirect(
        new URL('/login?error=registration_failed', getSiteUrl())
      );
    }

    // 12. 관리자 텔레그램 알림
    await sendAdminNotification(
      userInfo.name,
      userInfo.name,
      primaryAccount.id
    );

    // 13. 성공 - /pending 페이지로 리다이렉트
    return NextResponse.redirect(
      new URL(`/pending?clientId=${newClient.id}`, getSiteUrl())
    );
  } catch (err) {
    console.error('OAuth callback error:', err);
    return NextResponse.redirect(
      new URL('/login?error=callback_failed', getSiteUrl())
    );
  }
}
