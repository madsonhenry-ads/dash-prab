import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';

interface CreativesParams {
  period: string;
  page: number;
  pageSize: number;
  status?: string;
  search?: string;
  product?: string;
  sortBy?: string;
  sortOrder?: string;
  channels?: string;
}

export function useCreatives(params: CreativesParams) {
  return useQuery({
    queryKey: ['creatives', params],
    queryFn: () => api.creatives.list(params as any),
    staleTime: 5 * 60 * 1000,
  });
}