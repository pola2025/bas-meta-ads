import type { WeeklySummary, AdPerformance, CampaignPerformance } from '../types';

// 주간 통계 계산
export function calculateWeeklySummary(data: any[]): WeeklySummary {
  if (!data || data.length === 0) {
    return {
      impressions: 0,
      clicks: 0,
      leads: 0,
      spend: 0,
      ctr: 0,
      cpl: 0,
      conversion_rate: 0,
    };
  }

  const totals = data.reduce(
    (acc, row) => {
      acc.impressions += row.impressions || 0;
      acc.clicks += row.clicks || 0;
      acc.leads += row.leads || 0;
      acc.spend += parseFloat(row.spend) || 0;
      return acc;
    },
    { impressions: 0, clicks: 0, leads: 0, spend: 0 }
  );

  const ctr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;
  const cpl = totals.leads > 0 ? totals.spend / totals.leads : 0;
  const conversion_rate = totals.clicks > 0 ? (totals.leads / totals.clicks) * 100 : 0;

  return {
    ...totals,
    ctr,
    cpl,
    conversion_rate,
  };
}

// 광고별 성과 집계
export function getAdPerformance(weekData: any[]): AdPerformance[] {
  if (!weekData || weekData.length === 0) return [];

  const adStats: Record<string, any> = {};

  weekData.forEach((row) => {
    const adKey = row.ad_id || 'unknown';
    if (!adStats[adKey]) {
      adStats[adKey] = {
        ad_id: row.ad_id,
        ad_name: row.ad_name || 'Unknown Ad',
        impressions: 0,
        clicks: 0,
        leads: 0,
        spend: 0,
        dailyPerformance: {},
      };
    }

    adStats[adKey].impressions += row.impressions || 0;
    adStats[adKey].clicks += row.clicks || 0;
    adStats[adKey].leads += row.leads || 0;
    adStats[adKey].spend += parseFloat(row.spend) || 0;

    if (row.date) {
      if (!adStats[adKey].dailyPerformance[row.date]) {
        adStats[adKey].dailyPerformance[row.date] = { leads: 0, spend: 0 };
      }
      adStats[adKey].dailyPerformance[row.date].leads += row.leads || 0;
      adStats[adKey].dailyPerformance[row.date].spend += parseFloat(row.spend) || 0;
    }
  });

  return Object.values(adStats).map((ad) => ({
    ...ad,
    cpl: ad.leads > 0 ? ad.spend / ad.leads : 999999,
    ctr: ad.impressions > 0 ? (ad.clicks / ad.impressions) * 100 : 0,
  }));
}

// 캠페인별 성과 집계
export function getCampaignPerformance(weekData: any[]): CampaignPerformance[] {
  if (!weekData || weekData.length === 0) return [];

  const campaignStats: Record<string, any> = {};

  weekData.forEach((row) => {
    const campKey = row.campaign_id || 'unknown';
    if (!campaignStats[campKey]) {
      campaignStats[campKey] = {
        campaign_id: row.campaign_id,
        campaign_name: row.campaign_name || 'Unknown Campaign',
        spend: 0,
        leads: 0,
      };
    }

    campaignStats[campKey].spend += parseFloat(row.spend) || 0;
    campaignStats[campKey].leads += row.leads || 0;
  });

  const total = Object.values(campaignStats).reduce(
    (acc: any, c: any) => ({ spend: acc.spend + c.spend, leads: acc.leads + c.leads }),
    { spend: 0, leads: 0 }
  );

  return Object.values(campaignStats).map((camp: any) => ({
    ...camp,
    cpl: camp.leads > 0 ? camp.spend / camp.leads : 999999,
    spendPercent: total.spend > 0 ? (camp.spend / total.spend) * 100 : 0,
    leadPercent: total.leads > 0 ? (camp.leads / total.leads) * 100 : 0,
  }));
}
