'use client';

import { ArrowUpRight, ArrowDownRight, TrendingUp, DollarSign, Target, MousePointerClick } from 'lucide-react';

interface ComparisonData {
  current: {
    total_leads: number;
    total_spend: number;
    avg_cpl: number;
    avg_ctr: number;
  };
  previous: {
    total_leads: number;
    total_spend: number;
    avg_cpl: number;
    avg_ctr: number;
  };
  currentPeriod: string;
  previousPeriod: string;
  mode: 'weekly' | 'monthly';
}

interface MetricComparisonProps {
  icon: React.ReactNode;
  label: string;
  current: number;
  previous: number;
  format: 'number' | 'currency' | 'percentage';
  reverseColor?: boolean; // CPL과 Spend는 낮을수록 좋음
}

function MetricComparison({ icon, label, current, previous, format, reverseColor = false }: MetricComparisonProps) {
  const diff = current - previous;
  const percentChange = previous !== 0 ? (diff / previous) * 100 : 0;
  const isPositive = reverseColor ? diff < 0 : diff > 0;

  const formatValue = (value: number) => {
    switch (format) {
      case 'currency':
        return `$${value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
      case 'percentage':
        return `${value.toFixed(2)}%`;
      default:
        return value.toLocaleString('en-US');
    }
  };

  return (
    <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
      {/* 아이콘 & 라벨 */}
      <div className="flex items-center gap-2 mb-4">
        <div className="text-gray-600">{icon}</div>
        <h3 className="text-sm font-medium text-gray-600">{label}</h3>
      </div>

      {/* 현재 값 (크게) */}
      <div className="mb-3">
        <div className="text-3xl font-bold text-gray-900">{formatValue(current)}</div>
        <div className="text-xs text-gray-500 mt-1">현재 기간</div>
      </div>

      {/* 비교 정보 */}
      <div className="flex items-center justify-between pt-3 border-t border-gray-100">
        <div className="text-sm text-gray-600">
          이전: {formatValue(previous)}
        </div>
        <div className={`flex items-center gap-1 font-semibold ${
          isPositive ? 'text-green-600' : 'text-red-600'
        }`}>
          {isPositive ? (
            <ArrowUpRight className="w-4 h-4" />
          ) : (
            <ArrowDownRight className="w-4 h-4" />
          )}
          <span className="text-lg">{Math.abs(percentChange).toFixed(1)}%</span>
        </div>
      </div>
    </div>
  );
}

export function ComparisonSection({ current, previous, currentPeriod, previousPeriod, mode }: ComparisonData) {
  const modeLabel = mode === 'weekly' ? '주간' : '월간';

  return (
    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 shadow-sm">
      {/* 헤더 */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-white" />
          </div>
          <h2 className="text-xl font-bold text-gray-900">{modeLabel} 비교 분석</h2>
        </div>
        <div className="flex items-center gap-3 text-sm text-gray-600">
          <span className="px-3 py-1 bg-white rounded-full font-medium">
            📅 이전: {previousPeriod}
          </span>
          <span className="text-gray-400">→</span>
          <span className="px-3 py-1 bg-blue-600 text-white rounded-full font-medium">
            📅 현재: {currentPeriod}
          </span>
        </div>
      </div>

      {/* 메트릭 그리드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricComparison
          icon={<TrendingUp className="w-5 h-5" />}
          label="총 리드"
          current={current.total_leads}
          previous={previous.total_leads}
          format="number"
        />
        <MetricComparison
          icon={<DollarSign className="w-5 h-5" />}
          label="총 지출"
          current={current.total_spend}
          previous={previous.total_spend}
          format="currency"
          reverseColor={true}
        />
        <MetricComparison
          icon={<Target className="w-5 h-5" />}
          label="평균 CPL"
          current={current.avg_cpl}
          previous={previous.avg_cpl}
          format="currency"
          reverseColor={true}
        />
        <MetricComparison
          icon={<MousePointerClick className="w-5 h-5" />}
          label="평균 CTR"
          current={current.avg_ctr}
          previous={previous.avg_ctr}
          format="percentage"
        />
      </div>

      {/* 요약 */}
      <div className="mt-6 p-4 bg-white/60 backdrop-blur rounded-lg">
        <div className="flex items-start gap-3">
          <div className="text-2xl">💡</div>
          <div>
            <h4 className="font-semibold text-gray-900 mb-1">AI 인사이트</h4>
            <p className="text-sm text-gray-700">
              {current.total_leads > previous.total_leads ? (
                `리드가 ${((current.total_leads - previous.total_leads) / previous.total_leads * 100).toFixed(1)}% 증가했습니다. `
              ) : (
                `리드가 ${((previous.total_leads - current.total_leads) / previous.total_leads * 100).toFixed(1)}% 감소했습니다. `
              )}
              {current.avg_cpl < previous.avg_cpl ? (
                `CPL이 개선되어 비용 효율이 높아졌습니다.`
              ) : (
                `CPL이 상승했습니다. 캠페인 최적화를 고려해보세요.`
              )}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
