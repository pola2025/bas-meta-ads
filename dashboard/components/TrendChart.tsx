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
  const [metrics, setMetrics] = useState<('leads' | 'spend' | 'cpl' | 'video_views' | 'avg_watch_time')[]>(['leads', 'spend', 'cpl']);

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
                ? `$${Math.round(entry.value || 0).toLocaleString('en-US')}`
                : entry.name === '평균시청'
                ? formatWatchTime(entry.value || 0)
                : entry.value?.toLocaleString() || 0}
            </span>
          </div>
        ))}
      </div>
    );
  };

  const toggleMetric = (metric: 'leads' | 'spend' | 'cpl' | 'video_views' | 'avg_watch_time') => {
    setMetrics(prev => {
      if (prev.includes(metric)) {
        return prev.filter(m => m !== metric);
      }
      return [...prev, metric];
    });
  };

  // 시청시간 포맷 (초 -> mm:ss 또는 초)
  const formatWatchTime = (seconds: number) => {
    if (!seconds || seconds === 0) return '-';
    if (seconds < 60) return `${seconds.toFixed(1)}s`;
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
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
        <button
          onClick={() => toggleMetric('video_views')}
          className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
            metrics.includes('video_views')
              ? 'bg-cyan-50 border-cyan-200 text-cyan-700'
              : 'bg-gray-50 border-gray-200 text-gray-500'
          }`}
        >
          <span className="mr-1.5">▶</span>영상조회
        </button>
        <button
          onClick={() => toggleMetric('avg_watch_time')}
          className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
            metrics.includes('avg_watch_time')
              ? 'bg-pink-50 border-pink-200 text-pink-700'
              : 'bg-gray-50 border-gray-200 text-gray-500'
          }`}
        >
          <span className="mr-1.5">⏱</span>평균시청
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

            {/* 왼쪽 Y축: 리드 (별도 스케일) */}
            <YAxis
              yAxisId="leads"
              stroke="#3B82F6"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              tickFormatter={(val) => val.toLocaleString()}
              domain={[0, 'auto']}
            />

            {/* 오른쪽 Y축: 지출 ($) */}
            <YAxis
              yAxisId="spend"
              orientation="right"
              stroke="#8B5CF6"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              tickFormatter={(val) => `$${val >= 1000 ? `${(val/1000).toFixed(0)}k` : val}`}
            />

            {/* 오른쪽 Y축 2: CPL ($) - 숨김 처리, 지출과 스케일 공유 */}
            <YAxis
              yAxisId="cpl"
              orientation="right"
              stroke="#F59E0B"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              hide={true}
            />

            {/* 영상 조회수 Y축 - 숨김 처리 */}
            <YAxis
              yAxisId="video_views"
              orientation="right"
              stroke="#06B6D4"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              hide={true}
            />

            {/* 평균 시청시간 Y축 - 숨김 처리 */}
            <YAxis
              yAxisId="avg_watch_time"
              orientation="right"
              stroke="#EC4899"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              hide={true}
            />

            <Tooltip content={<CustomTooltip />} />

            <Legend
              verticalAlign="top"
              height={36}
              iconType="circle"
              formatter={(value) => <span className="text-sm text-gray-600">{value}</span>}
            />

            {metrics.includes('leads') && (
              <Bar
                yAxisId="leads"
                dataKey="leads"
                fill="#3B82F6"
                radius={[4, 4, 0, 0]}
                name="리드"
                barSize={period === '30d' ? 8 : period === '14d' ? 16 : 24}
              />
            )}

            {metrics.includes('spend') && (
              <Area
                yAxisId="spend"
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
                yAxisId="cpl"
                type="monotone"
                dataKey="cpl"
                stroke="#F59E0B"
                strokeWidth={2.5}
                name="CPL"
                dot={{ fill: '#F59E0B', r: 4, strokeWidth: 2, stroke: '#fff' }}
                activeDot={{ r: 6, strokeWidth: 2, stroke: '#fff' }}
              />
            )}

            {metrics.includes('video_views') && (
              <Line
                yAxisId="video_views"
                type="monotone"
                dataKey="video_views"
                stroke="#06B6D4"
                strokeWidth={2}
                name="영상조회"
                dot={{ fill: '#06B6D4', r: 3, strokeWidth: 2, stroke: '#fff' }}
                activeDot={{ r: 5, strokeWidth: 2, stroke: '#fff' }}
              />
            )}

            {metrics.includes('avg_watch_time') && (
              <Line
                yAxisId="avg_watch_time"
                type="monotone"
                dataKey="avg_watch_time"
                stroke="#EC4899"
                strokeWidth={2}
                name="평균시청"
                dot={{ fill: '#EC4899', r: 3, strokeWidth: 2, stroke: '#fff' }}
                activeDot={{ r: 5, strokeWidth: 2, stroke: '#fff' }}
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
              ${chartData.reduce((sum, d) => sum + d.spend, 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-500">평균 CPL</p>
            <p className="text-lg font-semibold text-gray-900">
              ${Math.round(chartData.reduce((sum, d) => sum + d.spend, 0) / Math.max(chartData.reduce((sum, d) => sum + d.leads, 0), 1)).toLocaleString('en-US')}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
