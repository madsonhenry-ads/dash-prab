import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import toast from 'react-hot-toast';

interface SyncStatus {
  postgresConnected: boolean;
  lastSync: { finished_at: string; status: string; total_leads: number; total_purchases: number } | null;
}

interface SyncResult {
  success: boolean;
  creatives: number;
  campaigns: number;
  offers: number;
  channels: number;
  errors: string[];
  duration: number;
}

export function useSyncStatus() {
  return useQuery({
    queryKey: ['sync', 'status'],
    queryFn: () => api.request<{ data: SyncStatus }>('/sync/status'),
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });
}

export function useSync() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => api.request<{ data: SyncResult }>('/sync/run', { method: 'POST' }),
    onSuccess: (result) => {
      if (result.data.success) {
        toast.success(`Sync completed: ${result.data.creatives} creatives, ${result.data.campaigns} campaigns in ${(result.data.duration / 1000).toFixed(1)}s`);
      } else {
        toast.error(`Sync completed with ${result.data.errors.length} errors`);
      }
      queryClient.invalidateQueries({ queryKey: ['sync', 'status'] });
      // Invalidate all data queries so they refetch from fresh cache
      queryClient.invalidateQueries({ queryKey: ['creatives'] });
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (err: any) => {
      toast.error(`Sync failed: ${err.message}`);
    },
  });
}