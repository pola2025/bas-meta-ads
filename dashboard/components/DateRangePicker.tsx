'use client'

import React, { useState } from 'react'
import { DayPicker, DateRange as DayPickerDateRange } from 'react-day-picker'
import { ko } from 'date-fns/locale'
import { format, subDays, startOfDay } from 'date-fns'
import 'react-day-picker/dist/style.css'

export interface DateRange {
  from: Date | undefined
  to: Date | undefined
}

interface DateRangePickerProps {
  value: DateRange
  onChange: (range: DateRange) => void
}

export default function DateRangePicker({ value, onChange }: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const today = startOfDay(new Date())
  const yesterday = startOfDay(subDays(today, 1))

  // 프리셋 버튼 설정
  const presets = [
    {
      label: '오늘',
      getValue: () => ({ from: today, to: today }),
    },
    {
      label: '어제',
      getValue: () => ({ from: yesterday, to: yesterday }),
    },
    {
      label: '최근 7일',
      getValue: () => ({ from: subDays(today, 6), to: today }),
    },
    {
      label: '최근 30일',
      getValue: () => ({ from: subDays(today, 29), to: today }),
    },
    {
      label: '최근 90일',
      getValue: () => ({ from: subDays(today, 89), to: today }),
    },
  ]

  // 날짜 범위 검증 (미래 날짜만 체크)
  const handleDateSelect = (range: DayPickerDateRange | undefined) => {
    if (!range) {
      onChange({ from: undefined, to: undefined })
      return
    }

    const { from, to } = range

    // from만 선택된 경우
    if (from && !to) {
      // 미래 날짜 체크
      if (from > today) {
        return
      }
      onChange({ from, to: undefined })
      return
    }

    // from, to 모두 선택된 경우
    if (from && to) {
      // 미래 날짜 체크
      if (to > today) {
        onChange({ from, to: today })
        return
      }


      onChange({ from, to })
    }
  }

  // 프리셋 버튼 클릭
  const handlePresetClick = (preset: typeof presets[0]) => {
    const range = preset.getValue()
    onChange(range)
  }

  // 날짜 범위 포맷팅
  const formatDateRange = () => {
    if (!value.from) {
      return '날짜 선택'
    }
    if (!value.to) {
      return format(value.from, 'yyyy-MM-dd', { locale: ko })
    }
    return `${format(value.from, 'yyyy-MM-dd', { locale: ko })} ~ ${format(value.to, 'yyyy-MM-dd', { locale: ko })}`
  }

  return (
    <div className="relative">
      {/* 날짜 범위 선택 버튼 */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:border-blue-600 hover:bg-gray-50 transition-colors"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-5 w-5 text-gray-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
        <span className="text-sm font-medium">{formatDateRange()}</span>
      </button>

      {/* 날짜 선택 패널 */}
      {isOpen && (
        <>
          {/* 배경 오버레이 */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />

          {/* 날짜 선택 패널 */}
          <div className="absolute top-full left-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-xl z-20 p-4">
            <div className="flex gap-4">
              {/* 프리셋 버튼 */}
              <div className="flex flex-col gap-2 pr-4 border-r border-gray-200">
                {presets.map((preset) => (
                  <button
                    key={preset.label}
                    onClick={() => handlePresetClick(preset)}
                    className="px-4 py-2 text-sm text-left rounded-md hover:bg-gray-100 transition-colors whitespace-nowrap"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              {/* 캘린더 */}
              <div className="date-range-picker">
                <DayPicker
                  mode="range"
                  selected={value}
                  onSelect={handleDateSelect}
                  locale={ko}
                  disabled={{ after: today }}
                  numberOfMonths={2}
                />
                <div className="mt-2 pt-2 border-t border-gray-200 text-xs text-gray-500">
                  * 원하는 기간을 자유롭게 선택할 수 있습니다
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* 스타일 오버라이드 */}
      <style jsx global>{`
        .date-range-picker .rdp {
          --rdp-cell-size: 40px;
          --rdp-accent-color: #0066cc;
          --rdp-background-color: #e6f2ff;
          margin: 0;
        }

        .date-range-picker .rdp-months {
          display: flex;
          gap: 1rem;
        }

        .date-range-picker .rdp-caption {
          display: flex;
          justify-content: center;
          padding: 0.5rem;
          font-weight: 600;
          color: #1f2937;
        }

        .date-range-picker .rdp-head_cell {
          color: #6b7280;
          font-weight: 500;
          font-size: 0.875rem;
        }

        .date-range-picker .rdp-day {
          border-radius: 0.5rem;
          transition: all 0.15s;
        }

        .date-range-picker .rdp-day:hover:not(.rdp-day_disabled) {
          background-color: #f3f4f6;
        }

        .date-range-picker .rdp-day_selected {
          background-color: var(--rdp-accent-color);
          color: white;
        }

        .date-range-picker .rdp-day_selected:hover {
          background-color: #0052a3;
        }

        .date-range-picker .rdp-day_range_middle {
          background-color: var(--rdp-background-color);
          color: #0066cc;
        }

        .date-range-picker .rdp-day_disabled {
          color: #d1d5db;
          cursor: not-allowed;
        }

        .date-range-picker .rdp-day_today {
          font-weight: 700;
          color: #0066cc;
        }
      `}</style>
    </div>
  )
}
