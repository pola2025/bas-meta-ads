'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { PlatformPerformance } from '@/types/analytics';

interface PlatformChartProps {
  data: PlatformPerformance[];
  dateRange?: { start: string; end: string };
}

// 플랫폼별 색상
const PLATFORM_COLORS: Record<string, string> = {
  facebook: '#1877F2',
  instagram: '#E4405F',
  audience_network: '#4267B2',
  messenger: '#0084FF',
  unknown: '#6B7280',
  Meta: '#6B7280'
};

// 플랫폼 이름 한글화
const PLATFORM_NAMES: Record<string, string> = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  audience_network: 'Audience Network',
  messenger: 'Messenger',
  unknown: '기타',
  Meta: 'Meta'
};

export function PlatformChart({ data, dateRange }: PlatformChartProps) {
  // 총계 계산
  const totalSpend = data.reduce((sum, d) => sum + d.spend, 0);
  const totalLeads = data.reduce((sum, d) => sum + d.leads, 0);

  // 도넛 차트용 데이터 (지출 비율)
  const pieData = data.map(d => ({
    name: PLATFORM_NAMES[d.platform] || d.platform,
    value: d.spend,
    percentage: totalSpend > 0 ? (d.spend / totalSpend) * 100 : 0,
    color: PLATFORM_COLORS[d.platform] || PLATFORM_COLORS.unknown
  }));

  // 효율 최고 플랫폼 찾기 (CPL 기준, 리드 있는 것만)
  const platformsWithLeads = data.filter(d => d.leads > 0);
  const bestPlatform = platformsWithLeads.length > 0
    ? platformsWithLeads.reduce((best, d) => d.cpl < best.cpl ? d : best)
    : null;

  // 커스텀 툴팁
  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || payload.length === 0) return null;

    const data = payload[0].payload;
    return (
      <div className="bg-white p-3 rounded-lg shadow-lg border border-gray-200">
        <p className="font-semibold text-gray-900">{data.name}</p>
        <p className="text-sm text-gray-600">
          지출: ${data.value.toLocaleString('en-US', { maximumFractionDigits: 0 })}
        </p>
        <p className="text-sm text-gray-600">
          비율: {data.percentage.toFixed(1)}%
        </p>
      </div>
    );
  };

  return (
    <div className="bg-white p-4 sm:p-6 rounded-xl border border-gray-200">
      {/* 헤더 */}
      <div className="mb-4">
        <h3 className="text-base font-semibold text-gray-900">플랫폼별 성과</h3>
        <p className="text-xs text-gray-500 mt-0.5">
          {dateRange
            ? `${dateRange.start.slice(5).replace('-', '/')} ~ ${dateRange.end.slice(5).replace('-', '/')}`
            : '지출 비율 및 효율 비교'}
        </p>
      </div>

      {/* 모바일: 세로 배치, 데스크톱: 가로 배치 */}
      <div className="flex flex-col lg:flex-row gap-4 lg:gap-6">
        {/* 도넛 차트 + 범례 */}
        <div className="flex flex-row items-center justify-center gap-4 lg:flex-col lg:flex-shrink-0">
          {/* 도넛 차트 */}
          <div className="relative w-32 h-32 sm:w-40 sm:h-40">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={35}
                  outerRadius={55}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>

            {/* 중앙 텍스트 */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <p className="text-xs text-gray-500">총 지출</p>
              <p className="text-sm font-bold text-gray-900">
                ${totalSpend >= 1000 ? `${(totalSpend / 1000).toFixed(1)}k` : totalSpend.toLocaleString()}
              </p>
            </div>
          </div>

          {/* 범례 */}
          <div className="space-y-1.5">
            {pieData.map((entry, index) => (
              <div key={index} className="flex items-center gap-2 text-xs">
                <span
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: entry.color }}
                />
                <span className="text-gray-600">{entry.name}</span>
                <span className="text-gray-400 ml-auto">{entry.percentage.toFixed(0)}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* 상세 테이블 */}
        <div className="flex-1 overflow-x-auto">
          <table className="w-full text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left py-2 text-xs sm:text-xs font-medium text-gray-500 uppercase">플랫폼</th>
                <th className="text-right py-2 text-xs sm:text-xs font-medium text-gray-500 uppercase">리드</th>
                <th className="text-right py-2 text-xs sm:text-xs font-medium text-gray-500 uppercase">지출</th>
                <th className="text-right py-2 text-xs sm:text-xs font-medium text-gray-500 uppercase">CPL</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {data.map((platform, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="py-2">
                    <div className="flex items-center gap-1.5">
                      <span
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: PLATFORM_COLORS[platform.platform] || '#6B7280' }}
                      />
                      <span className="font-medium text-gray-900 truncate">
                        {PLATFORM_NAMES[platform.platform] || platform.platform}
                      </span>
                    </div>
                  </td>
                  <td className="py-2 text-right text-gray-700">
                    {platform.leads.toLocaleString()}
                  </td>
                  <td className="py-2 text-right text-gray-700">
                    ${platform.spend.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                  </td>
                  <td className="py-2 text-right">
                    <span className={`font-medium ${
                      platform.leads > 0 && bestPlatform && platform.cpl === bestPlatform.cpl
                        ? 'text-green-600'
                        : 'text-gray-900'
                    }`}>
                      {platform.leads > 0 ? `$${platform.cpl.toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '-'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-gray-200 font-medium">
                <td className="py-2 text-gray-900">합계</td>
                <td className="py-2 text-right text-gray-900">{totalLeads.toLocaleString()}</td>
                <td className="py-2 text-right text-gray-900">
                  ${totalSpend.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                </td>
                <td className="py-2 text-right text-gray-900">
                  ${totalLeads > 0 ? Math.round(totalSpend / totalLeads).toLocaleString('en-US') : '-'}
                </td>
              </tr>
            </tfoot>
          </table>

          {/* 효율 최고 플랫폼 하이라이트 */}
          {bestPlatform && (
            <div className="mt-3 p-2 bg-green-50 rounded-lg border border-green-100">
              <div className="flex items-center gap-1.5">
                <span className="text-green-600 text-sm">⭐</span>
                <span className="text-xs text-green-800">
                  <strong>{PLATFORM_NAMES[bestPlatform.platform] || bestPlatform.platform}</strong>
                  {' '}효율 최고 (CPL ${bestPlatform.cpl.toLocaleString('en-US', { maximumFractionDigits: 0 })})
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
