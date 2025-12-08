'use client';

import React from 'react';

interface SummaryItem {
  emoji: string;
  title: string;
  content: string;
}

interface ExecutiveSummaryProps {
  highlights: SummaryItem; // 핵심 성과 (초록)
  warnings: SummaryItem;   // 주의 필요 (주황)
  actions: SummaryItem;    // 권장 액션 (파랑)
  summaryText?: string;    // 요약 텍스트 (insight-box)
}

export function ExecutiveSummary({
  highlights,
  warnings,
  actions,
  summaryText
}: ExecutiveSummaryProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center gap-2 text-lg font-bold text-gray-800 mb-4">
        <span>📊</span>
        <span>핵심 성과 요약</span>
      </div>

      {/* Insight Box - 요약 텍스트 */}
      {summaryText && (
        <div className="rounded-lg p-5 mb-4 border-l-4 border-blue-500"
          style={{
            background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.05) 0%, rgba(16, 185, 129, 0.05) 100%)'
          }}
        >
          <p className="text-gray-700 leading-relaxed" dangerouslySetInnerHTML={{ __html: summaryText }} />
        </div>
      )}

      {/* 3박스 그리드 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* 핵심 성과 - 초록 배경 */}
        <div className="flex items-start gap-3 p-4 bg-green-50 rounded-lg border border-green-100">
          <span className="text-2xl">{highlights.emoji}</span>
          <div>
            <div className="text-sm font-medium text-gray-600">{highlights.title}</div>
            <div className="text-gray-900 font-semibold">{highlights.content}</div>
          </div>
        </div>

        {/* 주의 필요 - 주황 배경 */}
        <div className="flex items-start gap-3 p-4 bg-amber-50 rounded-lg border border-amber-100">
          <span className="text-2xl">{warnings.emoji}</span>
          <div>
            <div className="text-sm font-medium text-gray-600">{warnings.title}</div>
            <div className="text-gray-900 font-semibold">{warnings.content}</div>
          </div>
        </div>

        {/* 권장 액션 - 파랑 배경 */}
        <div className="flex items-start gap-3 p-4 bg-blue-50 rounded-lg border border-blue-100">
          <span className="text-2xl">{actions.emoji}</span>
          <div>
            <div className="text-sm font-medium text-gray-600">{actions.title}</div>
            <div className="text-gray-900 font-semibold">{actions.content}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
