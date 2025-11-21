'use client';

import { useState } from 'react';
import { Calendar } from 'lucide-react';

interface SimpleDateInputProps {
  onDateRangeChange: (startDate: string, endDate: string) => void;
  defaultStart?: string;
  defaultEnd?: string;
}

/**
 * 간단한 날짜 입력 컴포넌트
 *
 * 입력 형식:
 * - 20251101-20251120
 * - 2025-11-01 ~ 2025-11-20
 * - 시작일/종료일 각각 입력
 */
export default function SimpleDateInput({
  onDateRangeChange,
  defaultStart = '',
  defaultEnd = ''
}: SimpleDateInputProps) {
  const [inputValue, setInputValue] = useState('');
  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(defaultEnd);
  const [mode, setMode] = useState<'single' | 'separate'>('single');
  const [error, setError] = useState('');

  // 단일 입력 파싱 (20251101-20251120 형식)
  const parseSingleInput = (value: string): { start: string; end: string } | null => {
    // 공백 제거
    value = value.trim().replace(/\s+/g, '');

    // 패턴 1: 20251101-20251120
    const pattern1 = /^(\d{8})-(\d{8})$/;
    const match1 = value.match(pattern1);
    if (match1) {
      const start = `${match1[1].substring(0, 4)}-${match1[1].substring(4, 6)}-${match1[1].substring(6, 8)}`;
      const end = `${match1[2].substring(0, 4)}-${match1[2].substring(4, 6)}-${match1[2].substring(6, 8)}`;
      return { start, end };
    }

    // 패턴 2: 2025-11-01 ~ 2025-11-20
    const pattern2 = /^(\d{4}-\d{2}-\d{2})[-~](\d{4}-\d{2}-\d{2})$/;
    const match2 = value.match(pattern2);
    if (match2) {
      return { start: match2[1], end: match2[2] };
    }

    // 패턴 3: 2025-11-01-2025-11-20
    const pattern3 = /^(\d{4}-\d{2}-\d{2})-(\d{4}-\d{2}-\d{2})$/;
    const match3 = value.match(pattern3);
    if (match3) {
      return { start: match3[1], end: match3[2] };
    }

    return null;
  };

  // 날짜 유효성 검사
  const isValidDate = (dateStr: string): boolean => {
    const date = new Date(dateStr);
    return date instanceof Date && !isNaN(date.getTime());
  };

  // 단일 입력 확인
  const handleSingleInputSubmit = () => {
    const result = parseSingleInput(inputValue);

    if (!result) {
      setError('올바른 형식이 아닙니다. 예: 20251101-20251120');
      return;
    }

    if (!isValidDate(result.start) || !isValidDate(result.end)) {
      setError('유효하지 않은 날짜입니다');
      return;
    }

    if (new Date(result.start) > new Date(result.end)) {
      setError('시작일이 종료일보다 늦습니다');
      return;
    }

    setError('');
    setStartDate(result.start);
    setEndDate(result.end);
    onDateRangeChange(result.start, result.end);
  };

  // 개별 입력 확인
  const handleSeparateInputSubmit = () => {
    if (!startDate || !endDate) {
      setError('시작일과 종료일을 모두 입력해주세요');
      return;
    }

    if (!isValidDate(startDate) || !isValidDate(endDate)) {
      setError('유효하지 않은 날짜입니다');
      return;
    }

    if (new Date(startDate) > new Date(endDate)) {
      setError('시작일이 종료일보다 늦습니다');
      return;
    }

    setError('');
    onDateRangeChange(startDate, endDate);
  };

  // Enter 키 처리
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (mode === 'single') {
        handleSingleInputSubmit();
      } else {
        handleSeparateInputSubmit();
      }
    }
  };

  return (
    <div className="space-y-4">
      {/* 입력 모드 선택 */}
      <div className="flex gap-2 mb-3">
        <button
          onClick={() => setMode('single')}
          className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
            mode === 'single'
              ? 'bg-blue-500 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          한 번에 입력
        </button>
        <button
          onClick={() => setMode('separate')}
          className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
            mode === 'separate'
              ? 'bg-blue-500 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          개별 입력
        </button>
      </div>

      {/* 단일 입력 모드 */}
      {mode === 'single' && (
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">
            날짜 범위 입력
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="20251101-20251120"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={handleSingleInputSubmit}
              className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
            >
              확인
            </button>
          </div>
          <p className="text-xs text-gray-500">
            예: 20251101-20251120 또는 2025-11-01~2025-11-20
          </p>
        </div>
      )}

      {/* 개별 입력 모드 */}
      {mode === 'separate' && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">
                시작일
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                onKeyPress={handleKeyPress}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">
                종료일
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                onKeyPress={handleKeyPress}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <button
            onClick={handleSeparateInputSubmit}
            className="w-full px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors flex items-center justify-center gap-2"
          >
            <Calendar className="w-4 h-4" />
            확인
          </button>
        </div>
      )}

      {/* 에러 메시지 */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* 현재 선택된 기간 표시 */}
      {startDate && endDate && !error && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
          <p className="text-sm text-blue-800">
            <span className="font-medium">선택된 기간:</span>{' '}
            {startDate} ~ {endDate}
          </p>
        </div>
      )}
    </div>
  );
}
