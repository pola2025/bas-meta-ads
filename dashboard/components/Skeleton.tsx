'use client';

import { cn } from '@/lib/utils';

// 기본 스켈레톤 컴포넌트
interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-md bg-gray-200',
        className
      )}
    />
  );
}

// KPI 카드 스켈레톤
export function KPICardSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-3">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-8 w-8 rounded-lg" />
      </div>
      <Skeleton className="h-8 w-32 mb-2" />
      <div className="flex items-center gap-2">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-24" />
      </div>
      <Skeleton className="h-12 w-full mt-4" />
    </div>
  );
}

// 차트 스켈레톤
export function ChartSkeleton() {
  return (
    <div className="bg-white p-6 rounded-xl border border-gray-200">
      <div className="flex items-center justify-between mb-6">
        <div>
          <Skeleton className="h-5 w-32 mb-2" />
          <Skeleton className="h-3 w-24" />
        </div>
        <Skeleton className="h-8 w-32 rounded-lg" />
      </div>
      <div className="flex gap-2 mb-4">
        <Skeleton className="h-7 w-16 rounded-full" />
        <Skeleton className="h-7 w-16 rounded-full" />
        <Skeleton className="h-7 w-16 rounded-full" />
      </div>
      <Skeleton className="h-[320px] w-full rounded-lg" />
      <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="text-center">
            <Skeleton className="h-3 w-12 mx-auto mb-2" />
            <Skeleton className="h-6 w-16 mx-auto" />
          </div>
        ))}
      </div>
    </div>
  );
}

// 테이블 스켈레톤
export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* 헤더 */}
      <div className="px-6 py-4 border-b border-gray-200">
        <Skeleton className="h-5 w-32" />
      </div>
      {/* 테이블 헤더 */}
      <div className="grid grid-cols-6 gap-4 px-6 py-3 bg-gray-50 border-b border-gray-200">
        {[...Array(6)].map((_, i) => (
          <Skeleton key={i} className="h-4 w-16" />
        ))}
      </div>
      {/* 테이블 행 */}
      {[...Array(rows)].map((_, rowIdx) => (
        <div
          key={rowIdx}
          className="grid grid-cols-6 gap-4 px-6 py-4 border-b border-gray-100"
        >
          {[...Array(6)].map((_, colIdx) => (
            <Skeleton
              key={colIdx}
              className={cn(
                'h-4',
                colIdx === 0 ? 'w-32' : 'w-16'
              )}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

// 전체 대시보드 스켈레톤
export function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      {/* 필터 바 스켈레톤 */}
      <div className="flex items-center gap-4">
        <Skeleton className="h-10 w-64 rounded-lg" />
        <Skeleton className="h-10 w-32 rounded-lg" />
        <Skeleton className="h-10 w-32 rounded-lg" />
      </div>

      {/* 내보내기 버튼 */}
      <div className="flex justify-end">
        <Skeleton className="h-10 w-28 rounded-lg" />
      </div>

      {/* KPI 카드 */}
      <section>
        <Skeleton className="h-8 w-24 mb-4" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <KPICardSkeleton key={i} />
          ))}
        </div>
      </section>

      {/* 차트 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartSkeleton />
        <ChartSkeleton />
      </div>

      {/* 테이블 */}
      <TableSkeleton rows={5} />
    </div>
  );
}

// 플랫폼 차트 스켈레톤
export function PlatformChartSkeleton() {
  return (
    <div className="bg-white p-6 rounded-xl border border-gray-200">
      <div className="flex items-center justify-between mb-6">
        <div>
          <Skeleton className="h-5 w-32 mb-2" />
          <Skeleton className="h-3 w-24" />
        </div>
        <Skeleton className="h-8 w-24 rounded-lg" />
      </div>
      <div className="flex items-center justify-center">
        <Skeleton className="h-[300px] w-[300px] rounded-full" />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="flex items-center gap-2">
            <Skeleton className="h-3 w-3 rounded-full" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-12 ml-auto" />
          </div>
        ))}
      </div>
    </div>
  );
}
