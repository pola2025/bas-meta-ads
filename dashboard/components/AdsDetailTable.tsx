'use client'

import { useState } from 'react'
import { TopAd } from '@/types/analytics'
import { AdWithStatus } from '@/lib/api'
import { TrendingUp, TrendingDown, ChevronDown, ChevronUp, Circle } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { ko } from 'date-fns/locale'

interface AdsDetailTableProps {
  data: AdWithStatus[]
  onAdClick?: (ad: TopAd) => void
}

type SortKey = 'ad_name' | 'spend' | 'impressions' | 'clicks' | 'cpc' | 'leads' | 'cpl' | 'ctr' | 'cvr' | 'isActive' | 'lastActiveDate' | 'avg_watch_time'
type SortDirection = 'asc' | 'desc'

export function AdsDetailTable({ data, onAdClick }: AdsDetailTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('isActive')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [expandedAdId, setExpandedAdId] = useState<string | null>(null)
  const [showInactive, setShowInactive] = useState(true)

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDirection('desc')
    }
  }

  // 필터링 및 정렬
  const filteredData = showInactive ? data : data.filter(ad => ad.isActive)

  const sortedData = [...filteredData].sort((a, b) => {
    // 활성 상태 정렬 시 활성이 먼저
    if (sortKey === 'isActive') {
      if (a.isActive !== b.isActive) {
        return sortDirection === 'desc'
          ? (a.isActive ? -1 : 1)
          : (a.isActive ? 1 : -1)
      }
      // 같은 상태면 리드 순
      return b.leads - a.leads
    }

    const aVal = a[sortKey]
    const bVal = b[sortKey]

    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return sortDirection === 'asc' ? aVal - bVal : bVal - aVal
    }
    if (typeof aVal === 'boolean' && typeof bVal === 'boolean') {
      return sortDirection === 'asc'
        ? (aVal ? 1 : -1) - (bVal ? 1 : -1)
        : (bVal ? 1 : -1) - (aVal ? 1 : -1)
    }

    return sortDirection === 'asc'
      ? String(aVal).localeCompare(String(bVal))
      : String(bVal).localeCompare(String(aVal))
  })

  const activeCount = data.filter(ad => ad.isActive).length
  const inactiveCount = data.length - activeCount

  const SortIcon = ({ column }: { column: SortKey }) => {
    if (sortKey !== column) return null
    return sortDirection === 'asc' ? (
      <ChevronUp className="w-4 h-4 inline ml-1" />
    ) : (
      <ChevronDown className="w-4 h-4 inline ml-1" />
    )
  }

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('ko-KR').format(num)
  }

  const formatCurrency = (num: number) => {
    return `₩${Math.round(num).toLocaleString('ko-KR')}`
  }

  const formatPercentage = (num: number) => {
    return `${num.toFixed(2)}%`
  }

  const formatDate = (dateStr: string) => {
    try {
      return format(parseISO(dateStr), 'MM/dd', { locale: ko })
    } catch {
      return dateStr
    }
  }

  const formatWatchTime = (seconds?: number) => {
    if (!seconds || seconds === 0) return '-'
    if (seconds < 60) return `${seconds.toFixed(1)}s`
    const mins = Math.floor(seconds / 60)
    const secs = Math.round(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // 최대 리드 수 계산 (프로그레스 바용)
  const maxLeads = data.length > 0
    ? Math.max(...data.map(ad => ad.leads))
    : 0

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      {/* PC 헤더 */}
      <div className="hidden md:block px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">광고별 상세 성과</h2>
            <p className="text-sm text-gray-500 mt-1">
              총 {data.length}개 광고 •
              <span className="text-green-600 ml-1">
                <Circle className="w-2 h-2 inline fill-green-500 mr-1" />
                활성 {activeCount}개
              </span>
              <span className="text-gray-400 ml-2">
                <Circle className="w-2 h-2 inline fill-gray-300 mr-1" />
                비활성 {inactiveCount}개
              </span>
            </p>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
              className="rounded border-gray-300"
            />
            비활성 광고 표시
          </label>
        </div>
      </div>

      {/* 모바일 헤더 */}
      <div className="block md:hidden px-3 py-3 border-b border-gray-200">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-gray-900 shrink-0">광고별 성과</h2>
          <div className="flex items-center gap-2">
            {/* 정렬 드롭다운 */}
            <select
              value={sortKey}
              onChange={(e) => {
                setSortKey(e.target.value as SortKey)
                setSortDirection('desc')
              }}
              className="text-xs border border-gray-200 rounded-md px-2 py-1.5 bg-white text-gray-700"
            >
              <option value="isActive">활성순</option>
              <option value="leads">리드순</option>
              <option value="cpl">CPL순</option>
              <option value="spend">지출순</option>
              <option value="ctr">CTR순</option>
            </select>
            {/* 비활성 토글 */}
            <button
              onClick={() => setShowInactive(!showInactive)}
              className={`text-xs px-2 py-1.5 rounded-md border ${
                showInactive
                  ? 'bg-gray-100 border-gray-300 text-gray-700'
                  : 'bg-white border-gray-200 text-gray-400'
              }`}
            >
              {showInactive ? `전체 ${data.length}` : `활성 ${activeCount}`}
            </button>
          </div>
        </div>
      </div>

      {/* 모바일: 그리드 테이블 */}
      <div className="block md:hidden">
        {/* 테이블 헤더 */}
        <div className="grid grid-cols-[auto_1fr_45px_40px_45px] gap-1 px-3 py-2 bg-gray-50 border-b border-gray-200 text-[10px] text-gray-500 font-medium">
          <span className="w-4"></span>
          <span>광고명</span>
          <span className="text-right">노출</span>
          <span className="text-right">리드</span>
          <span className="text-right">CPL</span>
        </div>

        {/* 테이블 바디 */}
        <div className="divide-y divide-gray-100">
          {sortedData.map((ad, index) => (
            <div
              key={ad.ad_id}
              className={`${!ad.isActive ? 'bg-gray-50/70' : ''}`}
            >
              {/* 메인 행 */}
              <div
                className="grid grid-cols-[auto_1fr_45px_40px_45px] gap-1 px-3 py-2.5 items-center cursor-pointer"
                onClick={() => {
                  setExpandedAdId(expandedAdId === ad.ad_id ? null : ad.ad_id)
                  onAdClick?.(ad)
                }}
              >
                {/* 상태 */}
                <span className="w-4 flex items-center justify-center">
                  {ad.isActive ? (
                    <Circle className="w-2 h-2 fill-green-500 text-green-500" />
                  ) : (
                    <Circle className="w-2 h-2 fill-gray-300 text-gray-300" />
                  )}
                </span>
                {/* 광고명 */}
                <div className="min-w-0">
                  <p className={`text-[11px] font-medium truncate ${ad.isActive ? 'text-gray-900' : 'text-gray-500'}`}>
                    {ad.ad_name}
                  </p>
                </div>
                {/* 노출 */}
                <span className={`text-[11px] text-right ${ad.isActive ? 'text-gray-600' : 'text-gray-400'}`}>
                  {ad.impressions >= 1000 ? (ad.impressions/1000).toFixed(0) + 'K' : ad.impressions}
                </span>
                {/* 리드 */}
                <span className={`text-[11px] font-bold text-right ${ad.isActive ? 'text-blue-600' : 'text-blue-400'}`}>
                  {ad.leads}
                </span>
                {/* CPL */}
                <span className={`text-[11px] font-bold text-right ${
                  ad.cpl > 20000 ? 'text-orange-600' : ad.cpl > 0 ? 'text-green-600' : 'text-gray-400'
                }`}>
                  {ad.cpl > 0 ? `₩${Math.round(ad.cpl).toLocaleString('ko-KR')}` : '-'}
                </span>
              </div>

              {/* 확장 시 상세 정보 */}
              <div
                className={`overflow-hidden transition-all duration-200 ease-in-out ${
                  expandedAdId === ad.ad_id ? 'max-h-48 opacity-100' : 'max-h-0 opacity-0'
                }`}
              >
                <div className="px-3 pb-3 pt-1">
                  {/* 캠페인명 */}
                  <p className="text-[10px] text-gray-400 truncate mb-2">{ad.campaign_name}</p>
                  {/* 리드 프로그레스 바 */}
                  <div className="flex items-center gap-2 mb-3">
                    <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${ad.isActive ? 'bg-emerald-500' : 'bg-emerald-300'}`}
                        style={{ width: `${maxLeads > 0 ? (ad.leads / maxLeads) * 100 : 0}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-gray-500">
                      {Math.round((ad.leads / maxLeads) * 100)}%
                    </span>
                  </div>
                  {/* 상세 지표 그리드 */}
                  <div className="grid grid-cols-5 gap-2 text-center">
                    <div className="bg-gray-50 rounded py-1.5">
                      <p className="text-[9px] text-gray-500">지출</p>
                      <p className={`text-[11px] font-bold ${ad.isActive ? 'text-gray-900' : 'text-gray-500'}`}>
                        ${ad.spend >= 1000 ? (ad.spend/1000).toFixed(1) + 'K' : ad.spend.toFixed(0)}
                      </p>
                    </div>
                    <div className="bg-gray-50 rounded py-1.5">
                      <p className="text-[9px] text-gray-500">클릭</p>
                      <p className={`text-[11px] font-bold ${ad.isActive ? 'text-gray-900' : 'text-gray-500'}`}>
                        {ad.clicks >= 1000 ? (ad.clicks/1000).toFixed(1) + 'K' : ad.clicks}
                      </p>
                    </div>
                    <div className="bg-gray-50 rounded py-1.5">
                      <p className="text-[9px] text-gray-500">CTR</p>
                      <p className={`text-[11px] font-bold ${ad.isActive ? 'text-blue-600' : 'text-blue-400'}`}>
                        {ad.ctr.toFixed(1)}%
                      </p>
                    </div>
                    <div className="bg-gray-50 rounded py-1.5">
                      <p className="text-[9px] text-gray-500">CVR</p>
                      <p className={`text-[11px] font-bold ${ad.isActive ? 'text-teal-600' : 'text-teal-400'}`}>
                        {ad.cvr.toFixed(1)}%
                      </p>
                    </div>
                    <div className="bg-gray-50 rounded py-1.5">
                      <p className="text-[9px] text-gray-500">시청</p>
                      <p className={`text-[11px] font-bold ${ad.isActive ? 'text-purple-600' : 'text-purple-400'}`}>
                        {formatWatchTime(ad.avg_watch_time)}
                      </p>
                    </div>
                  </div>
                  {/* 최근 활동일 */}
                  <p className="text-[10px] text-gray-400 mt-2 text-right">
                    최근 활동: {formatDate(ad.lastActiveDate)}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {sortedData.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500 text-sm">데이터가 없습니다</p>
          </div>
        )}
      </div>

      {/* PC: 테이블 */}
      <div className="hidden md:block overflow-x-auto max-h-[600px] overflow-y-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10 shadow-sm">
            <tr>
              <th
                className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 w-14 whitespace-nowrap"
                onClick={() => handleSort('isActive')}
              >
                상태 <SortIcon column="isActive" />
              </th>
              <th
                className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 min-w-[200px]"
                onClick={() => handleSort('ad_name')}
              >
                광고명 <SortIcon column="ad_name" />
              </th>
              <th
                className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 w-24 whitespace-nowrap"
                onClick={() => handleSort('lastActiveDate')}
              >
                최근활동 <SortIcon column="lastActiveDate" />
              </th>
              <th
                className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 w-24"
                onClick={() => handleSort('spend')}
              >
                지출 <SortIcon column="spend" />
              </th>
              <th
                className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 w-20"
                onClick={() => handleSort('leads')}
              >
                리드 <SortIcon column="leads" />
              </th>
              <th
                className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 w-20"
                onClick={() => handleSort('cpl')}
              >
                CPL <SortIcon column="cpl" />
              </th>
              <th
                className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 w-24"
                onClick={() => handleSort('impressions')}
              >
                노출 <SortIcon column="impressions" />
              </th>
              <th
                className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 w-20"
                onClick={() => handleSort('clicks')}
              >
                클릭 <SortIcon column="clicks" />
              </th>
              <th
                className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 w-16"
                onClick={() => handleSort('ctr')}
              >
                CTR <SortIcon column="ctr" />
              </th>
              <th
                className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 w-16"
                onClick={() => handleSort('cvr')}
              >
                CVR <SortIcon column="cvr" />
              </th>
              <th
                className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 w-16"
                onClick={() => handleSort('avg_watch_time')}
              >
                시청 <SortIcon column="avg_watch_time" />
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-neutral-200">
            {sortedData.map((ad, index) => (
              <tr
                key={ad.ad_id}
                className={`hover:bg-gray-50 transition-colors cursor-pointer ${
                  !ad.isActive ? 'bg-gray-50 opacity-70' : ''
                }`}
                onClick={() => {
                  setExpandedAdId(expandedAdId === ad.ad_id ? null : ad.ad_id)
                  onAdClick?.(ad)
                }}
              >
                {/* 상태 표시 */}
                <td className="px-4 py-3 text-center">
                  {ad.isActive ? (
                    <Circle className="w-3 h-3 fill-green-500 text-green-500 mx-auto" />
                  ) : (
                    <Circle className="w-3 h-3 fill-gray-300 text-gray-300 mx-auto" />
                  )}
                </td>
                {/* 광고명 */}
                <td className="px-4 py-3">
                  <div className="flex items-center">
                    <span className="text-xs font-medium text-gray-400 mr-3">
                      {index + 1}
                    </span>
                    <div className="flex-1 min-w-[180px]">
                      <div className={`text-sm font-medium ${ad.isActive ? 'text-gray-900' : 'text-gray-500'}`}>
                        {ad.ad_name}
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        {ad.campaign_name}
                      </div>
                      {/* 리드 프로그레스 바 */}
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <div className="flex-1 flex gap-[2px]">
                          {Array.from({ length: 20 }).map((_, i) => {
                            const percentage = maxLeads > 0 ? (ad.leads / maxLeads) * 100 : 0
                            const filledBlocks = Math.round((percentage / 100) * 20)
                            return (
                              <div
                                key={i}
                                className={`h-2 flex-1 rounded-[1px] transition-colors ${
                                  i < filledBlocks
                                    ? ad.isActive ? 'bg-emerald-500' : 'bg-emerald-200'
                                    : 'bg-gray-100'
                                }`}
                              />
                            )
                          })}
                        </div>
                        <span className={`text-xs font-medium w-10 text-right whitespace-nowrap ${ad.isActive ? 'text-gray-500' : 'text-gray-400'}`}>
                          {ad.leads.toLocaleString()}건
                        </span>
                      </div>
                    </div>
                  </div>
                </td>
                {/* 최근 활동일 */}
                <td className="px-4 py-3 text-center">
                  <span className={`text-xs ${ad.isActive ? 'text-green-600' : 'text-gray-400'}`}>
                    {formatDate(ad.lastActiveDate)}
                  </span>
                </td>
                {/* 지출 */}
                <td className="px-4 py-3 text-center">
                  <span className={`text-sm font-semibold ${ad.isActive ? 'text-gray-900' : 'text-gray-500'}`}>
                    {formatCurrency(ad.spend)}
                  </span>
                </td>
                {/* 리드 */}
                <td className="px-4 py-3 text-center">
                  <span className={`text-sm font-semibold ${ad.isActive ? 'text-blue-600' : 'text-blue-400'}`}>
                    {formatNumber(ad.leads)}
                  </span>
                </td>
                {/* CPL */}
                <td className="px-4 py-3 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <span className={`text-sm font-semibold ${
                      ad.cpl > 20
                        ? 'text-orange-600'
                        : ad.cpl > 0
                        ? 'text-green-600'
                        : ad.isActive
                        ? 'text-gray-900'
                        : 'text-gray-500'
                    }`}>
                      {ad.cpl > 0 ? formatCurrency(ad.cpl) : '-'}
                    </span>
                    {ad.cpl > 0 && (
                      ad.cpl > 20 ? (
                        <span title="CPL $20 초과 - 검토 필요" className="text-orange-500 text-sm">⚠️</span>
                      ) : (
                        <span title="CPL $20 이하 - 양호" className="text-green-500 text-sm">✅</span>
                      )
                    )}
                  </div>
                </td>
                {/* 노출 */}
                <td className="px-4 py-3 text-center">
                  <span className={`text-sm ${ad.isActive ? 'text-gray-700' : 'text-gray-400'}`}>
                    {formatNumber(ad.impressions)}
                  </span>
                </td>
                {/* 클릭 */}
                <td className="px-4 py-3 text-center">
                  <span className={`text-sm ${ad.isActive ? 'text-gray-700' : 'text-gray-400'}`}>
                    {formatNumber(ad.clicks)}
                  </span>
                </td>
                {/* CTR */}
                <td className="px-4 py-3 text-center">
                  <div className="flex items-center justify-center">
                    <span className={`text-sm ${ad.isActive ? 'text-gray-700' : 'text-gray-400'}`}>
                      {formatPercentage(ad.ctr)}
                    </span>
                    {ad.ctr > 2 && ad.isActive && (
                      <TrendingUp className="w-3 h-3 text-green-600 ml-1" />
                    )}
                  </div>
                </td>
                {/* CVR */}
                <td className="px-4 py-3 text-center">
                  <div className="flex items-center justify-center">
                    <span className={`text-sm ${ad.isActive ? 'text-gray-700' : 'text-gray-400'}`}>
                      {formatPercentage(ad.cvr)}
                    </span>
                    {ad.cvr > 5 && ad.isActive && (
                      <TrendingUp className="w-3 h-3 text-green-600 ml-1" />
                    )}
                  </div>
                </td>
                {/* 평균 시청시간 */}
                <td className="px-4 py-3 text-center">
                  <span className={`text-sm ${ad.isActive ? 'text-purple-600' : 'text-purple-400'}`}>
                    {formatWatchTime(ad.avg_watch_time)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {data.length === 0 && (
        <div className="hidden md:block text-center py-12">
          <p className="text-gray-500">데이터가 없습니다</p>
        </div>
      )}
    </div>
  )
}
