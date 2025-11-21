'use client'

import { subDays, differenceInDays } from 'date-fns'
import DateRangePicker from './DateRangePicker'

interface ComparisonDatePickerProps {
  primaryRange: { from: Date; to: Date }
  comparisonRange: { from: Date | undefined; to: Date | undefined }
  onChange: (range: { from: Date | undefined; to: Date | undefined }) => void
}

export function ComparisonDatePicker({
  primaryRange,
  comparisonRange,
  onChange
}: ComparisonDatePickerProps) {
  // 기본 기간의 일수 계산
  const daysDiff = differenceInDays(primaryRange.to, primaryRange.from) + 1

  // 자동으로 이전 기간 설정
  const autoSetPreviousPeriod = () => {
    const from = subDays(primaryRange.from, daysDiff)
    const to = subDays(primaryRange.from, 1)
    onChange({ from, to })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-700">비교 기간 선택</h3>
        <button
          onClick={autoSetPreviousPeriod}
          className="text-xs text-blue-600 hover:text-blue-600-hover font-medium"
        >
          이전 {daysDiff}일로 설정
        </button>
      </div>

      <DateRangePicker
        value={comparisonRange}
        onChange={onChange}
      />

      {comparisonRange.from && comparisonRange.to && (
        <div className="text-xs text-gray-500 space-y-1">
          <div>기본 기간: {primaryRange.from.toLocaleDateString('ko-KR')} ~ {primaryRange.to.toLocaleDateString('ko-KR')}</div>
          <div>비교 기간: {comparisonRange.from.toLocaleDateString('ko-KR')} ~ {comparisonRange.to.toLocaleDateString('ko-KR')}</div>
        </div>
      )}
    </div>
  )
}
