'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Header } from '@/components/Header';
import { supabase } from '@/lib/supabase';
import { validateAccess, AccessMode, ClientInfo } from '@/lib/access-control';
import {
  FileText, TrendingUp, TrendingDown, Minus,
  ChevronRight, ChevronDown, Filter, BarChart3, Users, DollarSign, Target, Lock, ArrowLeft, LayoutDashboard
} from 'lucide-react';
import Link from 'next/link';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, ComposedChart, Legend
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
    videoViews?: number;
    avgWatchTime?: number;
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

  // 모바일용 개요 렌더링
  function renderMobileOverview() {
    if (!selectedReport?.report_data) {
      return (
        <div className="text-center text-gray-500 py-6 text-sm">
          구조화된 데이터가 없습니다. (기존 리포트)
        </div>
      );
    }

    const data = selectedReport.report_data;
    const isMonthly = selectedReport.report_type === 'monthly';

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
          cpl: d.cpl,
          videoViews: d.videoViews || 0,
          avgWatchTime: d.avgWatchTime || 0
        }));

    // 영상 데이터 유무 확인 (eslint-disable를 사용하여 any 타입 허용)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const hasVideoData = !isMonthly && trendData.some((d: any) => (d.videoViews || 0) > 0);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const hasWatchTime = !isMonthly && trendData.some((d: any) => (d.avgWatchTime || 0) > 0);

    return (
      <div className="space-y-4">
        {/* 트렌드 차트 - 축소 */}
        <div className="bg-gray-50 rounded-lg p-3">
          <h4 className="text-xs font-semibold text-gray-700 mb-2">
            {isMonthly ? '주별 트렌드' : '일별 트렌드'}
          </h4>
          {trendData.length > 0 ? (
            <ResponsiveContainer width="100%" height={hasWatchTime ? 180 : 160}>
              <ComposedChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 9 }} interval={isMonthly ? 0 : 1} />
                <YAxis yAxisId="left" tick={{ fontSize: 9 }} width={30} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 9 }} width={35} tickFormatter={(v) => `$${v}`} />
                {hasWatchTime && <YAxis yAxisId="watch" orientation="right" hide />}
                <Tooltip
                  contentStyle={{ fontSize: 10 }}
                  formatter={(value: number, name: string) => {
                    if (name === 'leads') return [value, '리드'];
                    if (name === 'spend') return [`$${value.toFixed(0)}`, '지출'];
                    if (name === 'videoViews') return [value, '영상조회'];
                    if (name === 'avgWatchTime') return [`${value.toFixed(1)}초`, '시청시간'];
                    return [value, name];
                  }}
                />
                <Bar yAxisId="left" dataKey="leads" fill="#3B82F6" name="리드" />
                <Bar yAxisId="right" dataKey="spend" fill="#10B981" name="지출" />
                {hasVideoData && <Bar yAxisId="left" dataKey="videoViews" fill="#EF4444" name="영상조회" />}
                {hasWatchTime && <Line yAxisId="watch" type="monotone" dataKey="avgWatchTime" stroke="#9333EA" strokeWidth={2} dot={{ r: 3, fill: '#9333EA' }} name="시청시간" />}
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center text-gray-400 py-4 text-xs">데이터 없음</div>
          )}
        </div>

        {/* AI 인사이트 */}
        {selectedReport?.ai_insights && (
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200 p-3">
            <h4 className="text-xs font-semibold text-blue-800 mb-2 flex items-center gap-1">
              <span>🤖</span> AI 인사이트
            </h4>
            <div className="text-[11px] text-gray-700 whitespace-pre-wrap leading-relaxed">
              {cleanMarkdown(selectedReport.ai_insights)}
            </div>
          </div>
        )}
      </div>
    );
  }

  // 모바일용 광고 테이블
  function renderMobileAdsTable() {
    const ads = selectedReport?.report_data?.ad_performance || [];

    if (ads.length === 0) {
      return <div className="text-center text-gray-500 py-6 text-sm">광고 데이터가 없습니다.</div>;
    }

    return (
      <div className="space-y-1">
        {/* 목차 헤더 */}
        <div className="grid grid-cols-[1fr_40px_40px_40px] gap-1 px-2 py-1 text-[9px] text-gray-400 font-medium">
          <span>광고명</span>
          <span className="text-right">리드</span>
          <span className="text-right">CPL</span>
          <span className="text-right">효율</span>
        </div>
        {/* 광고 행 - 지출이 있는 모든 광고 표시 */}
        {ads.filter(ad => ad.spend > 0).sort((a, b) => b.spend - a.spend).map((ad, idx) => {
          const efficiency = ad.lead_percent - ad.spend_percent;
          return (
            <div key={ad.ad_id || idx} className="grid grid-cols-[1fr_40px_40px_40px] gap-1 px-2 py-2 items-center bg-gray-50 rounded-lg">
              <span className="text-[10px] font-medium text-gray-900 truncate">{ad.ad_name}</span>
              <span className="text-[10px] font-bold text-blue-600 text-right">{ad.leads}</span>
              <span className={`text-[10px] font-bold text-right ${
                ad.leads > 0 ? (ad.cpl < (selectedReport?.avg_cpl || 0) ? 'text-green-600' : 'text-orange-600') : 'text-gray-400'
              }`}>
                {ad.leads > 0 ? `$${ad.cpl.toFixed(0)}` : '-'}
              </span>
              <span className={`text-[9px] text-center px-1 py-0.5 rounded ${
                efficiency > 5 ? 'bg-green-100 text-green-700' :
                efficiency < -5 ? 'bg-red-100 text-red-700' :
                'bg-gray-200 text-gray-600'
              }`}>
                {efficiency > 5 ? '좋음' : efficiency < -5 ? '검토' : '보통'}
              </span>
            </div>
          );
        })}
      </div>
    );
  }

  // 모바일용 캠페인 테이블
  function renderMobileCampaignsTable() {
    const campaigns = selectedReport?.report_data?.campaign_performance || [];

    if (campaigns.length === 0) {
      return <div className="text-center text-gray-500 py-6 text-sm">캠페인 데이터가 없습니다.</div>;
    }

    return (
      <div className="space-y-3">
        {/* 파이 차트 - 축소 */}
        <div className="bg-gray-50 rounded-lg p-3">
          <h4 className="text-xs font-semibold text-gray-700 mb-2">캠페인별 지출 비중</h4>
          <ResponsiveContainer width="100%" height={140}>
            <PieChart>
              <Pie
                data={campaigns}
                dataKey="spend"
                nameKey="campaign_name"
                cx="50%"
                cy="50%"
                outerRadius={50}
                label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
                labelLine={false}
              >
                {campaigns.map((_, idx) => (
                  <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ fontSize: 10 }}
                formatter={(value: number) => [`$${value.toFixed(0)}`, '지출']}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* 캠페인 행 */}
        <div className="space-y-1">
          {/* 목차 헤더 */}
          <div className="grid grid-cols-[auto_1fr_40px_40px_40px] gap-1 px-2 py-1 text-[9px] text-gray-400 font-medium">
            <span className="w-3"></span>
            <span>캠페인명</span>
            <span className="text-right">리드</span>
            <span className="text-right">CPL</span>
            <span className="text-right">효율</span>
          </div>
          {campaigns.filter(camp => camp.cpl !== null || camp.leads > 0).map((camp, idx) => {
            const efficiency = camp.lead_percent - camp.spend_percent;
            return (
              <div key={camp.campaign_id || idx} className="grid grid-cols-[auto_1fr_40px_40px_40px] gap-1 px-2 py-2 items-center bg-gray-50 rounded-lg">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                <span className="text-[10px] font-medium text-gray-900 truncate">{camp.campaign_name}</span>
                <span className="text-[10px] font-bold text-blue-600 text-right">{camp.leads}</span>
                <span className="text-[10px] font-bold text-gray-900 text-right">{camp.cpl !== null ? `$${camp.cpl.toFixed(0)}` : '-'}</span>
                <span className={`text-[9px] text-center px-1 py-0.5 rounded ${
                  efficiency > 10 ? 'bg-green-100 text-green-700' :
                  efficiency < -10 ? 'bg-red-100 text-red-700' :
                  'bg-gray-200 text-gray-600'
                }`}>
                  {efficiency > 10 ? '좋음' : efficiency < -10 ? '검토' : '보통'}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
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
          cpl: d.cpl,
          videoViews: d.videoViews || 0,
          avgWatchTime: d.avgWatchTime || 0
        }));

    // 영상 데이터 유무 확인 (eslint-disable를 사용하여 any 타입 허용)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const hasVideoData = !isMonthly && trendData.some((d: any) => (d.videoViews || 0) > 0);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const hasWatchTime = !isMonthly && trendData.some((d: any) => (d.avgWatchTime || 0) > 0);

    // 요일별 데이터 (월간만)
    const dayData = data.day_of_week_stats || [];

    return (
      <div className="space-y-6">
        {/* 트렌드 차트 */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h4 className="text-sm font-semibold text-gray-700 mb-4">
            {isMonthly ? '주별 트렌드' : '일별 트렌드'}
            {hasWatchTime && <span className="ml-2 text-xs text-purple-600 font-normal">(보라선: 시청시간)</span>}
          </h4>
          {trendData.length > 0 ? (
            <ResponsiveContainer width="100%" height={hasWatchTime ? 280 : 250}>
              <ComposedChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} tickFormatter={(v) => `$${v}`} />
                {hasWatchTime && <YAxis yAxisId="watch" orientation="right" hide />}
                <Tooltip
                  formatter={(value: number, name: string) => {
                    if (name === 'spend') return [`$${value.toFixed(2)}`, '지출'];
                    if (name === 'cpl') return [`$${value.toFixed(2)}`, 'CPL'];
                    if (name === 'videoViews') return [value, '영상조회'];
                    if (name === 'avgWatchTime') return [`${value.toFixed(1)}초`, '시청시간'];
                    return [value, '리드'];
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar yAxisId="left" dataKey="leads" fill="#3B82F6" name="리드" />
                <Bar yAxisId="right" dataKey="spend" fill="#10B981" name="지출" />
                {hasVideoData && <Bar yAxisId="left" dataKey="videoViews" fill="#EF4444" name="영상조회" />}
                {hasWatchTime && <Line yAxisId="watch" type="monotone" dataKey="avgWatchTime" stroke="#9333EA" strokeWidth={2} dot={{ r: 4, fill: '#9333EA' }} name="시청시간" />}
              </ComposedChart>
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
            {ads.filter(ad => ad.spend > 0).sort((a, b) => b.spend - a.spend).map((ad, idx) => {
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
                    {ad.leads > 0 ? (
                      <span className={ad.cpl < (selectedReport?.avg_cpl || 0) ? 'text-green-600' : 'text-red-600'}>
                        ${ad.cpl.toFixed(2)}
                      </span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
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
              {campaigns.filter(camp => camp.cpl !== null || camp.leads > 0).map((camp, idx) => {
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
                      {camp.cpl !== null ? `$${camp.cpl.toFixed(2)}` : '-'}
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
          <div className="mb-3 md:mb-4 px-3 py-2 md:px-4 md:py-3 bg-purple-50 rounded-lg flex flex-col md:flex-row md:items-center md:justify-between gap-2">
            <div className="flex flex-col md:flex-row md:items-center gap-0.5 md:gap-2">
              <span className="text-purple-700 font-medium text-sm md:text-base">🔐 관리자 모드</span>
              <span className="text-purple-500 text-xs md:text-sm">모든 클라이언트 데이터 접근 가능</span>
            </div>
            <select
              className="border border-purple-200 rounded-lg px-2 py-1 md:px-3 md:py-1.5 text-xs md:text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-500 w-full md:w-auto"
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
          <div className="mb-3 md:mb-4 px-3 py-2 md:px-4 md:py-3 bg-blue-50 rounded-lg flex items-center justify-between">
            <div>
              <span className="text-blue-700 font-medium text-sm md:text-base">{clientName}</span>
              <span className="text-blue-500 ml-2 text-xs md:text-sm">리포트</span>
            </div>
            <Link
              href={`/?client=${clientId}`}
              className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-xs md:text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              <LayoutDashboard className="w-3.5 h-3.5 md:w-4 md:h-4" />
              <span>대시보드</span>
            </Link>
          </div>
        )}

        {/* 페이지 헤더 */}
        <div className="mb-4 md:mb-8">
          <h1 className="text-lg md:text-2xl font-bold text-gray-900 flex items-center gap-2 md:gap-3">
            <FileText className="w-5 h-5 md:w-7 md:h-7 text-blue-600" />
            리포트 아카이브
          </h1>
          <p className="mt-1 md:mt-2 text-xs md:text-base text-gray-600">
            발송된 주간/월간 성과 리포트를 확인하세요
          </p>
        </div>

        {/* 필터 - 모바일에서 상세보기 중일 때 숨김 */}
        <div className={`mb-4 md:mb-6 flex items-center gap-2 md:gap-4 ${selectedReport ? 'hidden md:flex' : ''}`}>
          <div className="hidden md:flex items-center gap-2 text-sm text-gray-600">
            <Filter className="w-4 h-4" />
            <span>필터:</span>
          </div>
          <div className="flex gap-1 md:gap-2 bg-gray-100 p-1 rounded-lg md:bg-transparent md:p-0">
            {(['all', 'weekly', 'monthly'] as const).map((type) => (
              <button
                key={type}
                onClick={() => {
                  setFilterType(type);
                  // 모바일에서 필터 변경 시 목록으로 돌아가기
                  if (window.innerWidth < 768) {
                    setSelectedReport(null);
                  }
                }}
                className={`px-3 py-1.5 md:px-4 md:py-2 rounded-md md:rounded-lg text-xs md:text-sm font-medium transition-colors ${
                  filterType === type
                    ? 'bg-white md:bg-blue-600 text-gray-900 md:text-white shadow-sm md:shadow-none'
                    : 'text-gray-600 md:text-gray-700 hover:text-gray-900 md:hover:bg-gray-100 md:bg-white md:border md:border-gray-200'
                }`}
              >
                {type === 'all' ? '전체' : type === 'weekly' ? '주간' : '월간'}
              </button>
            ))}
          </div>
        </div>

        {/* 모바일: 리포트 선택 시 상세만 표시 */}
        <div className={`md:hidden ${selectedReport ? 'hidden' : 'block'}`}>
          {/* 모바일 리포트 목록 - 컴팩트 그리드 */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="px-3 py-2 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-900">
                리포트 목록
              </h2>
              <span className="text-xs text-gray-500">{reports.length}개</span>
            </div>

            {loading ? (
              <div className="p-8 text-center text-gray-500 text-sm">로딩 중...</div>
            ) : reports.length === 0 ? (
              <div className="p-8 text-center text-gray-500 text-sm">저장된 리포트가 없습니다</div>
            ) : (
              <>
                {/* 목차 헤더 */}
                <div className="grid grid-cols-[auto_1fr_45px_45px] gap-2 px-3 py-1.5 bg-gray-50 border-b border-gray-100 text-[10px] text-gray-400 font-medium">
                  <span className="w-10">타입</span>
                  <span>기간</span>
                  <span className="text-right">리드</span>
                  <span className="text-right">CPL</span>
                </div>
                {/* 리포트 행 */}
                <div className="divide-y divide-gray-100 max-h-[calc(100vh-280px)] overflow-y-auto">
                  {reports.map((report) => (
                    <button
                      key={report.id}
                      onClick={() => { setSelectedReport(report); setActiveTab('overview'); }}
                      className="w-full grid grid-cols-[auto_1fr_45px_45px] gap-2 px-3 py-2.5 items-center text-left hover:bg-gray-50 active:bg-blue-50 transition-colors"
                    >
                      <span className={`w-10 text-[10px] px-1.5 py-0.5 rounded text-center font-medium ${
                        report.report_type === 'weekly'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-purple-100 text-purple-700'
                      }`}>
                        {report.report_type === 'weekly' ? '주간' : '월간'}
                      </span>
                      <span className="text-[11px] font-medium text-gray-900 truncate">
                        {formatPeriod(report.week_start, report.week_end, report.report_type)}
                      </span>
                      <span className="text-[11px] font-bold text-blue-600 text-right">
                        {report.total_leads}
                      </span>
                      <span className={`text-[11px] font-bold text-right ${
                        report.avg_cpl > 20 ? 'text-orange-600' : 'text-green-600'
                      }`}>
                        ${report.avg_cpl?.toFixed(0)}
                      </span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* 모바일: 선택된 리포트 상세 (전체 화면) */}
        <div className={`md:hidden ${selectedReport ? 'block' : 'hidden'}`}>
          {selectedReport && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200">
              {/* 뒤로가기 + 헤더 */}
              <div className="px-3 py-3 border-b border-gray-200">
                <button
                  onClick={() => setSelectedReport(null)}
                  className="flex items-center gap-1 text-xs text-blue-600 mb-2"
                >
                  <ArrowLeft className="w-3 h-3" />
                  목록으로
                </button>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                    selectedReport.report_type === 'weekly'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-purple-100 text-purple-700'
                  }`}>
                    {selectedReport.report_type === 'weekly' ? '주간' : '월간'}
                  </span>
                  <span className="text-[10px] text-gray-400">
                    발송: {formatDate(selectedReport.sent_at)}
                  </span>
                </div>
                <h2 className="text-base font-bold text-gray-900">
                  {formatPeriod(selectedReport.week_start, selectedReport.week_end, selectedReport.report_type)}
                </h2>
              </div>

              {/* 모바일 KPI - 4열 압축 그리드 */}
              <div className="px-3 py-3 border-b border-gray-200">
                <div className="grid grid-cols-4 gap-2">
                  <div className="text-center py-2 bg-blue-50 rounded-lg">
                    <p className="text-[9px] text-gray-500">리드</p>
                    <p className="text-sm font-bold text-blue-600">{selectedReport.total_leads}</p>
                    <div className={`flex items-center justify-center gap-0.5 text-[9px] ${getTrendColor(selectedReport.leads_change)}`}>
                      {selectedReport.leads_change > 0 ? <TrendingUp className="w-2 h-2" /> : selectedReport.leads_change < 0 ? <TrendingDown className="w-2 h-2" /> : null}
                      <span>{selectedReport.leads_change?.toFixed(0)}%</span>
                    </div>
                  </div>
                  <div className="text-center py-2 bg-green-50 rounded-lg">
                    <p className="text-[9px] text-gray-500">지출</p>
                    <p className="text-sm font-bold text-gray-900">${(selectedReport.total_spend/1000).toFixed(1)}K</p>
                    <div className={`flex items-center justify-center gap-0.5 text-[9px] ${getTrendColor(selectedReport.spend_change, true)}`}>
                      {selectedReport.spend_change > 0 ? <TrendingUp className="w-2 h-2" /> : selectedReport.spend_change < 0 ? <TrendingDown className="w-2 h-2" /> : null}
                      <span>{selectedReport.spend_change?.toFixed(0)}%</span>
                    </div>
                  </div>
                  <div className="text-center py-2 bg-orange-50 rounded-lg">
                    <p className="text-[9px] text-gray-500">CPL</p>
                    <p className={`text-sm font-bold ${selectedReport.avg_cpl > 20 ? 'text-orange-600' : 'text-green-600'}`}>
                      ${selectedReport.avg_cpl?.toFixed(0)}
                    </p>
                    <div className={`flex items-center justify-center gap-0.5 text-[9px] ${getTrendColor(selectedReport.cpl_change, true)}`}>
                      {selectedReport.cpl_change > 0 ? <TrendingUp className="w-2 h-2" /> : selectedReport.cpl_change < 0 ? <TrendingDown className="w-2 h-2" /> : null}
                      <span>{selectedReport.cpl_change?.toFixed(0)}%</span>
                    </div>
                  </div>
                  <div className="text-center py-2 bg-purple-50 rounded-lg">
                    <p className="text-[9px] text-gray-500">CTR</p>
                    <p className="text-sm font-bold text-purple-600">{selectedReport.avg_ctr?.toFixed(1)}%</p>
                  </div>
                </div>
              </div>

              {/* 모바일 탭 - 아이콘 + 라벨 */}
              <div className="border-b border-gray-200">
                <div className="flex">
                  {[
                    { id: 'overview', label: '개요', icon: BarChart3 },
                    { id: 'ads', label: '광고', icon: Target },
                    { id: 'raw', label: '원본', icon: FileText }
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as typeof activeTab)}
                      className={`flex-1 py-2 text-center transition-colors ${
                        activeTab === tab.id
                          ? 'border-b-2 border-blue-600 text-blue-600'
                          : 'text-gray-400'
                      }`}
                    >
                      <tab.icon className="w-4 h-4 mx-auto" />
                      <span className="text-[9px] mt-0.5 block">{tab.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* 모바일 탭 콘텐츠 */}
              <div className="p-3">
                {activeTab === 'overview' && renderMobileOverview()}
                {activeTab === 'ads' && renderMobileAdsTable()}
                {activeTab === 'raw' && (
                  <div className="space-y-3">
                    {selectedReport.ai_insights && (
                      <div>
                        <h4 className="text-xs font-semibold text-gray-700 mb-1">🤖 AI 인사이트</h4>
                        <div className="bg-blue-50 rounded-lg p-3 text-[11px] text-gray-700 whitespace-pre-wrap leading-relaxed">
                          {cleanMarkdown(selectedReport.ai_insights)}
                        </div>
                      </div>
                    )}
                    <div>
                      <h4 className="text-xs font-semibold text-gray-700 mb-1">📝 전체 메시지</h4>
                      <div className="bg-gray-900 rounded-lg p-3 text-[10px] text-gray-100 whitespace-pre-wrap font-mono max-h-[300px] overflow-y-auto">
                        {cleanMarkdown(selectedReport.message_text)}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* PC: 기존 그리드 레이아웃 */}
        <div className="hidden md:grid grid-cols-1 lg:grid-cols-3 gap-6">
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
