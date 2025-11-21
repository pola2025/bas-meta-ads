'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { subDays, startOfDay } from 'date-fns'
import { useState, useEffect } from 'react'
import DateRangePicker from './DateRangePicker'
import SimpleDateInput from './SimpleDateInput'
import { PlatformFilter } from './PlatformFilter'
import { CampaignFilter } from './CampaignFilter'

type DateInputMode = 'picker' | 'simple'
type ComparisonMode = 'none' | 'weekly' | 'monthly'

export function FilterBar() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // 날짜 입력 모드 상태
  const [dateInputMode, setDateInputMode] = useState<DateInputMode>('picker')

  // 비교 모드 상태 - URL에서 초기화
  const compareParam = searchParams.get('compare') as ComparisonMode | null
  const [comparisonMode, setComparisonMode] = useState<ComparisonMode>(
    compareParam && ['none', 'weekly', 'monthly'].includes(compareParam)
      ? compareParam
      : 'none'
  )

  // URL 파라미터 변경 시 상태 동기화
  useEffect(() => {
    const urlCompare = searchParams.get('compare') as ComparisonMode | null
    if (urlCompare && ['none', 'weekly', 'monthly'].includes(urlCompare)) {
      setComparisonMode(urlCompare)
    } else {
      setComparisonMode('none')
    }
  }, [searchParams])

  // 🔍 CRITICAL FIX: URL에 날짜가 없으면 기본 날짜 자동 설정
  useEffect(() => {
    const hasStartDate = searchParams.has('start')
    const hasEndDate = searchParams.has('end')

    // URL에 날짜가 하나라도 없으면 기본 날짜 설정
    if (!hasStartDate || !hasEndDate) {
      console.log('⚠️ FilterBar: Missing date parameters in URL, initializing defaults...')
      console.log('  - has start:', hasStartDate, '| has end:', hasEndDate)

      const params = new URLSearchParams(searchParams)

      if (!hasStartDate) {
        const defaultStartStr = defaultStart.toISOString().split('T')[0]
        params.set('start', defaultStartStr)
        console.log('  - Setting default start:', defaultStartStr)
      }

      if (!hasEndDate) {
        const todayStr = today.toISOString().split('T')[0]
        params.set('end', todayStr)
        console.log('  - Setting default end:', todayStr)
      }

      router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    }
  }, [searchParams, pathname, router, defaultStart, today])

  // 기본 날짜 범위 (최근 7일)
  const today = startOfDay(new Date())
  const defaultStart = subDays(today, 6)

  // URL에서 필터 값 읽기
  const startDate = searchParams.get('start')
  const endDate = searchParams.get('end')
  const platforms = searchParams.get('platforms')?.split(',').filter(Boolean) || []
  const campaigns = searchParams.get('campaigns')?.split(',').filter(Boolean) || []

  // 날짜 범위를 Date 객체로 변환 (URL에 값이 없으면 기본값 사용)
  const dateRange = {
    from: startDate ? new Date(startDate) : defaultStart,
    to: endDate ? new Date(endDate) : today,
  }

  // 필터 변경 시 URL 업데이트 함수
  const updateFilters = (key: string, value: string | string[]) => {
    const params = new URLSearchParams(searchParams)

    if (Array.isArray(value)) {
      if (value.length > 0) {
        params.set(key, value.join(','))
      } else {
        params.delete(key)
      }
    } else {
      if (value) {
        params.set(key, value)
      } else {
        params.delete(key)
      }
    }

    router.push(`${pathname}?${params.toString()}`, { scroll: false })
  }

  // 날짜 범위 변경 핸들러 (DateRangePicker용)
  const handleDateChange = (range: { from: Date | undefined; to: Date | undefined }) => {
    const params = new URLSearchParams(searchParams)

    if (range.from) {
      params.set('start', range.from.toISOString().split('T')[0])
    } else {
      params.delete('start')
    }

    if (range.to) {
      params.set('end', range.to.toISOString().split('T')[0])
    } else {
      params.delete('end')
    }

    router.push(`${pathname}?${params.toString()}`, { scroll: false })
  }

  // 날짜 범위 변경 핸들러 (SimpleDateInput용)
  const handleSimpleDateChange = (start: string, end: string) => {
    const params = new URLSearchParams(searchParams)
    params.set('start', start)
    params.set('end', end)
    router.push(`${pathname}?${params.toString()}`, { scroll: false })
  }

  // 비교 모드 변경 핸들러 (상태 + URL 동시 업데이트)
  const handleComparisonModeChange = (mode: ComparisonMode) => {
    setComparisonMode(mode)
    updateFilters('compare', mode === 'none' ? '' : mode)
  }

  // 모든 필터 초기화
  const resetFilters = () => {
    setComparisonMode('none')
    router.push(pathname, { scroll: false })
  }

  // 활성화된 필터 개수 계산 (기본값과 다른 경우만)
  const activeFiltersCount = [
    startDate && startDate !== defaultStart.toISOString().split('T')[0],
    endDate && endDate !== today.toISOString().split('T')[0],
    platforms.length > 0,
    campaigns.length > 0,
    comparisonMode !== 'none'
  ].filter(Boolean).length

  return (
    <div className="bg-white p-6 rounded-lg shadow space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-800">필터</h2>
        {activeFiltersCount > 0 && (
          <button
            onClick={resetFilters}
            className="text-sm text-blue-600 hover:text-blue-800 transition-colors font-medium"
            aria-label="필터 초기화"
          >
            초기화 ({activeFiltersCount})
          </button>
        )}
      </div>

      {/* 날짜 입력 모드 선택 */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setDateInputMode('picker')}
          className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
            dateInputMode === 'picker'
              ? 'bg-blue-500 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          캘린더 선택
        </button>
        <button
          onClick={() => setDateInputMode('simple')}
          className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
            dateInputMode === 'simple'
              ? 'bg-blue-500 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          직접 입력
        </button>
      </div>

      {/* 비교 모드 선택 */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          비교 모드
        </label>
        <div className="flex gap-2">
          <button
            onClick={() => handleComparisonModeChange('none')}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
              comparisonMode === 'none'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            비교 없음
          </button>
          <button
            onClick={() => handleComparisonModeChange('weekly')}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
              comparisonMode === 'weekly'
                ? 'bg-green-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            주간 비교
          </button>
          <button
            onClick={() => handleComparisonModeChange('monthly')}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
              comparisonMode === 'monthly'
                ? 'bg-purple-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            월간 비교
          </button>
        </div>
        {comparisonMode !== 'none' && (
          <p className="mt-2 text-xs text-gray-600">
            {comparisonMode === 'weekly' && '선택한 기간과 이전 주를 비교합니다.'}
            {comparisonMode === 'monthly' && '선택한 기간과 이전 월을 비교합니다.'}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 날짜 범위 선택 */}
        <div className="lg:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            날짜 범위
          </label>
          {dateInputMode === 'picker' ? (
            <DateRangePicker
              value={dateRange}
              onChange={handleDateChange}
            />
          ) : (
            <SimpleDateInput
              onDateRangeChange={handleSimpleDateChange}
              defaultStart={startDate || ''}
              defaultEnd={endDate || ''}
            />
          )}
        </div>

        {/* 플랫폼 필터 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            플랫폼
          </label>
          <PlatformFilter
            value={platforms}
            onChange={(selected) => updateFilters('platforms', selected)}
          />
        </div>

        {/* 캠페인 필터 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            캠페인
          </label>
          <CampaignFilter
            value={campaigns}
            onChange={(selected) => updateFilters('campaigns', selected)}
          />
        </div>
      </div>

      {/* 활성화된 필터 태그 표시 */}
      {activeFiltersCount > 0 && (
        <div className="flex flex-wrap gap-2 pt-4 border-t border-gray-200">
          {comparisonMode !== 'none' && (
            <span className="inline-flex items-center gap-1 px-3 py-1 bg-purple-100 text-purple-700 text-sm rounded-full">
              {comparisonMode === 'weekly' ? '주간 비교' : '월간 비교'}
              <button
                onClick={() => handleComparisonModeChange('none')}
                className="hover:opacity-70"
                aria-label="비교 모드 제거"
              >
                ×
              </button>
            </span>
          )}
          {startDate && startDate !== defaultStart.toISOString().split('T')[0] && (
            <span className="inline-flex items-center gap-1 px-3 py-1 bg-blue-600/10 text-blue-600 text-sm rounded-full">
              시작: {startDate}
              <button
                onClick={() => updateFilters('start', '')}
                className="hover:text-blue-800"
                aria-label="시작일 제거"
              >
                ×
              </button>
            </span>
          )}
          {endDate && endDate !== today.toISOString().split('T')[0] && (
            <span className="inline-flex items-center gap-1 px-3 py-1 bg-blue-600/10 text-blue-600 text-sm rounded-full">
              종료: {endDate}
              <button
                onClick={() => updateFilters('end', '')}
                className="hover:text-blue-800"
                aria-label="종료일 제거"
              >
                ×
              </button>
            </span>
          )}
          {platforms.map((platform) => (
            <span
              key={platform}
              className="inline-flex items-center gap-1 px-3 py-1 bg-accent/10 text-accent text-sm rounded-full"
            >
              {platform}
              <button
                onClick={() => updateFilters('platforms', platforms.filter(p => p !== platform))}
                className="hover:opacity-70"
                aria-label={`${platform} 플랫폼 제거`}
              >
                ×
              </button>
            </span>
          ))}
          {campaigns.map((campaign) => (
            <span
              key={campaign}
              className="inline-flex items-center gap-1 px-3 py-1 bg-green-600/10 text-green-600 text-sm rounded-full"
            >
              {campaign}
              <button
                onClick={() => updateFilters('campaigns', campaigns.filter(c => c !== campaign))}
                className="hover:opacity-70"
                aria-label={`${campaign} 캠페인 제거`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
