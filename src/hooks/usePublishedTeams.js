import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost } from '../api/client';

export function usePublishedTeams(seasonId) {
  const queryClient = useQueryClient();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['publishedTeams', seasonId],
    queryFn: () => apiGet(`/teams/published?seasonId=${seasonId}`),
    enabled: !!seasonId,
  });

  const publishMutation = useMutation({
    mutationFn: (nextTeams) => apiPost('/teams/publish', { seasonId, teams: nextTeams }),
    onSuccess: (result) => {
      queryClient.setQueryData(['publishedTeams', seasonId], result);
      // Publishing flips the season's status, which the seasons list/detail
      // and the season selector's browsable list both need to reflect.
      queryClient.invalidateQueries({ queryKey: ['seasons'] });
      queryClient.invalidateQueries({ queryKey: ['season', seasonId] });
      queryClient.invalidateQueries({ queryKey: ['matches', seasonId] });
    },
  });

  const publish = (nextTeams) => publishMutation.mutateAsync(nextTeams);

  return {
    teams: data?.teams ?? null,
    options: data?.options ?? null,
    loading: isLoading,
    error,
    publish,
    refetch,
  };
}
