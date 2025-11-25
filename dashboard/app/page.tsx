'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Header } from '@/components/Header';
import { FilterBar } from '@/components/FilterBar';
import { validateAccess, AccessMode, ClientInfo } from '@/lib/access-control';
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
import { TrendingUp, DollarSign, Target, MousePointerClick, Lock } from 'lucide-react';
import {
  getKPISummary,
  getDailyTrend,
  getPlatformPerformance,
  getTopAds,
  Filters
} from '@/lib/api';
import { DailyTrend, PlatformPerformance, KPISummary, TopAd } from '@/types/analytics';
import { startOfDay, subDays, format, differenceInDays } from 'date-fns';

export default function Home() {
  const searchParams = useSearchParams();

  // 접근 제어 상태
  const [accessMode, setAccessMode] = useState<AccessMode>('denied');
  const [clientId, setClientId] = useState<string | null>(null);
  const [clientName, setClientName] = useState<string | null>(null);
  const [allClients, setAllClients] = useState<ClientInfo[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [accessLoading, setAccessLoading] = useState(true);

  // 데이터 상태
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

  // 접근 제어 검증
  useEffect(() => {
    async function checkAccess() {
      setAccessLoading(true);
      const adminParam = searchParams.get('admin');
      const clientParam = searchParams.get('client');

      const result = await validateAccess(adminParam, clientParam);

      setAccessMode(result.mode);
      setClientId(result.clientId);
      setClientName(result.clientName);

      if (result.mode === 'admin' && result.allClients) {
        setAllClients(result.allClients);
      }

      setAccessLoading(false);
    }

    checkAccess();
  }, [searchParams]);

  // URL에서 필터 읽기 (compare 파라미터 포함)
  const compareMode = searchParams.get('compare') as 'none' | 'weekly' | 'monthly' || 'none';
  const filters: Filters = {
    startDate: searchParams.get('start'),
    endDate: searchParams.get('end'),
    platforms: searchParams.get('platforms')?.split(',').filter(Boolean),
    campaigns: searchParams.get('campaigns')?.split(',').filter(Boolean)
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

  // 데이터 로드
  useEffect(() => {
    async function loadData() {
      if (accessMode === 'denied' || accessLoading) return;

      setLoading(true);
      try {
        // TODO: 멀티클라이언트 지원 시 client_id 필터 추가
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
    accessMode,
    accessLoading,
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

  // 접근 로딩 중
  if (accessLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">접근 권한 확인 중...</p>
        </div>
      </div>
    );
  }

  // 접근 거부 화면
  if (accessMode === 'denied') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md mx-auto px-4">
          <div className="bg-white rounded-xl shadow-lg p-8">
            <Lock className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900 mb-2">접근 권한 없음</h1>
            <p className="text-gray-600 mb-6">
              유효한 링크를 통해 접속해주세요.<br />
              링크가 없으시면 담당자에게 문의하세요.
            </p>
            <div className="text-sm text-gray-400">
              문의: mkt@polarad.co.kr
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 데이터 로딩 중
  if (loading) {
    return (
      <div className="min-h-screen">
        <Header clientName={clientName} isAdmin={accessMode === 'admin'} />
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
      <Header clientName={clientName} isAdmin={accessMode === 'admin'} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-8">
          {/* 관리자/클라이언트 모드 표시 */}
          {accessMode === 'admin' && (
            <div className="px-4 py-3 bg-purple-50 rounded-lg flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-purple-700 font-medium">🔐 관리자 모드</span>
                <span className="text-purple-500 text-sm">모든 클라이언트 데이터 접근 가능</span>
              </div>
              <select
                className="border border-purple-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                value={selectedClientId || ''}
                onChange={(e) => setSelectedClientId(e.target.value || null)}
              >
                <option value="">클라이언트 선택...</option>
                {allClients.map(c => (
                  <option key={c.id} value={c.id}>{c.client_name}</option>
                ))}
              </select>
            </div>
          )}

          {accessMode === 'client' && clientName && (
            <div className="px-4 py-3 bg-blue-50 rounded-lg">
              <span className="text-blue-700 font-medium">{clientName}</span>
              <span className="text-blue-500 ml-2">대시보드</span>
            </div>
          )}

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
