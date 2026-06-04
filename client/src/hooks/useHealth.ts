import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';

export function useHealth() {
  return useQuery({
    queryKey: ['health'],
    queryFn: () => api.health.get(),
    staleTime: 30000,
    refetchInterval: 30000,
  });
}