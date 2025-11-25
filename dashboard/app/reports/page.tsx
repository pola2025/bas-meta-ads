'use client';

import { useEffect, useState } from 'react';
import { Header } from '@/components/Header';
import { supabase } from '@/lib/supabase';
import { FileText, Calendar, TrendingUp, TrendingDown, Minus, ChevronRight, Filter } from 'lucide-react';

interface Report {
  id: string;
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
}

export default function ReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [filterType, setFilterType] = useState<'all' | 'weekly' | 'monthly'>('all');

  useEffect(() => {
    fetchReports();
  }, [filterType]);

  async function fetchReports() {
    setLoading(true);
    try {
      let query = supabase
        .from('telegram_reports')
        .select('*')
        .order('week_start', { ascending: false })
        .limit(50);

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

  // 마크다운 이스케이프 제거 (텔레그램 MarkdownV2 → 일반 텍스트)
  function cleanMarkdown(text: string) {
    if (!text) return '';
    return text
      .replace(/\\([_*[\]()~`>#+\-=|{}.!])/g, '$1')
      .replace(/━+/g, '─'.repeat(30))
      .replace(/\n{3,}/g, '\n\n');
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
                <div className="p-8 text-center text-gray-500">
                  로딩 중...
                </div>
              ) : reports.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  저장된 리포트가 없습니다
                </div>
              ) : (
                <div className="divide-y divide-gray-100 max-h-[600px] overflow-y-auto">
                  {reports.map((report) => (
                    <button
                      key={report.id}
                      onClick={() => setSelectedReport(report)}
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
                            <Calendar className="w-3 h-3 text-gray-400" />
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
                  <h3 className="text-sm font-semibold text-gray-700 mb-4">핵심 지표</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="text-xs text-gray-500 mb-1">리드</p>
                      <p className="text-xl font-bold text-gray-900">
                        {selectedReport.total_leads}건
                      </p>
                      <div className={`flex items-center gap-1 mt-1 text-xs ${getTrendColor(selectedReport.leads_change)}`}>
                        {getTrendIcon(selectedReport.leads_change)}
                        <span>{selectedReport.leads_change?.toFixed(1)}%</span>
                      </div>
                    </div>

                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="text-xs text-gray-500 mb-1">지출</p>
                      <p className="text-xl font-bold text-gray-900">
                        ${selectedReport.total_spend?.toFixed(2)}
                      </p>
                      <div className={`flex items-center gap-1 mt-1 text-xs ${getTrendColor(selectedReport.spend_change, true)}`}>
                        {getTrendIcon(-selectedReport.spend_change)}
                        <span>{selectedReport.spend_change?.toFixed(1)}%</span>
                      </div>
                    </div>

                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="text-xs text-gray-500 mb-1">CPL</p>
                      <p className="text-xl font-bold text-gray-900">
                        ${selectedReport.avg_cpl?.toFixed(2)}
                      </p>
                      <div className={`flex items-center gap-1 mt-1 text-xs ${getTrendColor(selectedReport.cpl_change, true)}`}>
                        {getTrendIcon(-selectedReport.cpl_change)}
                        <span>{selectedReport.cpl_change?.toFixed(1)}%</span>
                      </div>
                    </div>

                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="text-xs text-gray-500 mb-1">CTR</p>
                      <p className="text-xl font-bold text-gray-900">
                        {selectedReport.avg_ctr?.toFixed(2)}%
                      </p>
                    </div>
                  </div>
                </div>

                {/* AI 인사이트 */}
                {selectedReport.ai_insights && (
                  <div className="p-6 border-b border-gray-200">
                    <h3 className="text-sm font-semibold text-gray-700 mb-4">🤖 AI 인사이트</h3>
                    <div className="bg-blue-50 rounded-lg p-4 text-sm text-gray-700 whitespace-pre-wrap">
                      {cleanMarkdown(selectedReport.ai_insights)}
                    </div>
                  </div>
                )}

                {/* 전체 메시지 */}
                <div className="p-6">
                  <h3 className="text-sm font-semibold text-gray-700 mb-4">📝 전체 리포트</h3>
                  <div className="bg-gray-900 rounded-lg p-6 text-sm text-gray-100 whitespace-pre-wrap font-mono overflow-x-auto max-h-[500px] overflow-y-auto">
                    {cleanMarkdown(selectedReport.message_text)}
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
                <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">
                  왼쪽 목록에서 리포트를 선택하세요
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
