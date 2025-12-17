/**
 * OAuth Login API - Meta OAuth 인증 시작
 *
 * GET /api/auth/login
 * → Meta OAuth 인증 페이지로 리다이렉트
 */

import { NextResponse } from 'next/server';
import { getOAuthUrl } from '@/lib/oauth-handler';

export async function GET() {
  try {
    // CSRF 토큰이 포함된 OAuth URL 생성
    const authUrl = await getOAuthUrl();

    // Meta OAuth 페이지로 리다이렉트
    return NextResponse.redirect(authUrl);
  } catch (error) {
    console.error('OAuth login error:', error);
    return NextResponse.redirect(
      new URL('/login?error=oauth_init_failed', process.env.NEXT_PUBLIC_SITE_URL || 'https://bas-meta-ads.vercel.app')
    );
  }
}
