'use client';

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { DailyTrend } from '@/types/analytics';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

interface TrendChartProps {
  data: DailyTrend[];
}

export function TrendChart({ data }: TrendChartProps) {
  const chartData = data.map(d => ({
    ...d,
    date: format(new Date(d.date), 'MM/dd', { locale: ko })
  }));

  const formatTooltipValue = (value: number, name: string) => {
    if (name === '지출') {
      return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    return value.toLocaleString('en-US');
  };

  return (
    <div className="bg-white p-6 rounded-lg border border-gray-200">
      <h3 className="text-lg font-semibold mb-4">일별 트렌드 (최근 7일)</h3>

      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
          <XAxis
            dataKey="date"
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

          <Line
            type="monotone"
            dataKey="impressions"
            stroke="#0066CC"
            strokeWidth={2}
            name="노출수"
            dot={{ fill: '#0066CC', r: 4 }}
          />
          <Line
            type="monotone"
            dataKey="clicks"
            stroke="#10B981"
            strokeWidth={2}
            name="클릭수"
            dot={{ fill: '#10B981', r: 4 }}
          />
          <Line
            type="monotone"
            dataKey="leads"
            stroke="#F59E0B"
            strokeWidth={2}
            name="리드수"
            dot={{ fill: '#F59E0B', r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
