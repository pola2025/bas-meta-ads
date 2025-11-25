/**
 * 멀티클라이언트 대시보드 접근 제어 유틸리티
 */

import { supabase } from './supabase';

// 접근 모드 타입
export type AccessMode = 'admin' | 'client' | 'denied';

// 클라이언트 정보 타입
export interface ClientInfo {
  id: string;
  client_name: string;
  slug: string;
}

// 접근 제어 결과 타입
export interface AccessControlResult {
  mode: AccessMode;
  clientId: string | null;
  clientName: string | null;
  clientSlug: string | null;
  allClients?: ClientInfo[];
}

// 관리자 키 (환경 변수에서 로드)
const ADMIN_KEY = process.env.NEXT_PUBLIC_ADMIN_KEY;

/**
 * URL 파라미터 기반 접근 제어 검증
 * @param adminParam - admin 쿼리 파라미터 값
 * @param clientParam - client 쿼리 파라미터 값 (slug)
 */
export async function validateAccess(
  adminParam: string | null,
  clientParam: string | null
): Promise<AccessControlResult> {
  // 1. 관리자 모드 확인
  if (adminParam && adminParam === ADMIN_KEY) {
    // 전체 클라이언트 목록 조회
    const { data: clients } = await supabase
      .from('clients')
      .select('id, client_name, slug')
      .eq('is_active', true)
      .order('client_name');

    return {
      mode: 'admin',
      clientId: null,
      clientName: null,
      clientSlug: null,
      allClients: clients || []
    };
  }

  // 2. 클라이언트 모드 확인
  if (clientParam) {
    const { data: client } = await supabase
      .from('clients')
      .select('id, client_name, slug')
      .eq('slug', clientParam)
      .eq('is_active', true)
      .single();

    if (client) {
      return {
        mode: 'client',
        clientId: client.id,
        clientName: client.client_name,
        clientSlug: client.slug
      };
    }
  }

  // 3. 접근 거부
  return {
    mode: 'denied',
    clientId: null,
    clientName: null,
    clientSlug: null
  };
}

/**
 * 클라이언트 목록 조회 (관리자용)
 */
export async function getAllClients(): Promise<ClientInfo[]> {
  const { data } = await supabase
    .from('clients')
    .select('id, client_name, slug')
    .eq('is_active', true)
    .order('client_name');

  return data || [];
}

/**
 * slug로 클라이언트 정보 조회
 */
export async function getClientBySlug(slug: string): Promise<ClientInfo | null> {
  const { data } = await supabase
    .from('clients')
    .select('id, client_name, slug')
    .eq('slug', slug)
    .eq('is_active', true)
    .single();

  return data;
}

/**
 * 관리자 키 검증
 */
export function isValidAdminKey(key: string | null): boolean {
  if (!key || !ADMIN_KEY) return false;
  return key === ADMIN_KEY;
}
