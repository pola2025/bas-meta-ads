'use client';

import React from 'react';
import { format, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';

interface DailyData {
  date: string;
  leads: number;
  cpl: number;
  spend?: number;
  clicks?: number;
}

interface DailyPerformanceCardsProps {
  data: DailyData[];
  metric?: 'leads' | 'cpl'; // 표시할 메트릭
}

const DAYS_KO = ['일', '월', '화', '수', '목', '금', '토'];

export function DailyPerformanceCards({ data, metric = 'leads' }: DailyPerformanceCardsProps) {
  // 최근 7일 데이터만 사용
  const last7Days = data.slice(-7);

  // 최고/최저 성과일 계산
  const bestDay = metric === 'leads'
    ? last7Days.reduce((max, d) => d.leads > max.leads ? d : max, last7Days[0])
    : last7Days.reduce((min, d) => d.cpl < min.cpl && d.cpl > 0 ? d : min, last7Days.filter(d => d.cpl > 0)[0] || last7Days[0]);

  const worstDay = metric === 'leads'
    ? last7Days.reduce((min, d) => d.leads < min.leads ? d : min, last7Days[0])
    : last7Days.reduce((max, d) => d.cpl > max.cpl ? d : max, last7Days[0]);

  const getCardStyle = (day: DailyData) => {
    const isBest = day.date === bestDay?.date;
    const isWorst = day.date === worstDay?.date && day.date !== bestDay?.date;

    if (isBest) {
      return 'border-green-400 bg-gradient-to-br from-green-50 to-green-50/50';
    }
    if (isWorst) {
      return 'border-red-400 bg-gradient-to-br from-red-50 to-red-50/50';
    }
    return 'border-gray-200 bg-white';
  };

  const getDayLabel = (day: DailyData) => {
    const isBest = day.date === bestDay?.date;
    const isWorst = day.date === worstDay?.date && day.date !== bestDay?.date;
    const dayOfWeek = new Date(day.date).getDay();
    const dayName = DAYS_KO[dayOfWeek];

    if (isBest) {
      return <span className="font-bold text-green-600">{dayName} ⭐</span>;
    }
    if (isWorst) {
      return <span className="font-bold text-red-600">{dayName} ⚠️</span>;
    }
    return <span className="font-bold text-gray-700">{dayName}</span>;
  };

  const formatCPL = (value: number) => {
    if (value === 0) return '-';
    return `₩${value.toLocaleString('ko-KR', { maximumFractionDigits: 0 })}`;
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center gap-2 text-lg font-bold text-gray-800 mb-4">
        <span>📅</span>
        <span>일별 성과 추이</span>
      </div>

      {/* 일별 카드 그리드 */}
      <div className="grid grid-cols-7 gap-2">
        {last7Days.map((day) => {
          const dateObj = parseISO(day.date);
          const dateStr = format(dateObj, 'MM/dd');

          return (
            <div
              key={day.date}
              className={`rounded-lg p-3 text-center border transition-all ${getCardStyle(day)}`}
            >
              <div className="text-xs text-gray-500 mb-1">{dateStr}</div>
              <div className="mb-2">{getDayLabel(day)}</div>

              {/* 리드 수 */}
              <div className="text-lg font-bold text-gray-900">{day.leads}</div>
              <div className="text-xs text-gray-500">리드</div>

              {/* CPL */}
              <div className={`text-sm font-medium mt-1 ${
                day.cpl > 0 && day.date === bestDay?.date ? 'text-green-600' :
                day.cpl > 0 && day.date === worstDay?.date && day.date !== bestDay?.date ? 'text-red-600' :
                'text-gray-600'
              }`}>
                {formatCPL(day.cpl)}
              </div>
            </div>
          );
        })}
      </div>

      {/* 인사이트 박스 */}
      {bestDay && worstDay && bestDay.date !== worstDay.date && (
        <div className="mt-4 rounded-lg p-4 border-l-4 border-blue-500"
          style={{
            background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.05) 0%, rgba(16, 185, 129, 0.05) 100%)'
          }}
        >
          <p className="text-gray-700 text-sm">
            💡 <strong>인사이트:</strong>{' '}
            {format(parseISO(bestDay.date), 'EEEE', { locale: ko })}({format(parseISO(bestDay.date), 'MM/dd')})
            리드 {bestDay.leads}건으로 주간 최고 성과.{' '}
            {format(parseISO(worstDay.date), 'EEEE', { locale: ko })}은 리드 {worstDay.leads}건으로 개선 검토 필요.
          </p>
        </div>
      )}
    </div>
  );
}
