'use client';

import { AlertCircle, CheckCircle, Clock, Calendar } from 'lucide-react';
import { differenceInDays, format } from 'date-fns';

interface DataMonitorProps {
  // 현재 기간
  currentPeriod: {
    start: string;
    end: string;
    days: number;
  };
  // 현재 데이터
  currentData: {
    total_leads: number;
    total_spend: number;
    avg_cpl: number;
    dataPoints: number; // 실제 조회된 행 수
  };
  // 비교 기간 (선택사항)
  comparisonPeriod?: {
    start: string;
    end: string;
    days: number;
  };
  // 비교 데이터 (선택사항)
  comparisonData?: {
    total_leads: number;
    total_spend: number;
    avg_cpl: number;
    dataPoints: number;
  };
}

interface ValidationResult {
  status: 'healthy' | 'warning' | 'error';
  message: string;
  details?: string;
}

export function DataMonitor({
  currentPeriod,
  currentData,
  comparisonPeriod,
  comparisonData
}: DataMonitorProps) {

  // 데이터 검증 로직
  const validateData = (): ValidationResult[] => {
    const results: ValidationResult[] = [];

    // 1. 데이터 포인트 수 검증 (기대값: 기간 × 플랫폼 수)
    const expectedPoints = currentPeriod.days * 3; // 3개 플랫폼 가정
    const tolerance = expectedPoints * 0.5; // 50% 허용 오차

    if (currentData.dataPoints > expectedPoints + tolerance) {
      results.push({
        status: 'error',
        message: '데이터 과다 조회 감지',
        details: `${currentPeriod.days}일 기간에 ${currentData.dataPoints}개 행 조회됨 (예상: ~${expectedPoints}개)`
      });
    } else if (currentData.dataPoints < expectedPoints - tolerance) {
      results.push({
        status: 'warning',
        message: '데이터 부족 감지',
        details: `${currentPeriod.days}일 기간에 ${currentData.dataPoints}개 행만 조회됨 (예상: ~${expectedPoints}개)`
      });
    } else {
      results.push({
        status: 'healthy',
        message: '데이터 수 정상',
        details: `${currentData.dataPoints}개 행 조회 (예상 범위 내)`
      });
    }

    // 2. 일평균 지출 검증
    const avgSpendPerDay = currentData.total_spend / currentPeriod.days;
    if (avgSpendPerDay > 200) { // 일 평균 $200 이상은 의심
      results.push({
        status: 'warning',
        message: '높은 일평균 지출',
        details: `일평균 $${Math.round(avgSpendPerDay).toLocaleString('en-US')} (검토 필요)`
      });
    }

    // 3. CPL 검증
    if (currentData.avg_cpl > 100 || currentData.avg_cpl < 1) {
      results.push({
        status: 'warning',
        message: 'CPL 이상치 감지',
        details: `평균 CPL: $${Math.round(currentData.avg_cpl).toLocaleString('en-US')}`
      });
    }

    // 4. 비교 데이터 검증 (있는 경우)
    if (comparisonData && comparisonPeriod) {
      if (comparisonPeriod.days !== currentPeriod.days) {
        results.push({
          status: 'warning',
          message: '비교 기간 불일치',
          details: `현재 ${currentPeriod.days}일 vs 이전 ${comparisonPeriod.days}일`
        });
      }
    }

    return results;
  };

  const validations = validateData();
  const hasError = validations.some(v => v.status === 'error');
  const hasWarning = validations.some(v => v.status === 'warning');

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-gray-600" />
          <h3 className="font-semibold text-gray-900">데이터 모니터링</h3>
        </div>
        <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${
          hasError ? 'bg-red-100 text-red-700' :
          hasWarning ? 'bg-yellow-100 text-yellow-700' :
          'bg-green-100 text-green-700'
        }`}>
          {hasError ? (
            <><AlertCircle className="w-4 h-4" /> 오류</>
          ) : hasWarning ? (
            <><AlertCircle className="w-4 h-4" /> 주의</>
          ) : (
            <><CheckCircle className="w-4 h-4" /> 정상</>
          )}
        </div>
      </div>

      {/* 현재 기간 정보 */}
      <div className="bg-blue-50 rounded-lg p-4 mb-4">
        <div className="flex items-start gap-3">
          <Calendar className="w-5 h-5 text-blue-600 mt-0.5" />
          <div className="flex-1">
            <div className="font-semibold text-blue-900 mb-1">
              📊 분석 기간
            </div>
            <div className="text-sm text-blue-800 space-y-1">
              <div className="flex items-center justify-between">
                <span>기간:</span>
                <span className="font-mono font-semibold">
                  {currentPeriod.start} ~ {currentPeriod.end}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>일수:</span>
                <span className="font-semibold">{currentPeriod.days}일</span>
              </div>
              <div className="flex items-center justify-between">
                <span>데이터 행:</span>
                <span className="font-semibold">{currentData.dataPoints}개</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 비교 기간 정보 (있는 경우) */}
      {comparisonPeriod && comparisonData && (
        <div className="bg-purple-50 rounded-lg p-4 mb-4">
          <div className="flex items-start gap-3">
            <Calendar className="w-5 h-5 text-purple-600 mt-0.5" />
            <div className="flex-1">
              <div className="font-semibold text-purple-900 mb-1">
                📅 비교 기간 (이전)
              </div>
              <div className="text-sm text-purple-800 space-y-1">
                <div className="flex items-center justify-between">
                  <span>기간:</span>
                  <span className="font-mono font-semibold">
                    {comparisonPeriod.start} ~ {comparisonPeriod.end}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>일수:</span>
                  <span className="font-semibold">{comparisonPeriod.days}일</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>데이터 행:</span>
                  <span className="font-semibold">{comparisonData.dataPoints}개</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 검증 결과 */}
      <div className="space-y-2">
        {validations.map((validation, index) => (
          <div
            key={index}
            className={`flex items-start gap-2 p-3 rounded-lg text-sm ${
              validation.status === 'error' ? 'bg-red-50 border border-red-200' :
              validation.status === 'warning' ? 'bg-yellow-50 border border-yellow-200' :
              'bg-green-50 border border-green-200'
            }`}
          >
            {validation.status === 'error' ? (
              <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
            ) : validation.status === 'warning' ? (
              <AlertCircle className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" />
            ) : (
              <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
            )}
            <div className="flex-1">
              <div className={`font-medium ${
                validation.status === 'error' ? 'text-red-900' :
                validation.status === 'warning' ? 'text-yellow-900' :
                'text-green-900'
              }`}>
                {validation.message}
              </div>
              {validation.details && (
                <div className={`text-xs mt-1 ${
                  validation.status === 'error' ? 'text-red-700' :
                  validation.status === 'warning' ? 'text-yellow-700' :
                  'text-green-700'
                }`}>
                  {validation.details}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* 요약 정보 */}
      <div className="mt-4 pt-4 border-t border-gray-200">
        <div className="grid grid-cols-3 gap-4 text-center text-xs">
          <div>
            <div className="text-gray-600 mb-1">총 지출</div>
            <div className="font-semibold text-gray-900">
              ${currentData.total_spend.toLocaleString('en-US')}
            </div>
          </div>
          <div>
            <div className="text-gray-600 mb-1">총 리드</div>
            <div className="font-semibold text-gray-900">
              {currentData.total_leads.toLocaleString('ko-KR')}
            </div>
          </div>
          <div>
            <div className="text-gray-600 mb-1">평균 CPL</div>
            <div className="font-semibold text-gray-900">
              ${Math.round(currentData.avg_cpl).toLocaleString('en-US')}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
