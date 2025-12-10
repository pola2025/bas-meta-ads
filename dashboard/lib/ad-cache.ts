/**
 * 광고 메타데이터 캐시 레이어
 *
 * Meta API 호출 최소화를 위해 Supabase ad_cache 테이블 활용
 *
 * [캐시 전략]
 * - 통계 데이터: raw_data 테이블 (항상)
 * - 광고 상태/objective/썸네일: 캐시 우선, 없으면 Meta API 1회 호출 후 캐시
 *
 * [캐시 업데이트 시점]
 * - 최초 접속 시 캐시 없으면 → Meta API 호출 → 캐시 저장
 * - on/off 제어 시 → Meta API 호출 → 해당 광고만 캐시 업데이트
 * - 신규 광고 발견 시 → 해당 광고만 Meta API 조회 → 캐시 추가
 *
 * [Rate Limit 쿨다운]
 * - Rate Limit 발생 시 30분간 Meta API 호출 차단
 * - 차단 중에는 만료된 캐시라도 사용 (stale data)
 */

import { supabaseAdmin } from './supabase-admin';

// 캐시에 저장되는 광고 메타데이터 타입
export interface CachedAdMeta {
  ad_id: string;
  ad_name: string;
  status: string;
  effective_status: string;
  configured_status: string;
  objective: string | null;
  thumbnail_url: string | null;
  daily_budget: number | null;
  lifetime_budget: number | null;
  campaign_id: string | null;
  campaign_name: string | null;
  campaign_status: string | null;
}

// 캐시 데이터 전체 타입
export interface AdCacheData {
  [ad_id: string]: CachedAdMeta;
}

// 캐시 조회 결과 타입
export interface CacheResult {
  data: AdCacheData | null;
  isExpired: boolean;         // 만료 여부
  isRateLimited: boolean;     // Rate Limit 쿨다운 중 여부
  rateLimitRemainingMinutes?: number;  // 쿨다운 남은 시간(분)
}

// 캐시 TTL (24시간)
const CACHE_TTL_HOURS = 24;

// Rate Limit 쿨다운 시간 (30분)
const RATE_LIMIT_COOLDOWN_MINUTES = 30;

/**
 * 캐시에서 광고 메타데이터 조회 (확장 버전)
 * - 만료 여부와 Rate Limit 상태도 함께 반환
 * - Rate Limit 쿨다운 중이거나 만료된 캐시라도 데이터는 반환 (stale data)
 */
export async function getAdCacheWithStatus(clientId: string): Promise<CacheResult> {
  try {
    const { data, error } = await supabaseAdmin
      .from('ad_cache')
      .select('ads_data, expires_at, rate_limit_until')
      .eq('client_id', clientId)
      .single();

    if (error || !data) {
      return { data: null, isExpired: true, isRateLimited: false };
    }

    const now = new Date();

    // Rate Limit 쿨다운 확인
    let isRateLimited = false;
    let rateLimitRemainingMinutes: number | undefined;

    if (data.rate_limit_until) {
      const rateLimitUntil = new Date(data.rate_limit_until);
      if (rateLimitUntil > now) {
        isRateLimited = true;
        rateLimitRemainingMinutes = Math.ceil((rateLimitUntil.getTime() - now.getTime()) / 60000);
      }
    }

    // 만료 확인
    const expiresAt = new Date(data.expires_at);
    const isExpired = expiresAt < now;

    if (isExpired) {
      console.log(`[AdCache] 캐시 만료됨 (stale data 반환): ${clientId}`);
    }

    // 만료되었어도 데이터는 반환 (Rate Limit 중이면 stale data라도 사용)
    return {
      data: data.ads_data as AdCacheData,
      isExpired,
      isRateLimited,
      rateLimitRemainingMinutes
    };
  } catch (err) {
    console.error('[AdCache] 캐시 조회 오류:', err);
    return { data: null, isExpired: true, isRateLimited: false };
  }
}

/**
 * 캐시에서 광고 메타데이터 조회 (기존 호환)
 * @returns 캐시 데이터 또는 null (캐시 없거나 만료)
 */
export async function getAdCache(clientId: string): Promise<AdCacheData | null> {
  const result = await getAdCacheWithStatus(clientId);
  // 만료되지 않은 유효한 캐시만 반환 (기존 동작 유지)
  if (result.data && !result.isExpired) {
    return result.data;
  }
  return null;
}

/**
 * 캐시에 광고 메타데이터 저장 (전체 덮어쓰기)
 * - 썸네일은 영구 캐시: 기존 썸네일이 있으면 유지
 */
export async function setAdCache(clientId: string, adsData: AdCacheData): Promise<boolean> {
  try {
    // 기존 캐시 조회 (썸네일 보존용)
    const { data: existingData } = await supabaseAdmin
      .from('ad_cache')
      .select('ads_data')
      .eq('client_id', clientId)
      .single();

    const existingAds = existingData?.ads_data as AdCacheData | null;

    // 기존 썸네일 보존: 새 데이터에 썸네일이 없으면 기존 것 유지
    if (existingAds) {
      for (const adId of Object.keys(adsData)) {
        if (!adsData[adId].thumbnail_url && existingAds[adId]?.thumbnail_url) {
          adsData[adId].thumbnail_url = existingAds[adId].thumbnail_url;
        }
      }
    }

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + CACHE_TTL_HOURS);

    const { error } = await supabaseAdmin
      .from('ad_cache')
      .upsert({
        client_id: clientId,
        ads_data: adsData,
        updated_at: new Date().toISOString(),
        expires_at: expiresAt.toISOString()
      }, {
        onConflict: 'client_id'
      });

    if (error) {
      console.error('[AdCache] 캐시 저장 오류:', error);
      return false;
    }

    console.log(`[AdCache] 캐시 저장 완료: ${clientId}, ${Object.keys(adsData).length}개 광고`);
    return true;
  } catch (err) {
    console.error('[AdCache] 캐시 저장 오류:', err);
    return false;
  }
}

