'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { subDays, startOfDay } from 'date-fns'
import { useState, useEffect } from 'react'
import DateRangePicker from './DateRangePicker'
import SimpleDateInput from './SimpleDateInput'
import { ChevronDown, ChevronUp, Filter } from 'lucide-react'

type DateInputMode = 'picker' | 'simple'
type ComparisonMode = 'none' | 'weekly' | 'monthly'

export function FilterBar() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // 날짜 입력 모드 상태
  const [dateInputMode, setDateInputMode] = useState<DateInputMode>('picker')

  // 모바일에서 필터 펼침/접힘
  const [isExpanded, setIsExpanded] = useState(false)

  // 비교 모드 상태 - URL에서 초기화
  const compareParam = searchParams.get('compare') as ComparisonMode | null
  const [comparisonMode, setComparisonMode] = useState<ComparisonMode>(
    compareParam && ['none', 'weekly', 'monthly'].includes(compareParam)
      ? compareParam
      : 'none'
  )

  // 기본 날짜 범위 (최근 7일)
  const today = startOfDay(new Date())
  const defaultStart = subDays(today, 6)

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

  // URL에서 필터 값 읽기
  const startDate = searchParams.get('start')
  const endDate = searchParams.get('end')

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
    comparisonMode !== 'none'
  ].filter(Boolean).length

  return (
    <div className="bg-white p-3 sm:p-6 rounded-lg shadow space-y-3 sm:space-y-4">
      {/* 헤더 - 모바일에서 터치로 펼침/접힘 */}
      <div
        className="flex items-center justify-between cursor-pointer sm:cursor-default"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-500 sm:hidden" />
          <h2 className="text-sm sm:text-lg font-semibold text-gray-800">필터</h2>
          {activeFiltersCount > 0 && (
            <span className="px-1.5 py-0.5 text-xs sm:text-xs bg-blue-100 text-blue-700 rounded-full">
              {activeFiltersCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {activeFiltersCount > 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                resetFilters()
              }}
              className="text-xs sm:text-sm text-blue-600 hover:text-blue-800 transition-colors font-medium"
              aria-label="필터 초기화"
            >
              초기화
            </button>
          )}
          <button className="sm:hidden p-1">
            {isExpanded ? (
              <ChevronUp className="w-4 h-4 text-gray-500" />
            ) : (
              <ChevronDown className="w-4 h-4 text-gray-500" />
            )}
          </button>
        </div>
      </div>

      {/* 필터 내용 - 모바일에서 접힘/펼침 가능 */}
      <div className={`space-y-3 sm:space-y-4 ${isExpanded ? 'block' : 'hidden sm:block'}`}>
        {/* 날짜 입력 모드 선택 */}
        <div className="flex gap-1 sm:gap-2">
          <button
            onClick={() => setDateInputMode('picker')}
            className={`px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm rounded-md transition-colors ${
              dateInputMode === 'picker'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            캘린더
          </button>
          <button
            onClick={() => setDateInputMode('simple')}
            className={`px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm rounded-md transition-colors ${
              dateInputMode === 'simple'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            직접 입력
          </button>
        </div>

        {/* 비교 모드 선택 */}
        <div>
          <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">
            비교 모드
          </label>
          <div className="flex flex-wrap gap-1 sm:gap-2">
            <button
              onClick={() => handleComparisonModeChange('none')}
              className={`px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm rounded-md transition-colors ${
                comparisonMode === 'none'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              없음
            </button>
            <button
              onClick={() => handleComparisonModeChange('weekly')}
              className={`px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm rounded-md transition-colors ${
                comparisonMode === 'weekly'
                  ? 'bg-green-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              주간
            </button>
            <button
              onClick={() => handleComparisonModeChange('monthly')}
              className={`px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm rounded-md transition-colors ${
                comparisonMode === 'monthly'
                  ? 'bg-purple-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              월간
            </button>
          </div>
        </div>

        {/* 날짜 범위 선택 */}
        <div>
          <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">
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
      </div>

      {/* 활성화된 필터 태그 표시 - 모바일에서도 항상 표시 */}
      {activeFiltersCount > 0 && (
        <div className="flex flex-wrap gap-1.5 sm:gap-2 pt-3 sm:pt-4 border-t border-gray-200">
          {comparisonMode !== 'none' && (
            <span className="inline-flex items-center gap-1 px-2 sm:px-3 py-0.5 sm:py-1 bg-purple-100 text-purple-700 text-xs sm:text-sm rounded-full">
              {comparisonMode === 'weekly' ? '주간' : '월간'}
              <button
                onClick={() => handleComparisonModeChange('none')}
                className="hover:opacity-70"
                aria-label="비교 모드 제거"
              >
                ×
              </button>
            </span>
          )}
          {startDate && (
            <span className="inline-flex items-center gap-1 px-2 sm:px-3 py-0.5 sm:py-1 bg-blue-100 text-blue-700 text-xs sm:text-sm rounded-full">
              {startDate}~{endDate}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
