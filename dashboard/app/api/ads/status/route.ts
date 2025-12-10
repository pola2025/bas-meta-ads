/**
 * 광고 상태 변경 API
 *
 * POST: 광고 상태 변경 (ACTIVE/PAUSED)
 *       - Meta API 호출 후 캐시 업데이트
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { decrypt } from '@/lib/encryption';
import { updateAdsStatusInCache } from '@/lib/ad-cache';

const META_API_VERSION = 'v22.0';
const META_API_BASE = `https://graph.facebook.com/${META_API_VERSION}`;

// 클라이언트 인증
async function getClientInfo(request: NextRequest) {
  const clientId = request.headers.get('x-client-id');

  if (!clientId) {
    return null;
  }

  const { data: client, error } = await supabaseAdmin
    .from('clients')
    .select('id, client_name, meta_ad_account_id, encrypted_access_token, is_active')
    .eq('id', clientId)
    .single();

  if (error || !client || !client.is_active) {
    return null;
  }

  return client;
}

// 단일 광고 상태 변경
async function updateAdStatus(adId: string, accessToken: string, status: string) {
  const url = `${META_API_BASE}/${adId}`;

  const params = new URLSearchParams({
    access_token: accessToken,
    status: status
  });

  const response = await fetch(url, {
    method: 'POST',
    body: params
  });

  const data = await response.json();

  if (data.error) {
    throw new Error(data.error.message || 'Failed to update ad status');
  }

  return { success: true, ad_id: adId };
}

// POST: 광고 상태 변경
export async function POST(request: NextRequest) {
  try {
    // 클라이언트 인증
    const client = await getClientInfo(request);
    if (!client) {
      return NextResponse.json({ error: 'Unauthorized or client not found' }, { status: 401 });
    }

    if (!client.meta_ad_account_id || !client.encrypted_access_token) {
      return NextResponse.json({
        error: 'Meta 계정이 연결되지 않았습니다.',
        code: 'META_NOT_CONNECTED'
      }, { status: 400 });
    }

    // Access Token 복호화
    let accessToken: string;
    try {
      accessToken = decrypt(client.encrypted_access_token) as string;
      if (!accessToken) {
        throw new Error('Failed to decrypt token');
      }
    } catch (e) {
      return NextResponse.json({
        error: 'Access Token 복호화 실패',
        code: 'TOKEN_DECRYPT_FAILED'
      }, { status: 500 });
    }

    // 요청 본문 파싱
    const body = await request.json();
    const { ad_ids, status } = body;

    // 유효성 검사
    if (!ad_ids || !Array.isArray(ad_ids) || ad_ids.length === 0) {
      return NextResponse.json({
        error: 'ad_ids는 필수이며 배열이어야 합니다.',
        code: 'INVALID_AD_IDS'
      }, { status: 400 });
    }

    if (!['ACTIVE', 'PAUSED'].includes(status)) {
      return NextResponse.json({
        error: 'status는 ACTIVE 또는 PAUSED만 가능합니다.',
        code: 'INVALID_STATUS'
      }, { status: 400 });
    }

    // 상태 변경 로깅
    console.log(`[Ad Status Change] Client: ${client.client_name}, Ads: ${ad_ids.length}, Status: ${status}`);

    // 일괄 상태 변경
    const results = {
      success: [] as string[],
      failed: [] as { id: string; error: string }[]
    };

    for (const adId of ad_ids) {
      try {
        await updateAdStatus(adId, accessToken, status);
        results.success.push(adId);
      } catch (error: any) {
        results.failed.push({
          id: adId,
          error: error.message || 'Unknown error'
        });
      }

      // Rate limit 방지: 요청 간 짧은 딜레이
      if (ad_ids.length > 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    // 성공한 광고들의 캐시 업데이트
    if (results.success.length > 0) {
      try {
        await updateAdsStatusInCache(client.id, results.success, status);
        console.log(`[Ad Status Change] 캐시 업데이트 완료: ${results.success.length}개`);
      } catch (cacheError) {
        console.warn('[Ad Status Change] 캐시 업데이트 실패:', cacheError);
        // 캐시 업데이트 실패는 무시 (메인 작업은 성공)
      }
    }

    // 상태 변경 이력 저장 (선택적)
    try {
      await supabaseAdmin.from('ad_status_logs').insert({
        client_id: client.id,
        ad_ids: ad_ids,
        new_status: status,
        success_count: results.success.length,
        failed_count: results.failed.length,
        created_at: new Date().toISOString()
      });
    } catch (logError) {
      // 로깅 실패는 무시 (테이블이 없을 수도 있음)
      console.warn('Failed to log ad status change:', logError);
    }

    return NextResponse.json({
      success: true,
      results: results,
      message: `${results.success.length}개 광고 상태 변경 완료` +
        (results.failed.length > 0 ? `, ${results.failed.length}개 실패` : '')
    });

  } catch (error: any) {
    console.error('Error updating ad status:', error);
    return NextResponse.json({
      error: error.message || 'Internal server error',
      code: 'UPDATE_STATUS_FAILED'
    }, { status: 500 });
  }
}
