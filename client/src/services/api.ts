const API_BASE = '/api';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem('token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  const res = await fetch(`${API_BASE}${url}`, { ...options, headers });
  if (res.status === 401) {
    localStorage.removeItem('token');
    window.location.href = '/login';
    throw new Error('Sessão expirada');
  }
  const data = await res.json();
  if (!data.success) throw new Error(data.error || 'Erro desconhecido');
  return data;
}

export const api = {
  request: <T>(url: string, options?: RequestInit) => request<T>(url, options),
  auth: {
    login: (password: string) => request<{ data: { token: string; expiresIn: number } }>('/auth/login', { method: 'POST', body: JSON.stringify({ password }) }),
    check: () => request<{ data: { valid: boolean } }>('/auth/check'),
  },
  health: { get: () => request<{ data: import('../types').HealthStatus }>('/health') },
  dashboard: {
    kpis: (p?: Record<string, string>) => request<{ data: import('../types').DashboardKpis }>(`/dashboard/kpis?${new URLSearchParams({ timezone: localStorage.getItem('trafficboard_timezone') || 'UTC', ...p }).toString()}`),
    funnel: (p?: Record<string, string>) => request<{ data: import('../types').FunnelStep[] }>(`/dashboard/funnel?${new URLSearchParams({ timezone: localStorage.getItem('trafficboard_timezone') || 'UTC', ...p }).toString()}`),
    salesByHour: (p?: Record<string, string>) => request<{ data: import('../types').SalesByHour[] }>(`/dashboard/sales-by-hour?${new URLSearchParams({ timezone: localStorage.getItem('trafficboard_timezone') || 'UTC', ...p }).toString()}`),
    salesByDay: (p?: Record<string, string>) => request<{ data: import('../types').SalesByDay[] }>(`/dashboard/sales-by-day?${new URLSearchParams({ timezone: localStorage.getItem('trafficboard_timezone') || 'UTC', ...p }).toString()}`),
    salesByCountry: (p?: Record<string, string>) => request<{ data: import('../types').SalesByCountry[] }>(`/dashboard/sales-by-country?${new URLSearchParams({ timezone: localStorage.getItem('trafficboard_timezone') || 'UTC', ...p }).toString()}`),
    salesByPayment: (p?: Record<string, string>) => request<{ data: import('../types').SalesByPayment[] }>(`/dashboard/sales-by-payment?${new URLSearchParams({ timezone: localStorage.getItem('trafficboard_timezone') || 'UTC', ...p }).toString()}`),
    topCampaigns: (p?: Record<string, string>) => request<{ data: { name: string; spend: number; revenue: number; roas: number }[] }>(`/dashboard/top-campaigns?${new URLSearchParams({ timezone: localStorage.getItem('trafficboard_timezone') || 'UTC', ...p }).toString()}`),
    salesByChannel: (p?: Record<string, string>) => request<{ data: { id: string; name: string; spend: number; revenue: number; profit: number; sales: number; roas: number }[] }>(`/dashboard/sales-by-channel?${new URLSearchParams({ timezone: localStorage.getItem('trafficboard_timezone') || 'UTC', ...p }).toString()}`),
    salesByProduct: (p?: Record<string, string>) => request<{ data: { id: string; name: string; price: number; sales: number; revenue: number }[] }>(`/dashboard/sales-by-product?${new URLSearchParams({ timezone: localStorage.getItem('trafficboard_timezone') || 'UTC', ...p }).toString()}`),
  },
  campaigns: {
    list: (p?: Record<string, string>) => request<{ data: import('../types').Campaign[]; meta: import('../types').MetaData; footer: any }>(`/campaigns-report/campaigns?${new URLSearchParams({ timezone: localStorage.getItem('trafficboard_timezone') || 'UTC', ...p }).toString()}`),
    adSets: (p?: Record<string, string>) => request<{ data: import('../types').AdSet[]; meta: import('../types').MetaData; footer: any }>(`/campaigns-report/ad-sets?${new URLSearchParams({ timezone: localStorage.getItem('trafficboard_timezone') || 'UTC', ...p }).toString()}`),
    ads: (p?: Record<string, string>) => request<{ data: import('../types').AdCreative[]; meta: import('../types').MetaData; footer: any }>(`/campaigns-report/ads?${new URLSearchParams({ timezone: localStorage.getItem('trafficboard_timezone') || 'UTC', ...p }).toString()}`),
  },
  creatives: {
    list: (p?: Record<string, string>) => request<{ data: import('../types').AdCreative[]; meta: import('../types').MetaData; footer: any }>(`/creatives?${new URLSearchParams({ timezone: localStorage.getItem('trafficboard_timezone') || 'UTC', ...p }).toString()}`),
    export: (p?: Record<string, string>) => `${API_BASE}/creatives/export?${new URLSearchParams({ timezone: localStorage.getItem('trafficboard_timezone') || 'UTC', ...p }).toString()}`,
  },
  filters: {
    adAccounts: () => request<{ data: import('../types').AdAccount[] }>('/filters/ad-accounts'),
    products: () => request<{ data: import('../types').Product[] }>('/filters/products'),
    trafficChannels: () => request<{ data: import('../types').TrafficChannel[] }>('/filters/traffic-channels'),
  },
  mcp: { status: () => request<{ data: import('../types').McpStatus }>('/mcp/status') },
  cache: { invalidate: (key?: string) => request('/cache/invalidate', { method: 'POST', body: JSON.stringify({ key }) }) },
};