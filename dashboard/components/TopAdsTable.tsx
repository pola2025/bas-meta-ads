'use client';

import { useState } from 'react';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import { TopAd } from '@/types/analytics';

interface TopAdsTableProps {
  data: TopAd[];
  avgCpl?: number;  // 평균 CPL (상태 표시용)
  showSparkline?: boolean;
  sparklineData?: Record<string, number[]>;  // ad_id -> 7일 CPL 추이
}

// 순위 뱃지 컴포넌트 (컴팩트)
function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <span className="text-base">🥇</span>;
  if (rank === 2) return <span className="text-base">🥈</span>;
  if (rank === 3) return <span className="text-base">🥉</span>;
  return <span className="text-xs text-gray-500 font-medium">{rank}</span>;
}

// 상태 아이콘 컴포넌트 (컴팩트)
function StatusIcon({ cpl, avgCpl, trend }: { cpl: number; avgCpl?: number; trend?: 'up' | 'down' | 'stable' }) {
  // CPL 기준 상태
  if (avgCpl) {
    if (cpl < avgCpl * 0.8) return <span title="효율 최고" className="text-green-500 text-sm">✅</span>;
    if (cpl > avgCpl * 1.2) return <span title="검토 필요" className="text-orange-500 text-sm">⚠️</span>;
  }

  // 트렌드 기준
  if (trend === 'up') return <span title="상승 중" className="text-blue-500 text-sm">📈</span>;
  if (trend === 'down') return <span title="하락 중" className="text-red-500 text-sm">📉</span>;

  return <span title="안정" className="text-gray-400 text-sm">●</span>;
}

