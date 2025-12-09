'use client';

import { useState, useEffect } from 'react';
import { X, TrendingUp, TrendingDown, Calendar, Award, Sparkles } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';
import { TopAd } from '@/types/analytics';
import { AdCumulativeStats, AdDailySnapshot, getAdCumulativeStats, getAdDailySnapshots, getAdDailyData } from '@/lib/api';

interface AdProfileCardProps {
  ad: TopAd;
  onClose: () => void;
  avgCpl?: number;
  // AI 분석 관련 props
  aiSummary?: string | null;
  aiLoading?: boolean;
  onRequestAI?: () => void;
  aiAlreadyGenerated?: boolean;  // 이미 생성된 AI 분석이 있는지
  isAdmin?: boolean;  // 관리자 모드 여부 (클라이언트는 조회만 가능)
}

// 지표 선택 탭
type MetricTab = 'leads' | 'cpl' | 'ctr' | 'spend';

export function AdProfileCard({
  ad,
  onClose,
  avgCpl,
  aiSummary,
  aiLoading = false,
  onRequestAI,
  aiAlreadyGenerated = false,
  isAdmin = false
}: AdProfileCardProps) {
  const [cumulativeStats, setCumulativeStats] = useState<AdCumulativeStats | null>(null);
  const [dailySnapshots, setDailySnapshots] = useState<AdDailySnapshot[]>([]);
  const [dailyData, setDailyData] = useState<{date: string; leads: number; spend: number; cpl: number; ctr: number}[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMetric, setSelectedMetric] = useState<MetricTab>('leads');
  const [chartDays, setChartDays] = useState<7 | 14 | 30>(14);

  // 데이터 로드
  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        // 기간 계산
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - chartDays);

        const filters = {
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0]
        };

        // 병렬로 데이터 조회
        const [stats, snapshots, daily] = await Promise.all([
          getAdCumulativeStats(undefined, 100),
          getAdDailySnapshots(ad.ad_id || ad.ad_name, undefined, chartDays),
          getAdDailyData(ad.ad_name, filters)
        ]);

        // 누적 통계
        const adStats = stats.find(s => s.ad_id === ad.ad_id || s.ad_name === ad.ad_name);
        setCumulativeStats(adStats || null);

        // 일별 스냅샷 (순위 변동용)
        setDailySnapshots(snapshots);

        // 일별 실제 데이터 (차트용)
        setDailyData(daily);
      } catch (error) {
        console.error('Failed to load ad profile data:', error);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [ad.ad_id, ad.ad_name, chartDays]);

  // 차트 데이터 변환 (일별 실제 데이터 우선, 없으면 스냅샷 사용)
  const chartData = dailyData.length > 0
    ? dailyData.map(d => ({
        date: d.date.slice(5), // MM-DD 형식
        leads: d.leads,
        spend: d.spend,
        cpl: d.cpl,
        ctr: d.ctr
      }))
    : dailySnapshots.map(snap => ({
        date: snap.snapshot_date.slice(5),
        leads: snap.cumulative_leads,
        spend: 0,
        cpl: snap.cumulative_cpl || 0,
        ctr: 0
      }));

  // 숫자 포맷
  const formatCurrency = (num: number) => `$${Math.round(num).toLocaleString('en-US')}`;
  const formatNumber = (num: number) => num.toLocaleString('ko-KR');
  const formatPercentage = (num: number) => `${num.toFixed(2)}%`;

  // 성과 등급 계산
  const getPerformanceGrade = () => {
    if (!avgCpl || !ad.cpl) return { grade: 'N/A', color: 'gray' };
    const ratio = ad.cpl / avgCpl;
    if (ratio < 0.7) return { grade: 'S', color: 'text-purple-600 bg-purple-100' };
    if (ratio < 0.85) return { grade: 'A', color: 'text-green-600 bg-green-100' };
    if (ratio < 1.0) return { grade: 'B', color: 'text-blue-600 bg-blue-100' };
    if (ratio < 1.2) return { grade: 'C', color: 'text-yellow-600 bg-yellow-100' };
    return { grade: 'D', color: 'text-red-600 bg-red-100' };
  };

  const grade = getPerformanceGrade();

  // 운영 일수 계산
  const getActiveDays = () => {
    if (cumulativeStats?.active_days) return cumulativeStats.active_days;
    if (cumulativeStats?.first_seen_date && cumulativeStats?.last_seen_date) {
      const start = new Date(cumulativeStats.first_seen_date);
      const end = new Date(cumulativeStats.last_seen_date);
      return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    }
    return null;
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* 헤더 */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white z-10">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold ${grade.color}`}>
              {grade.grade}
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 truncate max-w-md">
                {ad.ad_name}
              </h2>
              <p className="text-sm text-gray-500">{ad.campaign_name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* 상단: 누적 성과 + 일별 차트 */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* 누적 성과 카드 */}
            <div className="bg-gray-50 rounded-xl p-5 space-y-4">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <Award className="w-4 h-4 text-yellow-500" />
                누적 성과
              </h3>

              {loading ? (
                <div className="space-y-3">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="h-12 bg-gray-200 rounded animate-pulse" />
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">리드</span>
                    <span className="text-lg font-bold text-gray-900">
                      {formatNumber(cumulativeStats?.total_leads || ad.leads)}건
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">지출</span>
                    <span className="text-lg font-bold text-gray-900">
                      {formatCurrency(cumulativeStats?.total_spend || ad.spend)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">CPL</span>
                    <span className={`text-lg font-bold ${
                      avgCpl && (cumulativeStats?.lifetime_cpl || ad.cpl) < avgCpl
                        ? 'text-green-600'
                        : 'text-gray-900'
                    }`}>
                      {formatCurrency(cumulativeStats?.lifetime_cpl || ad.cpl)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">CTR</span>
                    <span className="text-lg font-bold text-gray-900">
                      {formatPercentage(cumulativeStats?.lifetime_ctr || ad.ctr)}
                    </span>
                  </div>

                  <div className="pt-3 border-t border-gray-200">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Calendar className="w-4 h-4" />
                      <span>운영 기간</span>
                    </div>
                    <p className="text-sm font-medium text-gray-900 mt-1">
                      {cumulativeStats?.first_seen_date || '정보 없음'}
                      {cumulativeStats?.first_seen_date && ' ~ '}
                      {cumulativeStats?.last_seen_date || ''}
                    </p>
                    {getActiveDays() && (
                      <p className="text-xs text-gray-500 mt-0.5">
                        ({getActiveDays()}일째 운영)
                      </p>
                    )}
                  </div>

                  {/* 순위 정보 */}
                  {cumulativeStats?.cpl_rank && (
                    <div className="pt-3 border-t border-gray-200">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">CPL 순위</span>
                        <span className="text-lg font-bold text-blue-600">
                          #{cumulativeStats.cpl_rank}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 일별 성과 추이 차트 */}
            <div className="lg:col-span-2 bg-gray-50 rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900">일별 성과 추이</h3>

                {/* 기간 선택 */}
                <div className="flex gap-1 bg-gray-200 p-0.5 rounded-lg">
                  {([7, 14, 30] as const).map((days) => (
                    <button
                      key={days}
                      onClick={() => setChartDays(days)}
                      className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                        chartDays === days
                          ? 'bg-white text-gray-900 shadow-sm'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      {days}일
                    </button>
                  ))}
                </div>
              </div>

              {/* 지표 탭 */}
              <div className="flex gap-2 mb-4">
                {(['leads', 'cpl', 'ctr', 'spend'] as const).map((metric) => (
                  <button
                    key={metric}
                    onClick={() => setSelectedMetric(metric)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                      selectedMetric === metric
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                    }`}
                  >
                    {metric === 'leads' ? '리드' :
                     metric === 'cpl' ? 'CPL' :
                     metric === 'ctr' ? 'CTR' : '지출'}
                  </button>
                ))}
              </div>

              {loading ? (
                <div className="h-48 bg-gray-200 rounded animate-pulse" />
              ) : chartData.length > 0 ? (
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 11, fill: '#6B7280' }}
                        axisLine={{ stroke: '#E5E7EB' }}
                      />
                      <YAxis
                        tick={{ fontSize: 11, fill: '#6B7280' }}
                        axisLine={{ stroke: '#E5E7EB' }}
                        tickFormatter={(value) =>
                          selectedMetric === 'cpl' || selectedMetric === 'spend'
                            ? `$${value >= 1000 ? `${(value/1000).toFixed(0)}k` : value}`
                            : selectedMetric === 'ctr'
                            ? `${value}%`
                            : value
                        }
                      />
                      <Tooltip
                        formatter={(value: number) =>
                          selectedMetric === 'cpl' || selectedMetric === 'spend'
                            ? formatCurrency(value)
                            : selectedMetric === 'ctr'
                            ? formatPercentage(value)
                            : formatNumber(value)
                        }
                        labelFormatter={(label) => `날짜: ${label}`}
                      />
                      <Line
                        type="monotone"
                        dataKey={selectedMetric}
                        stroke="#3B82F6"
                        strokeWidth={2}
                        dot={{ fill: '#3B82F6', r: 3 }}
                        activeDot={{ r: 5 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-48 flex flex-col items-center justify-center text-gray-500 bg-gray-100 rounded-lg">
                  <Calendar className="w-8 h-8 mb-2 text-gray-400" />
                  <p className="text-sm">최근 {chartDays}일간 데이터가 없습니다</p>
                  <p className="text-xs text-gray-400 mt-1">다른 기간을 선택해보세요</p>
                </div>
              )}
            </div>
          </div>

          {/* AI 성과 요약 섹션 */}
          <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-500" />
                AI 성과 요약
              </h3>

              {/* AI 분석 버튼은 관리자 모드에서만 표시 */}
              {!aiSummary && !aiLoading && onRequestAI && isAdmin && (
                <button
                  onClick={onRequestAI}
                  disabled={aiAlreadyGenerated}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                    aiAlreadyGenerated
                      ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                      : 'bg-purple-600 text-white hover:bg-purple-700'
                  }`}
                >
                  {aiAlreadyGenerated ? '이미 분석됨' : 'AI 분석 요청'}
                </button>
              )}
            </div>

            {aiLoading ? (
              <div className="space-y-2">
                <div className="h-4 bg-white/50 rounded animate-pulse w-full" />
                <div className="h-4 bg-white/50 rounded animate-pulse w-4/5" />
                <div className="h-4 bg-white/50 rounded animate-pulse w-3/5" />
              </div>
            ) : aiSummary ? (
              <div className="space-y-3 text-sm text-gray-700">
                {aiSummary.split('\n').map((line, idx) => (
                  line.trim() && (
                    <p key={idx} className="flex items-start gap-2">
                      {line.startsWith('•') || line.startsWith('-') ? (
                        <>
                          <span className="text-purple-500 mt-0.5">•</span>
                          <span>{line.replace(/^[•-]\s*/, '')}</span>
                        </>
                      ) : (
                        <span>{line}</span>
                      )}
                    </p>
                  )
                ))}
              </div>
            ) : (
              <div className="text-sm text-gray-500">
                {/* 기본 분석 (AI 없이도 제공) */}
                <div className="space-y-2">
                  {avgCpl && ad.cpl < avgCpl && (
                    <p className="flex items-start gap-2">
                      <span className="text-green-500">✓</span>
                      <span>전체 광고 중 CPL {formatPercentage((1 - ad.cpl / avgCpl) * 100)} 우수</span>
                    </p>
                  )}
                  {dailySnapshots.length >= 2 && (
                    <p className="flex items-start gap-2">
                      <span className="text-blue-500">ℹ</span>
                      <span>
                        최근 {chartDays}일간 리드{' '}
                        {dailySnapshots[dailySnapshots.length - 1]?.leads_change !== null
                          ? dailySnapshots[dailySnapshots.length - 1].leads_change! >= 0
                            ? `+${dailySnapshots[dailySnapshots.length - 1].leads_change} 증가 추세`
                            : `${dailySnapshots[dailySnapshots.length - 1].leads_change} 감소 추세`
                          : '변동 데이터 수집 중'}
                      </span>
                    </p>
                  )}
                  {cumulativeStats?.cpl_rank && cumulativeStats.cpl_rank <= 3 && (
                    <p className="flex items-start gap-2">
                      <span className="text-yellow-500">🏆</span>
                      <span>CPL 효율 상위 {cumulativeStats.cpl_rank}위 광고</span>
                    </p>
                  )}
                </div>

                {/* AI 분석 안내는 관리자 모드에서만 표시 */}
                {isAdmin && onRequestAI && !aiAlreadyGenerated && (
                  <p className="mt-4 text-xs text-gray-400">
                    AI 분석 버튼을 클릭하면 상세 성과 분석 및 추천을 제공합니다.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* 하단: 상세 지표 테이블 */}
          <div className="bg-gray-50 rounded-xl p-5">
            <h3 className="font-semibold text-gray-900 mb-4">상세 지표</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white rounded-lg p-3">
                <p className="text-xs text-gray-500">노출</p>
                <p className="text-lg font-bold text-gray-900">{formatNumber(ad.impressions)}</p>
              </div>
              <div className="bg-white rounded-lg p-3">
                <p className="text-xs text-gray-500">클릭</p>
                <p className="text-lg font-bold text-gray-900">{formatNumber(ad.clicks)}</p>
              </div>
              <div className="bg-white rounded-lg p-3">
                <p className="text-xs text-gray-500">CPC</p>
                <p className="text-lg font-bold text-gray-900">{formatCurrency(ad.cpc)}</p>
              </div>
              <div className="bg-white rounded-lg p-3">
                <p className="text-xs text-gray-500">CVR</p>
                <p className="text-lg font-bold text-gray-900">{formatPercentage(ad.cvr)}</p>
              </div>
            </div>
          </div>

          {/* 평균 대비 비교 */}
          {avgCpl && (
            <div className="bg-gray-50 rounded-xl p-5">
              <h3 className="font-semibold text-gray-900 mb-4">평균 대비 비교</h3>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">이 광고 CPL</span>
                    <span className="font-medium">{formatCurrency(ad.cpl)}</span>
                  </div>
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        ad.cpl < avgCpl ? 'bg-green-500' : 'bg-orange-500'
                      }`}
                      style={{
                        width: `${Math.min((ad.cpl / (avgCpl * 1.5)) * 100, 100)}%`
                      }}
                    />
                  </div>
                </div>
                <div className="text-center px-4 border-l border-gray-200">
                  <p className="text-xs text-gray-500">평균 CPL</p>
                  <p className="text-lg font-bold text-gray-600">{formatCurrency(avgCpl)}</p>
                </div>
                <div className="text-center px-4 border-l border-gray-200">
                  <p className="text-xs text-gray-500">차이</p>
                  <p className={`text-lg font-bold ${
                    ad.cpl < avgCpl ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {ad.cpl < avgCpl ? '-' : '+'}
                    {formatPercentage(Math.abs((ad.cpl - avgCpl) / avgCpl * 100))}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
