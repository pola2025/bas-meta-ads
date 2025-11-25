'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { BarChart3, Settings, FileText, Menu } from 'lucide-react';
import { useState } from 'react';

interface HeaderProps {
  clientName?: string | null;
  isAdmin?: boolean;
}

export function Header({ clientName, isAdmin }: HeaderProps) {
  const searchParams = useSearchParams();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // URL 파라미터 유지를 위한 쿼리 문자열 생성
  const getQueryString = () => {
    const admin = searchParams.get('admin');
    const client = searchParams.get('client');
    if (admin) return `?admin=${admin}`;
    if (client) return `?client=${client}`;
    return '';
  };

  const queryString = getQueryString();

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 sm:h-16">
          {/* 로고 & 타이틀 */}
          <Link href={`/${queryString}`} className="flex items-center gap-2 sm:gap-3 hover:opacity-80 transition-opacity min-w-0 flex-1">
            <BarChart3 className="w-6 h-6 sm:w-8 sm:h-8 text-[var(--primary)] flex-shrink-0" />
            <div className="min-w-0">
              <h1 className="text-sm sm:text-xl font-bold text-gray-900 truncate">
                {clientName ? `${clientName}` : 'Meta Ads'}
              </h1>
              <p className="text-xs sm:text-sm text-gray-500 hidden sm:block">
                {isAdmin ? '관리자 모드' : '메타 광고 성과 분석'}
              </p>
            </div>
          </Link>

          {/* 데스크톱 네비게이션 */}
          <div className="hidden sm:flex items-center gap-2 sm:gap-4">
            <Link
              href={`/reports${queryString}`}
              className="inline-flex items-center gap-2 px-3 py-2 text-gray-700 hover:text-blue-600 hover:bg-gray-50 rounded-lg transition-colors"
              aria-label="리포트"
            >
              <FileText className="w-5 h-5" />
              <span className="text-sm font-medium">리포트</span>
            </Link>

            {isAdmin && (
              <Link
                href={`/settings${queryString}`}
                className="inline-flex items-center gap-2 px-3 py-2 text-gray-700 hover:text-blue-600 hover:bg-gray-50 rounded-lg transition-colors"
                aria-label="설정"
              >
                <Settings className="w-5 h-5" />
                <span className="text-sm font-medium">설정</span>
              </Link>
            )}

            <div className="text-xs sm:text-sm text-gray-500 hidden lg:block">
              {new Date().toLocaleDateString('ko-KR')}
            </div>
          </div>

          {/* 모바일 메뉴 버튼 */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="sm:hidden p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>

        {/* 모바일 드롭다운 메뉴 */}
        {mobileMenuOpen && (
          <div className="sm:hidden py-2 border-t border-gray-100">
            <div className="flex flex-col gap-1">
              <Link
                href={`/reports${queryString}`}
                className="flex items-center gap-2 px-3 py-2 text-gray-700 hover:bg-gray-50 rounded-lg"
                onClick={() => setMobileMenuOpen(false)}
              >
                <FileText className="w-4 h-4" />
                <span className="text-sm">리포트</span>
              </Link>
              {isAdmin && (
                <Link
                  href={`/settings${queryString}`}
                  className="flex items-center gap-2 px-3 py-2 text-gray-700 hover:bg-gray-50 rounded-lg"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <Settings className="w-4 h-4" />
                  <span className="text-sm">설정</span>
                </Link>
              )}
              <div className="px-3 py-2 text-xs text-gray-400">
                업데이트: {new Date().toLocaleDateString('ko-KR')}
              </div>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
