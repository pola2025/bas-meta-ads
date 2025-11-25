'use client';

import { useState } from 'react';
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area
} from 'recharts';
import { DailyTrend } from '@/types/analytics';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

interface TrendChartProps {
  data: DailyTrend[];
  maxDays?: number; // 하위 호환성 유지 (미사용)
}

type PeriodOption = '7d' | '14d' | '30d';

export function TrendChart({ data }: TrendChartProps) {
  const [period, setPeriod] = useState<PeriodOption>('7d');
  const [metrics, setMetrics] = useState<('leads' | 'spend' | 'cpl')[]>(['leads', 'cpl']);

  const periodDays = { '7d': 7, '14d': 14, '30d': 30 };
  const filteredData = data.slice(-periodDays[period]);

  const chartData = filteredData.map(d => ({
    ...d,
    dateLabel: format(new Date(d.date), 'MM/dd', { locale: ko }),
    dateShort: format(new Date(d.date), 'd', { locale: ko })
  }));

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || payload.length === 0) return null;

    return (
      <div className="bg-white p-4 rounded-lg shadow-lg border border-gray-200">
        <p className="font-semibold text-gray-900 mb-2">{label}</p>
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center gap-2 text-sm">
            <span
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-gray-600">{entry.name}:</span>
            <span className="font-medium text-gray-900">
              {entry.name === 'CPL' || entry.name === '지출'
                ? `$${entry.value?.toFixed(2) || 0}`
                : entry.value?.toLocaleString() || 0}
            </span>
          </div>
        ))}
      </div>
    );
  };

  const toggleMetric = (metric: 'leads' | 'spend' | 'cpl') => {
    setMetrics(prev => {
      if (prev.includes(metric)) {
        return prev.filter(m => m !== metric);
      }
      return [...prev, metric];
    });
  };

  return (
    <div className="bg-white p-2 sm:p-4 md:p-6 rounded-xl border border-gray-200">
      {/* 헤더 */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4 md:mb-6 px-1 sm:px-0">
        <div>
          <h3 className="text-base md:text-lg font-semibold text-gray-900">일별 성과 트렌드</h3>
          <p className="text-xs md:text-sm text-gray-500 mt-0.5">리드수와 CPL 추이</p>
        </div>

        {/* 기간 선택 - 블록형 버튼 (항상 활성화) */}
        <div className="grid grid-cols-3 gap-1.5 w-full sm:w-auto sm:flex sm:gap-1 bg-gray-100 p-1.5 rounded-lg">
          {(['7d', '14d', '30d'] as PeriodOption[]).map((opt) => (
            <button
              key={opt}
              onClick={() => setPeriod(opt)}
              className={`px-3 py-2 sm:py-1.5 text-sm sm:text-xs font-medium rounded-md transition-colors ${
                period === opt
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              {opt === '7d' ? '7일' : opt === '14d' ? '14일' : '30일'}
            </button>
          ))}
        </div>
      </div>

      {/* 메트릭 선택 칩 */}
      <div className="flex gap-2 mb-4 px-1 sm:px-0">
        <button
          onClick={() => toggleMetric('leads')}
          className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
            metrics.includes('leads')
              ? 'bg-blue-50 border-blue-200 text-blue-700'
              : 'bg-gray-50 border-gray-200 text-gray-500'
          }`}
        >
          <span className="mr-1.5">■</span>리드
        </button>
        <button
          onClick={() => toggleMetric('spend')}
          className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
            metrics.includes('spend')
              ? 'bg-purple-50 border-purple-200 text-purple-700'
              : 'bg-gray-50 border-gray-200 text-gray-500'
          }`}
        >
          <span className="mr-1.5">▨</span>지출
        </button>
        <button
          onClick={() => toggleMetric('cpl')}
          className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
            metrics.includes('cpl')
              ? 'bg-orange-50 border-orange-200 text-orange-700'
              : 'bg-gray-50 border-gray-200 text-gray-500'
          }`}
        >
          <span className="mr-1.5">─</span>CPL
        </button>
      </div>

      {/* 차트 */}
      <div className="-mx-2 sm:mx-0">
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={chartData} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="leadGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="spendGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0}/>
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />

            <XAxis
              dataKey="dateLabel"
              stroke="#9CA3AF"
              fontSize={11}
              tickLine={false}
              axisLine={{ stroke: '#E5E7EB' }}
            />

            <YAxis
              yAxisId="left"
              stroke="#9CA3AF"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              tickFormatter={(val) => val.toLocaleString()}
            />

            <YAxis
              yAxisId="right"
              orientation="right"
              stroke="#9CA3AF"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              tickFormatter={(val) => `$${val}`}
            />

            <Tooltip content={<CustomTooltip />} />

            <Legend
              verticalAlign="top"
              height={36}
              iconType="circle"
              formatter={(value) => <span className="text-sm text-gray-600">{value}</span>}
            />

            {metrics.includes('leads') && (
              <>
                <Area
                  yAxisId="left"
                  type="monotone"
                  dataKey="leads"
                  fill="url(#leadGradient)"
                  stroke="transparent"
                  name="리드"
                />
                <Bar
                  yAxisId="left"
                  dataKey="leads"
                  fill="#3B82F6"
                  radius={[4, 4, 0, 0]}
                  name="리드"
                  barSize={period === '30d' ? 8 : period === '14d' ? 16 : 24}
                />
              </>
            )}

            {metrics.includes('spend') && (
              <Area
                yAxisId="left"
                type="monotone"
                dataKey="spend"
                fill="url(#spendGradient)"
                stroke="#8B5CF6"
                strokeWidth={2}
                name="지출"
                dot={false}
              />
            )}

            {metrics.includes('cpl') && (
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="cpl"
                stroke="#F59E0B"
                strokeWidth={2.5}
                name="CPL"
                dot={{ fill: '#F59E0B', r: 4, strokeWidth: 2, stroke: '#fff' }}
                activeDot={{ r: 6, strokeWidth: 2, stroke: '#fff' }}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* 요약 */}
      {chartData.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-3 gap-4 px-1 sm:px-0">
          <div className="text-center">
            <p className="text-xs text-gray-500">총 리드</p>
            <p className="text-lg font-semibold text-gray-900">
              {chartData.reduce((sum, d) => sum + d.leads, 0).toLocaleString()}
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-500">총 지출</p>
            <p className="text-lg font-semibold text-gray-900">
              ${chartData.reduce((sum, d) => sum + d.spend, 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-500">평균 CPL</p>
            <p className="text-lg font-semibold text-gray-900">
              ${(chartData.reduce((sum, d) => sum + d.spend, 0) / Math.max(chartData.reduce((sum, d) => sum + d.leads, 0), 1)).toFixed(2)}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
