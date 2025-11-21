'use client'

import { Header } from '@/components/Header'
import { TelegramSettings } from '@/components/TelegramSettings'
import { Settings as SettingsIcon } from 'lucide-react'

export default function SettingsPage() {
  const handleSaveSettings = async (config: any) => {
    try {
      const response = await fetch('/api/settings/telegram', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(config),
      })

      if (!response.ok) {
        throw new Error('설정 저장에 실패했습니다.')
      }

      console.log('텔레그램 설정이 저장되었습니다:', config)
    } catch (error) {
      console.error('설정 저장 오류:', error)
    }
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      <Header />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-8">
          <div className="flex items-center gap-3">
            <SettingsIcon className="w-8 h-8 text-neutral-700" />
            <h1 className="text-3xl font-bold text-neutral-900">설정</h1>
          </div>

          <TelegramSettings onSave={handleSaveSettings} />

          {/* 추가 설정 섹션 */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-neutral-800 mb-4">대시보드 설정</h3>
            <p className="text-sm text-neutral-600">
              추가 설정 옵션은 향후 업데이트에서 제공됩니다.
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}
