'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Header } from '@/components/Header';
import { supabase } from '@/lib/supabase';
import { validateAccess, AccessMode, ClientInfo } from '@/lib/access-control';
import {
  FileText, TrendingUp, TrendingDown, Minus,
  ChevronRight, Filter, BarChart3, Users, DollarSign, Target, Lock
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell
} from 'recharts';

interface ReportData {
  summary?: {
    impressions: number;
    clicks: number;
    leads: number;
    spend: number;
    cpl: number;
    ctr: number;
    conversion_rate: number;
  };
  comparison?: {
    prev_impressions: number;
    prev_clicks: number;
    prev_leads: number;
    prev_spend: number;
    prev_cpl: number;
    prev_ctr: number;
  };
  daily_stats?: Array<{
    date: string;
    leads: number;
    spend: number;
    cpl: number;
  }>;
  weekly_stats?: Array<{
    week: number;
    label: string;
    leads: number;
    spend: number;
    cpl: number;
  }>;
  day_of_week_stats?: Array<{
    day: string;
    leads: number;
    percent: number;
  }>;
  ad_performance?: Array<{
    ad_id: string;
    ad_name: string;
    leads: number;
    spend: number;
    cpl: number;
    ctr: number;
    spend_percent: number;
    lead_percent: number;
  }>;
  campaign_performance?: Array<{
    campaign_id: string;
    campaign_name: string;
    leads: number;
    spend: number;
    cpl: number;
    spend_percent: number;
    lead_percent: number;
  }>;
}

interface Report {
  id: string;
  client_id: string;
  report_type: 'weekly' | 'monthly';
  week_start: string;
  week_end: string;
  total_leads: number;
  total_spend: number;
  avg_cpl: number;
  avg_ctr: number;
  leads_change: number;
  spend_change: number;
  cpl_change: number;
  sent_at: string;
  message_text: string;
  ai_insights: string;
  report_data: ReportData | null;
}

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

