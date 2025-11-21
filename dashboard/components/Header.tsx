import Link from 'next/link';
import { BarChart3, Settings } from 'lucide-react';

export function Header() {
  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <BarChart3 className="w-8 h-8 text-[var(--primary)]" />
            <div>
              <h1 className="text-xl font-bold text-gray-900">
                BAS Meta Ads Dashboard
              </h1>
              <p className="text-sm text-gray-500">
                메타 광고 성과 분석
              </p>
            </div>
          </Link>

          <div className="flex items-center gap-4">
            <Link
              href="/settings"
              className="inline-flex items-center gap-2 px-4 py-2 text-gray-700 hover:text-blue-600 hover:bg-gray-50 rounded-lg transition-colors"
              aria-label="설정"
            >
              <Settings className="w-5 h-5" />
              <span className="text-sm font-medium">설정</span>
            </Link>

            <div className="text-sm text-gray-600">
              최종 업데이트: {new Date().toLocaleDateString('ko-KR')}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