// 미니 스파크라인
function MiniSparkline({ data, color = '#3B82F6' }: { data: number[]; color?: string }) {
  if (!data || data.length < 2) return null;

  const chartData = data.map((value, idx) => ({ value, idx }));

  return (
    <div className="w-12 h-5">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
          <Line
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={1.5}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// 리드 프로그레스 바 (칸칸이 채워지는 막대)
function LeadProgressBar({ leads, maxLeads }: { leads: number; maxLeads: number }) {
  const percentage = maxLeads > 0 ? (leads / maxLeads) * 100 : 0;
  const totalBlocks = 20; // 총 블록 수
  const filledBlocks = Math.round((percentage / 100) * totalBlocks);

  return (
    <div className="flex items-center gap-1.5 mt-1">
      {/* 블록 막대 */}
      <div className="flex-1 flex gap-[2px]">
        {Array.from({ length: totalBlocks }).map((_, i) => (
          <div
            key={i}
            className={`h-2 flex-1 rounded-[1px] transition-colors ${
              i < filledBlocks
                ? 'bg-emerald-500'
                : 'bg-gray-100'
            }`}
          />
        ))}
      </div>
      {/* 리드 숫자 표시 */}
      <span className="text-xs text-gray-500 font-medium w-10 text-right">
        {leads.toLocaleString()}건
      </span>
    </div>
  );
}

export function TopAdsTable({
  data,
  avgCpl,
  showSparkline = false,  // 기본값 false로 변경 (모바일 대응)
  sparklineData
}: TopAdsTableProps) {
  const [sortBy, setSortBy] = useState<'cpl' | 'leads' | 'spend'>('cpl');

  // 정렬된 데이터
  const sortedData = [...data].sort((a, b) => {
    switch (sortBy) {
      case 'cpl':
        return a.cpl - b.cpl;  // CPL 낮은 순
      case 'leads':
        return b.leads - a.leads;  // 리드 많은 순
      case 'spend':
        return b.spend - a.spend;  // 지출 많은 순
      default:
        return 0;
    }
  });

  // 평균 CPL 계산 (전달되지 않은 경우)
  const calculatedAvgCpl = avgCpl || (
    data.length > 0
      ? data.reduce((sum, ad) => sum + ad.cpl, 0) / data.length
      : 0
  );

  // 최대 리드 수 계산 (프로그레스 바용)
  const maxLeads = data.length > 0
    ? Math.max(...data.map(ad => ad.leads))
    : 0;

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* 헤더 */}
      <div className="px-4 py-3 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold text-gray-900">TOP 광고 성과</h3>
          <p className="text-xs text-gray-500">CPL 기준 효율 순위 (전체 기간)</p>
        </div>

        {/* 정렬 옵션 */}
        <div className="flex gap-1 bg-gray-100 p-0.5 rounded-lg self-start sm:self-auto">
          {(['cpl', 'leads', 'spend'] as const).map((option) => (
            <button
              key={option}
              onClick={() => setSortBy(option)}
              className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                sortBy === option
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {option === 'cpl' ? 'CPL' : option === 'leads' ? '리드' : '지출'}
            </button>
          ))}
        </div>
      </div>

      {/* 모바일: 세로 막대 차트 */}
      <div className="block md:hidden p-4">
        {/* 막대 차트 영역 */}
        <div className="flex items-end gap-2 mb-3" style={{ height: '160px' }}>
          {sortedData.slice(0, 10).map((ad, index) => {
            const rank = index + 1;
            const percentage = maxLeads > 0 ? (ad.leads / maxLeads) * 100 : 0;
            const barHeight = Math.max(percentage, 15); // 최소 15%

            return (
              <div key={ad.ad_id || index} className="flex-1 flex flex-col items-center h-full">
                {/* 리드 개수 표시 */}
                <div className="text-[11px] font-bold mb-1 text-gray-700">
                  {ad.leads}건
                </div>
                {/* 막대 컨테이너 */}
                <div className="flex-1 w-full flex items-end">
                  {/* 세로 막대 */}
                  <div
                    className={`w-full rounded-t-sm ${
                      ad.cpl > 20 ? 'bg-orange-400' : 'bg-emerald-500'
                    }`}
                    style={{ height: `${barHeight}%`, minHeight: '20px' }}
                  />
                </div>
                {/* 순위 */}
                <div className="text-xs text-gray-500 font-medium mt-1">
                  {rank <= 3 ? <RankBadge rank={rank} /> : rank}
                </div>
              </div>
            );
          })}
        </div>

        {/* 범례 및 요약 */}
        <div className="flex items-center justify-between text-xs text-gray-500 border-t border-gray-100 pt-2">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 bg-emerald-500 rounded-sm"></span> $20 이하
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 bg-orange-400 rounded-sm"></span> $20 초과
            </span>
          </div>
          <span>리드 기준 높이</span>
        </div>

        {/* 광고 목록 (간단히) */}
        <div className="mt-3 space-y-2">
          {sortedData.slice(0, 10).map((ad, index) => {
            const rank = index + 1;
            return (
              <div key={ad.ad_id || index} className="flex items-center gap-2 text-xs">
                <span className="w-5 text-center flex-shrink-0">
                  {rank <= 3 ? <RankBadge rank={rank} /> : <span className="text-gray-400">{rank}</span>}
                </span>
                <span className="flex-1 truncate text-gray-700">{ad.ad_name}</span>
                <span className="text-gray-500">{ad.leads}건</span>
                <span className={`font-semibold ${ad.cpl > 20 ? 'text-orange-600' : 'text-green-600'}`}>
                  ${ad.cpl.toFixed(0)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* PC: 테이블 레이아웃 */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-2 py-2 lg:py-3 text-left text-xs lg:text-sm font-medium text-gray-500 uppercase w-8 lg:w-10">
                #
              </th>
              <th className="px-2 py-2 lg:px-3 lg:py-3 text-left text-xs lg:text-sm font-medium text-gray-500 uppercase">
                광고명
              </th>
              <th className="px-2 py-2 lg:px-3 lg:py-3 text-right text-xs lg:text-sm font-medium text-gray-500 uppercase w-14 lg:w-20">
                리드
              </th>
              <th className="px-2 py-2 lg:px-3 lg:py-3 text-right text-xs lg:text-sm font-medium text-gray-500 uppercase w-16 lg:w-24">
                지출
              </th>
              <th className="px-2 py-2 lg:px-3 lg:py-3 text-right text-xs lg:text-sm font-medium text-gray-500 uppercase w-16 lg:w-20">
                CPL
              </th>
              <th className="px-2 py-2 lg:py-3 text-center text-xs font-medium text-gray-500 uppercase w-10 lg:w-12 whitespace-nowrap">
                상태
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {sortedData.map((ad, index) => {
              const rank = index + 1;
              const adSparkline = sparklineData?.[ad.ad_id];

              // 트렌드 계산 (스파크라인 데이터 기반)
              let trend: 'up' | 'down' | 'stable' = 'stable';
              if (adSparkline && adSparkline.length >= 2) {
                const recent = adSparkline.slice(-2);
                if (recent[1] > recent[0] * 1.1) trend = 'up';
                else if (recent[1] < recent[0] * 0.9) trend = 'down';
              }

              return (
                <tr
                  key={ad.ad_id || index}
                  className="hover:bg-gray-50 transition-colors"
                >
                  {/* 순위 */}
                  <td className="px-2 py-2 whitespace-nowrap text-center">
                    <RankBadge rank={rank} />
                  </td>

                  {/* 광고명 */}
                  <td className="px-2 py-2 lg:px-3">
                    <div className="max-w-[200px] lg:max-w-[320px] xl:max-w-[400px]">
                      <div className="text-xs lg:text-sm font-medium text-gray-900 truncate" title={ad.ad_name}>
                        {ad.ad_name}
                      </div>
                      <div className="text-xs lg:text-xs text-gray-400 truncate" title={ad.campaign_name}>
                        {ad.campaign_name}
                      </div>
                      {/* 리드 프로그레스 바 */}
                      <LeadProgressBar leads={ad.leads} maxLeads={maxLeads} />
                    </div>
                  </td>

                  {/* 리드 */}
                  <td className="px-2 py-2 lg:px-3 whitespace-nowrap text-right">
                    <span className="text-xs lg:text-sm font-semibold text-gray-900">
                      {ad.leads.toLocaleString()}
                    </span>
                  </td>

                  {/* 지출 */}
                  <td className="px-2 py-2 lg:px-3 whitespace-nowrap text-right">
                    <span className="text-xs lg:text-sm text-gray-700">
                      ${ad.spend.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </span>
                  </td>

                  {/* CPL */}
                  <td className="px-2 py-2 lg:px-3 whitespace-nowrap text-right">
                    <div className="flex items-center justify-end gap-1">
                      <span className={`text-xs lg:text-sm font-semibold ${
                        ad.cpl > 20
                          ? 'text-orange-600'
                          : 'text-green-600'
                      }`}>
                        ${ad.cpl.toFixed(2)}
                      </span>
                      {ad.cpl > 20 ? (
                        <span title="CPL $20 초과 - 검토 필요" className="text-orange-500 text-sm">⚠️</span>
                      ) : (
                        <span title="CPL $20 이하 - 양호" className="text-green-500 text-sm">✅</span>
                      )}
                    </div>
                  </td>

                  {/* 상태 */}
                  <td className="px-2 py-2 whitespace-nowrap text-center">
                    <StatusIcon
                      cpl={ad.cpl}
                      avgCpl={calculatedAvgCpl}
                      trend={trend}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 빈 상태 */}
      {data.length === 0 && (
        <div className="px-4 py-8 text-center">
          <p className="text-gray-500 text-sm">데이터가 없습니다</p>
        </div>
      )}

      {/* 범례 - 모바일에서는 숨김 */}
      {data.length > 0 && (
        <div className="hidden md:block px-4 py-2 bg-gray-50 border-t border-gray-100">
          <div className="flex items-center gap-3 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <span className="text-green-500">✅</span> CPL $20 이하
            </span>
            <span className="flex items-center gap-1">
              <span className="text-orange-500">⚠️</span> CPL $20 초과
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
