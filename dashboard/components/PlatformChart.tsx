'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { PlatformPerformance } from '@/types/analytics';

interface PlatformChartProps {
  data: PlatformPerformance[];
}

export function PlatformChart({ data }: PlatformChartProps) {
  const formatTooltipValue = (value: number, name: string) => {
    if (name === '지출') {
      return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    return value.toLocaleString('en-US');
  };

  return (
    <div className="bg-white p-6 rounded-lg border border-gray-200">
      <h3 className="text-lg font-semibold mb-4">플랫폼별 성과 (최근 30일)</h3>

      <ResponsiveContainer width="100%" height={400}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
          <XAxis
            dataKey="platform"
            stroke="#6B7280"
            style={{ fontSize: '12px' }}
          />
          <YAxis
            stroke="#6B7280"
            style={{ fontSize: '12px' }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'white',
              border: '1px solid #E5E7EB',
              borderRadius: '8px'
            }}
            formatter={formatTooltipValue}
          />
          <Legend />

          <Bar dataKey="leads" fill="#F59E0B" name="리드수" />
          <Bar dataKey="clicks" fill="#10B981" name="클릭수" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
