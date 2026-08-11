import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiDelete } from '../api/client';

// List of seasons, optionally scoped to one league — used by the season
// dropdown and the SeasonsPage list. Different leagueId values (including
// unscoped/null) get independent cache entries, so they can never clobber
// each other's cached data.
export function useSeasons(leagueId) {
  const queryClient = useQueryClient();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['seasons', leagueId ?? null],
    queryFn: () => apiGet(leagueId ? `/seasons?leagueId=${leagueId}` : '/seasons'),
  });

  const createMutation = useMutation({
    mutationFn: (payload) => apiPost('/seasons', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['seasons'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: ({ id, currentPassword }) => apiDelete(`/seasons/${id}`, { currentPassword }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['seasons'] });
    },
  });

  const createSeason = (payload) => createMutation.mutateAsync(payload);
  const deleteSeason = (id, currentPassword) => deleteMutation.mutateAsync({ id, currentPassword });

  return { seasons: data || [], loading: isLoading, error, refetch, createSeason, deleteSeason };
}
