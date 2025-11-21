'use client'

import { useState } from 'react'
import { Sparkles, Loader2, RefreshCw } from 'lucide-react'
import { ExportData } from '@/lib/excelExport'

interface AIInsightsPanelProps {
  data: ExportData
  reportType?: 'weekly' | 'monthly' | 'custom'
}

export function AIInsightsPanel({ data, reportType = 'custom' }: AIInsightsPanelProps) {
  const [insights, setInsights] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const generateInsights = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/reports/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          kpi: data.kpi,
          dailyTrend: data.dailyTrend,
          platformPerformance: data.platformPerformance,
          topAds: data.topAds,
          dateRange: data.dateRange,
          reportType
        }),
      })

      if (!response.ok) {
        throw new Error('AI 인사이트 생성에 실패했습니다.')
      }

      const result = await response.json()
      setInsights(result.insights)
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-gradient-to-br from-purple-50 to-blue-50 p-6 rounded-lg border border-purple-200">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-purple-600" />
          <h3 className="text-lg font-semibold text-gray-800">AI 인사이트</h3>
        </div>

        <button
          onClick={generateInsights}
          disabled={loading}
          className={`
            inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all
            ${loading
              ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
              : 'bg-purple-600 text-white hover:bg-purple-700 shadow-md hover:shadow-lg'
            }
          `}
          aria-label="AI 인사이트 생성"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>분석 중...</span>
            </>
          ) : insights ? (
            <>
              <RefreshCw className="w-4 h-4" />
              <span>재생성</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              <span>인사이트 생성</span>
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
          <p className="text-sm">{error}</p>
        </div>
      )}

      {insights ? (
        <div className="bg-white p-6 rounded-lg shadow-sm">
          <div className="prose prose-sm max-w-none">
            <pre className="whitespace-pre-wrap font-sans text-gray-700 leading-relaxed">
              {insights}
            </pre>
          </div>
        </div>
      ) : !loading ? (
        <div className="text-center py-12 text-gray-500">
          <Sparkles className="w-12 h-12 mx-auto mb-3 text-purple-300" />
          <p className="text-sm">AI 인사이트를 생성하여 데이터 기반 의사결정을 시작하세요</p>
          <p className="text-xs mt-2">Claude AI가 현재 데이터를 분석하여 실행 가능한 제안을 제공합니다</p>
        </div>
      ) : (
        <div className="text-center py-12">
          <Loader2 className="w-12 h-12 mx-auto mb-3 text-purple-600 animate-spin" />
          <p className="text-sm text-gray-600">AI가 데이터를 분석하고 있습니다...</p>
        </div>
      )}
    </div>
  )
}
