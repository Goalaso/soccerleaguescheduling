import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPatch } from '../api/client';

export function usePendingActions() {
  const queryClient = useQueryClient();
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['pendingActions'],
    // A failed fetch (e.g. not authenticated) just means no pending items
    // to show, not an error state — matches the original hook's behavior.
    queryFn: () => apiGet('/me/pending-actions').then((d) => d.actions).catch(() => []),
  });

  const respondMutation = useMutation({
    mutationFn: ({ seasonId, isAvailable }) =>
      apiPatch(`/seasons/${seasonId}/availability/me`, { isAvailable }),
    onSuccess: (_result, { seasonId }) => {
      queryClient.setQueryData(['pendingActions'], (prev) =>
        (prev || []).filter((a) => !(a.type === 'season_availability' && a.seasonId === seasonId))
      );
      queryClient.invalidateQueries({ queryKey: ['seasonAvailability', seasonId] });
    },
  });

  const respondToSeasonAvailability = (seasonId, isAvailable) =>
    respondMutation.mutateAsync({ seasonId, isAvailable });

  return { actions: data || [], loading: isLoading, refetch, respondToSeasonAvailability };
}
