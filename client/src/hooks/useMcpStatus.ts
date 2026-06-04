import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';

export function useMcpStatus() {
  return useQuery({
    queryKey: ['mcp', 'status'],
    queryFn: () => api.mcp.status(),
    staleTime: 60000,
    refetchInterval: 60000,
  });
}