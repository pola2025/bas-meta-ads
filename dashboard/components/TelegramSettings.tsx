'use client'

import { useState, useEffect } from 'react'
import { Bell, Check, X } from 'lucide-react'

interface TelegramSettingsProps {
  onSave?: (settings: TelegramConfig) => void
}

interface TelegramConfig {
  enabled: boolean
  reportTime: string
  reportDays: string[]
}

const DAYS_OF_WEEK = [
  { value: 'MON', label: '월' },
  { value: 'TUE', label: '화' },
  { value: 'WED', label: '수' },
  { value: 'THU', label: '목' },
  { value: 'FRI', label: '금' },
  { value: 'SAT', label: '토' },
  { value: 'SUN', label: '일' }
]

export function TelegramSettings({ onSave }: TelegramSettingsProps) {
  const [config, setConfig] = useState<TelegramConfig>({
    enabled: false,
    reportTime: '09:00',
    reportDays: ['MON']
  })
  const [saved, setSaved] = useState(false)

  const handleSave = () => {
    onSave?.(config)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const toggleDay = (day: string) => {
    setConfig(prev => ({
      ...prev,
      reportDays: prev.reportDays.includes(day)
        ? prev.reportDays.filter(d => d !== day)
        : [...prev.reportDays, day]
    }))
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <div className="flex items-center gap-2 mb-6">
        <Bell className="w-5 h-5 text-blue-600" />
        <h3 className="text-lg font-semibold text-gray-800">텔레그램 알림 설정</h3>
      </div>

      <div className="space-y-6">
        {/* 알림 활성화 */}
        <div className="flex items-center justify-between">
          <label htmlFor="telegram-enabled" className="text-sm font-medium text-gray-700">
            텔레그램 알림 사용
          </label>
          <button
            id="telegram-enabled"
            onClick={() => setConfig(prev => ({ ...prev, enabled: !prev.enabled }))}
            className={`
              relative inline-flex h-6 w-11 items-center rounded-full transition-colors
              ${config.enabled ? 'bg-blue-600' : 'bg-gray-300'}
            `}
            role="switch"
            aria-checked={config.enabled}
          >
            <span
              className={`
                inline-block h-4 w-4 transform rounded-full bg-white transition-transform
                ${config.enabled ? 'translate-x-6' : 'translate-x-1'}
              `}
            />
          </button>
        </div>

        {config.enabled && (
          <>
            {/* 리포트 시간 */}
            <div>
              <label htmlFor="report-time" className="block text-sm font-medium text-gray-700 mb-2">
                리포트 전송 시간
              </label>
              <input
                type="time"
                id="report-time"
                value={config.reportTime}
                onChange={(e) => setConfig(prev => ({ ...prev, reportTime: e.target.value }))}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* 리포트 요일 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                리포트 전송 요일
              </label>
              <div className="flex gap-2">
                {DAYS_OF_WEEK.map(day => (
                  <button
                    key={day.value}
                    onClick={() => toggleDay(day.value)}
                    className={`
                      w-10 h-10 rounded-full font-medium transition-all
                      ${config.reportDays.includes(day.value)
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }
                    `}
                    aria-pressed={config.reportDays.includes(day.value)}
                  >
                    {day.label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-2">
                선택한 요일마다 {config.reportTime}에 리포트가 전송됩니다
              </p>
            </div>

            {/* 저장 버튼 */}
            <div className="pt-4 border-t border-gray-200">
              <button
                onClick={handleSave}
                className={`
                  inline-flex items-center gap-2 px-6 py-2 rounded-lg font-medium transition-all
                  ${saved
                    ? 'bg-green-600 text-white'
                    : 'bg-blue-600 text-white hover:bg-blue-700 shadow-md hover:shadow-lg'
                  }
                `}
              >
                {saved ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>저장됨</span>
                  </>
                ) : (
                  <span>설정 저장</span>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
