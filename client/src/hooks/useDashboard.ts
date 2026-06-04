import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import type { Period } from '../types';

export function useDashboardKpis(period: Period, account: string) {
  return useQuery({ queryKey: ['dashboard', 'kpis', period, account], queryFn: () => api.dashboard.kpis({ period, account }), staleTime: 5 * 60 * 1000 });
}
export function useDashboardFunnel(period: Period) {
  return useQuery({ queryKey: ['dashboard', 'funnel', period], queryFn: () => api.dashboard.funnel({ period }), staleTime: 5 * 60 * 1000 });
}
export function useSalesByHour(period: Period) {
  return useQuery({ queryKey: ['dashboard', 'salesByHour', period], queryFn: () => api.dashboard.salesByHour({ period }), staleTime: 5 * 60 * 1000 });
}
export function useSalesByDay(period: Period) {
  return useQuery({ queryKey: ['dashboard', 'salesByDay', period], queryFn: () => api.dashboard.salesByDay({ period }), staleTime: 5 * 60 * 1000 });
}
export function useSalesByCountry(period: Period) {
  return useQuery({ queryKey: ['dashboard', 'salesByCountry', period], queryFn: () => api.dashboard.salesByCountry({ period }), staleTime: 5 * 60 * 1000 });
}
export function useSalesByPayment(period: Period) {
  return useQuery({ queryKey: ['dashboard', 'salesByPayment', period], queryFn: () => api.dashboard.salesByPayment({ period }), staleTime: 5 * 60 * 1000 });
}
export function useTopCampaigns(period: Period) {
  return useQuery({ queryKey: ['dashboard', 'topCampaigns', period], queryFn: () => api.dashboard.topCampaigns({ period }), staleTime: 5 * 60 * 1000 });
}