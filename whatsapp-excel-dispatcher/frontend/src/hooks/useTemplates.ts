import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from '../services/api';
import type { ManualCampaignInput, ManualRecipientInput, TemplateInput } from '../types';

export function useTemplates() {
  return useQuery({
    queryKey: ['templates'],
    queryFn: () => api.listTemplates(),
  });
}

export function useTemplatePresets() {
  return useQuery({
    queryKey: ['template-presets'],
    queryFn: () => api.getTemplatePresets(),
    staleTime: Infinity, // Built-in list, never changes at runtime
  });
}

export function useCreateTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: TemplateInput & { presetKey?: string }) => api.createTemplate(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
    },
  });
}

export function useUpdateTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<TemplateInput> }) =>
      api.updateTemplate(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
    },
  });
}

export function useDeleteTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteTemplate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
    },
  });
}

export function useCreateManualCampaign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ManualCampaignInput) => api.createManualCampaign(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['templates'] });
    },
  });
}

export function useAddRecipients() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      campaignId,
      recipients,
      scheduledAt,
      sendNow,
    }: {
      campaignId: string;
      recipients: ManualRecipientInput[];
      scheduledAt?: string;
      sendNow?: boolean;
    }) => api.addRecipients(campaignId, { recipients, scheduledAt, sendNow }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipients'] });
      queryClient.invalidateQueries({ queryKey: ['campaign'] });
    },
  });
}

export function useRemoveRecipient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ campaignId, recipientId }: { campaignId: string; recipientId: string }) =>
      api.removeRecipient(campaignId, recipientId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipients'] });
      queryClient.invalidateQueries({ queryKey: ['campaign'] });
    },
  });
}
