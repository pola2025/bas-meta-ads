/**
 * 광고 관리 API
 *
 * GET: 광고 목록 + 누적 통계
 *
 * [캐시 전략]
 * - 통계 데이터: raw_data 테이블 (항상)
 * - 광고 메타데이터: Supabase 캐시 우선, 없으면 Meta API 1회 호출 후 캐시
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { decrypt } from '@/lib/encryption';
import {
  getAdCacheWithStatus,
  setAdCache,
  setRateLimitCooldown,
  clearRateLimitCooldown,
  transformMetaAdsToCache,
  type AdCacheData,
  type CachedAdMeta
} from '@/lib/ad-cache';

const META_API_VERSION = 'v22.0';
const META_API_BASE = `https://graph.facebook.com/${META_API_VERSION}`;

// 클라이언트 인증
async function getClientInfo(request: NextRequest) {
  const clientId = request.headers.get('x-client-id') ||
    new URL(request.url).searchParams.get('client_id');

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

// raw_data에서 광고별 누적 통계 조회
async function getAdsStatsFromRawData(clientId: string) {
  // 광고별 전체 기간 누적 통계 (페이지네이션으로 전체 데이터 조회)
  const allData: any[] = [];
  const pageSize = 1000;
  let page = 0;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabaseAdmin
      .from('raw_data')
      .select('ad_id, ad_name, campaign_id, campaign_name, spend, leads, impressions, clicks, video_views, avg_watch_time')
      .eq('client_id', clientId)
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (error) {
      console.error('raw_data 조회 오류:', error);
      break;
    }

    if (data && data.length > 0) {
      allData.push(...data);
      hasMore = data.length === pageSize;
      page++;
    } else {
      hasMore = false;
    }
  }

  if (allData.length === 0) {
    return { ads: {}, campaigns: {} };
  }

  console.log(`[Ads API] raw_data 조회 완료: ${allData.length}건`);

  // 광고별 집계
  const adsMap: Record<string, {
    ad_id: string;
    ad_name: string;
    campaign_id: string;
    campaign_name: string;
    spend: number;
    leads: number;
    impressions: number;
    clicks: number;
    video_views: number;
    avg_watch_time: number;
    avg_watch_time_count: number; // 평균 계산용
  }> = {};

  // 캠페인별 집계
  const campaignsMap: Record<string, {
    campaign_id: string;
    campaign_name: string;
    spend: number;
    leads: number;
  }> = {};

  allData.forEach(row => {
    const adId = row.ad_id;
    if (!adId) return;

    // 광고별 집계
    if (!adsMap[adId]) {
      adsMap[adId] = {
        ad_id: adId,
        ad_name: row.ad_name || '',
        campaign_id: row.campaign_id || '',
        campaign_name: row.campaign_name || '',
        spend: 0,
        leads: 0,
        impressions: 0,
        clicks: 0,
        video_views: 0,
        avg_watch_time: 0,
        avg_watch_time_count: 0
      };
    }
    adsMap[adId].spend += parseFloat(row.spend as any) || 0;
    adsMap[adId].leads += row.leads || 0;
    adsMap[adId].impressions += row.impressions || 0;
    adsMap[adId].clicks += row.clicks || 0;
    adsMap[adId].video_views += row.video_views || 0;

    // 평균 시청시간: 가중 평균 계산 (video_views 기준)
    const watchTime = parseFloat(row.avg_watch_time as any) || 0;
    const views = row.video_views || 0;
    if (watchTime > 0 && views > 0) {
      adsMap[adId].avg_watch_time += watchTime * views;
      adsMap[adId].avg_watch_time_count += views;
    }

    // 캠페인별 집계
    const campaignId = row.campaign_id;
    if (campaignId) {
      if (!campaignsMap[campaignId]) {
        campaignsMap[campaignId] = {
          campaign_id: campaignId,
          campaign_name: row.campaign_name || '',
          spend: 0,
          leads: 0
        };
      }
      campaignsMap[campaignId].spend += parseFloat(row.spend as any) || 0;
      campaignsMap[campaignId].leads += row.leads || 0;
    }
  });

  // 평균 시청시간 계산 완료
  Object.values(adsMap).forEach(ad => {
    if (ad.avg_watch_time_count > 0) {
      ad.avg_watch_time = ad.avg_watch_time / ad.avg_watch_time_count;
    }
  });

  return { ads: adsMap, campaigns: campaignsMap };
}

// Meta API에서 광고 상태 조회
async function fetchAdsStatusFromMeta(accountId: string, accessToken: string) {
  const url = `${META_API_BASE}/${accountId}/ads`;

  const params = new URLSearchParams({
    access_token: accessToken,
    fields: [
      'id',
      'name',
      'status',
      'effective_status',
      'configured_status',
      'campaign{id,name,status,objective,daily_budget,lifetime_budget}',
      'creative{thumbnail_url,image_url}'  // image_url은 더 고해상도
    ].join(','),
    limit: '500'
  });

  const response = await fetch(`${url}?${params}`);
  const data = await response.json();

  if (data.error) {
    throw new Error(`Meta API Error: ${data.error.message}`);
  }

  // 페이지네이션 처리
  let allAds = data.data || [];
  let nextUrl = data.paging?.next;

  while (nextUrl && allAds.length < 500) {
    const nextResponse = await fetch(nextUrl);
    const nextData = await nextResponse.json();

    if (nextData.error) break;
    allAds = allAds.concat(nextData.data || []);
    nextUrl = nextData.paging?.next;
  }

  return allAds;
}

// GET: 광고 목록 조회
export async function GET(request: NextRequest) {
  try {
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

    // 쿼리 파라미터
    const { searchParams } = new URL(request.url);
    const sortBy = searchParams.get('sort') || 'name';
    const sortOrder = searchParams.get('order') || 'asc';
    const forceRefresh = searchParams.get('refresh') === 'true';

    // 1. raw_data에서 누적 통계 조회 (빠름, rate limit 없음)
    const { ads: rawStats, campaigns: campaignStats } = await getAdsStatsFromRawData(client.id);

    // 2. 캐시 확인 (Rate Limit 상태 포함)
    const cacheResult = await getAdCacheWithStatus(client.id);
    let cachedMeta: AdCacheData | null = cacheResult.data;
    let dataSource: 'cache' | 'meta_api' | 'raw_data_only' | 'stale_cache' = 'cache';
    let isRateLimited = cacheResult.isRateLimited;
    let rateLimitRemainingMinutes = cacheResult.rateLimitRemainingMinutes;
    let metaError: string | null = null;

    // 3. Meta API 호출 결정 로직
    const shouldCallMetaApi = forceRefresh || (!cachedMeta || cacheResult.isExpired);
    const canCallMetaApi = !isRateLimited;

    if (shouldCallMetaApi && canCallMetaApi) {
      console.log(`[Ads API] Meta API 호출: ${client.client_name}, forceRefresh=${forceRefresh}, isExpired=${cacheResult.isExpired}`);

      try {
        const metaAds = await fetchAdsStatusFromMeta(client.meta_ad_account_id, accessToken);

        if (metaAds.length > 0) {
          // 캐시에 저장
          cachedMeta = transformMetaAdsToCache(metaAds);
          await setAdCache(client.id, cachedMeta);
          dataSource = 'meta_api';

          // API 성공 시 Rate Limit 쿨다운 해제
          if (isRateLimited) {
            await clearRateLimitCooldown(client.id);
            isRateLimited = false;
          }
        }
      } catch (e: any) {
        metaError = e.message;
        console.error('Meta API 오류:', e.message);

        // Rate Limit 에러 감지 및 쿨다운 설정
        // Meta API 에러 코드: #80004 (too many calls), #80000 (rate limit), #80003 (user request limit)
        if (e.message.includes('rate limit') || e.message.includes('too many calls') || e.message.includes('User request limit reached') || e.message.includes('#80004') || e.message.includes('#80000') || e.message.includes('#80003')) {
          await setRateLimitCooldown(client.id);
          isRateLimited = true;
          rateLimitRemainingMinutes = 30;
        }

        // 만료된 캐시라도 있으면 사용 (stale data)
        if (cachedMeta) {
          dataSource = 'stale_cache';
        } else {
          dataSource = 'raw_data_only';
        }
      }
    } else if (isRateLimited) {
      // Rate Limit 쿨다운 중
      console.log(`[Ads API] Rate Limit 쿨다운 중: ${client.client_name}, ${rateLimitRemainingMinutes}분 남음`);

      if (cachedMeta) {
        dataSource = 'stale_cache';
      } else {
        dataSource = 'raw_data_only';
      }
    } else if (cachedMeta && !cacheResult.isExpired) {
      // 유효한 캐시 사용
      console.log(`[Ads API] 캐시 사용: ${client.client_name}, ${Object.keys(cachedMeta).length}개 광고`);
      dataSource = 'cache';
    }

    // 4. 데이터 병합
    let result: any[] = [];

    if (cachedMeta && Object.keys(cachedMeta).length > 0) {
      // 캐시 데이터 + raw_data 통계 병합
      // raw_data에 있는 광고 ID 기준으로 병합 (활성/비활성 모두 포함)
      const allAdIds = Array.from(new Set([
        ...Object.keys(rawStats),
        ...Object.keys(cachedMeta)
      ]));

      for (const adId of allAdIds) {
        const cached = cachedMeta[adId];
        const stats = rawStats[adId] || { spend: 0, leads: 0, impressions: 0, clicks: 0 };
        const cpl = stats.leads > 0 ? stats.spend / stats.leads : 0;

        if (cached) {
          result.push({
            id: adId,
            name: cached.ad_name,
            status: cached.status,
            effective_status: cached.effective_status,
            configured_status: cached.configured_status,
            campaign: cached.campaign_id ? {
              id: cached.campaign_id,
              name: cached.campaign_name,
              status: cached.campaign_status,
              objective: cached.objective,
              daily_budget: cached.daily_budget,
              lifetime_budget: cached.lifetime_budget
            } : null,
            thumbnail_url: cached.thumbnail_url,
            metrics: {
              spend: parseFloat(stats.spend.toFixed(2)),
              leads: stats.leads,
              cpl: parseFloat(cpl.toFixed(2)),
              impressions: stats.impressions,
              clicks: stats.clicks,
              video_views: stats.video_views || 0,
              avg_watch_time: parseFloat((stats.avg_watch_time || 0).toFixed(1))
            }
          });
        } else {
          // 캐시에 없는 광고 (raw_data에만 있음)
          const rawAd = rawStats[adId];
          if (rawAd) {
            result.push({
              id: adId,
              name: rawAd.ad_name,
              status: 'UNKNOWN',
              effective_status: 'UNKNOWN',
              configured_status: 'UNKNOWN',
              campaign: rawAd.campaign_id ? {
                id: rawAd.campaign_id,
                name: rawAd.campaign_name,
                status: 'UNKNOWN',
                objective: null,
                daily_budget: null,
                lifetime_budget: null
              } : null,
              thumbnail_url: null,
              metrics: {
                spend: parseFloat(stats.spend.toFixed(2)),
                leads: stats.leads,
                cpl: parseFloat(cpl.toFixed(2)),
                impressions: stats.impressions,
                clicks: stats.clicks,
                video_views: stats.video_views || 0,
                avg_watch_time: parseFloat((stats.avg_watch_time || 0).toFixed(1))
              }
            });
          }
        }
      }
    } else {
      // 캐시도 없고 Meta API도 실패 시: raw_data만으로 구성
      result = Object.values(rawStats).map((stats: any) => {
        const cpl = stats.leads > 0 ? stats.spend / stats.leads : 0;

        return {
          id: stats.ad_id,
          name: stats.ad_name,
          status: 'UNKNOWN',
          effective_status: 'UNKNOWN',
          configured_status: 'UNKNOWN',
          campaign: stats.campaign_id ? {
            id: stats.campaign_id,
            name: stats.campaign_name,
            status: 'UNKNOWN',
            objective: null,
            daily_budget: null,
            lifetime_budget: null
          } : null,
          thumbnail_url: null,
          metrics: {
            spend: parseFloat(stats.spend.toFixed(2)),
            leads: stats.leads,
            cpl: parseFloat(cpl.toFixed(2)),
            impressions: stats.impressions,
            clicks: stats.clicks,
            video_views: stats.video_views || 0,
            avg_watch_time: parseFloat((stats.avg_watch_time || 0).toFixed(1))
          }
        };
      });
    }

    // 정렬
    result.sort((a: any, b: any) => {
      let valueA, valueB;

      switch (sortBy) {
        case 'spend':
          valueA = a.metrics.spend;
          valueB = b.metrics.spend;
          break;
        case 'leads':
          valueA = a.metrics.leads;
          valueB = b.metrics.leads;
          break;
        case 'cpl':
          valueA = a.metrics.cpl;
          valueB = b.metrics.cpl;
          break;
        default:
          valueA = a.name?.toLowerCase() || '';
          valueB = b.name?.toLowerCase() || '';
      }

      if (sortOrder === 'desc') {
        return valueA > valueB ? -1 : valueA < valueB ? 1 : 0;
      }
      return valueA < valueB ? -1 : valueA > valueB ? 1 : 0;
    });

    return NextResponse.json({
      success: true,
      ads: result,
      total: result.length,
      client_name: client.client_name,
      meta_error: metaError,
      data_source: dataSource,
      rate_limited: isRateLimited,
      rate_limit_remaining_minutes: rateLimitRemainingMinutes
    });

  } catch (error: any) {
    console.error('Error fetching ads:', error);
    return NextResponse.json({
      error: error.message || 'Internal server error',
      code: 'FETCH_ADS_FAILED'
    }, { status: 500 });
  }
}
