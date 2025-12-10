'use client';

import { useState, useEffect, useCallback } from 'react';
import { Power, PowerOff, RefreshCw, Search, Filter, ChevronDown, ChevronRight, AlertCircle, CheckCircle, XCircle, Users, MousePointerClick, Megaphone, Target, DollarSign, Database, Clock } from 'lucide-react';

interface AdMetrics {
  spend: number;
  leads: number;
  cpl: number;
  video_views?: number;
  avg_watch_time?: number;
}

interface Campaign {
  id: string;
  name: string;
  status: string;
  objective?: string;
  daily_budget?: number | null;
  lifetime_budget?: number | null;
  budget_remaining?: number | null;
}

interface Ad {
  id: string;
  name: string;
  status: string;
  effective_status: string;
  configured_status: string;
  campaign: Campaign | null;
  thumbnail_url: string | null;
  created_time: string;
  updated_time: string;
  metrics: AdMetrics;
}

interface AdManagementTabProps {
  clientId: string;
}

// 상태 뱃지 컴포넌트
function StatusBadge({ status }: { status: string }) {
  const statusConfig: Record<string, { color: string; label: string; icon: React.ReactNode }> = {
    ACTIVE: { color: 'bg-green-100 text-green-800', label: '활성', icon: <CheckCircle className="w-3 h-3" /> },
    PAUSED: { color: 'bg-yellow-100 text-yellow-800', label: '일시정지', icon: <PowerOff className="w-3 h-3" /> },
    PENDING_REVIEW: { color: 'bg-blue-100 text-blue-800', label: '검토 중', icon: <AlertCircle className="w-3 h-3" /> },
    DISAPPROVED: { color: 'bg-red-100 text-red-800', label: '비승인', icon: <XCircle className="w-3 h-3" /> },
    DELETED: { color: 'bg-gray-100 text-gray-500', label: '삭제됨', icon: null },
    ARCHIVED: { color: 'bg-gray-100 text-gray-500', label: '보관됨', icon: null },
    WITH_ISSUES: { color: 'bg-orange-100 text-orange-800', label: '문제 있음', icon: <AlertCircle className="w-3 h-3" /> },
  };

  const config = statusConfig[status] || { color: 'bg-gray-100 text-gray-600', label: status, icon: null };

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${config.color}`}>
      {config.icon}
      {config.label}
    </span>
  );
}

// 광고 목표 뱃지 컴포넌트
function ObjectiveBadge({ objective }: { objective: string | undefined | null }) {
  if (!objective) return null;

  const objectiveConfig: Record<string, { color: string; label: string; icon: React.ReactNode }> = {
    // 잠재고객/리드 관련
    LEAD_GENERATION: { color: 'bg-purple-100 text-purple-700', label: '잠재고객', icon: <Users className="w-3 h-3" /> },
    OUTCOME_LEADS: { color: 'bg-purple-100 text-purple-700', label: '잠재고객', icon: <Users className="w-3 h-3" /> },
    // 트래픽 관련
    LINK_CLICKS: { color: 'bg-blue-100 text-blue-700', label: '트래픽', icon: <MousePointerClick className="w-3 h-3" /> },
    OUTCOME_TRAFFIC: { color: 'bg-blue-100 text-blue-700', label: '트래픽', icon: <MousePointerClick className="w-3 h-3" /> },
    // 전환 관련
    CONVERSIONS: { color: 'bg-green-100 text-green-700', label: '전환', icon: <Target className="w-3 h-3" /> },
    OUTCOME_SALES: { color: 'bg-green-100 text-green-700', label: '전환', icon: <Target className="w-3 h-3" /> },
    // 인지도/도달
    REACH: { color: 'bg-cyan-100 text-cyan-700', label: '도달', icon: <Megaphone className="w-3 h-3" /> },
    BRAND_AWARENESS: { color: 'bg-cyan-100 text-cyan-700', label: '인지도', icon: <Megaphone className="w-3 h-3" /> },
    OUTCOME_AWARENESS: { color: 'bg-cyan-100 text-cyan-700', label: '인지도', icon: <Megaphone className="w-3 h-3" /> },
    // 참여
    OUTCOME_ENGAGEMENT: { color: 'bg-pink-100 text-pink-700', label: '참여', icon: <Users className="w-3 h-3" /> },
    POST_ENGAGEMENT: { color: 'bg-pink-100 text-pink-700', label: '참여', icon: <Users className="w-3 h-3" /> },
  };

  const config = objectiveConfig[objective];
  if (!config) return null;

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${config.color}`}>
      {config.icon}
      {config.label}
    </span>
  );
}

