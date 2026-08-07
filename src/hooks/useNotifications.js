import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPatch, apiDelete } from '../api/client';

export function useNotifications({ includeRead = false } = {}) {
  const queryClient = useQueryClient();
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['notifications', includeRead],
    // Not authenticated (or any other failure) just means nothing to show,
    // not an error state — matches how the homepage should degrade.
    queryFn: () => apiGet(includeRead ? '/notifications?all=true' : '/notifications').catch(() => []),
  });

  // Partial key match — invalidates both the unread-only (homepage) and
  // include-read (history page) cache entries, whichever is mounted.
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['notifications'] });

  const markReadMutation = useMutation({
    mutationFn: (id) => apiPatch(`/notifications/${id}`, { isRead: true }),
    onSuccess: invalidate,
  });
  const removeMutation = useMutation({
    mutationFn: (id) => apiDelete(`/notifications/${id}`),
    onSuccess: invalidate,
  });
  // The season_availability_request type resolves inline in the panel via
  // the existing self-service endpoint, which already marks the
  // notification read server-side — this mutation just needs to refresh
  // the list (and the admin availability-review list, in case that's open
  // in another tab) afterward.
  const respondSeasonMutation = useMutation({
    mutationFn: ({ seasonId, isAvailable }) =>
      apiPatch(`/seasons/${seasonId}/availability/me`, { isAvailable }),
    onSuccess: (_result, { seasonId }) => {
      invalidate();
      queryClient.invalidateQueries({ queryKey: ['seasonAvailability', seasonId] });
    },
  });

  const markRead = (id) => markReadMutation.mutateAsync(id);
  const remove = (id) => removeMutation.mutateAsync(id);
  const respondToSeasonAvailability = (seasonId, isAvailable) =>
    respondSeasonMutation.mutateAsync({ seasonId, isAvailable });

  return {
    notifications: data || [],
    loading: isLoading,
    refetch,
    markRead,
    remove,
    respondToSeasonAvailability,
  };
}
