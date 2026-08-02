import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost } from '../api/client';

export function useMatch(matchId) {
  const queryClient = useQueryClient();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['match', matchId],
    queryFn: () => apiGet(`/matches/${matchId}`),
    enabled: !!matchId,
  });

  const submitMutation = useMutation({
    mutationFn: (payload) => apiPost(`/matches/${matchId}/results`, payload),
    onSuccess: (updated) => {
      queryClient.setQueryData(['match', matchId], (prev) => ({ ...prev, ...updated }));
      // Recording a result changes standings/schedule for every season's
      // match list, not just this one match.
      queryClient.invalidateQueries({ queryKey: ['matches'] });
    },
  });

  const submitResults = (payload) => submitMutation.mutateAsync(payload);

  return { match: data ?? null, loading: isLoading, error, refetch, submitResults };
}
