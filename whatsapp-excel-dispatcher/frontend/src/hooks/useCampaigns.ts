import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from '../services/api';

export function useCampaigns(page = 1, status?: string) {
  return useQuery({
    queryKey: ['campaigns', page, status],
    queryFn: () => api.listCampaigns(page, 20, status),
    refetchInterval: 10000, // Poll every 10 seconds
  });
}

export function useCampaign(id: string) {
  return useQuery({
    queryKey: ['campaign', id],
    queryFn: () => api.getCampaign(id),
    enabled: !!id,
    refetchInterval: 10000,
  });
}

export function useRecipients(campaignId: string, page = 1, status?: string) {
  return useQuery({
    queryKey: ['recipients', campaignId, page, status],
    queryFn: () => api.listRecipients(campaignId, page, 50, status),
    enabled: !!campaignId,
    refetchInterval: 10000,
  });
}

export function useStartCampaign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.startCampaign(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['campaign'] });
    },
  });
}

export function useCancelCampaign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.cancelCampaign(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['campaign'] });
    },
  });
}

export function useRetryRecipient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ campaignId, recipientId }: { campaignId: string; recipientId: string }) =>
      api.retryRecipient(campaignId, recipientId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipients'] });
      queryClient.invalidateQueries({ queryKey: ['campaign'] });
    },
  });
}