// 게이지바 컴포넌트 - 녹색/파란색 그라데이션
function MetricGauge({
  value,
  maxValue,
  label,
  format = 'number',
  colorType = 'default'
}: {
  value: number;
  maxValue: number;
  label: string;
  format?: 'number' | 'currency' | 'cpl' | 'time';
  colorType?: 'default' | 'cpl';
}) {
  // 퍼센트 계산 (최소 5%, 최대 100%)
  const percentage = maxValue > 0 ? Math.min(Math.max((value / maxValue) * 100, value > 0 ? 5 : 0), 100) : 0;

  // 값 포맷팅
  const formatValue = () => {
    if (format === 'currency' || format === 'cpl') {
      return `$${value.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
    }
    if (format === 'time') {
      // 초를 "Xs" 형식으로 표시
      return `${value.toFixed(1)}s`;
    }
    return value.toLocaleString('en-US');
  };

  // CPL 색상 (낮을수록 좋음 - 녹색, 높을수록 나쁨 - 빨강)
  const getCplGradient = () => {
    if (value === 0) return 'from-gray-200 to-gray-300';
    if (value <= 20) return 'from-emerald-400 to-teal-500';
    if (value <= 35) return 'from-yellow-400 to-amber-500';
    return 'from-orange-400 to-red-500';
  };

  // 기본 그라데이션 (녹색 → 파란색)
  const getDefaultGradient = () => {
    if (value === 0) return 'from-gray-200 to-gray-300';
    return 'from-emerald-400 via-teal-500 to-cyan-500';
  };

  const gradient = colorType === 'cpl' ? getCplGradient() : getDefaultGradient();

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-500">{label}</span>
        <span className={`text-sm font-semibold ${
          colorType === 'cpl'
            ? value === 0 ? 'text-gray-400' : value <= 20 ? 'text-emerald-600' : value <= 35 ? 'text-amber-600' : 'text-red-600'
            : value === 0 ? 'text-gray-400' : 'text-gray-900'
        }`}>
          {formatValue()}
        </span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${gradient} transition-all duration-500 ease-out`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

// 활성 예산 요약 테이블 컴포넌트
function ActiveBudgetSummary({ ads }: { ads: Ad[] }) {
  // 활성 광고만 필터
  const activeAds = ads.filter(ad => ad.effective_status === 'ACTIVE');

  if (activeAds.length === 0) return null;

  // objective별 일 예산 합계 계산
  const budgetByObjective: Record<string, { label: string; icon: React.ReactNode; budget: number; color: string }> = {};

  // 캠페인별로 중복 제거 (같은 캠페인의 여러 광고가 있을 수 있음)
  const processedCampaigns = new Set<string>();

  activeAds.forEach(ad => {
    if (!ad.campaign?.id || processedCampaigns.has(ad.campaign.id)) return;
    processedCampaigns.add(ad.campaign.id);

    const objective = ad.campaign.objective || 'UNKNOWN';
    const dailyBudget = ad.campaign.daily_budget || 0;

    if (dailyBudget <= 0) return;

    // objective 매핑
    const objectiveConfig: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
      LEAD_GENERATION: { label: '잠재고객', icon: <Users className="w-4 h-4" />, color: 'text-purple-600' },
      OUTCOME_LEADS: { label: '잠재고객', icon: <Users className="w-4 h-4" />, color: 'text-purple-600' },
      LINK_CLICKS: { label: '트래픽', icon: <MousePointerClick className="w-4 h-4" />, color: 'text-blue-600' },
      OUTCOME_TRAFFIC: { label: '트래픽', icon: <MousePointerClick className="w-4 h-4" />, color: 'text-blue-600' },
      CONVERSIONS: { label: '전환', icon: <Target className="w-4 h-4" />, color: 'text-green-600' },
      OUTCOME_SALES: { label: '전환', icon: <Target className="w-4 h-4" />, color: 'text-green-600' },
      REACH: { label: '도달', icon: <Megaphone className="w-4 h-4" />, color: 'text-cyan-600' },
      BRAND_AWARENESS: { label: '인지도', icon: <Megaphone className="w-4 h-4" />, color: 'text-cyan-600' },
      OUTCOME_AWARENESS: { label: '인지도', icon: <Megaphone className="w-4 h-4" />, color: 'text-cyan-600' },
      OUTCOME_ENGAGEMENT: { label: '참여', icon: <Users className="w-4 h-4" />, color: 'text-pink-600' },
      POST_ENGAGEMENT: { label: '참여', icon: <Users className="w-4 h-4" />, color: 'text-pink-600' },
    };

    const config = objectiveConfig[objective] || { label: objective, icon: <Target className="w-4 h-4" />, color: 'text-gray-600' };
    const key = config.label; // 같은 라벨끼리 그룹화

    if (!budgetByObjective[key]) {
      budgetByObjective[key] = { ...config, budget: 0 };
    }
    budgetByObjective[key].budget += dailyBudget;
  });

  const entries = Object.entries(budgetByObjective);
  if (entries.length === 0) return null;

  const totalBudget = entries.reduce((sum, [_, data]) => sum + data.budget, 0);

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden mb-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-green-50 to-emerald-50 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-green-600" />
          <span className="font-semibold text-gray-800">활성 예산</span>
        </div>
        <span className="text-xl font-bold text-green-600">${totalBudget.toFixed(0)}</span>
      </div>

      {/* 상세 목록 */}
      <div className="divide-y divide-gray-100">
        {entries.map(([key, data]) => (
          <div key={key} className="flex items-center justify-between px-4 py-2.5 hover:bg-gray-50">
            <div className={`flex items-center gap-2 ${data.color}`}>
              {data.icon}
              <span className="text-sm font-medium">{data.label}</span>
            </div>
            <span className="text-sm font-semibold text-gray-700">${data.budget.toFixed(0)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// 예산 표시 컴포넌트
function BudgetDisplay({ campaign }: { campaign: Campaign | null }) {
  if (!campaign) return null;

  const dailyBudget = campaign.daily_budget;
  const lifetimeBudget = campaign.lifetime_budget;
  const remaining = campaign.budget_remaining;

  // 예산이 없으면 표시 안 함
  if (!dailyBudget && !lifetimeBudget) return null;

  // 진행률 계산 (lifetime budget인 경우)
  let usedPercent = 0;
  if (lifetimeBudget && remaining !== null && remaining !== undefined) {
    const used = lifetimeBudget - remaining;
    usedPercent = Math.min(100, (used / lifetimeBudget) * 100);
  }

  return (
    <div className="flex items-center gap-2 text-xs">
      {dailyBudget ? (
        <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded">
          일 ${dailyBudget.toFixed(0)}
        </span>
      ) : lifetimeBudget ? (
        <div className="flex items-center gap-1.5">
          <span className="text-gray-500">총 ${lifetimeBudget.toFixed(0)}</span>
          <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${usedPercent > 80 ? 'bg-red-500' : usedPercent > 50 ? 'bg-yellow-500' : 'bg-green-500'}`}
              style={{ width: `${usedPercent}%` }}
            />
          </div>
          <span className="text-gray-400">{usedPercent.toFixed(0)}%</span>
        </div>
      ) : null}
    </div>
  );
}

// 토글 스위치 컴포넌트
function ToggleSwitch({
  enabled,
  onChange,
  disabled,
  loading
}: {
  enabled: boolean;
  onChange: () => void;
  disabled?: boolean;
  loading?: boolean;
}) {
  return (
    <button
      onClick={onChange}
      disabled={disabled || loading}
      className={`
        relative inline-flex h-6 w-11 items-center rounded-full transition-colors
        ${enabled ? 'bg-green-500' : 'bg-gray-300'}
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
      `}
    >
      {loading ? (
        <span className="absolute inset-0 flex items-center justify-center">
          <RefreshCw className="w-3 h-3 animate-spin text-white" />
        </span>
      ) : (
        <span
          className={`
            inline-block h-4 w-4 transform rounded-full bg-white transition-transform
            ${enabled ? 'translate-x-6' : 'translate-x-1'}
          `}
        />
      )}
    </button>
  );
}

// 활성 광고 카드 컴포넌트 - 썸네일 + 광고명 상단, 지표들 세로 배치
function ActiveAdRow({
  ad,
  selected,
  onSelect,
  onToggle,
  loading,
  maxValues
}: {
  ad: Ad;
  selected: boolean;
  onSelect: () => void;
  onToggle: () => void;
  loading: boolean;
  maxValues: { spend: number; leads: number; cpl: number; video_views: number; avg_watch_time: number };
}) {
  // 게이지 퍼센트 계산
  const getPercent = (value: number, max: number) => max > 0 ? Math.min(Math.max((value / max) * 100, value > 0 ? 3 : 0), 100) : 0;

  // CPL 색상
  const getCplColor = (cpl: number) => {
    if (cpl === 0) return { text: 'text-gray-400', bar: 'from-gray-200 to-gray-300' };
    if (cpl <= 20) return { text: 'text-emerald-600', bar: 'from-emerald-400 to-teal-500' };
    if (cpl <= 35) return { text: 'text-amber-600', bar: 'from-yellow-400 to-amber-500' };
    return { text: 'text-red-600', bar: 'from-orange-400 to-red-500' };
  };

  const cplColor = getCplColor(ad.metrics.cpl);

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
      {/* PC 레이아웃 */}
      <div className="hidden md:block p-4">
        {/* 상단: 체크박스 + 썸네일 + 광고명 + 토글 */}
        <div className="flex items-center gap-4 mb-4">
          <input
            type="checkbox"
            checked={selected}
            onChange={onSelect}
            className="w-5 h-5 rounded border-gray-300 flex-shrink-0 cursor-pointer"
          />
          <div className="flex-shrink-0 w-16 h-16 bg-gray-100 rounded-lg overflow-hidden">
            {ad.thumbnail_url ? (
              <img src={ad.thumbnail_url} alt={ad.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">-</div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-gray-900 text-lg truncate" title={ad.name}>{ad.name}</div>
            <div className="text-sm text-gray-500 truncate">{ad.campaign?.name || '-'}</div>
          </div>
          <ToggleSwitch
            enabled={ad.effective_status === 'ACTIVE'}
            onChange={onToggle}
            loading={loading}
          />
        </div>

        {/* 하단: 지표들 세로 배치 (가로 게이지바) */}
        <div className="space-y-3 pl-9">
          {/* 지출 */}
          <div className="flex items-center gap-3">
            <span className="w-16 text-sm text-gray-500">지출</span>
            <span className="w-20 text-sm font-bold text-gray-900 text-right">${ad.metrics.spend.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
            <div className="flex-1 h-6 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-teal-500 to-cyan-500 transition-all duration-300"
                style={{ width: `${getPercent(ad.metrics.spend, maxValues.spend)}%` }}
              />
            </div>
          </div>

          {/* 리드 */}
          <div className="flex items-center gap-3">
            <span className="w-16 text-sm text-gray-500">리드</span>
            <span className="w-20 text-sm font-bold text-gray-900 text-right">{ad.metrics.leads}</span>
            <div className="flex-1 h-6 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-teal-500 to-cyan-500 transition-all duration-300"
                style={{ width: `${getPercent(ad.metrics.leads, maxValues.leads)}%` }}
              />
            </div>
          </div>

          {/* CPL */}
          <div className="flex items-center gap-3">
            <span className="w-16 text-sm text-gray-500">CPL</span>
            <span className={`w-20 text-sm font-bold text-right ${cplColor.text}`}>${ad.metrics.cpl.toFixed(0)}</span>
            <div className="flex-1 h-6 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full bg-gradient-to-r ${cplColor.bar} transition-all duration-300`}
                style={{ width: `${getPercent(ad.metrics.cpl, maxValues.cpl)}%` }}
              />
            </div>
          </div>

          {/* 영상조회 */}
          <div className="flex items-center gap-3">
            <span className="w-16 text-sm text-gray-500">영상조회</span>
            <span className="w-20 text-sm font-bold text-gray-900 text-right">{(ad.metrics.video_views || 0).toLocaleString()}</span>
            <div className="flex-1 h-6 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-teal-500 to-cyan-500 transition-all duration-300"
                style={{ width: `${getPercent(ad.metrics.video_views || 0, maxValues.video_views)}%` }}
              />
            </div>
          </div>

          {/* 평균시청 */}
          <div className="flex items-center gap-3">
            <span className="w-16 text-sm text-gray-500">평균시청</span>
            <span className="w-20 text-sm font-bold text-gray-900 text-right">{(ad.metrics.avg_watch_time || 0).toFixed(1)}s</span>
            <div className="flex-1 h-6 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-teal-500 to-cyan-500 transition-all duration-300"
                style={{ width: `${getPercent(ad.metrics.avg_watch_time || 0, maxValues.avg_watch_time)}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* 모바일 레이아웃 */}
      <div className="md:hidden p-4">
        {/* 상단: 체크박스 + 썸네일 + 광고명 + 토글 */}
        <div className="flex items-center gap-3 mb-3">
          <input type="checkbox" checked={selected} onChange={onSelect} className="w-4 h-4 rounded border-gray-300" />
          <div className="w-12 h-12 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
            {ad.thumbnail_url ? (
              <img src={ad.thumbnail_url} alt={ad.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">-</div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-gray-900 text-sm truncate">{ad.name}</div>
          </div>
          <ToggleSwitch enabled={ad.effective_status === 'ACTIVE'} onChange={onToggle} loading={loading} />
        </div>

        {/* 하단: 지표들 세로 배치 */}
        <div className="space-y-1.5 pl-7">
          {/* 지출 */}
          <div className="flex items-center gap-2">
            <span className="w-14 text-xs text-gray-500">지출</span>
            <span className="w-16 text-xs font-bold text-gray-900 text-right">${ad.metrics.spend.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
            <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-teal-500 to-cyan-500"
                style={{ width: `${getPercent(ad.metrics.spend, maxValues.spend)}%` }}
              />
            </div>
          </div>

          {/* 리드 */}
          <div className="flex items-center gap-2">
            <span className="w-14 text-xs text-gray-500">리드</span>
            <span className="w-16 text-xs font-bold text-gray-900 text-right">{ad.metrics.leads}</span>
            <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-teal-500 to-cyan-500"
                style={{ width: `${getPercent(ad.metrics.leads, maxValues.leads)}%` }}
              />
            </div>
          </div>

          {/* CPL */}
          <div className="flex items-center gap-2">
            <span className="w-14 text-xs text-gray-500">CPL</span>
            <span className={`w-16 text-xs font-bold text-right ${cplColor.text}`}>${ad.metrics.cpl.toFixed(0)}</span>
            <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full bg-gradient-to-r ${cplColor.bar}`}
                style={{ width: `${getPercent(ad.metrics.cpl, maxValues.cpl)}%` }}
              />
            </div>
          </div>

          {/* 영상조회 */}
          <div className="flex items-center gap-2">
            <span className="w-14 text-xs text-gray-500">영상조회</span>
            <span className="w-16 text-xs font-bold text-gray-900 text-right">{(ad.metrics.video_views || 0).toLocaleString()}</span>
            <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-teal-500 to-cyan-500"
                style={{ width: `${getPercent(ad.metrics.video_views || 0, maxValues.video_views)}%` }}
              />
            </div>
          </div>

          {/* 평균시청 */}
          <div className="flex items-center gap-2">
            <span className="w-14 text-xs text-gray-500">평균시청</span>
            <span className="w-16 text-xs font-bold text-gray-900 text-right">{(ad.metrics.avg_watch_time || 0).toFixed(1)}s</span>
            <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-teal-500 to-cyan-500"
                style={{ width: `${getPercent(ad.metrics.avg_watch_time || 0, maxValues.avg_watch_time)}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// 비활성 광고 목록 아이템 컴포넌트
// 미니 게이지바 (비활성 광고용)
function MiniGauge({
  value,
  maxValue,
  colorType = 'default'
}: {
  value: number;
  maxValue: number;
  colorType?: 'default' | 'cpl';
}) {
  const percentage = maxValue > 0 ? Math.min(Math.max((value / maxValue) * 100, value > 0 ? 5 : 0), 100) : 0;

  const getGradient = () => {
    if (colorType === 'cpl') {
      if (value === 0) return 'from-gray-200 to-gray-300';
      if (value <= 20) return 'from-emerald-400 to-teal-500';
      if (value <= 35) return 'from-yellow-400 to-amber-500';
      return 'from-orange-400 to-red-500';
    }
    if (value === 0) return 'from-gray-200 to-gray-300';
    return 'from-emerald-400 via-teal-500 to-cyan-500';
  };

  return (
    <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full bg-gradient-to-r ${getGradient()} transition-all duration-300`}
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
}

function InactiveAdItem({
  ad,
  selected,
  onSelect,
  onToggle,
  loading,
  isControllable,
  maxValues
}: {
  ad: Ad;
  selected: boolean;
  onSelect: () => void;
  onToggle: () => void;
  loading: boolean;
  isControllable: boolean;
  maxValues: { spend: number; leads: number; cpl: number; video_views: number; avg_watch_time: number };
}) {
  return (
    <div className="bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors overflow-hidden">
      {/* PC 레이아웃 - 가로 배치 (활성 광고보다 작게) */}
      <div className="hidden md:flex items-center gap-3 p-3">
        {/* 체크박스 */}
        {isControllable ? (
          <input
            type="checkbox"
            checked={selected}
            onChange={onSelect}
            className="w-4 h-4 rounded border-gray-300 flex-shrink-0 cursor-pointer"
          />
        ) : (
          <span className="w-4 h-4 flex-shrink-0" />
        )}

        {/* 썸네일 - 1:1 비율, 작게 */}
        <div className="flex-shrink-0 w-12 h-12 bg-gray-200 rounded-lg overflow-hidden">
          {ad.thumbnail_url ? (
            <img src={ad.thumbnail_url} alt={ad.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">-</div>
          )}
        </div>

        {/* 광고명 + 캠페인 + 상태 */}
        <div className="flex-shrink-0 w-40 min-w-0">
          <div className="font-medium text-gray-700 truncate text-sm" title={ad.name}>{ad.name}</div>
          <div className="flex items-center gap-1 mt-0.5">
            <StatusBadge status={ad.effective_status} />
          </div>
        </div>

        {/* 성과 지표들 - 작은 사이즈 */}
        <div className="flex items-center gap-4 flex-1 text-xs">
          {/* 지출 */}
          <div className="flex flex-col items-center min-w-[60px]">
            <span className="text-gray-500 mb-0.5">지출</span>
            <span className="font-semibold text-gray-700">${ad.metrics.spend.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
            <MiniGauge value={ad.metrics.spend} maxValue={maxValues.spend} />
          </div>

          {/* 리드 */}
          <div className="flex flex-col items-center min-w-[50px]">
            <span className="text-gray-500 mb-0.5">리드</span>
            <span className="font-semibold text-gray-700">{ad.metrics.leads}</span>
            <MiniGauge value={ad.metrics.leads} maxValue={maxValues.leads} />
          </div>

          {/* CPL */}
          <div className="flex flex-col items-center min-w-[50px]">
            <span className="text-gray-500 mb-0.5">CPL</span>
            <span className={`font-semibold ${ad.metrics.cpl > 30 ? 'text-red-600' : ad.metrics.cpl > 20 ? 'text-amber-600' : ad.metrics.cpl > 0 ? 'text-emerald-600' : 'text-gray-400'}`}>
              ${ad.metrics.cpl.toFixed(0)}
            </span>
            <MiniGauge value={ad.metrics.cpl} maxValue={maxValues.cpl} colorType="cpl" />
          </div>

          {/* 영상조회 */}
          <div className="flex flex-col items-center min-w-[60px]">
            <span className="text-gray-500 mb-0.5">영상조회</span>
            <span className="font-semibold text-gray-700">{(ad.metrics.video_views || 0).toLocaleString()}</span>
            <MiniGauge value={ad.metrics.video_views || 0} maxValue={maxValues.video_views} />
          </div>

          {/* 평균시청 */}
          <div className="flex flex-col items-center min-w-[50px]">
            <span className="text-gray-500 mb-0.5">평균시청</span>
            <span className="font-semibold text-gray-700">{(ad.metrics.avg_watch_time || 0).toFixed(1)}s</span>
            <MiniGauge value={ad.metrics.avg_watch_time || 0} maxValue={maxValues.avg_watch_time} />
          </div>
        </div>

        {/* 토글 */}
        <div className="flex-shrink-0">
          {isControllable ? (
            <ToggleSwitch enabled={ad.effective_status === 'ACTIVE'} onChange={onToggle} loading={loading} />
          ) : (
            <span className="w-11 h-6" />
          )}
        </div>
      </div>

      {/* 모바일 레이아웃 */}
      <div className="md:hidden p-3">
        <div className="flex items-start gap-3">
          {/* 체크박스 + 썸네일 */}
          <div className="flex flex-col items-center gap-1">
            {isControllable ? (
              <input type="checkbox" checked={selected} onChange={onSelect} className="w-4 h-4 rounded border-gray-300" />
            ) : (
              <span className="w-4 h-4" />
            )}
            <div className="w-12 h-12 bg-gray-200 rounded-lg overflow-hidden flex-shrink-0">
              {ad.thumbnail_url ? (
                <img src={ad.thumbnail_url} alt={ad.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">-</div>
              )}
            </div>
          </div>

          {/* 광고 정보 */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 mb-1">
              <div className="font-medium text-gray-700 text-sm truncate">{ad.name}</div>
              {isControllable ? (
                <ToggleSwitch enabled={ad.effective_status === 'ACTIVE'} onChange={onToggle} loading={loading} />
              ) : (
                <StatusBadge status={ad.effective_status} />
              )}
            </div>

            {/* 주요 지표 */}
            <div className="grid grid-cols-3 gap-1 text-xs">
              <div className="text-center bg-gray-100 rounded py-1">
                <div className="text-gray-500 text-[10px]">지출</div>
                <div className="font-semibold text-gray-700">${ad.metrics.spend.toLocaleString('en-US', { maximumFractionDigits: 0 })}</div>
              </div>
              <div className="text-center bg-gray-100 rounded py-1">
                <div className="text-gray-500 text-[10px]">리드</div>
                <div className="font-semibold text-gray-700">{ad.metrics.leads}</div>
              </div>
              <div className="text-center bg-gray-100 rounded py-1">
                <div className="text-gray-500 text-[10px]">CPL</div>
                <div className={`font-semibold ${ad.metrics.cpl > 30 ? 'text-red-600' : ad.metrics.cpl > 20 ? 'text-amber-600' : ad.metrics.cpl > 0 ? 'text-emerald-600' : 'text-gray-400'}`}>
                  ${ad.metrics.cpl.toFixed(0)}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AdManagementTab({ clientId }: AdManagementTabProps) {
  const [ads, setAds] = useState<Ad[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [selectedAds, setSelectedAds] = useState<Set<string>>(new Set());
  const [updatingAds, setUpdatingAds] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [inactiveExpanded, setInactiveExpanded] = useState(false);
  const [dataSource, setDataSource] = useState<'cache' | 'meta_api' | 'raw_data_only' | 'stale_cache' | null>(null);
  const [rateLimitInfo, setRateLimitInfo] = useState<{ limited: boolean; remainingMinutes?: number } | null>(null);

  // 로드 진행 중 여부 (중복 호출 방지)
  const [isLoadingRef] = useState(() => ({ current: false }));

  // 광고 목록 로드
  const loadAds = useCallback(async (forceRefresh = false) => {
    // 이미 로딩 중이면 스킵 (중복 호출 방지)
    if (isLoadingRef.current || !clientId) return;
    isLoadingRef.current = true;

    setLoading(true);
    setError(null);

    try {
      const refreshParam = forceRefresh ? '&refresh=true' : '';
      const response = await fetch(`/api/ads?client_id=${clientId}&sort=${sortBy}&order=${sortOrder}${refreshParam}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load ads');
      }

      setAds(data.ads || []);
      setDataSource(data.data_source || null);
      setRateLimitInfo(data.rate_limited ? { limited: true, remainingMinutes: data.rate_limit_remaining_minutes } : null);

      // 토스트 메시지
      if (data.rate_limited && forceRefresh) {
        setToast({ type: 'error', message: `Rate Limit 쿨다운 중. ${data.rate_limit_remaining_minutes || 30}분 후 동기화 가능합니다.` });
      } else if (forceRefresh && data.data_source === 'meta_api') {
        setToast({ type: 'success', message: 'Meta API에서 최신 데이터를 가져왔습니다.' });
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load ads');
    } finally {
      setLoading(false);
      isLoadingRef.current = false;
    }
  }, [clientId, sortBy, sortOrder, isLoadingRef]);

  // 최초 로드: clientId 변경 시만
  useEffect(() => {
    loadAds(false);
  }, [clientId]); // loadAds를 의존성에서 제외하여 정렬 변경 시 자동 재호출 방지

  // 광고 상태 변경
  const updateAdStatus = async (adIds: string[], newStatus: 'ACTIVE' | 'PAUSED') => {
    setUpdatingAds(prev => {
      const next = new Set(prev);
      adIds.forEach(id => next.add(id));
      return next;
    });

    try {
      const response = await fetch('/api/ads/status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-client-id': clientId
        },
        body: JSON.stringify({
          ad_ids: adIds,
          status: newStatus
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update status');
      }

      // 성공한 광고들의 상태 업데이트
      setAds(prev => prev.map(ad => {
        if (data.results.success.includes(ad.id)) {
          return {
            ...ad,
            status: newStatus,
            effective_status: newStatus
          };
        }
        return ad;
      }));

      // 선택 해제
      setSelectedAds(new Set());

      // 토스트 메시지
      if (data.results.failed.length > 0) {
        setToast({
          type: 'error',
          message: `${data.results.success.length}개 성공, ${data.results.failed.length}개 실패`
        });
      } else {
        setToast({
          type: 'success',
          message: `${data.results.success.length}개 광고 ${newStatus === 'ACTIVE' ? '활성화' : '일시정지'} 완료`
        });
      }
    } catch (err: any) {
      setToast({
        type: 'error',
        message: err.message || 'Failed to update status'
      });
    } finally {
      setUpdatingAds(prev => {
        const next = new Set(prev);
        adIds.forEach(id => next.delete(id));
        return next;
      });
    }
  };

  // 토스트 자동 숨기기
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // 필터링된 광고 목록
  const filteredAds = ads.filter(ad => {
    // 검색어 필터
    if (searchTerm && !ad.name.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }
    // 상태 필터
    if (statusFilter !== 'all' && ad.effective_status !== statusFilter) {
      return false;
    }
    return true;
  });

  // 제어 가능한 상태인지 확인
  const isControllable = (status: string) => {
    return ['ACTIVE', 'PAUSED', 'WITH_ISSUES'].includes(status);
  };

  // 전체 선택/해제
  const toggleSelectAll = () => {
    const controllableAds = filteredAds.filter(ad => isControllable(ad.effective_status));
    if (selectedAds.size === controllableAds.length) {
      setSelectedAds(new Set());
    } else {
      setSelectedAds(new Set(controllableAds.map(ad => ad.id)));
    }
  };

  // 개별 선택
  const toggleSelectAd = (adId: string) => {
    const next = new Set(selectedAds);
    if (next.has(adId)) {
      next.delete(adId);
    } else {
      next.add(adId);
    }
    setSelectedAds(next);
  };

  // 로딩 상태
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-3" />
          <p className="text-gray-600">광고 목록 로딩 중...</p>
        </div>
      </div>
    );
  }

  // 에러 상태
  if (error) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
        <p className="text-red-600 font-medium">{error}</p>
        <button
          onClick={() => loadAds(false)}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          다시 시도
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 필터 바 */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          {/* 검색 */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="광고명 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm w-full sm:w-64 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* 상태 필터 */}
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="pl-10 pr-8 py-2 border border-gray-300 rounded-lg text-sm appearance-none bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">전체 상태</option>
              <option value="ACTIVE">활성</option>
              <option value="PAUSED">일시정지</option>
              <option value="PENDING_REVIEW">검토 중</option>
              <option value="DISAPPROVED">비승인</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>
        </div>

        {/* 새로고침 버튼들 + 데이터 소스 표시 */}
        <div className="flex items-center gap-2">
          {/* 데이터 소스 표시 */}
          {dataSource && (
            <span className={`flex items-center gap-1 px-2 py-1 rounded text-xs ${
              dataSource === 'cache' ? 'bg-green-100 text-green-700' :
              dataSource === 'meta_api' ? 'bg-blue-100 text-blue-700' :
              dataSource === 'stale_cache' ? 'bg-yellow-100 text-yellow-700' :
              'bg-gray-100 text-gray-600'
            }`}>
              {dataSource === 'stale_cache' ? <Clock className="w-3 h-3" /> : <Database className="w-3 h-3" />}
              {dataSource === 'cache' ? '캐시' :
               dataSource === 'meta_api' ? 'API' :
               dataSource === 'stale_cache' ? '이전 데이터' : 'DB만'}
            </span>
          )}

          {/* Rate Limit 경고 표시 */}
          {rateLimitInfo?.limited && (
            <span className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-red-100 text-red-700" title={`${rateLimitInfo.remainingMinutes}분 후 동기화 가능`}>
              <AlertCircle className="w-3 h-3" />
              {rateLimitInfo.remainingMinutes}분
            </span>
          )}

          {/* 일반 새로고침 */}
          <button
            onClick={() => loadAds(false)}
            className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            title="캐시에서 빠르게 로드"
          >
            <RefreshCw className="w-4 h-4" />
            <span className="text-sm hidden sm:inline">새로고침</span>
          </button>

{/* 동기화 버튼 제거됨 - 클라이언트가 Meta API를 남용할 수 있어 캐시 기반으로만 운영 */}
        </div>
      </div>

      {/* 일괄 작업 바 */}
      {selectedAds.size > 0 && (
        <div className="flex items-center gap-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
          <span className="text-sm text-blue-800 font-medium">
            {selectedAds.size}개 선택됨
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => updateAdStatus(Array.from(selectedAds), 'ACTIVE')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700"
            >
              <Power className="w-3.5 h-3.5" />
              일괄 켜기
            </button>
            <button
              onClick={() => updateAdStatus(Array.from(selectedAds), 'PAUSED')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-600 text-white rounded-lg text-sm hover:bg-yellow-700"
            >
              <PowerOff className="w-3.5 h-3.5" />
              일괄 끄기
            </button>
          </div>
        </div>
      )}

      {/* 활성 광고와 비활성 광고 분리 */}
      {(() => {
        const activeAds = filteredAds.filter(ad => ad.effective_status === 'ACTIVE');
        // 비활성 광고: 성과순 정렬 (지출 > 리드 > 영상조회 내림차순)
        const inactiveAds = filteredAds
          .filter(ad => ad.effective_status !== 'ACTIVE')
          .sort((a, b) => {
            // 1차: 지출 내림차순
            if (b.metrics.spend !== a.metrics.spend) {
              return b.metrics.spend - a.metrics.spend;
            }
            // 2차: 리드 내림차순
            if (b.metrics.leads !== a.metrics.leads) {
              return b.metrics.leads - a.metrics.leads;
            }
            // 3차: 영상조회 내림차순
            return (b.metrics.video_views || 0) - (a.metrics.video_views || 0);
          });

        // 캠페인별로 그루핑
        const groupByCampaign = (ads: Ad[]) => {
          const groups: Record<string, { campaign: Campaign | null; ads: Ad[] }> = {};

          ads.forEach(ad => {
            const campaignId = ad.campaign?.id || 'no-campaign';
            if (!groups[campaignId]) {
              groups[campaignId] = {
                campaign: ad.campaign,
                ads: []
              };
            }
            groups[campaignId].ads.push(ad);
          });

          // 캠페인명 기준 정렬
          return Object.values(groups).sort((a, b) => {
            const nameA = a.campaign?.name || '';
            const nameB = b.campaign?.name || '';
            return nameA.localeCompare(nameB);
          });
        };

        const activeGroups = groupByCampaign(activeAds);
        const inactiveGroups = groupByCampaign(inactiveAds);

        // 게이지바용 최대값 계산 (전체 광고 기준)
        const maxValues = {
          spend: Math.max(...ads.map(ad => ad.metrics.spend), 100),
          leads: Math.max(...ads.map(ad => ad.metrics.leads), 10),
          cpl: Math.max(...ads.map(ad => ad.metrics.cpl), 50),
          video_views: Math.max(...ads.map(ad => ad.metrics.video_views || 0), 1000),
          avg_watch_time: Math.max(...ads.map(ad => ad.metrics.avg_watch_time || 0), 10)
        };

        return (
          <div className="space-y-6">
            {/* 활성 예산 요약 테이블 */}
            <ActiveBudgetSummary ads={ads} />

            {/* 활성 광고 - 캠페인별 그루핑 카드 형태 */}
            {activeAds.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <Power className="w-5 h-5 text-green-600" />
                    활성 광고
                    <span className="text-sm font-normal text-gray-500">({activeAds.length})</span>
                  </h3>
                </div>

                {/* 캠페인별 섹션 */}
                <div className="space-y-6">
                  {activeGroups.map(group => (
                    <div key={group.campaign?.id || 'no-campaign'}>
                      {/* 캠페인 헤더 */}
                      <div className="flex items-center flex-wrap gap-2 mb-3 pb-2 border-b border-gray-200">
                        <span className="font-medium text-gray-700">
                          {group.campaign?.name || '캠페인 없음'}
                        </span>
                        <ObjectiveBadge objective={group.campaign?.objective} />
                        <BudgetDisplay campaign={group.campaign} />
                        <span className="text-xs text-gray-400">({group.ads.length})</span>
                      </div>

                      {/* 광고 세로 리스트 */}
                      <div className="space-y-3">
                        {group.ads.map(ad => (
                          <ActiveAdRow
                            key={ad.id}
                            ad={ad}
                            selected={selectedAds.has(ad.id)}
                            onSelect={() => toggleSelectAd(ad.id)}
                            onToggle={() => updateAdStatus([ad.id], 'PAUSED')}
                            loading={updatingAds.has(ad.id)}
                            maxValues={maxValues}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 비활성 광고 - 성과순 정렬 목록 */}
            {inactiveAds.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                {/* 헤더 - 클릭하면 펼침/접힘 */}
                <button
                  onClick={() => setInactiveExpanded(!inactiveExpanded)}
                  className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <PowerOff className="w-5 h-5 text-gray-400" />
                    <span className="font-semibold text-gray-700">비활성 광고</span>
                    <span className="text-sm text-gray-500">({inactiveAds.length})</span>
                    <span className="text-xs text-gray-400 ml-2">성과순 정렬</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {!inactiveExpanded && (
                      <span className="text-xs text-gray-500">클릭하여 펼치기</span>
                    )}
                    {inactiveExpanded ? (
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronRight className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                </button>

                {/* 펼쳐진 목록 - 카드 형태 */}
                {inactiveExpanded && (
                  <div className="p-4 space-y-2">
                    {inactiveAds.map(ad => (
                      <InactiveAdItem
                        key={ad.id}
                        ad={ad}
                        selected={selectedAds.has(ad.id)}
                        onSelect={() => toggleSelectAd(ad.id)}
                        onToggle={() => updateAdStatus([ad.id], ad.effective_status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE')}
                        loading={updatingAds.has(ad.id)}
                        isControllable={isControllable(ad.effective_status)}
                        maxValues={maxValues}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 광고가 없는 경우 */}
            {filteredAds.length === 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
                <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">표시할 광고가 없습니다.</p>
              </div>
            )}
          </div>
        );
      })()}

      {/* 토스트 메시지 */}
      {toast && (
        <div className={`fixed bottom-4 right-4 px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 z-50 ${
          toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
        }`}>
          {toast.type === 'success' ? (
            <CheckCircle className="w-5 h-5" />
          ) : (
            <XCircle className="w-5 h-5" />
          )}
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
}
