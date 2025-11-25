'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { BarChart3, Settings, FileText } from 'lucide-react';

interface HeaderProps {
  clientName?: string | null;
  isAdmin?: boolean;
}

export function Header({ clientName, isAdmin }: HeaderProps) {
  const searchParams = useSearchParams();

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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href={`/${queryString}`} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <BarChart3 className="w-8 h-8 text-[var(--primary)]" />
            <div>
              <h1 className="text-xl font-bold text-gray-900">
                {clientName ? `${clientName}` : 'Meta Ads Dashboard'}
              </h1>
              <p className="text-sm text-gray-500">
                {isAdmin ? '관리자 모드' : '메타 광고 성과 분석'}
              </p>
            </div>
          </Link>

          <div className="flex items-center gap-4">
            <Link
              href={`/reports${queryString}`}
              className="inline-flex items-center gap-2 px-4 py-2 text-gray-700 hover:text-blue-600 hover:bg-gray-50 rounded-lg transition-colors"
              aria-label="리포트"
            >
              <FileText className="w-5 h-5" />
              <span className="text-sm font-medium">리포트</span>
            </Link>

            <Link
              href={`/settings${queryString}`}
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
