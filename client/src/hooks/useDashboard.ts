import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import type { Period } from '../types';

function getParams(period: Period, extra?: { channels?: string[]; products?: string[]; beginDate?: string; endDate?: string }): Record<string, string> {
  const params: Record<string, string> = { period };
  if (extra?.channels?.length) params.channels = extra.channels.join(',');
  if (extra?.products?.length) params.products = extra.products.join(',');
  if (extra?.beginDate) params.beginDate = extra.beginDate;
  if (extra?.endDate) params.endDate = extra.endDate;
  return params;
}

export function useDashboardKpis(period: Period, account: string, channels?: string[], products?: string[], dates?: { beginDate?: string; endDate?: string }) {
  const params = getParams(period, { channels, products, beginDate: dates?.beginDate, endDate: dates?.endDate });
  params.account = account;
  return useQuery({ queryKey: ['dashboard', 'kpis', period, account, channels, products, dates?.beginDate, dates?.endDate], queryFn: () => api.dashboard.kpis(params), staleTime: 5 * 60 * 1000 });
}
export function useDashboardFunnel(period: Period, channels?: string[], dates?: { beginDate?: string; endDate?: string }) {
  const params = getParams(period, { channels, beginDate: dates?.beginDate, endDate: dates?.endDate });
  return useQuery({ queryKey: ['dashboard', 'funnel', period, channels, dates?.beginDate, dates?.endDate], queryFn: () => api.dashboard.funnel(params), staleTime: 5 * 60 * 1000 });
}
export function useSalesByHour(period: Period, channels?: string[], dates?: { beginDate?: string; endDate?: string }) {
  const params = getParams(period, { channels, beginDate: dates?.beginDate, endDate: dates?.endDate });
  return useQuery({ queryKey: ['dashboard', 'salesByHour', period, channels, dates?.beginDate, dates?.endDate], queryFn: () => api.dashboard.salesByHour(params), staleTime: 5 * 60 * 1000 });
}
export function useSalesByDay(period: Period, channels?: string[], dates?: { beginDate?: string; endDate?: string }) {
  const params = getParams(period, { channels, beginDate: dates?.beginDate, endDate: dates?.endDate });
  return useQuery({ queryKey: ['dashboard', 'salesByDay', period, channels, dates?.beginDate, dates?.endDate], queryFn: () => api.dashboard.salesByDay(params), staleTime: 5 * 60 * 1000 });
}
export function useSalesByCountry(period: Period, channels?: string[], dates?: { beginDate?: string; endDate?: string }) {
  const params = getParams(period, { channels, beginDate: dates?.beginDate, endDate: dates?.endDate });
  return useQuery({ queryKey: ['dashboard', 'salesByCountry', period, channels, dates?.beginDate, dates?.endDate], queryFn: () => api.dashboard.salesByCountry(params), staleTime: 5 * 60 * 1000 });
}
export function useSalesByPayment(period: Period, channels?: string[], dates?: { beginDate?: string; endDate?: string }) {
  const params = getParams(period, { channels, beginDate: dates?.beginDate, endDate: dates?.endDate });
  return useQuery({ queryKey: ['dashboard', 'salesByPayment', period, channels, dates?.beginDate, dates?.endDate], queryFn: () => api.dashboard.salesByPayment(params), staleTime: 5 * 60 * 1000 });
}
export function useTopCampaigns(period: Period, channels?: string[], dates?: { beginDate?: string; endDate?: string }) {
  const params = getParams(period, { channels, beginDate: dates?.beginDate, endDate: dates?.endDate });
  return useQuery({ queryKey: ['dashboard', 'topCampaigns', period, channels, dates?.beginDate, dates?.endDate], queryFn: () => api.dashboard.topCampaigns(params), staleTime: 5 * 60 * 1000 });
}