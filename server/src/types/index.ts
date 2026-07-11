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
  spend: number;
  cpa: number;
  roas: number;
  impressions: number;
  reach: number;
  frequency: number;
  clicks: number;
  clicks_all: number;
  ctr: number;
  cpc: number;
  cpc_all: number;
  cpm: number;
  landing_views: number;
  cic: number;
  landing_clicks: number;
  cost_per_checkout: number;
  checkout_rate: number;
  pixel_purchase: number;
  revenue: number;
  sales: number;
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
  landing_rate: number;
  avg_watch_time: number;
  start_date: string;
  updated_time: string;
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
  startDate: string;
  spend: number;
  revenue: number;
  profit: number;
  roas: number;
  cpa: number;
  cpc: number;
  ctr: number;
  hookRate: number;
  holdRate: number;
  sales: number;
  addToCart: number;
  impressions: number;
  clicks: number;
  bounce_rate: number;
  landing_views: number;
  landing_clicks: number;
  avg_ticket: number;
  cic: number;
  // Novas métricas do ads-manager
  reach: number;
  frequency: number;
  clicks_all: number;
  cpc_all: number;
  cpm: number;
  video_plays: number;
  video_views: number;
  video_25: number;
  video_50: number;
  video_75: number;
  video_100: number;
  avg_watch_time: number;
  pixel_purchase: number;
  play_rate: number;
  body_rate: number;
  completion_rate: number;
  landing_rate: number;
  checkout_rate: number;
  cost_per_checkout: number;
  last_updated: string;
}

export interface AdAccount {
  id: string;
  name: string;
  platform: string;
}