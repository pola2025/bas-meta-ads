'use client';

/**
 * OAuth 로그인 페이지 - 신규 클라이언트용
 *
 * Meta OAuth 로그인 버튼과 서비스 안내를 제공합니다.
 */

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';

export default function LoginPage() {
  const searchParams = useSearchParams();
  const error = searchParams.get('error');
  const errorMessage = searchParams.get('message');

  const [agreed, setAgreed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = () => {
    if (!agreed) {
      alert('이용약관에 동의해주세요.');
      return;
    }
    setIsLoading(true);
    window.location.href = '/api/auth/login';
  };

  const getErrorMessage = (errorCode: string | null) => {
    switch (errorCode) {
      case 'oauth_init_failed':
        return 'OAuth 초기화에 실패했습니다. 다시 시도해주세요.';
      case 'missing_params':
        return '필수 파라미터가 누락되었습니다.';
      case 'invalid_state':
        return '보안 토큰이 유효하지 않습니다. 다시 시도해주세요.';
      case 'token_exchange_failed':
        return '토큰 교환에 실패했습니다. 다시 시도해주세요.';
      case 'long_lived_token_failed':
        return '장기 토큰 발급에 실패했습니다.';
      case 'user_info_failed':
        return '사용자 정보를 가져올 수 없습니다.';
      case 'no_ad_accounts':
        return '연결된 광고 계정이 없습니다. Meta Business Suite에서 광고 계정을 먼저 생성해주세요.';
      case 'registration_failed':
        return '등록에 실패했습니다. 다시 시도해주세요.';
      case 'callback_failed':
        return '인증 처리 중 오류가 발생했습니다.';
      default:
        return errorMessage || '알 수 없는 오류가 발생했습니다.';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8">
        {/* 로고/타이틀 */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
            <svg
              className="w-8 h-8 text-blue-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Meta Ads Analytics</h1>
          <p className="text-gray-500 mt-2">광고 성과 분석 대시보드</p>
        </div>

        {/* 에러 메시지 */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center">
              <svg
                className="w-5 h-5 text-red-500 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span className="text-red-700 text-sm">{getErrorMessage(error)}</span>
            </div>
          </div>
        )}

        {/* 서비스 소개 */}
        <div className="mb-6 space-y-3">
          <div className="flex items-start">
            <div className="flex-shrink-0 w-5 h-5 bg-green-100 rounded-full flex items-center justify-center mt-0.5">
              <svg className="w-3 h-3 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <p className="ml-3 text-sm text-gray-600">Meta 광고 성과 실시간 대시보드</p>
          </div>
          <div className="flex items-start">
            <div className="flex-shrink-0 w-5 h-5 bg-green-100 rounded-full flex items-center justify-center mt-0.5">
              <svg className="w-3 h-3 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <p className="ml-3 text-sm text-gray-600">주간/월간 리포트 자동 발송</p>
          </div>
          <div className="flex items-start">
            <div className="flex-shrink-0 w-5 h-5 bg-green-100 rounded-full flex items-center justify-center mt-0.5">
              <svg className="w-3 h-3 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <p className="ml-3 text-sm text-gray-600">CPL, 노출수, 리드 등 핵심 지표 분석</p>
          </div>
        </div>

        {/* 이용약관 동의 */}
        <div className="mb-6">
          <label className="flex items-start cursor-pointer">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-1 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <span className="ml-2 text-sm text-gray-600">
              <span className="font-medium">이용약관</span>에 동의합니다.
              <br />
              <span className="text-xs text-gray-400">
                본 서비스는 광고 성과 데이터(노출, 클릭, 리드, 비용)만 조회하며, 광고 수정/삭제
                기능은 없습니다. 개인정보는 수집하지 않습니다.
              </span>
            </span>
          </label>
        </div>

        {/* Meta 로그인 버튼 */}
        <button
          onClick={handleLogin}
          disabled={!agreed || isLoading}
          className={`w-full flex items-center justify-center py-3 px-4 rounded-lg font-medium transition-all ${
            agreed && !isLoading
              ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-xl'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
          }`}
        >
          {isLoading ? (
            <>
              <svg
                className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              연결 중...
            </>
          ) : (
            <>
              <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
              </svg>
              Meta 계정으로 시작하기
            </>
          )}
        </button>

        {/* 기존 회원 안내 */}
        <p className="mt-6 text-center text-sm text-gray-500">
          이미 등록된 클라이언트이신가요?
          <br />
          <span className="text-gray-400">
            관리자에게 대시보드 링크를 요청하세요.
          </span>
        </p>
      </div>
    </div>
  );
}
