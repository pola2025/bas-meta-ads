'use client'

import { useState } from 'react'
import { TopAd } from '@/types/analytics'
import { TrendingUp, TrendingDown, ChevronDown, ChevronUp } from 'lucide-react'

interface AdsDetailTableProps {
  data: TopAd[]
  onAdClick?: (ad: TopAd) => void
}

type SortKey = 'ad_name' | 'spend' | 'impressions' | 'clicks' | 'cpc' | 'leads' | 'cpl' | 'ctr' | 'cvr'
type SortDirection = 'asc' | 'desc'

export function AdsDetailTable({ data, onAdClick }: AdsDetailTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('spend')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [expandedAdId, setExpandedAdId] = useState<string | null>(null)

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDirection('desc')
    }
  }

  const sortedData = [...data].sort((a, b) => {
    const aVal = a[sortKey]
    const bVal = b[sortKey]

    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return sortDirection === 'asc' ? aVal - bVal : bVal - aVal
    }

    return sortDirection === 'asc'
      ? String(aVal).localeCompare(String(bVal))
      : String(bVal).localeCompare(String(aVal))
  })

  const SortIcon = ({ column }: { column: SortKey }) => {
    if (sortKey !== column) return null
    return sortDirection === 'asc' ? (
      <ChevronUp className="w-4 h-4 inline ml-1" />
    ) : (
      <ChevronDown className="w-4 h-4 inline ml-1" />
    )
  }

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US').format(num)
  }

  const formatCurrency = (num: number) => {
    return `$${num.toFixed(2)}`
  }

  const formatPercentage = (num: number) => {
    return `${num.toFixed(2)}%`
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">광고별 상세 성과</h2>
        <p className="text-sm text-gray-500 mt-1">
          총 {data.length}개 광고 • 클릭하여 일별 추이 확인
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('ad_name')}
              >
                광고명 <SortIcon column="ad_name" />
              </th>
              <th
                className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('spend')}
              >
                지출 <SortIcon column="spend" />
              </th>
              <th
                className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('impressions')}
              >
                노출 <SortIcon column="impressions" />
              </th>
              <th
                className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('clicks')}
              >
                클릭 <SortIcon column="clicks" />
              </th>
              <th
                className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('cpc')}
              >
                CPC <SortIcon column="cpc" />
              </th>
              <th
                className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('leads')}
              >
                리드 <SortIcon column="leads" />
              </th>
              <th
                className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('cpl')}
              >
                CPL <SortIcon column="cpl" />
              </th>
              <th
                className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('ctr')}
              >
                CTR <SortIcon column="ctr" />
              </th>
              <th
                className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('cvr')}
              >
                CVR <SortIcon column="cvr" />
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-neutral-200">
            {sortedData.map((ad, index) => (
              <tr
                key={ad.ad_id}
                className="hover:bg-gray-50 transition-colors cursor-pointer"
                onClick={() => {
                  setExpandedAdId(expandedAdId === ad.ad_id ? null : ad.ad_id)
                  onAdClick?.(ad)
                }}
              >
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <span className="text-xs font-medium text-gray-400 mr-3">
                      {index + 1}
                    </span>
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {ad.ad_name}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {ad.ad_id}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <span className="text-sm font-semibold text-gray-900">
                    {formatCurrency(ad.spend)}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <span className="text-sm text-gray-700">
                    {formatNumber(ad.impressions)}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <span className="text-sm text-gray-700">
                    {formatNumber(ad.clicks)}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <span className="text-sm text-gray-700">
                    {formatCurrency(ad.cpc)}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <span className="text-sm font-semibold text-blue-600">
                    {formatNumber(ad.leads)}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <span className="text-sm font-semibold text-gray-900">
                    {formatCurrency(ad.cpl)}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <div className="flex items-center justify-end">
                    <span className="text-sm text-gray-700">
                      {formatPercentage(ad.ctr)}
                    </span>
                    {ad.ctr > 2 && (
                      <TrendingUp className="w-4 h-4 text-green-600 ml-1" />
                    )}
                    {ad.ctr < 1 && (
                      <TrendingDown className="w-4 h-4 text-red-600 ml-1" />
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <div className="flex items-center justify-end">
                    <span className="text-sm text-gray-700">
                      {formatPercentage(ad.cvr)}
                    </span>
                    {ad.cvr > 5 && (
                      <TrendingUp className="w-4 h-4 text-green-600 ml-1" />
                    )}
                    {ad.cvr < 2 && (
                      <TrendingDown className="w-4 h-4 text-red-600 ml-1" />
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {data.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500">데이터가 없습니다</p>
        </div>
      )}
    </div>
  )
}
