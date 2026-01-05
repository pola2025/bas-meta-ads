// Environment variables interface
export interface Env {
  // Supabase
  SUPABASE_URL: string;
  SUPABASE_SERVICE_KEY: string;

  // Meta API
  META_APP_ID: string;
  META_APP_SECRET: string;

  META_ACCESS_TOKEN: string;
  META_AD_ACCOUNT_ID: string;
  // Gemini AI
  GEMINI_API_KEY: string;

  // Telegram
  TELEGRAM_BOT_TOKEN: string;
  TELEGRAM_ADMIN_CHAT_ID: string;
  TELEGRAM_ERROR_CHAT_ID: string;

  // Environment
  ENVIRONMENT?: string;
}

// Date range interface
export interface WeekDates {
  thisWeekStart: string;
  thisWeekEnd: string;
  lastWeekStart: string;
  lastWeekEnd: string;
}

// Weekly summary interface
export interface WeeklySummary {
  impressions: number;
  clicks: number;
  leads: number;
  spend: number;
  ctr: number;
  cpl: number;
  conversion_rate: number;
}

// Ad performance interface
export interface AdPerformance {
  ad_id: string;
  ad_name: string;
  impressions: number;
  clicks: number;
  leads: number;
  spend: number;
  cpl: number;
  ctr: number;
  dailyPerformance: Record<string, { leads: number; spend: number }>;
}

// Campaign performance interface
export interface CampaignPerformance {
  campaign_id: string;
  campaign_name: string;
  spend: number;
  leads: number;
  cpl: number;
  spendPercent: number;
  leadPercent: number;
}

// Report data interface
export interface ReportData {
  dates: WeekDates;
  thisWeek: WeeklySummary;
  lastWeek: WeeklySummary;
  thisWeekData: any[];
  lastWeekData: any[];
  topAds: AdPerformance[];
  worstAds: AdPerformance[];
  campaigns: CampaignPerformance[];
}
