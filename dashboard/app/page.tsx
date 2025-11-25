'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Header } from '@/components/Header';
import { FilterBar } from '@/components/FilterBar';
import { validateAccess, AccessMode, ClientInfo } from '@/lib/access-control';
import { ExportButton } from '@/components/ExportButton';
import { Tabs } from '@/components/Tabs';
import { AdsDetailTable } from '@/components/AdsDetailTable';
import { AdTrendChartWithData } from '@/components/AdTrendChartWithData';
import { AdProfileCard } from '@/components/AdProfileCard';
import { KPICard } from '@/components/KPICard';
import { TrendChart } from '@/components/TrendChart';
import { PlatformChart } from '@/components/PlatformChart';
import { TopAdsTable } from '@/components/TopAdsTable';
import { ComparisonSection } from '@/components/ComparisonSection';
import { DashboardSkeleton } from '@/components/Skeleton';
import { PeriodDataTable } from '@/components/PeriodDataTable';
import { Accordion } from '@/components/Accordion';
import { TrendingUp, DollarSign, Target, MousePointerClick, Lock } from 'lucide-react';
import {
  getKPISummary,
  getDailyTrend,
  getAllDailyTrend,
  getPlatformPerformance,
  getTopAds,
  getAllAdsWithStatus,
  getClientTargets,
  getKPISparklineData,
  Filters,
  ClientTargets,
  AdWithStatus
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
  const [allAds, setAllAds] = useState<AdWithStatus[]>([]); // 전체 광고 (활성/비활성 포함)
  const [allDailyTrend, setAllDailyTrend] = useState<DailyTrend[]>([]); // 전체 기간 데이터
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [selectedAd, setSelectedAd] = useState<TopAd | null>(null);
  const [showProfileCard, setShowProfileCard] = useState(false);

  // Phase 3: AI 분석 관련 상태 (중복 생성 방지)
  const [adAiSummaries, setAdAiSummaries] = useState<Record<string, string>>({});
  const [adAiLoading, setAdAiLoading] = useState<Record<string, boolean>>({});
  const [adAiGenerated, setAdAiGenerated] = useState<Set<string>>(new Set());

  // Phase 2: 목표값 및 스파크라인 데이터
  const [targets, setTargets] = useState<ClientTargets | null>(null);
  const [sparklineData, setSparklineData] = useState<{
    leads: number[];
    spend: number[];
    cpl: number[];
    ctr: number[];
  }>({ leads: [], spend: [], cpl: [], ctr: [] });

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
        // 트렌드 차트용 확장 필터 (최대 30일 데이터)
        const trendFilters: Filters = {
          ...filters,
          startDate: filters.startDate || format(subDays(today, 29), 'yyyy-MM-dd'),
          endDate: filters.endDate || format(today, 'yyyy-MM-dd')
        };

        // 멀티클라이언트 지원: client_id 필터 적용
        const effectiveClientId = clientId || undefined;
        const [kpiData, trendData, allTrendData, platformData, adsData, allAdsData, targetsData, sparkData] = await Promise.all([
          getKPISummary(filters),
          getDailyTrend(trendFilters),
          getAllDailyTrend(effectiveClientId), // 전체 기간 데이터 (기간별 데이터 탭용)
          getPlatformPerformance(filters),
          getTopAds(filters, 10),
          getAllAdsWithStatus(), // 전체 광고 (활성/비활성 포함)
          getClientTargets(effectiveClientId),
          getKPISparklineData(filters)
        ]);

        setKpi(kpiData);
        setDailyTrend(trendData);
        setAllDailyTrend(allTrendData); // 전체 기간 데이터 저장
        setPlatformPerformance(platformData);
        setTopAds(adsData);
        setAllAds(allAdsData); // 전체 광고 저장
        setTargets(targetsData);
        setSparklineData(sparkData);

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
    clientId,
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

  // Phase 3: AI 분석 요청 함수 (중복 생성 방지)
  const handleRequestAI = async (ad: TopAd) => {
    const adKey = ad.ad_id || ad.ad_name;

    // 이미 생성된 경우 무시
    if (adAiGenerated.has(adKey)) {
      console.log('AI analysis already generated for:', adKey);
      return;
    }

    // 로딩 중인 경우 무시
    if (adAiLoading[adKey]) {
      console.log('AI analysis already loading for:', adKey);
      return;
    }

    // 로딩 상태 설정
    setAdAiLoading(prev => ({ ...prev, [adKey]: true }));

    try {
      // 기본 분석 결과 생성 (실제로는 AI API 호출)
      // 현재는 로컬에서 간단한 분석 생성
      const avgCplValue = kpi.avg_cpl;
      const cplDiff = avgCplValue > 0 ? ((ad.cpl - avgCplValue) / avgCplValue * 100) : 0;

      const summaryLines = [];

      // CPL 분석
      if (cplDiff < -15) {
        summaryLines.push(`• 전체 평균 대비 CPL ${Math.abs(cplDiff).toFixed(1)}% 낮음 (우수)`);
      } else if (cplDiff > 15) {
        summaryLines.push(`• 전체 평균 대비 CPL ${cplDiff.toFixed(1)}% 높음 (개선 필요)`);
      } else {
        summaryLines.push(`• CPL이 평균 수준 유지 중`);
      }

      // 리드 분석
      const totalLeads = topAds.reduce((sum, a) => sum + a.leads, 0);
      const leadShare = totalLeads > 0 ? (ad.leads / totalLeads * 100) : 0;
      if (leadShare > 20) {
        summaryLines.push(`• 전체 리드의 ${leadShare.toFixed(1)}% 차지 (핵심 광고)`);
      } else if (leadShare > 10) {
        summaryLines.push(`• 전체 리드의 ${leadShare.toFixed(1)}% 기여`);
      }

      // CTR 분석
      if (ad.ctr > 2) {
        summaryLines.push(`• CTR ${ad.ctr.toFixed(2)}%로 양호한 클릭률`);
      } else if (ad.ctr < 1) {
        summaryLines.push(`• CTR ${ad.ctr.toFixed(2)}%로 클릭률 개선 검토 필요`);
      }

      // 추천 액션
      if (cplDiff < -10 && ad.leads > 5) {
        summaryLines.push(`\n📌 추천: 예산 증액하여 성과 확대 검토`);
      } else if (cplDiff > 20) {
        summaryLines.push(`\n📌 추천: 타겟팅 또는 소재 개선 검토`);
      }

      const summary = summaryLines.join('\n');

      // 상태 업데이트 (중복 방지를 위해 Generated 셋에 추가)
      setAdAiSummaries(prev => ({ ...prev, [adKey]: summary }));
      setAdAiGenerated(prev => new Set(prev).add(adKey));

    } catch (error) {
      console.error('Failed to generate AI summary:', error);
    } finally {
      setAdAiLoading(prev => ({ ...prev, [adKey]: false }));
    }
  };

  // 광고 클릭 핸들러
  const handleAdClick = (ad: TopAd) => {
    setSelectedAd(ad);
    setShowProfileCard(true);
  };

  // 프로필 카드 닫기
  const handleCloseProfileCard = () => {
    setShowProfileCard(false);
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
      <div className="min-h-screen bg-neutral-50">
        <Header clientName={clientName} isAdmin={accessMode === 'admin'} />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <DashboardSkeleton />
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
            <div className="px-3 py-2 sm:px-4 sm:py-3 bg-purple-50 rounded-lg flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div className="flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-2">
                <span className="text-purple-700 font-medium text-sm sm:text-base">🔐 관리자 모드</span>
                <span className="text-purple-500 text-xs sm:text-sm">모든 클라이언트 데이터 접근 가능</span>
              </div>
              <select
                className="border border-purple-200 rounded-lg px-2 py-1 sm:px-3 sm:py-1.5 text-xs sm:text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-500 w-full sm:w-auto"
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

          {/* TOP 광고 성과 - 필터 바 아래 */}
          <section>
            <TopAdsTable
              data={topAds}
              avgCpl={kpi.avg_cpl}
              showSparkline={false}
            />
          </section>

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
            <h2 className="text-lg sm:text-2xl font-bold mb-3 sm:mb-4">주요 지표</h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
              <KPICard
                title="총 리드"
                value={kpi.total_leads}
                icon={Target}
                format="number"
                trend={calculateTrend(kpi.total_leads, comparisonKpi?.total_leads)}
                target={targets?.target_leads || undefined}
                sparklineData={sparklineData.leads}
                colorScheme="blue"
              />
              <KPICard
                title="총 지출"
                value={kpi.total_spend}
                icon={DollarSign}
                format="currency"
                trend={calculateTrend(kpi.total_spend, comparisonKpi?.total_spend)}
                target={targets?.target_spend || undefined}
                sparklineData={sparklineData.spend}
                colorScheme="purple"
              />
              <KPICard
                title="평균 CPL"
                value={kpi.avg_cpl}
                icon={TrendingUp}
                format="currency"
                trend={calculateTrend(kpi.avg_cpl, comparisonKpi?.avg_cpl)}
                target={20}
                sparklineData={sparklineData.cpl}
                colorScheme="orange"
              />
              <KPICard
                title="평균 CTR"
                value={kpi.avg_ctr}
                icon={MousePointerClick}
                format="percentage"
                trend={calculateTrend(kpi.avg_ctr, comparisonKpi?.avg_ctr)}
                target={targets?.target_ctr || undefined}
                sparklineData={sparklineData.ctr}
                colorScheme="green"
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
                      {/* 모바일: 아코디언 스타일 */}
                      <div className="block md:hidden space-y-3">
                        <Accordion title="일별 트렌드" icon="📈" defaultOpen={true}>
                          <TrendChart data={allDailyTrend} />
                        </Accordion>
                        <Accordion title="플랫폼별 성과" icon="📊" defaultOpen={true}>
                          <PlatformChart
                            data={platformPerformance}
                            dateRange={{
                              start: filters.startDate || format(subDays(today, 6), 'yyyy-MM-dd'),
                              end: filters.endDate || format(today, 'yyyy-MM-dd')
                            }}
                          />
                        </Accordion>
                      </div>

                      {/* PC: 그리드 스타일 */}
                      <div className="hidden md:grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                        <TrendChart data={allDailyTrend} />
                        <PlatformChart
                          data={platformPerformance}
                          dateRange={{
                            start: filters.startDate || format(subDays(today, 6), 'yyyy-MM-dd'),
                            end: filters.endDate || format(today, 'yyyy-MM-dd')
                          }}
                        />
                      </div>

                      {/* 하단 여백 (푸터 높이) */}
                      <div className="py-8 lg:py-16" />
                    </>
                  )
                },
                {
                  id: 'period-data',
                  label: '기간별 데이터',
                  content: (
                    <PeriodDataTable data={allDailyTrend} />
                  )
                },
                {
                  id: 'ads-detail',
                  label: '광고별 상세',
                  content: (
                    <div className="space-y-6">
                      <AdsDetailTable
                        data={allAds}
                        onAdClick={handleAdClick}
                      />

                      {selectedAd && !showProfileCard && (
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

      {/* Phase 3: 광고 프로필 카드 모달 */}
      {showProfileCard && selectedAd && (
        <AdProfileCard
          ad={selectedAd}
          onClose={handleCloseProfileCard}
          avgCpl={kpi.avg_cpl}
          aiSummary={adAiSummaries[selectedAd.ad_id || selectedAd.ad_name] || null}
          aiLoading={adAiLoading[selectedAd.ad_id || selectedAd.ad_name] || false}
          // AI 분석 요청은 관리자 모드에서만 가능
          onRequestAI={accessMode === 'admin' ? () => handleRequestAI(selectedAd) : undefined}
          aiAlreadyGenerated={adAiGenerated.has(selectedAd.ad_id || selectedAd.ad_name)}
          isAdmin={accessMode === 'admin'}
        />
      )}

      {/* 푸터 */}
      <footer className="mt-12 py-8 md:py-12 border-t border-gray-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center gap-3 md:flex-row md:justify-between md:gap-6">
            <div className="text-xs md:text-sm text-gray-500 order-2 md:order-1">
              © 2024 POLAR AD. All rights reserved.
            </div>
            <div className="flex flex-col items-center gap-1 md:flex-row md:gap-4 text-xs md:text-sm text-gray-500 order-1 md:order-2">
              <span>문의: mkt@polarad.co.kr</span>
              <span className="hidden md:inline text-gray-300">|</span>
              <span>데이터 업데이트: 매일 오전 9시</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
