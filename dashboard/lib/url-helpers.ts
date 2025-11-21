/**
 * URL 쿼리 파라미터 관리 헬퍼 함수
 */

import { format, parse, isValid, subDays, startOfDay } from 'date-fns'

export interface DateRange {
  from: Date | undefined
  to: Date | undefined
}

export interface FilterState {
  dateRange: DateRange
  platforms: string[]
  campaigns: string[]
}

/**
 * 날짜를 YYYY-MM-DD 형식으로 포맷
 */
export function formatDateForURL(date: Date | undefined): string {
  if (!date) return ''
  return format(date, 'yyyy-MM-dd')
}

/**
 * YYYY-MM-DD 문자열을 Date 객체로 파싱
 */
export function parseDateFromURL(dateString: string | null): Date | undefined {
  if (!dateString) return undefined
  try {
    const parsed = parse(dateString, 'yyyy-MM-dd', new Date())
    return isValid(parsed) ? startOfDay(parsed) : undefined
  } catch {
    return undefined
  }
}

/**
 * 쉼표로 구분된 문자열을 배열로 변환
 */
export function parseArrayFromURL(value: string | null): string[] {
  if (!value) return []
  return value.split(',').filter(Boolean)
}

/**
 * 배열을 쉼표로 구분된 문자열로 변환
 */
export function formatArrayForURL(array: string[]): string {
  return array.join(',')
}

/**
 * URL 쿼리 파라미터에서 필터 상태 읽기
 */
export function parseFiltersFromURL(searchParams: URLSearchParams): FilterState {
  const today = startOfDay(new Date())
  const defaultStart = subDays(today, 6) // 최근 7일

  return {
    dateRange: {
      from: parseDateFromURL(searchParams.get('start')) || defaultStart,
      to: parseDateFromURL(searchParams.get('end')) || today,
    },
    platforms: parseArrayFromURL(searchParams.get('platforms')),
    campaigns: parseArrayFromURL(searchParams.get('campaigns')),
  }
}

/**
 * 필터 상태를 URL 쿼리 파라미터로 변환
 */
export function buildURLFromFilters(
  baseSearchParams: URLSearchParams,
  filters: Partial<FilterState>
): URLSearchParams {
  const params = new URLSearchParams(baseSearchParams)

  // 날짜 범위 처리
  if (filters.dateRange?.from) {
    params.set('start', formatDateForURL(filters.dateRange.from))
  } else {
    params.delete('start')
  }

  if (filters.dateRange?.to) {
    params.set('end', formatDateForURL(filters.dateRange.to))
  } else {
    params.delete('end')
  }

  // 플랫폼 처리
  if (filters.platforms && filters.platforms.length > 0) {
    params.set('platforms', formatArrayForURL(filters.platforms))
  } else if (filters.platforms !== undefined) {
    params.delete('platforms')
  }

  // 캠페인 처리
  if (filters.campaigns && filters.campaigns.length > 0) {
    params.set('campaigns', formatArrayForURL(filters.campaigns))
  } else if (filters.campaigns !== undefined) {
    params.delete('campaigns')
  }

  return params
}

/**
 * 필터가 기본값인지 확인
 */
export function isDefaultFilter(filters: FilterState): boolean {
  const today = startOfDay(new Date())
  const defaultStart = subDays(today, 6)

  const isDefaultDateRange =
    filters.dateRange.from?.getTime() === defaultStart.getTime() &&
    filters.dateRange.to?.getTime() === today.getTime()

  return (
    isDefaultDateRange &&
    filters.platforms.length === 0 &&
    filters.campaigns.length === 0
  )
}
