import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';

interface CampaignsParams {
  period: string;
  page: number;
  pageSize: number;
  search?: string;
  status?: string;
  campaignId?: string;
  sortBy?: string;
  sortOrder?: string;
}

export function useCampaigns(params: CampaignsParams) {
  return useQuery({ queryKey: ['campaigns', params], queryFn: () => api.campaigns.list(params as any), staleTime: 5 * 60 * 1000 });
}

export function useAdSets(params: CampaignsParams) {
  return useQuery({ queryKey: ['adSets', params], queryFn: () => api.campaigns.adSets(params as any), staleTime: 5 * 60 * 1000 });
}

export function useAds(params: CampaignsParams) {
  return useQuery({ queryKey: ['ads', params], queryFn: () => api.campaigns.ads(params as any), staleTime: 5 * 60 * 1000 });
}