'use client'

import { useState } from 'react'
import { ArrowLeftRight } from 'lucide-react'

interface ComparisonToggleProps {
  enabled: boolean
  onToggle: (enabled: boolean) => void
}

export function ComparisonToggle({ enabled, onToggle }: ComparisonToggleProps) {
  return (
    <div className="flex items-center gap-3">
      <button
        onClick={() => onToggle(!enabled)}
        className={`
          flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all
          ${enabled
            ? 'bg-blue-600 text-white shadow-md'
            : 'bg-white text-gray-700 border border-gray-300 hover:border-blue-600'
          }
        `}
        aria-label={enabled ? '비교 모드 끄기' : '비교 모드 켜기'}
      >
        <ArrowLeftRight className="w-4 h-4" />
        <span>기간 비교</span>
      </button>

      {enabled && (
        <span className="text-sm text-gray-600">
          이전 기간과 비교하여 변화량을 확인하세요
        </span>
      )}
    </div>
  )
}
