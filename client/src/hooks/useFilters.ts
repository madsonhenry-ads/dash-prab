import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';

export function useAdAccounts() {
  return useQuery({ queryKey: ['filters', 'adAccounts'], queryFn: () => api.filters.adAccounts(), staleTime: 30 * 60 * 1000 });
}
export function useProducts() {
  return useQuery({ queryKey: ['filters', 'products'], queryFn: () => api.filters.products(), staleTime: 30 * 60 * 1000 });
}
export function useTrafficChannels() {
  return useQuery({ queryKey: ['filters', 'trafficChannels'], queryFn: () => api.filters.trafficChannels(), staleTime: 30 * 60 * 1000 });
}