export default function ReportsPage() {
  const searchParams = useSearchParams();

  // 접근 제어 상태
  const [accessMode, setAccessMode] = useState<AccessMode>('denied');
  const [clientId, setClientId] = useState<string | null>(null);
  const [clientName, setClientName] = useState<string | null>(null);
  const [allClients, setAllClients] = useState<ClientInfo[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [accessLoading, setAccessLoading] = useState(true);

  // 리포트 상태
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [filterType, setFilterType] = useState<'all' | 'weekly' | 'monthly'>('all');
  const [activeTab, setActiveTab] = useState<'overview' | 'ads' | 'campaigns' | 'raw'>('overview');

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

  // 리포트 조회
  useEffect(() => {
    if (accessMode !== 'denied' && !accessLoading) {
      fetchReports();
    }
  }, [filterType, accessMode, accessLoading, clientId, selectedClientId]);

  async function fetchReports() {
    setLoading(true);
    try {
      let query = supabase
        .from('telegram_reports')
        .select('*')
        .order('week_start', { ascending: false })
        .limit(50);

      // 클라이언트 모드: 해당 클라이언트만
      if (accessMode === 'client' && clientId) {
        query = query.eq('client_id', clientId);
      }

      // 관리자 모드: 선택된 클라이언트 필터 (선택된 경우)
      if (accessMode === 'admin' && selectedClientId) {
        query = query.eq('client_id', selectedClientId);
      }

      // 리포트 타입 필터
      if (filterType !== 'all') {
        query = query.eq('report_type', filterType);
      }

      const { data, error } = await query;

      if (error) throw error;
      setReports(data || []);
    } catch (error) {
      console.error('리포트 조회 실패:', error);
    } finally {
      setLoading(false);
    }
  }

  function formatDate(dateStr: string) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  function formatPeriod(start: string, end: string, type: string) {
    if (type === 'monthly') {
      const date = new Date(start);
      return `${date.getFullYear()}년 ${date.getMonth() + 1}월`;
    }
    return `${formatDate(start)} ~ ${formatDate(end)}`;
  }

  function getTrendIcon(change: number) {
    if (change > 0) return <TrendingUp className="w-4 h-4 text-green-500" />;
    if (change < 0) return <TrendingDown className="w-4 h-4 text-red-500" />;
    return <Minus className="w-4 h-4 text-gray-400" />;
  }

  function getTrendColor(change: number, inverse = false) {
    if (inverse) change = -change;
    if (change > 0) return 'text-green-600';
    if (change < 0) return 'text-red-600';
    return 'text-gray-500';
  }

  function cleanMarkdown(text: string) {
    if (!text) return '';
    return text
      .replace(/\\([_*[\]()~`>#+\-=|{}.!])/g, '$1')
      .replace(/━+/g, '─'.repeat(30))
      .replace(/\n{3,}/g, '\n\n');
  }

  // 차트/테이블 데이터 렌더링
  function renderOverview() {
    if (!selectedReport?.report_data) {
      return (
        <div className="text-center text-gray-500 py-8">
          구조화된 데이터가 없습니다. (기존 리포트)
        </div>
      );
    }

    const data = selectedReport.report_data;
    const isMonthly = selectedReport.report_type === 'monthly';

    // 트렌드 데이터
    const trendData = isMonthly
      ? (data.weekly_stats || []).map(w => ({
          name: `W${w.week}`,
          leads: w.leads,
          spend: w.spend,
          cpl: w.cpl
        }))
      : (data.daily_stats || []).map(d => ({
          name: d.date.substring(5),
          leads: d.leads,
          spend: d.spend,
          cpl: d.cpl
        }));

    // 요일별 데이터 (월간만)
    const dayData = data.day_of_week_stats || [];

    return (
      <div className="space-y-6">
        {/* 트렌드 차트 */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h4 className="text-sm font-semibold text-gray-700 mb-4">
            {isMonthly ? '주별 트렌드' : '일별 트렌드'}
          </h4>
          {trendData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} />
                <Tooltip
                  formatter={(value: number, name: string) => {
                    if (name === 'spend' || name === 'cpl') return [`$${value.toFixed(2)}`, name === 'spend' ? '지출' : 'CPL'];
                    return [value, '리드'];
                  }}
                />
                <Bar yAxisId="left" dataKey="leads" fill="#3B82F6" name="리드" />
                <Line yAxisId="right" type="monotone" dataKey="cpl" stroke="#EF4444" name="CPL" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center text-gray-400 py-8">데이터 없음</div>
          )}
        </div>

        {/* 요일별 분포 (월간만) */}
        {isMonthly && dayData.length > 0 && (
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h4 className="text-sm font-semibold text-gray-700 mb-4">요일별 리드 분포</h4>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={dayData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" tick={{ fontSize: 12 }} />
                <YAxis dataKey="day" type="category" tick={{ fontSize: 12 }} width={30} />
                <Tooltip formatter={(value: number) => [`${value}건`, '리드']} />
                <Bar dataKey="leads" fill="#10B981" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* AI 인사이트 섹션 (개요 탭) */}
        {selectedReport?.ai_insights && (
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200 p-4">
            <h4 className="text-sm font-semibold text-blue-800 mb-3 flex items-center gap-2">
              <span>🤖</span> AI 인사이트
            </h4>
            <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
              {cleanMarkdown(selectedReport.ai_insights)}
            </div>
          </div>
        )}
      </div>
    );
  }

  function renderAdsTable() {
    const ads = selectedReport?.report_data?.ad_performance || [];

    if (ads.length === 0) {
      return <div className="text-center text-gray-500 py-8">광고 데이터가 없습니다.</div>;
    }

    return (
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">광고명</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">리드</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">지출</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">CPL</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">CTR</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">효율</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {ads.sort((a, b) => a.cpl - b.cpl).map((ad, idx) => {
              const efficiency = ad.lead_percent - ad.spend_percent;
              return (
                <tr key={ad.ad_id || idx} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-900 max-w-[200px] truncate">
                    {ad.ad_name}
                  </td>
                  <td className="px-4 py-3 text-sm text-right text-gray-900 font-medium">
                    {ad.leads}건
                  </td>
                  <td className="px-4 py-3 text-sm text-right text-gray-600">
                    ${ad.spend.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-sm text-right">
                    <span className={ad.cpl < (selectedReport?.avg_cpl || 0) ? 'text-green-600' : 'text-red-600'}>
                      ${ad.cpl.toFixed(2)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-right text-gray-600">
                    {ad.ctr.toFixed(2)}%
                  </td>
                  <td className="px-4 py-3 text-sm text-right">
                    <span className={`px-2 py-1 rounded text-xs ${
                      efficiency > 5 ? 'bg-green-100 text-green-700' :
                      efficiency < -5 ? 'bg-red-100 text-red-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {efficiency > 5 ? '효율적' : efficiency < -5 ? '검토필요' : '보통'}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  function renderCampaignsTable() {
    const campaigns = selectedReport?.report_data?.campaign_performance || [];

    if (campaigns.length === 0) {
      return <div className="text-center text-gray-500 py-8">캠페인 데이터가 없습니다.</div>;
    }

    return (
      <div className="space-y-4">
        {/* 파이 차트 */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h4 className="text-sm font-semibold text-gray-700 mb-4">캠페인별 지출 비중</h4>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={campaigns}
                dataKey="spend"
                nameKey="campaign_name"
                cx="50%"
                cy="50%"
                outerRadius={70}
                label={({ name, percent }) => `${name.substring(0, 10)}... ${(percent * 100).toFixed(0)}%`}
                labelLine={false}
              >
                {campaigns.map((_, idx) => (
                  <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value: number) => [`$${value.toFixed(2)}`, '지출']} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* 테이블 */}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">캠페인명</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">리드</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">지출</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">CPL</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">효율</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {campaigns.map((camp, idx) => {
                const efficiency = camp.lead_percent - camp.spend_percent;
                return (
                  <tr key={camp.campaign_id || idx} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                        {camp.campaign_name}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-gray-900 font-medium">
                      {camp.leads}건 ({camp.lead_percent.toFixed(1)}%)
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-gray-600">
                      ${camp.spend.toFixed(2)} ({camp.spend_percent.toFixed(1)}%)
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-gray-900">
                      ${camp.cpl.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right">
                      <span className={`px-2 py-1 rounded text-xs ${
                        efficiency > 10 ? 'bg-green-100 text-green-700' :
                        efficiency < -10 ? 'bg-red-100 text-red-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {efficiency > 10 ? '효율적' : efficiency < -10 ? '검토필요' : '보통'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

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

  return (
    <div className="min-h-screen bg-gray-50">
      <Header clientName={clientName} isAdmin={accessMode === 'admin'} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 관리자/클라이언트 모드 표시 */}
        {accessMode === 'admin' && (
          <div className="mb-4 px-4 py-3 bg-purple-50 rounded-lg flex items-center justify-between">
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
          <div className="mb-4 px-4 py-3 bg-blue-50 rounded-lg">
            <span className="text-blue-700 font-medium">{clientName}</span>
            <span className="text-blue-500 ml-2">리포트</span>
          </div>
        )}

        {/* 페이지 헤더 */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <FileText className="w-7 h-7 text-blue-600" />
            리포트 아카이브
          </h1>
          <p className="mt-2 text-gray-600">
            발송된 주간/월간 성과 리포트를 확인하세요
          </p>
        </div>

        {/* 필터 */}
        <div className="mb-6 flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Filter className="w-4 h-4" />
            <span>필터:</span>
          </div>
          <div className="flex gap-2">
            {(['all', 'weekly', 'monthly'] as const).map((type) => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filterType === type
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
                }`}
              >
                {type === 'all' ? '전체' : type === 'weekly' ? '주간' : '월간'}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 리포트 목록 */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200">
              <div className="p-4 border-b border-gray-200">
                <h2 className="font-semibold text-gray-900">
                  리포트 목록 ({reports.length})
                </h2>
              </div>

              {loading ? (
                <div className="p-8 text-center text-gray-500">로딩 중...</div>
              ) : reports.length === 0 ? (
                <div className="p-8 text-center text-gray-500">저장된 리포트가 없습니다</div>
              ) : (
                <div className="divide-y divide-gray-100 max-h-[600px] overflow-y-auto">
                  {reports.map((report) => (
                    <button
                      key={report.id}
                      onClick={() => { setSelectedReport(report); setActiveTab('overview'); }}
                      className={`w-full p-4 text-left hover:bg-gray-50 transition-colors ${
                        selectedReport?.id === report.id ? 'bg-blue-50 border-l-4 border-blue-500' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                              report.report_type === 'weekly'
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-purple-100 text-purple-700'
                            }`}>
                              {report.report_type === 'weekly' ? '주간' : '월간'}
                            </span>
                            {report.report_data && (
                              <span className="px-2 py-0.5 rounded text-xs bg-green-100 text-green-700">
                                차트
                              </span>
                            )}
                          </div>
                          <p className="text-sm font-medium text-gray-900">
                            {formatPeriod(report.week_start, report.week_end, report.report_type)}
                          </p>
                          <div className="mt-2 flex items-center gap-4 text-xs text-gray-500">
                            <span>리드 {report.total_leads}건</span>
                            <span>${report.total_spend?.toFixed(0)}</span>
                          </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-gray-400" />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 리포트 상세 */}
          <div className="lg:col-span-2">
            {selectedReport ? (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200">
                {/* 헤더 */}
                <div className="p-6 border-b border-gray-200">
                  <div className="flex items-center gap-3 mb-2">
                    <span className={`px-3 py-1 rounded-lg text-sm font-medium ${
                      selectedReport.report_type === 'weekly'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-purple-100 text-purple-700'
                    }`}>
                      {selectedReport.report_type === 'weekly' ? '주간 리포트' : '월간 리포트'}
                    </span>
                  </div>
                  <h2 className="text-xl font-bold text-gray-900">
                    {formatPeriod(selectedReport.week_start, selectedReport.week_end, selectedReport.report_type)}
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">
                    발송일: {formatDate(selectedReport.sent_at)}
                  </p>
                </div>

                {/* KPI 요약 */}
                <div className="p-6 border-b border-gray-200">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-blue-50 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <Users className="w-4 h-4 text-blue-600" />
                        <p className="text-xs text-gray-500">리드</p>
                      </div>
                      <p className="text-xl font-bold text-gray-900">{selectedReport.total_leads}건</p>
                      <div className={`flex items-center gap-1 mt-1 text-xs ${getTrendColor(selectedReport.leads_change)}`}>
                        {getTrendIcon(selectedReport.leads_change)}
                        <span>{selectedReport.leads_change?.toFixed(1)}%</span>
                      </div>
                    </div>

                    <div className="bg-green-50 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <DollarSign className="w-4 h-4 text-green-600" />
                        <p className="text-xs text-gray-500">지출</p>
                      </div>
                      <p className="text-xl font-bold text-gray-900">${selectedReport.total_spend?.toFixed(2)}</p>
                      <div className={`flex items-center gap-1 mt-1 text-xs ${getTrendColor(selectedReport.spend_change, true)}`}>
                        {getTrendIcon(-selectedReport.spend_change)}
                        <span>{selectedReport.spend_change?.toFixed(1)}%</span>
                      </div>
                    </div>

                    <div className="bg-orange-50 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <Target className="w-4 h-4 text-orange-600" />
                        <p className="text-xs text-gray-500">CPL</p>
                      </div>
                      <p className="text-xl font-bold text-gray-900">${selectedReport.avg_cpl?.toFixed(2)}</p>
                      <div className={`flex items-center gap-1 mt-1 text-xs ${getTrendColor(selectedReport.cpl_change, true)}`}>
                        {getTrendIcon(-selectedReport.cpl_change)}
                        <span>{selectedReport.cpl_change?.toFixed(1)}%</span>
                      </div>
                    </div>

                    <div className="bg-purple-50 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <BarChart3 className="w-4 h-4 text-purple-600" />
                        <p className="text-xs text-gray-500">CTR</p>
                      </div>
                      <p className="text-xl font-bold text-gray-900">{selectedReport.avg_ctr?.toFixed(2)}%</p>
                    </div>
                  </div>
                </div>

                {/* 탭 네비게이션 */}
                <div className="border-b border-gray-200">
                  <div className="flex">
                    {[
                      { id: 'overview', label: '개요', icon: BarChart3 },
                      { id: 'ads', label: '광고별', icon: Target },
                      { id: 'campaigns', label: '캠페인별', icon: Users },
                      { id: 'raw', label: '원본', icon: FileText }
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as typeof activeTab)}
                        className={`flex items-center gap-2 px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                          activeTab === tab.id
                            ? 'border-blue-600 text-blue-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700'
                        }`}
                      >
                        <tab.icon className="w-4 h-4" />
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 탭 콘텐츠 */}
                <div className="p-6">
                  {activeTab === 'overview' && renderOverview()}
                  {activeTab === 'ads' && renderAdsTable()}
                  {activeTab === 'campaigns' && renderCampaignsTable()}
                  {activeTab === 'raw' && (
                    <div className="space-y-4">
                      {selectedReport.ai_insights && (
                        <div>
                          <h4 className="text-sm font-semibold text-gray-700 mb-2">🤖 AI 인사이트</h4>
                          <div className="bg-blue-50 rounded-lg p-4 text-sm text-gray-700 whitespace-pre-wrap">
                            {cleanMarkdown(selectedReport.ai_insights)}
                          </div>
                        </div>
                      )}
                      <div>
                        <h4 className="text-sm font-semibold text-gray-700 mb-2">📝 전체 메시지</h4>
                        <div className="bg-gray-900 rounded-lg p-4 text-sm text-gray-100 whitespace-pre-wrap font-mono overflow-x-auto max-h-[400px] overflow-y-auto">
                          {cleanMarkdown(selectedReport.message_text)}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
                <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">왼쪽 목록에서 리포트를 선택하세요</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
