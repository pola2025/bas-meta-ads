/**
 * Report Storage Module
 * 리포트를 Supabase telegram_reports 테이블에 저장
 * 구조화된 JSON 데이터 포함
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// 기본 client_id (비즈액터스쿨)
const DEFAULT_CLIENT_ID = '79e35fc6-a817-4ccc-9d5d-9a93c1ad4515';

/**
 * 주간 리포트 저장
 */
async function saveWeeklyReport({
  weekStart,
  weekEnd,
  messages,
  thisStats,
  prevStats,
  aiInsights,
  // 구조화된 데이터 (신규)
  dailyStats = [],
  adPerformance = [],
  campaignPerformance = [],
  telegramMessageId = null,
  clientId = DEFAULT_CLIENT_ID
}) {
  // 구조화된 report_data JSON 생성
  const reportDataJson = {
    summary: {
      impressions: thisStats.impressions || 0,
      clicks: thisStats.clicks || 0,
      leads: thisStats.leads || 0,
      spend: thisStats.spend || 0,
      cpl: thisStats.cpl || 0,
      ctr: thisStats.ctr || 0,
      conversion_rate: thisStats.conversion_rate || 0
    },
    comparison: {
      prev_impressions: prevStats.impressions || 0,
      prev_clicks: prevStats.clicks || 0,
      prev_leads: prevStats.leads || 0,
      prev_spend: prevStats.spend || 0,
      prev_cpl: prevStats.cpl || 0,
      prev_ctr: prevStats.ctr || 0
    },
    daily_stats: dailyStats.map(d => ({
      date: d.date,
      leads: d.leads || 0,
      spend: d.spend || 0,
      cpl: d.leads > 0 ? d.spend / d.leads : 0,
      impressions: d.impressions || 0,
      clicks: d.clicks || 0,
      videoViews: d.videoViews || d.video_views || 0,
      avgWatchTime: d.avgWatchTime || d.avg_watch_time || 0
    })),
    ad_performance: adPerformance.map(ad => ({
      ad_id: ad.ad_id,
      ad_name: ad.ad_name,
      leads: ad.leads || 0,
      spend: ad.spend || 0,
      cpl: ad.leads > 0 ? (ad.cpl ?? ad.spend / ad.leads) : null,
      ctr: ad.ctr || 0,
      impressions: ad.impressions || 0,
      clicks: ad.clicks || 0,
      spend_percent: ad.spendPercent || 0,
      lead_percent: ad.leadPercent || 0
    })),
    campaign_performance: campaignPerformance.map(camp => ({
      campaign_id: camp.campaign_id,
      campaign_name: camp.campaign_name,
      leads: camp.leads || 0,
      spend: camp.spend || 0,
      cpl: camp.leads > 0 ? (camp.cpl ?? camp.spend / camp.leads) : null,
      spend_percent: camp.spendPercent || 0,
      lead_percent: camp.leadPercent || 0
    }))
  };

  const reportData = {
    client_id: clientId,
    week_start: weekStart,
    week_end: weekEnd,
    report_type: 'weekly',
    message_text: messages.join('\n\n---\n\n'),
    total_spend: thisStats.spend,
    total_leads: thisStats.leads,
    avg_cpl: thisStats.cpl,
    avg_ctr: thisStats.ctr,
    total_impressions: thisStats.impressions,
    total_clicks: thisStats.clicks,
    spend_change: Math.round(Math.max(-999, Math.min(999, prevStats.spend > 0 ? ((thisStats.spend - prevStats.spend) / prevStats.spend) * 100 : 0)) * 100) / 100,
    leads_change: Math.round(Math.max(-999, Math.min(999, prevStats.leads > 0 ? ((thisStats.leads - prevStats.leads) / prevStats.leads) * 100 : 0)) * 100) / 100,
    cpl_change: Math.round(Math.max(-999, Math.min(999, prevStats.cpl > 0 ? ((thisStats.cpl - prevStats.cpl) / prevStats.cpl) * 100 : 0)) * 100) / 100,
    ctr_change: Math.round(Math.max(-999, Math.min(999, prevStats.ctr > 0 ? ((thisStats.ctr - prevStats.ctr) / prevStats.ctr) * 100 : 0)) * 100) / 100,
    ai_insights: aiInsights,
    report_data: reportDataJson, // 구조화된 JSON
    telegram_message_id: telegramMessageId,
    sent_at: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from('telegram_reports')
    .upsert(reportData, {
      onConflict: 'client_id,week_start,week_end,report_type'
    })
    .select()
    .single();

  if (error) {
    console.error('❌ 리포트 저장 실패:', error.message);
    throw error;
  }

  console.log(`✅ 리포트 저장 완료: ${data.id}`);
  return data;
}

/**
 * 월간 리포트 저장
 */
async function saveMonthlyReport({
  monthStart,
  monthEnd,
  messages,
  thisStats,
  prevStats,
  aiInsights,
  // 구조화된 데이터 (신규)
  weeklyStats = [],
  dayOfWeekStats = [],
  adPerformance = [],
  campaignPerformance = [],
  telegramMessageId = null,
  clientId = DEFAULT_CLIENT_ID
}) {
  // 구조화된 report_data JSON 생성
  const reportDataJson = {
    summary: {
      impressions: thisStats.impressions || 0,
      clicks: thisStats.clicks || 0,
      leads: thisStats.leads || 0,
      spend: thisStats.spend || 0,
      cpl: thisStats.cpl || 0,
      ctr: thisStats.ctr || 0,
      conversion_rate: thisStats.conversion_rate || 0,
      days: thisStats.days || 0
    },
    comparison: {
      prev_impressions: prevStats.impressions || 0,
      prev_clicks: prevStats.clicks || 0,
      prev_leads: prevStats.leads || 0,
      prev_spend: prevStats.spend || 0,
      prev_cpl: prevStats.cpl || 0,
      prev_ctr: prevStats.ctr || 0
    },
    weekly_stats: weeklyStats.map(w => ({
      week: w.week,
      label: w.label,
      start: w.start,
      end: w.end,
      leads: w.leads || 0,
      spend: w.spend || 0,
      cpl: w.cpl || 0,
      impressions: w.impressions || 0,
      clicks: w.clicks || 0
    })),
    day_of_week_stats: dayOfWeekStats.map(d => ({
      day: d.name,
      leads: d.leads || 0,
      spend: d.spend || 0,
      percent: d.percent || 0
    })),
    ad_performance: adPerformance.map(ad => ({
      ad_id: ad.ad_id,
      ad_name: ad.ad_name,
      leads: ad.leads || 0,
      spend: ad.spend || 0,
      cpl: ad.leads > 0 ? (ad.cpl ?? ad.spend / ad.leads) : null,
      ctr: ad.ctr || 0,
      impressions: ad.impressions || 0,
      clicks: ad.clicks || 0,
      spend_percent: ad.spendPercent || 0,
      lead_percent: ad.leadPercent || 0
    })),
    campaign_performance: campaignPerformance.map(camp => ({
      campaign_id: camp.campaign_id,
      campaign_name: camp.campaign_name,
      leads: camp.leads || 0,
      spend: camp.spend || 0,
      cpl: camp.leads > 0 ? (camp.cpl ?? camp.spend / camp.leads) : null,
      spend_percent: camp.spendPercent || 0,
      lead_percent: camp.leadPercent || 0
    }))
  };

  const reportData = {
    client_id: clientId,
    week_start: monthStart,
    week_end: monthEnd,
    report_type: 'monthly',
    message_text: messages.join('\n\n---\n\n'),
    total_spend: thisStats.spend,
    total_leads: thisStats.leads,
    avg_cpl: thisStats.cpl,
    avg_ctr: thisStats.ctr,
    total_impressions: thisStats.impressions,
    total_clicks: thisStats.clicks,
    spend_change: Math.round(Math.max(-999, Math.min(999, prevStats.spend > 0 ? ((thisStats.spend - prevStats.spend) / prevStats.spend) * 100 : 0)) * 100) / 100,
    leads_change: Math.round(Math.max(-999, Math.min(999, prevStats.leads > 0 ? ((thisStats.leads - prevStats.leads) / prevStats.leads) * 100 : 0)) * 100) / 100,
    cpl_change: Math.round(Math.max(-999, Math.min(999, prevStats.cpl > 0 ? ((thisStats.cpl - prevStats.cpl) / prevStats.cpl) * 100 : 0)) * 100) / 100,
    ctr_change: Math.round(Math.max(-999, Math.min(999, prevStats.ctr > 0 ? ((thisStats.ctr - prevStats.ctr) / prevStats.ctr) * 100 : 0)) * 100) / 100,
    ai_insights: aiInsights,
    report_data: reportDataJson, // 구조화된 JSON
    telegram_message_id: telegramMessageId,
    sent_at: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from('telegram_reports')
    .upsert(reportData, {
      onConflict: 'client_id,week_start,week_end,report_type'
    })
    .select()
    .single();

  if (error) {
    console.error('❌ 리포트 저장 실패:', error.message);
    throw error;
  }

  console.log(`✅ 월간 리포트 저장 완료: ${data.id}`);
  return data;
}

/**
 * 리포트 목록 조회
 */
async function getReports({
  reportType = null,
  limit = 20,
  offset = 0,
  clientId = DEFAULT_CLIENT_ID
} = {}) {
  let query = supabase
    .from('telegram_reports')
    .select('*')
    .eq('client_id', clientId)
    .order('week_start', { ascending: false })
    .range(offset, offset + limit - 1);

  if (reportType) {
    query = query.eq('report_type', reportType);
  }

  const { data, error } = await query;

  if (error) {
    console.error('❌ 리포트 조회 실패:', error.message);
    throw error;
  }

  return data;
}

/**
 * 단일 리포트 조회
 */
async function getReportById(id) {
  const { data, error } = await supabase
    .from('telegram_reports')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    console.error('❌ 리포트 조회 실패:', error.message);
    throw error;
  }

  return data;
}

module.exports = {
  saveWeeklyReport,
  saveMonthlyReport,
  getReports,
  getReportById,
  DEFAULT_CLIENT_ID
};
