/**
 * Admin API - 월간 광고 효율 흐름 데이터
 *
 * GET: 월별 일일 집계 데이터 (도달, 리드, CPL, 지출, 평균시청시간)
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

// 관리자 키 검증
function isAdmin(request: NextRequest): boolean {
  const adminKey = request.headers.get('x-admin-key');
  return adminKey === process.env.NEXT_PUBLIC_ADMIN_KEY;
}

// GET: 월간 일일 데이터
export async function GET(request: NextRequest) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString());
    const month = parseInt(searchParams.get('month') || (new Date().getMonth() + 1).toString());
    const filter = searchParams.get('filter') || 'all'; // 'all', 'general', 'bizactor'

    // 해당 월의 시작일과 종료일
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, '0')}-${lastDay}`;

    // 비즈액터스쿨 클라이언트 ID 조회
    const { data: bizactorClients } = await supabaseAdmin
      .from('clients')
      .select('id')
      .ilike('client_name', '%비즈액터스쿨%');

    const bizactorClientIds = bizactorClients?.map(c => c.id) || [];

    // raw_data에서 일별 집계 (필터 적용)
    let query = supabaseAdmin
      .from('raw_data')
      .select('date, impressions, clicks, leads, spend, avg_watch_time, client_id')
      .gte('date', startDate)
      .lte('date', endDate);

    // 필터 적용
    if (filter === 'general' && bizactorClientIds.length > 0) {
      // 일반고객: 비즈액터스쿨 제외
      query = query.not('client_id', 'in', `(${bizactorClientIds.join(',')})`);
    } else if (filter === 'bizactor' && bizactorClientIds.length > 0) {
      // 비즈액터스쿨만
      query = query.in('client_id', bizactorClientIds);
    }

    const { data: rawData, error } = await query;

    if (error) {
      throw error;
    }

    // 일별 집계
    const dailyMap: Record<string, {
      date: string;
      impressions: number;
      clicks: number;
      leads: number;
      spend: number;
      watchTimeSum: number;
      watchTimeCount: number;
    }> = {};

    // 해당 월의 모든 날짜 초기화
    for (let day = 1; day <= lastDay; day++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      dailyMap[dateStr] = {
        date: dateStr,
        impressions: 0,
        clicks: 0,
        leads: 0,
        spend: 0,
        watchTimeSum: 0,
        watchTimeCount: 0,
      };
    }

    // 데이터 집계
    rawData?.forEach((row) => {
      const dateStr = row.date;
      if (dailyMap[dateStr]) {
        dailyMap[dateStr].impressions += row.impressions || 0;
        dailyMap[dateStr].clicks += row.clicks || 0;
        dailyMap[dateStr].leads += row.leads || 0;
        dailyMap[dateStr].spend += parseFloat(row.spend as any) || 0;
        if (row.avg_watch_time) {
          dailyMap[dateStr].watchTimeSum += parseFloat(row.avg_watch_time as any);
          dailyMap[dateStr].watchTimeCount += 1;
        }
      }
    });

    // 배열로 변환 및 CPL 계산
    const dailyData = Object.keys(dailyMap)
      .sort()
      .map((dateStr) => {
        const d = dailyMap[dateStr];
        const hasData = d.spend > 0 || d.leads > 0 || d.impressions > 0; // 광고 ON 여부
        const cpl = d.leads > 0 ? d.spend / d.leads : 0;
        const ctr = d.impressions > 0 ? (d.clicks / d.impressions) * 100 : 0;
        const avgWatchTime = d.watchTimeCount > 0 ? d.watchTimeSum / d.watchTimeCount : 0;

        return {
          date: dateStr,
          day: parseInt(dateStr.split('-')[2]),
          impressions: d.impressions,
          clicks: d.clicks,
          leads: d.leads,
          spend: Math.round(d.spend * 100) / 100,
          cpl: Math.round(cpl * 100) / 100,
          ctr: Math.round(ctr * 100) / 100,
          avgWatchTime: Math.round(avgWatchTime * 10) / 10,
          hasData, // 광고 ON 여부 (추이 그래프용)
        };
      });

    // 월 평균 CPL 계산 (효율 저하 구간 판단용)
    const totalSpend = dailyData.reduce((sum, d) => sum + d.spend, 0);
    const totalLeads = dailyData.reduce((sum, d) => sum + d.leads, 0);
    const avgCpl = totalLeads > 0 ? totalSpend / totalLeads : 0;

    // 효율 저하 구간 탐지 (평균 CPL 대비 30% 이상 높은 구간, 광고 ON일만)
    const threshold = avgCpl * 1.3;
    const inefficientDays = dailyData
      .filter((d) => d.hasData && d.leads > 0 && d.cpl > threshold)
      .map((d) => d.day);

    // 월 합계
    const monthlyTotals = {
      impressions: dailyData.reduce((sum, d) => sum + d.impressions, 0),
      clicks: dailyData.reduce((sum, d) => sum + d.clicks, 0),
      leads: totalLeads,
      spend: Math.round(totalSpend * 100) / 100,
      avgCpl: Math.round(avgCpl * 100) / 100,
      avgWatchTime:
        dailyData.filter((d) => d.avgWatchTime > 0).length > 0
          ? Math.round(
              (dailyData.reduce((sum, d) => sum + d.avgWatchTime, 0) /
                dailyData.filter((d) => d.avgWatchTime > 0).length) *
                10
            ) / 10
          : 0,
    };

    // 광고 운영일/OFF일 통계
    const activeDays = dailyData.filter(d => d.hasData).length;
    const inactiveDays = dailyData.length - activeDays;

    return NextResponse.json({
      success: true,
      year,
      month,
      filter,
      startDate,
      endDate,
      dailyData,
      monthlyTotals,
      analysis: {
        avgCpl: Math.round(avgCpl * 100) / 100,
        threshold: Math.round(threshold * 100) / 100,
        inefficientDays,
        inefficientCount: inefficientDays.length,
        activeDays,    // 광고 운영일 수
        inactiveDays,  // 광고 OFF일 수
      },
    });
  } catch (error: any) {
    console.error('Monthly flow API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
