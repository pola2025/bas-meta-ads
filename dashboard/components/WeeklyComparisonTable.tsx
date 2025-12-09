'use client';

import React from 'react';

interface MetricRow {
  label: string;
  current: number | string;
  previous: number | string;
  changePercent: number;
  format?: 'number' | 'currency' | 'percentage';
  invertTrend?: boolean; // CPL처럼 낮을수록 좋은 지표
}

interface WeeklyComparisonTableProps {
  metrics: MetricRow[];
  currentPeriod: string;
  previousPeriod: string;
}

export function WeeklyComparisonTable({
  metrics,
  currentPeriod,
  previousPeriod
}: WeeklyComparisonTableProps) {
  const formatValue = (value: number | string, format?: string) => {
    if (typeof value === 'string') return value;

    switch (format) {
      case 'currency':
        return `$${value.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
      case 'percentage':
        return `${value.toFixed(2)}%`;
      default:
        return value.toLocaleString('ko-KR');
    }
  };

  const getTrendClass = (change: number, invertTrend?: boolean) => {
    const isPositive = invertTrend ? change < 0 : change > 0;
    if (change === 0) return 'text-gray-500';
    return isPositive ? 'text-green-600' : 'text-red-600';
  };

  const getTrendIcon = (change: number) => {
    if (change > 0) return '▲';
    if (change < 0) return '▼';
    return '-';
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center gap-2 text-lg font-bold text-gray-800 mb-4">
        <span>📈</span>
        <span>주간 비교</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="py-3 px-3 text-left font-semibold text-gray-600">지표</th>
              <th className="py-3 px-3 text-right font-semibold text-gray-600">
                이번 주
                <br />
                <span className="font-normal text-xs">({currentPeriod})</span>
              </th>
              <th className="py-3 px-3 text-right font-semibold text-gray-600">
                전주
                <br />
                <span className="font-normal text-xs">({previousPeriod})</span>
              </th>
              <th className="py-3 px-3 text-right font-semibold text-gray-600">변화</th>
            </tr>
          </thead>
          <tbody>
            {metrics.map((metric, index) => (
              <tr
                key={metric.label}
                className={index < metrics.length - 1 ? 'border-b border-gray-100' : ''}
              >
                <td className="py-3 px-3 font-medium">{metric.label}</td>
                <td className="py-3 px-3 text-right">
                  {formatValue(metric.current, metric.format)}
                </td>
                <td className="py-3 px-3 text-right text-gray-500">
                  {formatValue(metric.previous, metric.format)}
                </td>
                <td className={`py-3 px-3 text-right font-medium ${getTrendClass(metric.changePercent, metric.invertTrend)}`}>
                  {getTrendIcon(metric.changePercent)} {Math.abs(metric.changePercent).toFixed(1)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
