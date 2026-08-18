import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiDelete } from '../api/client';

export function useMatch(matchId) {
  const queryClient = useQueryClient();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['match', matchId],
    queryFn: () => apiGet(`/matches/${matchId}`),
    enabled: !!matchId,
  });

  const applyRosterUpdate = (updated) => {
    queryClient.setQueryData(['match', matchId], (prev) => ({ ...prev, ...updated }));
    // Recording a result (or editing who played) changes standings/schedule
    // for every season's match list, not just this one match.
    queryClient.invalidateQueries({ queryKey: ['matches'] });
    // A borrow/return can also silently touch a DIFFERENT match's roster —
    // the borrowed player's own team's match this same round gets cleared
    // or restored server-side (see addRosterEntry/removeRosterEntry). That
    // other match has its own separate ['match', otherId] cache entry that
    // this request never told about the change, so invalidate every
    // single-match entry rather than just this one — otherwise navigating
    // to that other match shows its stale, pre-borrow roster until a hard
    // refresh bypasses the cache entirely.
    queryClient.invalidateQueries({ queryKey: ['match'] });
  };

  const submitMutation = useMutation({
    mutationFn: (payload) => apiPost(`/matches/${matchId}/results`, payload),
    onSuccess: applyRosterUpdate,
  });

  const addRosterMutation = useMutation({
    mutationFn: ({ playerId, teamId, source }) =>
      apiPost(`/matches/${matchId}/roster`, { playerId, teamId, source }),
    onSuccess: applyRosterUpdate,
  });

  const removeRosterMutation = useMutation({
    mutationFn: ({ playerId, teamId }) =>
      apiDelete(`/matches/${matchId}/roster/${playerId}?teamId=${teamId}`),
    onSuccess: applyRosterUpdate,
  });

  // Captain-reported proposal — never writes the official result itself,
  // just lands in match.scoreSubmissions for the admin to review/prefill from.
  const submitCaptainScoreMutation = useMutation({
    mutationFn: (payload) => apiPost(`/matches/${matchId}/submit-score`, payload),
    onSuccess: applyRosterUpdate,
  });

  const submitResults = (payload) => submitMutation.mutateAsync(payload);
  const addToRoster = (playerId, teamId, source) => addRosterMutation.mutateAsync({ playerId, teamId, source });
  const removeFromRoster = (playerId, teamId) => removeRosterMutation.mutateAsync({ playerId, teamId });
  const submitCaptainScore = (payload) => submitCaptainScoreMutation.mutateAsync(payload);

  return {
    match: data ?? null,
    loading: isLoading,
    error,
    refetch,
    submitResults,
    addToRoster,
    removeFromRoster,
    submitCaptainScore,
  };
}
