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

// Simplified Dashboard — mirrors EasyTracker's /api/simplified-dashboard payload
export interface SimplifiedSummaryItem {
  title: string;
  key: string;
  value: number;
  previousValue?: number;
}

export interface SimplifiedSpend {
  total_spent: number;
  total_clicks: number;
  by_provider: { provider: string; total_spent: number }[];
  accounts: { account_id: string; name: string; provider: string; total_spent: number }[];
}

export interface SimplifiedFunnel {
  clicks: number;
  landing_views: number;
  checkouts_initiated: number;
  purchases: number;
  landing_view_rate: number;
  checkout_rate: number;
  purchase_rate: number;
  ad_clicks: number;
}

export interface SimplifiedDailyItem {
  date: string;
  total_revenue: number;
  purchases: number;
  leads: number;
}

export interface SimplifiedProduct {
  product_name: string;
  total_revenue: string;
  purchases: number;
}

export interface SimplifiedCurrency {
  name: string;
  count: number;
  total_revenue: string;
}

export interface SimplifiedAudience {
  deviceTypes: { name: string; count: number }[];
  browsers: { name: string; count: number }[];
}

export interface SimplifiedHeatmapItem {
  day_of_week: number;
  hour: number;
  count: number;
  total_revenue: string;
}

export interface SimplifiedDashboard {
  summary: SimplifiedSummaryItem[];
  spend: SimplifiedSpend;
  funnel: SimplifiedFunnel;
  dailySeries: SimplifiedDailyItem[];
  topProducts: SimplifiedProduct[];
  topCurrencies: SimplifiedCurrency[];
  audience: SimplifiedAudience;
  heatmap: SimplifiedHeatmapItem[];
  meta: { currency: string; timezone: string; beginDate: string; endDate: string };
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

export type Timezone = 'UTC' | 'Europe/London' | 'America/Sao_Paulo';

export interface AdCreative {
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

export interface TrafficChannel {
  id: string;
  name: string;
  platform: string;
}

export interface AdAccount {
  id: string;
  name: string;
  platform: string;
}

export interface Product {
  id: string;
  name: string;
  price: number;
}

export interface MetaData {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  meta?: MetaData;
  footer?: any;
}

export interface McpStatus {
  connected: boolean;
  toolCount: number;
  tools: string[];
  mode: 'mock' | 'real';
}

export interface HealthStatus {
  status: string;
  version: string;
  mcpConnected: boolean;
  mcpMode: string;
  uptime: number;
}

export type Period = 'today' | 'yesterday' | 'last_7' | 'last_30' | 'this_month' | 'custom';

export type TaskStatus = 'todo' | 'in_progress' | 'review' | 'done';
export type TaskPriority = 'low' | 'medium' | 'high';

export interface TaskItem {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  assignee: string;
  dueDate: string;
  createdAt: string;
}

export interface ToolExpense {
  id: string;
  name: string;
  value: number;
  date: string;
  type: 'occasional' | 'recurring';
  recurringDay?: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ToolsSummary {
  total: number;
  daily: number;
  weekly: number;
  monthly: number;
  entries: ToolExpense[];
}