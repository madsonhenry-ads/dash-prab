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

export type Period = 'today' | 'yesterday' | 'last_7' | 'last_30' | 'custom';