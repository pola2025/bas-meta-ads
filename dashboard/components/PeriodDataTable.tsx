'use client';

import { useState, useMemo } from 'react';
import { DailyTrend } from '@/types/analytics';
import { format, startOfMonth, startOfWeek, endOfWeek, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import { TrendingUp, TrendingDown, Minus, Calendar, ChevronDown, ChevronRight } from 'lucide-react';

interface PeriodDataTableProps {
  data: DailyTrend[];
}

type ViewMode = 'daily' | 'weekly' | 'monthly';

interface DailyData {
  date: string;
  dateLabel: string;
  leads: number;
  spend: number;
  cpl: number;
  ctr: number;
  impressions: number;
  clicks: number;
  avg_watch_time: number;
}

interface WeeklyData {
  week: string;
  weekLabel: string;
  leads: number;
  spend: number;
  cpl: number;
  ctr: number;
  impressions: number;
  clicks: number;
  avg_watch_time: number;
  days: DailyData[];
}

interface MonthlyData {
  month: string;
  monthLabel: string;
  leads: number;
  spend: number;
  cpl: number;
  ctr: number;
  impressions: number;
  clicks: number;
  avg_watch_time: number;
  leadsDiff?: number;
  spendDiff?: number;
  cplDiff?: number;
  weeks: WeeklyData[];
  days: DailyData[];
}

export function PeriodDataTable({ data }: PeriodDataTableProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('monthly');
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());
  const [expandedWeeks, setExpandedWeeks] = useState<Set<string>>(new Set());

  // 일별 데이터 변환
  const convertToDailyData = (items: DailyTrend[]): DailyData[] => {
    return items
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(d => ({
        date: d.date,
        dateLabel: format(parseISO(d.date), 'MM/dd (EEE)', { locale: ko }),
        leads: d.leads,
        spend: d.spend,
        cpl: d.leads > 0 ? d.spend / d.leads : 0,
        ctr: d.impressions > 0 ? (d.clicks / d.impressions) * 100 : 0,
        impressions: d.impressions,
        clicks: d.clicks,
        avg_watch_time: d.avg_watch_time || 0
      }));
  };

  // 주별 데이터 집계
  const aggregateWeekly = (items: DailyTrend[]): WeeklyData[] => {
    const grouped: Record<string, DailyTrend[]> = {};

    items.forEach(d => {
      const date = parseISO(d.date);
      const weekStart = startOfWeek(date, { weekStartsOn: 1 });
      const key = format(weekStart, 'yyyy-MM-dd');

      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(d);
    });

    return Object.entries(grouped)
      .map(([key, weekItems]) => {
        const totalLeads = weekItems.reduce((sum, d) => sum + d.leads, 0);
        const totalSpend = weekItems.reduce((sum, d) => sum + d.spend, 0);
        const totalImpressions = weekItems.reduce((sum, d) => sum + d.impressions, 0);
        const totalClicks = weekItems.reduce((sum, d) => sum + d.clicks, 0);
        const watchTimeData = weekItems.filter(d => d.avg_watch_time && d.avg_watch_time > 0);
        const avgWatchTime = watchTimeData.length > 0
          ? watchTimeData.reduce((sum, d) => sum + (d.avg_watch_time || 0), 0) / watchTimeData.length
          : 0;

        const weekStart = parseISO(key);
        const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
        const weekLabel = `${format(weekStart, 'MM/dd', { locale: ko })} ~ ${format(weekEnd, 'MM/dd', { locale: ko })}`;

        return {
          week: key,
          weekLabel,
          leads: totalLeads,
          spend: totalSpend,
          cpl: totalLeads > 0 ? totalSpend / totalLeads : 0,
          ctr: totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0,
          impressions: totalImpressions,
          clicks: totalClicks,
          avg_watch_time: avgWatchTime,
          days: convertToDailyData(weekItems)
        };
      })
      .sort((a, b) => b.week.localeCompare(a.week));
  };

  // 월별로 그룹화된 데이터
  const monthlyData = useMemo(() => {
    if (data.length === 0) return [];

    const grouped: Record<string, DailyTrend[]> = {};

    data.forEach(d => {
      const date = parseISO(d.date);
      const monthKey = format(date, 'yyyy-MM');

      if (!grouped[monthKey]) grouped[monthKey] = [];
      grouped[monthKey].push(d);
    });

    const result: MonthlyData[] = Object.entries(grouped)
      .map(([monthKey, monthItems]) => {
        const totalLeads = monthItems.reduce((sum, d) => sum + d.leads, 0);
        const totalSpend = monthItems.reduce((sum, d) => sum + d.spend, 0);
        const totalImpressions = monthItems.reduce((sum, d) => sum + d.impressions, 0);
        const totalClicks = monthItems.reduce((sum, d) => sum + d.clicks, 0);
        const watchTimeData = monthItems.filter(d => d.avg_watch_time && d.avg_watch_time > 0);
        const avgWatchTime = watchTimeData.length > 0
          ? watchTimeData.reduce((sum, d) => sum + (d.avg_watch_time || 0), 0) / watchTimeData.length
          : 0;

        return {
          month: monthKey,
          monthLabel: format(parseISO(monthKey + '-01'), 'yyyy년 M월', { locale: ko }),
          leads: totalLeads,
          spend: totalSpend,
          cpl: totalLeads > 0 ? totalSpend / totalLeads : 0,
          ctr: totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0,
          impressions: totalImpressions,
          clicks: totalClicks,
          avg_watch_time: avgWatchTime,
          weeks: aggregateWeekly(monthItems),
          days: convertToDailyData(monthItems)
        };
      })
      .sort((a, b) => b.month.localeCompare(a.month));

    // 변동률 계산
    return result.map((item, idx) => {
      const prev = idx < result.length - 1 ? result[idx + 1] : null;
      return {
        ...item,
        leadsDiff: prev ? item.leads - prev.leads : undefined,
        spendDiff: prev ? ((item.spend - prev.spend) / (prev.spend || 1)) * 100 : undefined,
        cplDiff: prev && prev.cpl > 0 ? ((item.cpl - prev.cpl) / prev.cpl) * 100 : undefined
      };
    });
  }, [data]);

  // 주별 데이터 (전체)
  const weeklyData = useMemo(() => {
    if (data.length === 0) return [];
    return aggregateWeekly(data);
  }, [data]);

  // 토글 함수들
  const toggleMonth = (month: string) => {
    setExpandedMonths(prev => {
      const newSet = new Set(prev);
      if (newSet.has(month)) {
        newSet.delete(month);
      } else {
        newSet.add(month);
      }
      return newSet;
    });
  };

  const toggleWeek = (week: string) => {
    setExpandedWeeks(prev => {
      const newSet = new Set(prev);
      if (newSet.has(week)) {
        newSet.delete(week);
      } else {
        newSet.add(week);
      }
      return newSet;
    });
  };

  const expandAllMonths = () => setExpandedMonths(new Set(monthlyData.map(m => m.month)));
  const collapseAllMonths = () => setExpandedMonths(new Set());
  const expandAllWeeks = () => setExpandedWeeks(new Set(weeklyData.map(w => w.week)));
  const collapseAllWeeks = () => setExpandedWeeks(new Set());

  // 변동 아이콘
  const DiffIcon = ({ value }: { value?: number }) => {
    if (value === undefined) return <Minus className="w-3 h-3 text-gray-400" />;
    if (value > 0) return <TrendingUp className="w-3 h-3 text-green-500" />;
    if (value < 0) return <TrendingDown className="w-3 h-3 text-red-500" />;
    return <Minus className="w-3 h-3 text-gray-400" />;
  };

  // 숫자 포맷
  const formatCurrency = (num: number) => `$${Math.round(num).toLocaleString('en-US')}`;
  const formatNumber = (num: number) => num.toLocaleString('ko-KR');
  const formatPercentage = (num: number) => `${num.toFixed(2)}%`;
  const formatWatchTime = (seconds: number) => {
    if (!seconds || seconds === 0) return '-';
    if (seconds < 60) return `${seconds.toFixed(1)}s`;
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // 전체 요약 통계
  const summary = useMemo(() => {
    if (monthlyData.length === 0) return null;
    const totalLeads = monthlyData.reduce((sum, d) => sum + d.leads, 0);
    const totalSpend = monthlyData.reduce((sum, d) => sum + d.spend, 0);
    const totalImpressions = monthlyData.reduce((sum, d) => sum + d.impressions, 0);
    const totalClicks = monthlyData.reduce((sum, d) => sum + d.clicks, 0);
    const watchTimeData = monthlyData.filter(d => d.avg_watch_time && d.avg_watch_time > 0);
    const avgWatchTime = watchTimeData.length > 0
      ? watchTimeData.reduce((sum, d) => sum + d.avg_watch_time, 0) / watchTimeData.length
      : 0;

    return {
      totalLeads,
      totalSpend,
      avgCpl: totalLeads > 0 ? totalSpend / totalLeads : 0,
      avgCtr: totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0,
      totalImpressions,
      totalClicks,
      avgWatchTime
    };
  }, [monthlyData]);

  return (
    <div className="bg-white rounded-xl border border-gray-200">
      {/* 헤더 */}
      <div className="px-4 md:px-6 py-3 md:py-4 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-gray-500" />
          <h3 className="text-base md:text-lg font-semibold text-gray-900">기간별 성과</h3>
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
          {/* 펼침/접힘 버튼 - PC만 */}
          {viewMode === 'daily' && (
            <div className="hidden md:flex gap-2">
              <button onClick={expandAllMonths} className="px-2 py-1 text-xs text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded">
                모두 펼침
              </button>
              <button onClick={collapseAllMonths} className="px-2 py-1 text-xs text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded">
                모두 접힘
              </button>
            </div>
          )}
          {viewMode === 'weekly' && (
            <div className="hidden md:flex gap-2">
              <button onClick={expandAllWeeks} className="px-2 py-1 text-xs text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded">
                모두 펼침
              </button>
              <button onClick={collapseAllWeeks} className="px-2 py-1 text-xs text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded">
                모두 접힘
              </button>
            </div>
          )}

          {/* 뷰 모드 선택 */}
          <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
            {([
              { key: 'daily', label: '일별' },
              { key: 'weekly', label: '주별' },
              { key: 'monthly', label: '월별' }
            ] as const).map((mode) => (
              <button
                key={mode.key}
                onClick={() => setViewMode(mode.key)}
                className={`px-2 md:px-3 py-1 md:py-1.5 text-xs font-medium rounded-md transition-colors ${
                  viewMode === mode.key
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {mode.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 모바일: 카드 리스트 */}
      <div className="block md:hidden p-3 space-y-3">
        {/* 월별: 2열 그리드 (최신순: 3월|4월 / 1월|2월) */}
        {viewMode === 'monthly' && (
          <div className="grid grid-cols-2 gap-2">
            {monthlyData.map((month) => (
              <div key={month.month} className="bg-gray-50 rounded-xl p-3">
                {/* 헤더: 월 */}
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-bold text-gray-900">
                    {format(parseISO(month.month + '-01'), 'M월', { locale: ko })}
                  </span>
                  <span className={`text-xs font-bold ${month.cpl > 20 ? 'text-orange-600' : 'text-green-600'}`}>
                    ${month.cpl.toFixed(0)}
                  </span>
                </div>
                {/* 핵심 지표 */}
                <div className="space-y-0.5 text-[11px]">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">리드</span>
                    <span className="font-bold text-blue-600">{formatNumber(month.leads)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">노출</span>
                    <span className="text-gray-700">{(month.impressions/1000).toFixed(0)}K</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">클릭</span>
                    <span className="text-gray-700">{formatNumber(month.clicks)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">지출</span>
                    <span className="font-semibold text-gray-900">${(month.spend/1000).toFixed(1)}K</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 주별: 월 기준 계층화 */}
        {viewMode === 'weekly' && (
          <>
            {/* 목차 헤더 */}
            <div className="grid grid-cols-[auto_1fr_50px_45px_45px] items-center gap-2 px-3 pb-1 text-[10px] text-gray-400">
              <span className="w-4" />
              <span>기간</span>
              <span className="text-right">노출</span>
              <span className="text-right">리드</span>
              <span className="text-right">CPL</span>
            </div>
            {monthlyData.map((month) => (
              <div key={month.month} className="space-y-2">
                {/* 월 헤더 */}
                <div
                  className="bg-blue-50 rounded-lg px-3 py-2 cursor-pointer grid grid-cols-[auto_1fr_50px_45px_45px] items-center gap-2 text-[11px]"
                  onClick={() => toggleMonth(month.month)}
                >
                  <span className="text-gray-500">
                    {expandedMonths.has(month.month) ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </span>
                  <span className="text-sm font-bold text-blue-900">{month.monthLabel}</span>
                  <span className="text-blue-400 text-right">{(month.impressions/1000).toFixed(0)}K</span>
                  <span className="text-blue-700 font-bold text-right">{formatNumber(month.leads)}건</span>
                  <span className={`font-bold text-right ${month.cpl > 20 ? 'text-orange-600' : 'text-green-600'}`}>
                    ${month.cpl.toFixed(0)}
                  </span>
                </div>
                {/* 해당 월의 주간 데이터 */}
                {expandedMonths.has(month.month) && (
                  <div className="pl-3 space-y-1">
                    {month.weeks.map((week) => (
                      <div key={week.week} className="bg-gray-50 rounded-lg px-3 py-2 grid grid-cols-[auto_1fr_50px_45px_45px] items-center gap-2 text-[11px]">
                        <span className="w-4" />
                        <span className="font-medium text-gray-700">{week.weekLabel}</span>
                        <span className="text-gray-400 text-right">{(week.impressions/1000).toFixed(0)}K</span>
                        <span className="text-blue-600 font-bold text-right">{week.leads}건</span>
                        <span className={`font-bold text-right ${week.cpl > 20 ? 'text-orange-600' : 'text-green-600'}`}>
                          ${week.cpl.toFixed(0)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </>
        )}

        {/* 일별: 월별 그룹화 + 아코디언 */}
        {viewMode === 'daily' && (
          <>
            {/* 목차 헤더 */}
            <div className="grid grid-cols-[auto_1fr_50px_45px_45px] items-center gap-2 px-3 pb-1 text-[10px] text-gray-400">
              <span className="w-4" />
              <span>날짜</span>
              <span className="text-right">노출</span>
              <span className="text-right">리드</span>
              <span className="text-right">CPL</span>
            </div>
            {monthlyData.map((month) => (
              <div key={month.month} className="space-y-2">
                {/* 월 헤더 */}
                <div
                  className="bg-blue-50 rounded-lg px-3 py-2 cursor-pointer grid grid-cols-[auto_1fr_50px_45px_45px] items-center gap-2 text-[11px]"
                  onClick={() => toggleMonth(month.month)}
                >
                  <span className="text-gray-500">
                    {expandedMonths.has(month.month) ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </span>
                  <span className="text-sm font-bold text-blue-900">{month.monthLabel} <span className="text-[10px] font-normal text-blue-500">({month.days.length}일)</span></span>
                  <span className="text-blue-400 text-right">{(month.impressions/1000).toFixed(0)}K</span>
                  <span className="text-blue-700 font-bold text-right">{formatNumber(month.leads)}건</span>
                  <span className={`font-bold text-right ${month.cpl > 20 ? 'text-orange-600' : 'text-green-600'}`}>
                    ${month.cpl.toFixed(0)}
                  </span>
                </div>
                {/* 해당 월의 일별 데이터 */}
                {expandedMonths.has(month.month) && (
                  <div className="pl-3 space-y-1">
                    {month.days.map((day) => (
                      <div key={day.date} className="bg-gray-50 rounded-lg px-3 py-2 grid grid-cols-[auto_1fr_50px_45px_45px] items-center gap-2 text-[11px]">
                        <span className="w-4" />
                        <span className="font-medium text-gray-700">{day.dateLabel}</span>
                        <span className="text-gray-400 text-right">{(day.impressions/1000).toFixed(0)}K</span>
                        <span className="text-blue-600 font-bold text-right">{day.leads}건</span>
                        <span className={`font-bold text-right ${day.cpl > 20 ? 'text-orange-600' : 'text-green-600'}`}>
                          ${day.cpl.toFixed(0)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </>
        )}
      </div>

      {/* PC: 테이블 */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-48">기간</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-20">리드</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-28">지출</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-24">CPL</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-20">CTR</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-20">시청</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-28">노출</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-24">클릭</th>
            </tr>
          </thead>
          <tbody>
            {/* 월별 보기 */}
            {viewMode === 'monthly' && monthlyData.map((month) => (
              <tr key={month.month} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="px-4 py-3 text-left">
                  <span className="text-sm font-semibold text-gray-900">{month.monthLabel}</span>
                </td>
                <td className="px-4 py-3 text-center">
                  <div className="inline-flex items-center gap-1">
                    <span className="text-sm font-semibold text-gray-900">{formatNumber(month.leads)}</span>
                    {month.leadsDiff !== undefined && (
                      <span className={`text-xs ${month.leadsDiff >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {month.leadsDiff >= 0 ? '+' : ''}{month.leadsDiff}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-center">
                  <div className="inline-flex items-center gap-1">
                    <span className="text-sm font-semibold text-gray-900">{formatCurrency(month.spend)}</span>
                    {month.spendDiff !== undefined && <DiffIcon value={month.spendDiff} />}
                  </div>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`text-sm font-semibold ${summary && month.cpl < summary.avgCpl ? 'text-green-600' : 'text-gray-900'}`}>
                    {formatCurrency(month.cpl)}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className="text-sm text-gray-900">{formatPercentage(month.ctr)}</span>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className="text-sm text-purple-600">{formatWatchTime(month.avg_watch_time)}</span>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className="text-sm text-gray-600">{formatNumber(month.impressions)}</span>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className="text-sm text-gray-600">{formatNumber(month.clicks)}</span>
                </td>
              </tr>
            ))}

            {/* 주별 보기 */}
            {viewMode === 'weekly' && weeklyData.map((week) => {
              const isExpanded = expandedWeeks.has(week.week);
              return (
                <>
                  <tr
                    key={week.week}
                    className="border-b border-gray-200 bg-green-50 hover:bg-green-100 cursor-pointer"
                    onClick={() => toggleWeek(week.week)}
                  >
                    <td className="px-4 py-3 text-left">
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500">
                          {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </span>
                        <span className="text-sm font-bold text-green-900">{week.weekLabel}</span>
                        <span className="text-xs text-green-600">({week.days.length}일)</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-sm font-bold text-green-900">{formatNumber(week.leads)}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-sm font-bold text-green-900">{formatCurrency(week.spend)}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-sm font-bold ${summary && week.cpl < summary.avgCpl ? 'text-blue-600' : 'text-green-900'}`}>
                        {formatCurrency(week.cpl)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-sm font-bold text-green-900">{formatPercentage(week.ctr)}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-sm font-bold text-purple-600">{formatWatchTime(week.avg_watch_time)}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-sm font-bold text-green-900">{formatNumber(week.impressions)}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-sm font-bold text-green-900">{formatNumber(week.clicks)}</span>
                    </td>
                  </tr>
                  {isExpanded && week.days.map((day) => (
                    <tr key={day.date} className="border-b border-gray-100 bg-white hover:bg-gray-50">
                      <td className="px-4 py-2 pl-12 text-left">
                        <span className="text-sm text-gray-600">{day.dateLabel}</span>
                      </td>
                      <td className="px-4 py-2 text-center">
                        <span className="text-sm text-gray-900">{formatNumber(day.leads)}</span>
                      </td>
                      <td className="px-4 py-2 text-center">
                        <span className="text-sm text-gray-900">{formatCurrency(day.spend)}</span>
                      </td>
                      <td className="px-4 py-2 text-center">
                        <span className={`text-sm ${summary && day.cpl < summary.avgCpl ? 'text-green-600' : 'text-gray-900'}`}>
                          {formatCurrency(day.cpl)}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-center">
                        <span className="text-sm text-gray-900">{formatPercentage(day.ctr)}</span>
                      </td>
                      <td className="px-4 py-2 text-center">
                        <span className="text-sm text-purple-600">{formatWatchTime(day.avg_watch_time)}</span>
                      </td>
                      <td className="px-4 py-2 text-center">
                        <span className="text-sm text-gray-600">{formatNumber(day.impressions)}</span>
                      </td>
                      <td className="px-4 py-2 text-center">
                        <span className="text-sm text-gray-600">{formatNumber(day.clicks)}</span>
                      </td>
                    </tr>
                  ))}
                </>
              );
            })}

            {/* 일별 보기 (월별 그룹) */}
            {viewMode === 'daily' && monthlyData.map((month) => {
              const isExpanded = expandedMonths.has(month.month);
              return (
                <>
                  <tr
                    key={month.month}
                    className="border-b border-blue-200 bg-blue-50 hover:bg-blue-100 cursor-pointer"
                    onClick={() => toggleMonth(month.month)}
                  >
                    <td className="px-4 py-3 text-left">
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500">
                          {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </span>
                        <span className="text-sm font-bold text-blue-900">{month.monthLabel}</span>
                        <span className="text-xs text-blue-600">({month.days.length}일)</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-sm font-bold text-blue-900">{formatNumber(month.leads)}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-sm font-bold text-blue-900">{formatCurrency(month.spend)}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-sm font-bold ${summary && month.cpl < summary.avgCpl ? 'text-green-700' : 'text-blue-900'}`}>
                        {formatCurrency(month.cpl)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-sm font-bold text-blue-900">{formatPercentage(month.ctr)}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-sm font-bold text-purple-600">{formatWatchTime(month.avg_watch_time)}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-sm font-bold text-blue-900">{formatNumber(month.impressions)}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-sm font-bold text-blue-900">{formatNumber(month.clicks)}</span>
                    </td>
                  </tr>
                  {isExpanded && month.days.map((day) => (
                    <tr key={day.date} className="border-b border-gray-100 bg-white hover:bg-gray-50">
                      <td className="px-4 py-2 pl-12 text-left">
                        <span className="text-sm text-gray-600">{day.dateLabel}</span>
                      </td>
                      <td className="px-4 py-2 text-center">
                        <span className="text-sm text-gray-900">{formatNumber(day.leads)}</span>
                      </td>
                      <td className="px-4 py-2 text-center">
                        <span className="text-sm text-gray-900">{formatCurrency(day.spend)}</span>
                      </td>
                      <td className="px-4 py-2 text-center">
                        <span className={`text-sm ${summary && day.cpl < summary.avgCpl ? 'text-green-600' : 'text-gray-900'}`}>
                          {formatCurrency(day.cpl)}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-center">
                        <span className="text-sm text-gray-900">{formatPercentage(day.ctr)}</span>
                      </td>
                      <td className="px-4 py-2 text-center">
                        <span className="text-sm text-purple-600">{formatWatchTime(day.avg_watch_time)}</span>
                      </td>
                      <td className="px-4 py-2 text-center">
                        <span className="text-sm text-gray-600">{formatNumber(day.impressions)}</span>
                      </td>
                      <td className="px-4 py-2 text-center">
                        <span className="text-sm text-gray-600">{formatNumber(day.clicks)}</span>
                      </td>
                    </tr>
                  ))}
                </>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 요약 */}
      {summary && (
        <div className="px-4 md:px-6 py-4 bg-gray-50 border-t border-gray-200">
          {/* 모바일: 2x2 그리드 핵심 지표만 */}
          <div className="grid grid-cols-2 gap-3 md:hidden">
            <div className="text-center">
              <p className="text-xs text-gray-500">총 리드</p>
              <p className="text-lg font-bold text-blue-600">{formatNumber(summary.totalLeads)}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-500">총 지출</p>
              <p className="text-lg font-bold text-gray-900">${(summary.totalSpend/1000).toFixed(1)}K</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-500">평균 CPL</p>
              <p className={`text-lg font-bold ${summary.avgCpl > 20 ? 'text-orange-600' : 'text-green-600'}`}>
                ${summary.avgCpl.toFixed(1)}
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-500">평균 CTR</p>
              <p className="text-lg font-bold text-gray-900">{formatPercentage(summary.avgCtr)}</p>
            </div>
          </div>
          {/* PC: 7열 그리드 */}
          <div className="hidden md:grid grid-cols-7 gap-4 text-center">
            <div>
              <p className="text-xs text-gray-500">총 리드</p>
              <p className="text-lg font-bold text-gray-900">{formatNumber(summary.totalLeads)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">총 지출</p>
              <p className="text-lg font-bold text-gray-900">{formatCurrency(summary.totalSpend)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">평균 CPL</p>
              <p className="text-lg font-bold text-gray-900">{formatCurrency(summary.avgCpl)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">평균 CTR</p>
              <p className="text-lg font-bold text-gray-900">{formatPercentage(summary.avgCtr)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">평균 시청</p>
              <p className="text-lg font-bold text-purple-600">{formatWatchTime(summary.avgWatchTime)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">총 노출</p>
              <p className="text-lg font-bold text-gray-900">{formatNumber(summary.totalImpressions)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">총 클릭</p>
              <p className="text-lg font-bold text-gray-900">{formatNumber(summary.totalClicks)}</p>
            </div>
          </div>
        </div>
      )}

      {/* 데이터 없음 */}
      {monthlyData.length === 0 && (
        <div className="px-6 py-12 text-center text-gray-500">
          <Calendar className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <p>해당 기간의 데이터가 없습니다</p>
        </div>
      )}
    </div>
  );
}
