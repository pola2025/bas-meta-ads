'use client';

import React from 'react';

interface InsightItem {
  icon: string;
  text: string;
  type?: 'success' | 'warning' | 'info';
}

interface ActionItem {
  title: string;
  description?: string;
}

interface AIInsightBoxProps {
  summaryItems: InsightItem[];
  actionItems: ActionItem[];
  modelName?: string;
}

export function AIInsightBox({
  summaryItems,
  actionItems,
  modelName = 'Gemini 3 Pro Preview'
}: AIInsightBoxProps) {
  const getIconColor = (type?: string) => {
    switch (type) {
      case 'success': return 'text-green-500';
      case 'warning': return 'text-amber-500';
      default: return 'text-green-500';
    }
  };

  const getIcon = (type?: string) => {
    switch (type) {
      case 'success': return '✓';
      case 'warning': return '!';
      default: return '✓';
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center gap-2 text-lg font-bold text-gray-800 mb-4">
        <span>🤖</span>
        <span>AI 분석 인사이트</span>
        <span className="text-xs font-normal text-gray-400 ml-2">Powered by {modelName}</span>
      </div>

      {/* AI Box - 보라색 그라디언트 */}
      <div
        className="rounded-xl p-5 space-y-4 border"
        style={{
          background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.05) 0%, rgba(236, 72, 153, 0.05) 100%)',
          borderColor: 'rgba(139, 92, 246, 0.2)'
        }}
      >
        {/* 성과 요약 */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">🔍</span>
            <span className="font-semibold text-gray-800">이번 주 성과 요약</span>
          </div>
          <ul className="space-y-2 pl-7 text-sm text-gray-700">
            {summaryItems.map((item, index) => (
              <li key={index} className="flex items-start gap-2">
                <span className={`${getIconColor(item.type)} mt-0.5`}>{getIcon(item.type)}</span>
                <span dangerouslySetInnerHTML={{ __html: item.text }} />
              </li>
            ))}
          </ul>
        </div>

        {/* 추천 액션 */}
        {actionItems.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">💡</span>
              <span className="font-semibold text-gray-800">추천 액션</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pl-7">
              {actionItems.map((action, index) => (
                <div
                  key={index}
                  className="p-3 bg-white/60 rounded-lg border border-purple-100"
                >
                  <div className="text-sm font-medium text-gray-800">
                    {index + 1}. {action.title}
                  </div>
                  {action.description && (
                    <div className="text-xs text-gray-500 mt-1">{action.description}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
