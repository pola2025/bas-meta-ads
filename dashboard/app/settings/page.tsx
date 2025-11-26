'use client'

import { Header } from '@/components/Header'
import { TelegramSettings } from '@/components/TelegramSettings'
import { Settings as SettingsIcon, Users, ExternalLink } from 'lucide-react'
import { useSearchParams } from 'next/navigation'

export default function SettingsPage() {
  const searchParams = useSearchParams()
  const adminKey = process.env.NEXT_PUBLIC_ADMIN_KEY

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

          {/* 관리자 전용: 클라이언트 관리 */}
          {adminKey && (
            <div className="bg-white p-6 rounded-lg shadow">
              <div className="flex items-center gap-3 mb-4">
                <Users className="w-6 h-6 text-blue-600" />
                <h3 className="text-lg font-semibold text-neutral-800">클라이언트 관리</h3>
              </div>
              <p className="text-sm text-neutral-600 mb-4">
                클라이언트 추가, 수정, 삭제 및 서비스 기간을 관리합니다.
              </p>
              <a
                href={`/admin?admin=${adminKey}`}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <span>클라이언트 관리</span>
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