/**
 * 특정 광고만 캐시 업데이트 (on/off 제어 시 사용)
 */
export async function updateAdInCache(
  clientId: string,
  adId: string,
  updates: Partial<CachedAdMeta>
): Promise<boolean> {
  try {
    // 기존 캐시 조회
    const existingCache = await getAdCache(clientId);
    if (!existingCache) {
      console.log(`[AdCache] 기존 캐시 없음, 업데이트 스킵: ${clientId}`);
      return false;
    }

    // 해당 광고 업데이트
    if (existingCache[adId]) {
      existingCache[adId] = {
        ...existingCache[adId],
        ...updates
      };
    }

    // 저장
    return await setAdCache(clientId, existingCache);
  } catch (err) {
    console.error('[AdCache] 광고 업데이트 오류:', err);
    return false;
  }
}

/**
 * 여러 광고 상태 일괄 업데이트 (on/off 일괄 제어 시 사용)
 */
export async function updateAdsStatusInCache(
  clientId: string,
  adIds: string[],
  newStatus: string
): Promise<boolean> {
  try {
    const existingCache = await getAdCache(clientId);
    if (!existingCache) {
      return false;
    }

    // 각 광고 상태 업데이트
    for (const adId of adIds) {
      if (existingCache[adId]) {
        existingCache[adId].status = newStatus;
        existingCache[adId].effective_status = newStatus;
      }
    }

    return await setAdCache(clientId, existingCache);
  } catch (err) {
    console.error('[AdCache] 일괄 상태 업데이트 오류:', err);
    return false;
  }
}

/**
 * Rate Limit 쿨다운 설정
 * - Meta API에서 Rate Limit 에러 발생 시 호출
 * - 30분간 Meta API 호출을 차단
 */
export async function setRateLimitCooldown(clientId: string): Promise<boolean> {
  try {
    const rateLimitUntil = new Date();
    rateLimitUntil.setMinutes(rateLimitUntil.getMinutes() + RATE_LIMIT_COOLDOWN_MINUTES);

    // 기존 행이 있으면 update, 없으면 insert with empty ads_data
    const { error } = await supabaseAdmin
      .from('ad_cache')
      .upsert({
        client_id: clientId,
        ads_data: {}, // 빈 객체로 설정 (NOT NULL 제약 충족)
        rate_limit_until: rateLimitUntil.toISOString(),
        updated_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24시간 후
      }, {
        onConflict: 'client_id',
        ignoreDuplicates: false
      });

    if (error) {
      console.error('[AdCache] Rate Limit 쿨다운 설정 오류:', error);
      return false;
    }

    console.log(`[AdCache] Rate Limit 쿨다운 설정 완료: ${clientId}, ${RATE_LIMIT_COOLDOWN_MINUTES}분`);
    return true;
  } catch (err) {
    console.error('[AdCache] Rate Limit 쿨다운 설정 오류:', err);
    return false;
  }
}

/**
 * Rate Limit 쿨다운 해제
 */
export async function clearRateLimitCooldown(clientId: string): Promise<boolean> {
  try {
    const { error } = await supabaseAdmin
      .from('ad_cache')
      .update({
        rate_limit_until: null,
        updated_at: new Date().toISOString()
      })
      .eq('client_id', clientId);

    if (error) {
      console.error('[AdCache] Rate Limit 쿨다운 해제 오류:', error);
      return false;
    }

    return true;
  } catch (err) {
    console.error('[AdCache] Rate Limit 쿨다운 해제 오류:', err);
    return false;
  }
}

/**
 * 캐시 삭제
 */
export async function deleteAdCache(clientId: string): Promise<boolean> {
  try {
    const { error } = await supabaseAdmin
      .from('ad_cache')
      .delete()
      .eq('client_id', clientId);

    if (error) {
      console.error('[AdCache] 캐시 삭제 오류:', error);
      return false;
    }

    return true;
  } catch (err) {
    console.error('[AdCache] 캐시 삭제 오류:', err);
    return false;
  }
}

/**
 * Meta API 응답을 캐시 데이터로 변환
 * - image_url 우선 사용 (더 고해상도), 없으면 thumbnail_url
 */
export function transformMetaAdsToCache(metaAds: any[]): AdCacheData {
  const cacheData: AdCacheData = {};

  for (const ad of metaAds) {
    // image_url 우선, 없으면 thumbnail_url 사용
    const thumbnailUrl = ad.creative?.image_url || ad.creative?.thumbnail_url || null;

    cacheData[ad.id] = {
      ad_id: ad.id,
      ad_name: ad.name,
      status: ad.status,
      effective_status: ad.effective_status,
      configured_status: ad.configured_status,
      objective: ad.campaign?.objective || null,
      thumbnail_url: thumbnailUrl,
      daily_budget: ad.campaign?.daily_budget
        ? parseFloat(ad.campaign.daily_budget) / 100
        : null,
      lifetime_budget: ad.campaign?.lifetime_budget
        ? parseFloat(ad.campaign.lifetime_budget) / 100
        : null,
      campaign_id: ad.campaign?.id || null,
      campaign_name: ad.campaign?.name || null,
      campaign_status: ad.campaign?.status || null
    };
  }

  return cacheData;
}

/**
 * 캐시에 없는 광고 ID 찾기 (신규 광고 감지용)
 */
export function findMissingAds(
  rawDataAdIds: string[],
  cachedAdIds: string[]
): string[] {
  const cachedSet = new Set(cachedAdIds);
  return rawDataAdIds.filter(id => !cachedSet.has(id));
}
