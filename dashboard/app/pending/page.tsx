'use client';

/**
 * 승인 대기 페이지 - OAuth 등록 후 표시
 *
 * 관리자 승인을 기다리는 동안 표시되는 페이지입니다.
 */

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

interface ClientStatus {
  id: string;
  name: string;
  status: string;
  auth_type: string;
  message: string;
}

export default function PendingPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const clientId = searchParams.get('clientId');

  const [clientStatus, setClientStatus] = useState<ClientStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [checkCount, setCheckCount] = useState(0);

  // 상태 확인 함수
  const checkStatus = async () => {
    if (!clientId) return;

    try {
      const response = await fetch(`/api/auth/status?clientId=${clientId}`);
      const data = await response.json();

      if (data.success && data.client) {
        setClientStatus(data.client);

        // 승인되면 대시보드로 이동
        if (data.client.status === 'active') {
          router.push(`/?clientId=${clientId}`);
        }
      }
    } catch (error) {
      console.error('Status check error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // 초기 로드 및 주기적 확인
  useEffect(() => {
    checkStatus();

    // 30초마다 상태 확인
    const interval = setInterval(() => {
      checkStatus();
      setCheckCount((prev) => prev + 1);
    }, 30000);

    return () => clearInterval(interval);
  }, [clientId]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-yellow-50 to-orange-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-50 to-orange-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
        {/* 대기 아이콘 */}
        <div className="inline-flex items-center justify-center w-20 h-20 bg-yellow-100 rounded-full mb-6">
          <svg
            className="w-10 h-10 text-yellow-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>

        {/* 타이틀 */}
        <h1 className="text-2xl font-bold text-gray-900 mb-2">승인 대기 중</h1>
        <p className="text-gray-500 mb-6">
          등록이 완료되었습니다. 관리자 승인 후 서비스를 이용하실 수 있습니다.
        </p>

        {/* 클라이언트 정보 */}
        {clientStatus && (
          <div className="bg-gray-50 rounded-lg p-4 mb-6 text-left">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-500 text-sm">클라이언트</span>
                <span className="font-medium text-gray-900">{clientStatus.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 text-sm">상태</span>
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    clientStatus.status === 'pending'
                      ? 'bg-yellow-100 text-yellow-800'
                      : clientStatus.status === 'active'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-red-100 text-red-800'
                  }`}
                >
                  {clientStatus.status === 'pending'
                    ? '승인 대기'
                    : clientStatus.status === 'active'
                    ? '활성'
                    : clientStatus.status}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* 안내 사항 */}
        <div className="bg-blue-50 rounded-lg p-4 mb-6 text-left">
          <h3 className="font-medium text-blue-900 mb-2">안내 사항</h3>
          <ul className="space-y-1 text-sm text-blue-700">
            <li className="flex items-start">
              <span className="mr-2">1.</span>
              <span>관리자가 신청 내용을 검토 중입니다.</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">2.</span>
              <span>승인 완료 시 자동으로 대시보드로 이동합니다.</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">3.</span>
              <span>일반적으로 1~2 영업일 내 처리됩니다.</span>
            </li>
          </ul>
        </div>

        {/* 진행 상태 */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-500">상태 확인 중...</span>
            <span className="text-xs text-gray-400">
              {checkCount > 0 ? `${checkCount}회 확인됨` : ''}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-1.5">
            <div
              className="bg-yellow-500 h-1.5 rounded-full animate-pulse"
              style={{ width: '60%' }}
            ></div>
          </div>
        </div>

        {/* 문의 안내 */}
        <p className="text-sm text-gray-500">
          문의사항이 있으시면 관리자에게 연락해주세요.
        </p>

        {/* 새로고침 버튼 */}
        <button
          onClick={checkStatus}
          className="mt-4 text-sm text-blue-600 hover:text-blue-800 underline"
        >
          상태 새로고침
        </button>
      </div>
    </div>
  );
}
