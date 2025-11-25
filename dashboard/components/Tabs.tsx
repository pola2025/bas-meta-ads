'use client'

import { ReactNode } from 'react'

interface Tab {
  id: string
  label: string
  icon?: string
  content: ReactNode
}

interface TabsProps {
  tabs: Tab[]
  activeTab: string
  onChange: (tabId: string) => void
}

// 탭 아이콘 매핑
const tabIcons: Record<string, string> = {
  'overview': '📊',
  'period-data': '📅',
  'ads-detail': '📋'
}

export function Tabs({ tabs, activeTab, onChange }: TabsProps) {
  return (
    <div className="w-full">
      {/* 모바일: 블록형 버튼 그리드 */}
      <div className="block md:hidden">
        <div className="grid grid-cols-3 gap-1.5 p-1.5 bg-gray-100 rounded-xl">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onChange(tab.id)}
              className={`
                py-2.5 px-2 rounded-lg font-medium text-xs transition-all text-center
                ${
                  activeTab === tab.id
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }
              `}
              aria-current={activeTab === tab.id ? 'page' : undefined}
            >
              <span className="block text-base mb-0.5">{tabIcons[tab.id] || '📌'}</span>
              <span className="block truncate">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* PC: 언더라인 스타일 */}
      <div className="hidden md:block border-b border-gray-200">
        <nav className="flex gap-8" aria-label="Tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onChange(tab.id)}
              className={`
                py-4 px-1 border-b-2 font-medium text-sm transition-colors
                ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                }
              `}
              aria-current={activeTab === tab.id ? 'page' : undefined}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="mt-4 md:mt-6">
        {tabs.find((tab) => tab.id === activeTab)?.content}
      </div>
    </div>
  )
}
