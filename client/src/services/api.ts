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
    simplified: (p?: Record<string, string>) => request<{ data: import('../types').SimplifiedDashboard }>(`/dashboard/simplified?${new URLSearchParams({ timezone: localStorage.getItem('trafficboard_timezone') || 'UTC', ...p }).toString()}`),
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
    list: (p?: Record<string, string>) => request<{ data: import('../types').AdCreative[]; meta: import('../types').MetaData; footer: any; source: string }>(`/creatives?${new URLSearchParams({ timezone: localStorage.getItem('trafficboard_timezone') || 'UTC', ...p }).toString()}`),
    export: async (p?: Record<string, string>) => {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/creatives/export?${new URLSearchParams({ timezone: localStorage.getItem('trafficboard_timezone') || 'UTC', ...p }).toString()}`, {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      if (res.status === 401) { localStorage.removeItem('token'); window.location.href = '/login'; throw new Error('Sessão expirada'); }
      if (!res.ok) throw new Error(`Erro ${res.status}`);
      return res.blob();
    },
  },
  tools: {
    list: (period?: string) => {
      const params = period ? `?period=${period}` : '';
      return request<{ data: import('../types').ToolsSummary }>(`/tools${params}`);
    },
    create: (expense: { name: string; value: number; date: string; type: string; recurringDay?: number; notes?: string }) =>
      request<{ data: import('../types').ToolExpense }>('/tools', { method: 'POST', body: JSON.stringify(expense) }),
    delete: (id: string) => request<void>(`/tools/${id}`, { method: 'DELETE' }),
  },
  tasks: {
    list: () => request<{ data: import('../types').TaskItem[] }>('/tasks'),
    create: (task: { title: string; description?: string; status?: string; priority?: string; assignee?: string; dueDate?: string }) =>
      request<{ data: import('../types').TaskItem }>('/tasks', { method: 'POST', body: JSON.stringify(task) }),
    update: (id: string, task: { title?: string; description?: string; status?: string; priority?: string; assignee?: string; dueDate?: string }) =>
      request<{ data: import('../types').TaskItem }>(`/tasks/${id}`, { method: 'PUT', body: JSON.stringify(task) }),
    delete: (id: string) => request<void>(`/tasks/${id}`, { method: 'DELETE' }),
  },
  filters: {
    adAccounts: () => request<{ data: import('../types').AdAccount[] }>('/filters/ad-accounts'),
    products: () => request<{ data: import('../types').Product[] }>('/filters/products'),
    trafficChannels: () => request<{ data: import('../types').TrafficChannel[] }>('/filters/traffic-channels'),
  },
  mcp: { status: () => request<{ data: import('../types').McpStatus }>('/mcp/status') },
  cache: { invalidate: (key?: string) => request('/cache/invalidate', { method: 'POST', body: JSON.stringify({ key }) }) },
};