import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPatch } from '../api/client';

// Admin-only review queue for waitlist_entries — pending only by default,
// same convention as useNotifications (?all=true for full history).
// `enabled` lets non-admin-gated call sites (e.g. HomePage, visible to every
// role) skip the request entirely rather than firing a request that 403s.
export function useWaitlist({ includeReviewed = false, enabled = true } = {}) {
  const queryClient = useQueryClient();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['waitlist', includeReviewed],
    queryFn: () => apiGet(includeReviewed ? '/waitlist?all=true' : '/waitlist'),
    enabled,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['waitlist'] });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }) => apiPatch(`/waitlist/${id}`, { status }),
    onSuccess: invalidate,
  });

  const approve = (id) => updateStatusMutation.mutateAsync({ id, status: 'approved' });
  const dismiss = (id) => updateStatusMutation.mutateAsync({ id, status: 'dismissed' });

  return { entries: data || [], loading: isLoading, error, refetch, approve, dismiss };
}
