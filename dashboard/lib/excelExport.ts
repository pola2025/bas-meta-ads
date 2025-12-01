import * as XLSX from 'xlsx';
import { KPISummary, TopAd, DailyTrend, PlatformPerformance } from '@/types/analytics';

export interface ExportData {
  kpi: KPISummary;
  dailyTrend: DailyTrend[];
  platformPerformance: PlatformPerformance[];
  topAds: TopAd[];
  dateRange: {
    start: string;
    end: string;
  };
}

export function exportToExcel(data: ExportData, filename: string = 'bas-meta-ads-report') {
  // 워크북 생성
  const wb = XLSX.utils.book_new();

  // 1. KPI 요약 시트
  const kpiData = [
    ['Polarad Meta 광고리포트 - KPI 요약'],
    ['기간', `${data.dateRange.start} ~ ${data.dateRange.end}`],
    [],
    ['지표', '값'],
    ['총 리드', data.kpi.total_leads],
    ['총 지출', `$${data.kpi.total_spend.toFixed(2)}`],
    ['평균 CPL', `$${data.kpi.avg_cpl.toFixed(2)}`],
    ['평균 CTR', `${data.kpi.avg_ctr.toFixed(2)}%`],
    ['총 노출수', data.kpi.total_impressions],
    ['총 클릭수', data.kpi.total_clicks],
    ['평균 CVR', `${data.kpi.avg_cvr.toFixed(2)}%`]
  ];
  const wsKpi = XLSX.utils.aoa_to_sheet(kpiData);

  // 컬럼 너비 설정
  wsKpi['!cols'] = [{ wch: 20 }, { wch: 20 }];

  XLSX.utils.book_append_sheet(wb, wsKpi, 'KPI 요약');

  // 2. 일별 트렌드 시트
  if (data.dailyTrend.length > 0) {
    const trendData = [
      ['일별 성과 트렌드'],
      [],
      ['날짜', '리드', '지출', 'CPL', 'CTR', '노출수', '클릭수']
    ];

    data.dailyTrend.forEach(row => {
      trendData.push([
        row.date,
        row.leads.toString(),
        `$${row.spend.toFixed(2)}`,
        `$${row.cpl.toFixed(2)}`,
        `${row.ctr.toFixed(2)}%`,
        row.impressions.toString(),
        row.clicks.toString()
      ]);
    });

    const wsTrend = XLSX.utils.aoa_to_sheet(trendData);
    wsTrend['!cols'] = [
      { wch: 12 },
      { wch: 10 },
      { wch: 12 },
      { wch: 10 },
      { wch: 10 },
      { wch: 12 },
      { wch: 10 }
    ];

    XLSX.utils.book_append_sheet(wb, wsTrend, '일별 트렌드');
  }

  // 3. 플랫폼별 성과 시트
  if (data.platformPerformance.length > 0) {
    const platformData = [
      ['플랫폼별 성과'],
      [],
      ['플랫폼', '리드', '지출', 'CPL', '비율']
    ];

    data.platformPerformance.forEach(row => {
      platformData.push([
        row.platform,
        row.leads.toString(),
        `$${row.spend.toFixed(2)}`,
        `$${row.cpl.toFixed(2)}`,
        `${row.percentage.toFixed(1)}%`
      ]);
    });

    const wsPlatform = XLSX.utils.aoa_to_sheet(platformData);
    wsPlatform['!cols'] = [
      { wch: 15 },
      { wch: 10 },
      { wch: 12 },
      { wch: 10 },
      { wch: 10 }
    ];

    XLSX.utils.book_append_sheet(wb, wsPlatform, '플랫폼별 성과');
  }

  // 4. 상위 광고 시트
  if (data.topAds.length > 0) {
    const adsData = [
      ['상위 광고 성과'],
      [],
      ['광고명', '캠페인', '플랫폼', '리드', '지출', 'CPL', 'CTR', '노출수', '클릭수']
    ];

    data.topAds.forEach(row => {
      adsData.push([
        row.ad_name,
        row.campaign_name,
        row.platform,
        row.leads.toString(),
        `$${row.spend.toFixed(2)}`,
        `$${row.cpl.toFixed(2)}`,
        `${row.ctr.toFixed(2)}%`,
        row.impressions.toString(),
        row.clicks.toString()
      ]);
    });

    const wsAds = XLSX.utils.aoa_to_sheet(adsData);
    wsAds['!cols'] = [
      { wch: 30 },
      { wch: 25 },
      { wch: 12 },
      { wch: 10 },
      { wch: 12 },
      { wch: 10 },
      { wch: 10 },
      { wch: 12 },
      { wch: 10 }
    ];

    XLSX.utils.book_append_sheet(wb, wsAds, '상위 광고');
  }

  // 파일 다운로드
  const timestamp = new Date().toISOString().split('T')[0];
  XLSX.writeFile(wb, `${filename}_${timestamp}.xlsx`);
}
