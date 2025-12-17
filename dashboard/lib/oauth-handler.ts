/**
 * ============================================================================
 * OAuth Handler - Meta OAuth 인증 유틸리티
 * ============================================================================
 *
 * Meta OAuth 2.0 플로우 처리:
 * 1. 인증 URL 생성 (CSRF 토큰 포함)
 * 2. Authorization Code → Access Token 교환
 * 3. Short-lived Token → Long-lived Token 변환
 * 4. 광고 계정 정보 조회
 *
 * ============================================================================
 */

import crypto from 'crypto';
import { supabaseAdmin } from './supabase-admin';

// Meta API 설정
const META_API_VERSION = 'v22.0';
const META_GRAPH_URL = `https://graph.facebook.com/${META_API_VERSION}`;

// 환경변수
const getMetaAppId = () => process.env.META_APP_ID || process.env.NEXT_PUBLIC_META_APP_ID || '';
const getMetaAppSecret = () => process.env.META_APP_SECRET || '';
const getRedirectUri = () =>
  process.env.NEXT_PUBLIC_META_REDIRECT_URI ||
  'https://bas-meta-ads.vercel.app/api/auth/callback';

/**
 * CSRF State 토큰 생성 및 DB 저장
 */
export async function generateOAuthState(): Promise<string> {
  const state = crypto.randomBytes(32).toString('hex');

  // 10분 후 만료
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  await supabaseAdmin.from('oauth_sessions').insert({
    state,
    expires_at: expiresAt.toISOString(),
    used: false
  });

  return state;
}

/**
 * CSRF State 토큰 검증
 */
export async function validateOAuthState(state: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from('oauth_sessions')
    .select('*')
    .eq('state', state)
    .eq('used', false)
    .single();

  if (error || !data) {
    console.error('Invalid OAuth state:', state);
    return false;
  }

  // 만료 체크
  if (new Date(data.expires_at) < new Date()) {
    console.error('OAuth state expired:', state);
    return false;
  }

  // 사용됨으로 표시
  await supabaseAdmin
    .from('oauth_sessions')
    .update({ used: true })
    .eq('state', state);

  return true;
}

/**
 * Meta OAuth 인증 URL 생성
 */
export async function getOAuthUrl(): Promise<string> {
  const state = await generateOAuthState();

  const params = new URLSearchParams({
    client_id: getMetaAppId(),
    redirect_uri: getRedirectUri(),
    scope: 'ads_read',
    state,
    response_type: 'code'
  });

  return `https://www.facebook.com/${META_API_VERSION}/dialog/oauth?${params.toString()}`;
}

/**
 * Authorization Code → Access Token 교환
 */
export async function exchangeCodeForToken(
  code: string
): Promise<{ access_token: string; expires_in: number } | null> {
  try {
    const params = new URLSearchParams({
      client_id: getMetaAppId(),
      client_secret: getMetaAppSecret(),
      redirect_uri: getRedirectUri(),
      code
    });

    const response = await fetch(
      `${META_GRAPH_URL}/oauth/access_token?${params.toString()}`
    );

    const data = await response.json();

    if (data.error) {
      console.error('Token exchange error:', data.error);
      return null;
    }

    return {
      access_token: data.access_token,
      expires_in: data.expires_in || 3600
    };
  } catch (error) {
    console.error('Token exchange failed:', error);
    return null;
  }
}

/**
 * Short-lived Token → Long-lived Token 변환 (60일)
 */
export async function exchangeForLongLivedToken(
  shortLivedToken: string
): Promise<{ access_token: string; expires_in: number } | null> {
  try {
    const params = new URLSearchParams({
      grant_type: 'fb_exchange_token',
      client_id: getMetaAppId(),
      client_secret: getMetaAppSecret(),
      fb_exchange_token: shortLivedToken
    });

    const response = await fetch(
      `${META_GRAPH_URL}/oauth/access_token?${params.toString()}`
    );

    const data = await response.json();

    if (data.error) {
      console.error('Long-lived token exchange error:', data.error);
      return null;
    }

    return {
      access_token: data.access_token,
      // Long-lived token은 약 60일 (초 단위)
      expires_in: data.expires_in || 5184000
    };
  } catch (error) {
    console.error('Long-lived token exchange failed:', error);
    return null;
  }
}

/**
 * 사용자 정보 조회 (Meta User ID, Name)
 */
export async function getMetaUserInfo(
  accessToken: string
): Promise<{ id: string; name: string } | null> {
  try {
    const response = await fetch(
      `${META_GRAPH_URL}/me?fields=id,name&access_token=${accessToken}`
    );

    const data = await response.json();

    if (data.error) {
      console.error('User info error:', data.error);
      return null;
    }

    return {
      id: data.id,
      name: data.name
    };
  } catch (error) {
    console.error('User info fetch failed:', error);
    return null;
  }
}

/**
 * 사용자의 광고 계정 목록 조회
 */
export async function getAdAccounts(
  accessToken: string
): Promise<Array<{ id: string; account_id: string; name: string }>> {
  try {
    const response = await fetch(
      `${META_GRAPH_URL}/me/adaccounts?fields=account_id,name,account_status&access_token=${accessToken}`
    );

    const data = await response.json();

    if (data.error) {
      console.error('Ad accounts error:', data.error);
      return [];
    }

    // 활성 계정만 필터링 (account_status: 1 = ACTIVE)
    return (data.data || [])
      .filter((account: any) => account.account_status === 1)
      .map((account: any) => ({
        id: account.id, // act_xxxxx 형식
        account_id: account.account_id, // xxxxx 숫자만
        name: account.name
      }));
  } catch (error) {
    console.error('Ad accounts fetch failed:', error);
    return [];
  }
}

/**
 * 특정 광고 계정 정보 조회
 */
export async function getAdAccountInfo(
  accessToken: string,
  accountId: string
): Promise<{ id: string; name: string; currency: string } | null> {
  try {
    // accountId가 act_ 접두사 없으면 추가
    const fullAccountId = accountId.startsWith('act_')
      ? accountId
      : `act_${accountId}`;

    const response = await fetch(
      `${META_GRAPH_URL}/${fullAccountId}?fields=name,currency,account_status&access_token=${accessToken}`
    );

    const data = await response.json();

    if (data.error) {
      console.error('Ad account info error:', data.error);
      return null;
    }

    return {
      id: data.id,
      name: data.name,
      currency: data.currency
    };
  } catch (error) {
    console.error('Ad account info fetch failed:', error);
    return null;
  }
}

/**
 * 텔레그램 관리자 알림 발송
 */
export async function sendAdminNotification(
  clientName: string,
  metaUserName: string,
  adAccountId: string
): Promise<void> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID;

  if (!botToken || !adminChatId) {
    console.log('Telegram credentials not set, skipping notification');
    return;
  }

  const message = `🆕 <b>새 OAuth 클라이언트 등록</b>

📋 <b>클라이언트명</b>: ${clientName}
👤 <b>Meta 사용자</b>: ${metaUserName}
📊 <b>광고 계정</b>: ${adAccountId}
⏰ <b>등록 시각</b>: ${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })} KST

📌 <b>상태</b>: 승인 대기 중 (pending)

━━━━━━━━━━━━━━━━━━━━
✅ 승인하려면 관리자 페이지에서 승인 버튼을 클릭하세요.`;

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: adminChatId,
          text: message,
          parse_mode: 'HTML'
        })
      }
    );

    if (!response.ok) {
      const error = await response.json();
      console.error('Telegram notification error:', error);
    }
  } catch (error) {
    console.error('Telegram notification failed:', error);
  }
}
