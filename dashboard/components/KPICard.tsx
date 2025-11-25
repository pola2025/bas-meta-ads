'use client';

import { LucideIcon } from 'lucide-react';
import { LineChart, Line, ResponsiveContainer } from 'recharts';

interface KPICardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  format?: 'number' | 'currency' | 'percentage';
  // Phase 2 추가
  target?: number;           // 목표값
  sparklineData?: number[];  // 7일 추이 데이터
  colorScheme?: 'blue' | 'green' | 'purple' | 'orange';
}

export function KPICard({
  title,
  value,
  icon: Icon,
  trend,
  format = 'number',
  target,
  sparklineData,
  colorScheme = 'blue'
}: KPICardProps) {
  const formatValue = (val: string | number): string => {
    if (typeof val === 'string') return val;

    switch (format) {
      case 'currency':
        return `$${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      case 'percentage':
        return `${val.toFixed(2)}%`;
      default:
        return val.toLocaleString('en-US');
    }
  };

  // 목표 달성률 계산
  const getProgress = () => {
    if (!target || typeof value !== 'number') return null;

    // CPL은 낮을수록 좋음 (목표 이하일 때 100% 이상)
    if (format === 'currency' && title.toLowerCase().includes('cpl')) {
      if (value === 0) return 100;
      return Math.min(Math.round((target / value) * 100), 150);
    }

    return Math.min(Math.round((value / target) * 100), 150);
  };

  const progress = getProgress();

  // 색상 스킴
  const colors = {
    blue: {
      bg: 'bg-blue-50',
      icon: 'text-blue-600',
      progress: 'bg-blue-500',
      progressBg: 'bg-blue-100',
      spark: '#3B82F6'
    },
    green: {
      bg: 'bg-green-50',
      icon: 'text-green-600',
      progress: 'bg-green-500',
      progressBg: 'bg-green-100',
      spark: '#10B981'
    },
    purple: {
      bg: 'bg-purple-50',
      icon: 'text-purple-600',
      progress: 'bg-purple-500',
      progressBg: 'bg-purple-100',
      spark: '#8B5CF6'
    },
    orange: {
      bg: 'bg-orange-50',
      icon: 'text-orange-600',
      progress: 'bg-orange-500',
      progressBg: 'bg-orange-100',
      spark: '#F59E0B'
    }
  };

  const scheme = colors[colorScheme];

  // 스파크라인 데이터 변환
  const chartData = sparklineData?.map((val, idx) => ({ value: val, idx })) || [];

  return (
    <div className="bg-white p-3 sm:p-5 rounded-xl border border-gray-200 hover:shadow-lg transition-all duration-200">
      {/* 상단: 제목 + 아이콘 */}
      <div className="flex items-start justify-between mb-2 sm:mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-1 sm:gap-2">
            <p className="text-xs sm:text-sm font-medium text-gray-500">{title}</p>
          </div>
          {target && (
            <span className="text-xs sm:text-xs text-gray-400 hidden sm:inline">
              목표 {formatValue(target)}
            </span>
          )}
        </div>
        <div className={`p-1.5 sm:p-2.5 ${scheme.bg} rounded-lg`}>
          <Icon className={`w-4 h-4 sm:w-5 sm:h-5 ${scheme.icon}`} />
        </div>
      </div>

      {/* 중앙: 값 표시 */}
      <p className="text-xl sm:text-3xl font-bold text-gray-900 mb-1 sm:mb-2">
        {formatValue(value)}
      </p>

      {/* 목표 달성 프로그레스바 - 모바일에서 숨김 */}
      {progress !== null && (
        <div className="mb-2 sm:mb-3 hidden sm:block">
          <div className={`h-1.5 sm:h-2 ${scheme.progressBg} rounded-full overflow-hidden`}>
            <div
              className={`h-full ${scheme.progress} rounded-full transition-all duration-500`}
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
          <p className="text-xs sm:text-xs text-gray-500 mt-1">
            {progress}% 달성
            {progress >= 100 && <span className="ml-1 text-green-600">✓</span>}
          </p>
        </div>
      )}

      {/* 하단: 스파크라인 + 트렌드 */}
      <div className="flex items-end justify-between">
        {/* 스파크라인 (7일 추이) - 모바일에서 숨김 */}
        {chartData.length > 0 && (
          <div className="w-16 h-6 sm:w-24 sm:h-8 hidden sm:block">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke={scheme.spark}
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* 트렌드 */}
        {trend && (
          <div className="flex items-center gap-0.5 sm:gap-1">
            <span className={`text-xs sm:text-sm font-semibold ${
              trend.isPositive ? 'text-green-600' : 'text-red-600'
            }`}>
              {trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value).toFixed(1)}%
            </span>
            <span className="text-xs sm:text-xs text-gray-400 hidden sm:inline">vs 이전</span>
          </div>
        )}
      </div>
    </div>
  );
}
