import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPatch } from '../api/client';

// Admin-facing availability review list for a season.
export function useSeasonAvailability(seasonId) {
  const queryClient = useQueryClient();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['seasonAvailability', seasonId],
    queryFn: () => apiGet(`/seasons/${seasonId}/availability`),
    enabled: !!seasonId,
  });

  const setAvailabilityMutation = useMutation({
    mutationFn: ({ playerId, isAvailable }) =>
      apiPatch(`/seasons/${seasonId}/availability/${playerId}`, { isAvailable }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['seasonAvailability', seasonId] });
    },
  });

  const setAvailability = (playerId, isAvailable) =>
    setAvailabilityMutation.mutateAsync({ playerId, isAvailable });

  return { players: data || [], loading: isLoading, error, refetch, setAvailability };
}
