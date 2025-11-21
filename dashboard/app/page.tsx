'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Header } from '@/components/Header';
import { FilterBar } from '@/components/FilterBar';

import { ExportButton } from '@/components/ExportButton';
import { AIInsightsPanel } from '@/components/AIInsightsPanel';
import { Tabs } from '@/components/Tabs';
import { AdsDetailTable } from '@/components/AdsDetailTable';
import { AdTrendChartWithData } from '@/components/AdTrendChartWithData';
import { KPICard } from '@/components/KPICard';
import { TrendChart } from '@/components/TrendChart';
import { PlatformChart } from '@/components/PlatformChart';
import { TopAdsTable } from '@/components/TopAdsTable';
import { ComparisonSection } from '@/components/ComparisonSection';
import { TrendingUp, DollarSign, Target, MousePointerClick } from 'lucide-react';
import {
  getKPISummary,
  getDailyTrend,
  getPlatformPerformance,
  getTopAds,
  Filters
} from '@/lib/api';
import { DailyTrend, PlatformPerformance, KPISummary, TopAd } from '@/types/analytics';
import { startOfDay, subDays, format, differenceInDays } from 'date-fns';
import { DataMonitor } from '@/components/DataMonitor';

export default function Home() {
  const searchParams = useSearchParams();

  const [kpi, setKpi] = useState<KPISummary>({
    total_leads: 0,
    total_spend: 0,
    avg_cpl: 0,
    avg_ctr: 0,
    total_impressions: 0,
    total_clicks: 0,
    avg_cvr: 0
  });
  const [comparisonKpi, setComparisonKpi] = useState<KPISummary | null>(null);
  const [dailyTrend, setDailyTrend] = useState<DailyTrend[]>([]);
  const [platformPerformance, setPlatformPerformance] = useState<PlatformPerformance[]>([]);
  const [topAds, setTopAds] = useState<TopAd[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [selectedAd, setSelectedAd] = useState<TopAd | null>(null);



  // URL에서 필터 읽기 (compare 파라미터 포함)
  const compareMode = searchParams.get('compare') as 'none' | 'weekly' | 'monthly' || 'none';
  const filters: Filters = {
    startDate: searchParams.get('start'),
    endDate: searchParams.get('end'),
    platforms: searchParams.get('platforms')?.split(',').filter(Boolean),
    campaigns: searchParams.get('campaigns')?.split(',').filter(Boolean)
  };

  // 🔍 DEBUG: 클라이언트에서 구성한 필터 확인
  console.log('🔧 Page.tsx - Filters constructed from URL:', JSON.stringify(filters, null, 2));
  console.log('🌐 URL searchParams:', {
    start: searchParams.get('start'),
    end: searchParams.get('end'),
    platforms: searchParams.get('platforms'),
    campaigns: searchParams.get('campaigns'),
    compare: searchParams.get('compare')
  });

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const [kpiData, trendData, platformData, adsData] = await Promise.all([
          getKPISummary(filters),
          getDailyTrend(filters),
          getPlatformPerformance(filters),
          getTopAds(filters, 10)
        ]);

        setKpi(kpiData);
        setDailyTrend(trendData);
        setPlatformPerformance(platformData);
        setTopAds(adsData);

        // 🔍 DEBUG: 데이터 검증 - 날짜 범위 vs 데이터 양 체크
        if (filters.startDate && filters.endDate && trendData.length > 0) {
          const daysDiff = Math.ceil(
            (new Date(filters.endDate).getTime() - new Date(filters.startDate).getTime()) / (1000 * 60 * 60 * 24)
          ) + 1;

          console.log('📊 Data validation check:');
          console.log('  - Selected date range:', filters.startDate, 'to', filters.endDate);
          console.log('  - Number of days:', daysDiff);
          console.log('  - Daily trend data points:', trendData.length);
          console.log('  - Total spend:', kpiData.total_spend);

          // 비정상적인 데이터량 경고
          if (daysDiff <= 14 && trendData.length > daysDiff * 3) {
            console.error('❌ DATA INTEGRITY ISSUE: Too many data points for selected date range!');
            console.error('   Expected max:', daysDiff * 3, '| Actual:', trendData.length);
          }

          // 7일 범위에 $9000 이상이면 경고 (의심스러운 패턴)
          if (daysDiff <= 7 && kpiData.total_spend > 8000) {
            console.warn('⚠️ SUSPICIOUS: High spend for short date range!');
            console.warn('   This might indicate that ALL data is being returned instead of filtered data.');
          }
        }

        // 비교 모드가 활성화되고 비교 날짜가 설정된 경우
        if (compareMode !== 'none' && comparisonDates) {
          const comparisonFilters: Filters = {
            ...filters,
            startDate: format(comparisonDates.from, 'yyyy-MM-dd'),
            endDate: format(comparisonDates.to, 'yyyy-MM-dd')
          };
          const comparisonData = await getKPISummary(comparisonFilters);
          setComparisonKpi(comparisonData);
        } else {
          setComparisonKpi(null);
        }
      } catch (error) {
        console.error('Failed to load data:', error);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [
    filters.startDate,
    filters.endDate,
    filters.platforms?.join(','),
    filters.campaigns?.join(','),
    compareMode
  ]);

  // KPI 변화율 계산 함수
  const calculateTrend = (current: number, previous: number | undefined) => {
    if (!previous || previous === 0) return undefined;
    const change = ((current - previous) / previous) * 100;
    return {
      value: change,
      isPositive: change >= 0
    };
  };

  // 기본 날짜 범위
  const today = startOfDay(new Date());
  const defaultStart = subDays(today, 6);
  const primaryRange = {
    from: filters.startDate ? new Date(filters.startDate) : defaultStart,
    to: filters.endDate ? new Date(filters.endDate) : today
  };

  // 비교 날짜 계산
  const calculateComparisonDates = () => {
    if (compareMode === 'none') return null;
    
    const daysToSubtract = compareMode === 'weekly' ? 7 : 30;
    const comparisonStart = subDays(primaryRange.from, daysToSubtract);
    const comparisonEnd = subDays(primaryRange.to, daysToSubtract);
    
    return {
      from: comparisonStart,
      to: comparisonEnd,
      formatted: {
        current: `${format(primaryRange.from, 'yyyy-MM-dd')} ~ ${format(primaryRange.to, 'yyyy-MM-dd')}`,
        previous: `${format(comparisonStart, 'yyyy-MM-dd')} ~ ${format(comparisonEnd, 'yyyy-MM-dd')}`
      }
    };
  };

  const comparisonDates = calculateComparisonDates();
// Calculate current period information for DataMonitor  const currentPeriod = {    start: filters.startDate || primaryRange.from.toISOString().split('T')[0],    end: filters.endDate || primaryRange.to.toISOString().split('T')[0],    days: differenceInDays(      filters.endDate ? new Date(filters.endDate) : primaryRange.to,      filters.startDate ? new Date(filters.startDate) : primaryRange.from    ) + 1  };  // Calculate comparison period information (if exists)  const comparisonPeriod = comparisonDates ? {    start: comparisonDates.formatted.previous.split(' ~ ')[0],    end: comparisonDates.formatted.previous.split(' ~ ')[1],    days: differenceInDays(comparisonDates.to, comparisonDates.from) + 1  } : undefined;

  if (loading) {
    return (
      <div className="min-h-screen">
        <Header />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">데이터 로딩 중..</p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      <Header />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-8">
          {/* 필터 바 */}
          <FilterBar />

          {/* 내보내기 다운로드 */}
          <section className="flex items-center justify-end">
            <ExportButton
              data={{
                kpi,
                dailyTrend,
                platformPerformance,
                topAds,
                dateRange: {
                  start: filters.startDate || primaryRange.from.toISOString().split('T')[0],
                  end: filters.endDate || primaryRange.to.toISOString().split('T')[0]
                }
              }}
              disabled={loading}
            />
          </section>

          {/* KPI 카드 영역 */}
          <section>
            <h2 className="text-2xl font-bold mb-4">주요 지표</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <KPICard
                title="총 리드"
                value={kpi.total_leads}
                icon={Target}
                format="number"
                trend={calculateTrend(kpi.total_leads, comparisonKpi?.total_leads)}
              />
              <KPICard
                title="총 지출"
                value={kpi.total_spend}
                icon={DollarSign}
                format="currency"
                trend={calculateTrend(kpi.total_spend, comparisonKpi?.total_spend)}
              />
              <KPICard
                title="평균 CPL"
                value={kpi.avg_cpl}
                icon={TrendingUp}
                format="currency"
                trend={calculateTrend(kpi.avg_cpl, comparisonKpi?.avg_cpl)}
              />
              <KPICard
                title="평균 CTR"
                value={kpi.avg_ctr}
                icon={MousePointerClick}
                format="percentage"
                trend={calculateTrend(kpi.avg_ctr, comparisonKpi?.avg_ctr)}
              />
            </div>
          </section>

          {/* 비교 분석 섹션 */}
          {compareMode !== 'none' && comparisonKpi && comparisonDates && (
            <section>
              <ComparisonSection
                current={{
                  total_leads: kpi.total_leads,
                  total_spend: kpi.total_spend,
                  avg_cpl: kpi.avg_cpl,
                  avg_ctr: kpi.avg_ctr
                }}
                previous={{
                  total_leads: comparisonKpi.total_leads,
                  total_spend: comparisonKpi.total_spend,
                  avg_cpl: comparisonKpi.avg_cpl,
                  avg_ctr: comparisonKpi.avg_ctr
                }}
                currentPeriod={comparisonDates.formatted.current}
                previousPeriod={comparisonDates.formatted.previous}
                mode={compareMode as 'weekly' | 'monthly'}
              />
            </section>
          )}

          {/* 탭 영역 */}
          <section>
            <Tabs
              tabs={[
                {
                  id: 'overview',
                  label: '개요',
                  content: (
                    <>
                      {/* 차트 영역 */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                        <TrendChart data={dailyTrend} />
                        <PlatformChart data={platformPerformance} />
                      </div>

                      {/* AI 인사이트 */}
                      <div className="mb-6">
                        <AIInsightsPanel
                          data={{
                            kpi,
                            dailyTrend,
                            platformPerformance,
                            topAds,
                            dateRange: {
                              start: filters.startDate || primaryRange.from.toISOString().split('T')[0],
                              end: filters.endDate || primaryRange.to.toISOString().split('T')[0]
                            }
                          }}
                        />
                      </div>

                      {/* TOP 광고 */}
                      <TopAdsTable data={topAds} />
                    </>
                  )
                },
                {
                  id: 'ads-detail',
                  label: '광고별 상세',
                  content: (
                    <div className="space-y-6">
                      <AdsDetailTable
                        data={topAds}
                        onAdClick={(ad) => setSelectedAd(ad)}
                      />

                      {selectedAd && (
                        <AdTrendChartWithData ad={selectedAd} />
                      )}
                    </div>
                  )
                }
              ]}
              activeTab={activeTab}
              onChange={setActiveTab}
            />
          </section>
        </div>
      </main>
    </div>
  );
}
