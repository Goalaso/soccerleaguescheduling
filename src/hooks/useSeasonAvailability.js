import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPatch, apiPost } from '../api/client';

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

  // Applies several players' availability changes in one request instead
  // of one round trip per checkbox click.
  const setAvailabilityBatchMutation = useMutation({
    mutationFn: (changes) => apiPatch(`/seasons/${seasonId}/availability`, { changes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['seasonAvailability', seasonId] });
    },
  });

  // Adds a player who has no availability row for this season at all yet
  // (e.g. joined the league after the season already started) — distinct
  // from setAvailability above, which only ever toggles an existing row.
  const addToSeasonMutation = useMutation({
    mutationFn: (playerId) => apiPost(`/seasons/${seasonId}/availability`, { playerId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['seasonAvailability', seasonId] });
    },
  });

  const setAvailability = (playerId, isAvailable) =>
    setAvailabilityMutation.mutateAsync({ playerId, isAvailable });
  const setAvailabilityBatch = (changes) => setAvailabilityBatchMutation.mutateAsync(changes);
  const addToSeason = (playerId) => addToSeasonMutation.mutateAsync(playerId);

  return {
    players: data || [],
    loading: isLoading,
    error,
    refetch,
    setAvailability,
    setAvailabilityBatch,
    addToSeason,
  };
}
