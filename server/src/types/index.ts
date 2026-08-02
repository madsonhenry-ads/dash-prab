export interface DashboardKpis {
  adSpend: number;
  profit: number;
  roas: number;
  netRevenue: number;
  cpa: number;
  margin: number;
  roi: number;
  arpu: number;
  approvedSales: number;
  grossRevenue: number;
}

export interface FunnelStep {
  label: string;
  value: number;
  percentage?: number;
}

export interface SalesByHour {
  hour: number;
  investment: number;
  revenue: number;
  profit: number;
}

export interface SalesByDay {
  day: string;
  sales: number;
  percentage: number;
  isBest: boolean;
}

export interface SalesByCountry {
  country: string;
  sales: number;
  revenue: number;
  flag: string;
}

export interface SalesByPayment {
  method: string;
  sales: number;
  revenue: number;
  percentage: number;
  approvalRate: number;
}

export interface UtmRow {
  utmContent: string;
  utmSource?: string;
  utmCampaign?: string;
  utmMedium?: string;
  utmTerm?: string;
  sales: number;
  cpa: number;
  spend: number;
  revenue: number;
  profit: number;
  roas: number;
  margin: number;
  roi?: number;
  addToCart?: number;
  cpi?: number;
  cpc?: number;
  ctr?: number;
  cpm?: number;
  impressions?: number;
  clicks?: number;
  registrations?: number;
  costPerRegistration?: number;
  pageViews?: number;
  cpv?: number;
  hookRate?: number;
  holdRate?: number;
  retention75?: number;
  checkoutConversion?: number;
  icRate?: number;
  connectionRate?: number;
  arpu?: number;
  grossRevenue?: number;
  pendingSales?: number;
  refundedSales?: number;
  chargeback?: number;
}

export interface Creative {
  id: string;
  name: string;
  status: 'active' | 'paused' | 'rejected' | 'under_review' | 'no_data';
  creative: string;
  spend: number;
  impressions: number;
  clicks: number;
  cpc: number;
  cpm: number;
  conversions: number;
  cpa: number;
  checkouts: number;
  cost_per_checkout: number;
  profit: number;
  revenue: number;
  landing_views: number;
  cic: number;
  ctr: number;
  play_rate: number;
  hook_rate: number;
  body_rate: number;
  completion_rate: number;
  video_plays: number;
  video_views: number;
  video_25: number;
  video_50: number;
  video_75: number;
  video_100: number;
  pixel_purchase: number;
  roas: number;
  avg_watch_time: number;
  landing_rate: number;
  checkout_rate: number;
  quality_ranking: string;
  creative_conversion_rate: number;
  last_updated: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  meta?: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface McpTool {
  name: string;
  description?: string;
  inputSchema?: any;
}

export interface Campaign {
  id: string;
  name: string;
  status: string;
  budget: number;
  spend: number;
  impressions: number;
  clicks: number;
  revenue: number;
  profit: number;
  roas: number;
  cpa: number;
  ctr: number;
  sales: number;
}

export interface AdSet {
  id: string;
  name: string;
  campaignId: string;
  campaignName: string;
  status: string;
  spend: number;
  revenue: number;
  profit: number;
  roas: number;
  impressions: number;
  clicks: number;
  ctr: number;
  sales: number;
}

export interface TrafficChannel {
  id: string;
  name: string;
  platform: string;
}

export interface AdCreative {
  id: string;
  name: string;
  campaignId: string;
  campaignName: string;
  adSetId: string;
  status: 'active' | 'paused' | 'rejected' | 'under_review' | 'no_data';
  creative: string;
  startDate: string;
  spend: number;
  impressions: number;
  clicks: number;
  cpc: number;
  cpm: number;
  conversions: number;
  cpa: number;
  checkouts: number;
  cost_per_checkout: number;
  profit: number;
  revenue: number;
  landing_views: number;
  cic: number;
  ctr: number;
  play_rate: number;
  hook_rate: number;
  body_rate: number;
  completion_rate: number;
  video_plays: number;
  video_views: number;
  video_25: number;
  video_50: number;
  video_75: number;
  video_100: number;
  pixel_purchase: number;
  roas: number;
  avg_watch_time: number;
  landing_rate: number;
  checkout_rate: number;
  quality_ranking: string;
  creative_conversion_rate: number;
  last_updated: string;
}

export interface AdAccount {
  id: string;
  name: string;
  platform: string;
}