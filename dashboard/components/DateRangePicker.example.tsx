// DateRangePicker 사용 예시
import { useState } from 'react'
import DateRangePicker, { DateRange } from './DateRangePicker'
import { subDays } from 'date-fns'

export default function ExamplePage() {
  // 기본값: 최근 30일
  const [dateRange, setDateRange] = useState<DateRange>({
    from: subDays(new Date(), 29),
    to: new Date(),
  })

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">날짜 범위 선택 예시</h1>

      {/* DateRangePicker 사용 */}
      <DateRangePicker value={dateRange} onChange={setDateRange} />

      {/* 선택된 날짜 표시 */}
      <div className="mt-4 p-4 bg-gray-100 rounded-lg">
        <h2 className="font-semibold mb-2">선택된 날짜:</h2>
        <p>시작일: {dateRange.from?.toLocaleDateString('ko-KR') || '미선택'}</p>
        <p>종료일: {dateRange.to?.toLocaleDateString('ko-KR') || '미선택'}</p>
      </div>
    </div>
  )
}
