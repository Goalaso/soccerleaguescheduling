import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiDelete, apiPatch } from '../api/client';

export function usePublishedTeams(seasonId) {
  const queryClient = useQueryClient();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['publishedTeams', seasonId],
    queryFn: () => apiGet(`/teams/published?seasonId=${seasonId}`),
    enabled: !!seasonId,
  });

  const applyTeamsUpdate = (result) => {
    queryClient.setQueryData(['publishedTeams', seasonId], result);
  };

  const publishMutation = useMutation({
    mutationFn: (nextTeams) => apiPost('/teams/publish', { seasonId, teams: nextTeams }),
    onSuccess: (result) => {
      applyTeamsUpdate(result);
      // Publishing flips the season's status, which the seasons list/detail
      // and the season selector's browsable list both need to reflect.
      queryClient.invalidateQueries({ queryKey: ['seasons'] });
      queryClient.invalidateQueries({ queryKey: ['season', seasonId] });
      queryClient.invalidateQueries({ queryKey: ['matches', seasonId] });
    },
  });

  // Season-long roster changes (permanent, unlike a single-match loan) —
  // each returns the full refreshed team list, same shape as publish.
  const addPlayerMutation = useMutation({
    mutationFn: ({ teamId, playerId }) => apiPost(`/teams/${teamId}/players`, { playerId }),
    onSuccess: applyTeamsUpdate,
  });
  const removePlayerMutation = useMutation({
    mutationFn: ({ teamId, playerId }) => apiDelete(`/teams/${teamId}/players/${playerId}`),
    onSuccess: applyTeamsUpdate,
  });
  const movePlayerMutation = useMutation({
    mutationFn: ({ teamId, playerId, toTeamId }) =>
      apiPost(`/teams/${teamId}/players/${playerId}/move`, { toTeamId }),
    onSuccess: applyTeamsUpdate,
  });
  const setCaptainMutation = useMutation({
    mutationFn: ({ teamId, playerId }) => apiPatch(`/teams/${teamId}/captain`, { playerId }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['publishedTeams', seasonId] }),
  });

  // Applies several staged move/remove/add operations (plus an optional
  // captain change) in one request instead of one round trip per click.
  const batchEditMutation = useMutation({
    mutationFn: ({ operations, captainPlayerId, captainTeamId }) =>
      apiPost('/teams/roster/batch', { seasonId, operations, captainPlayerId, captainTeamId }),
    onSuccess: applyTeamsUpdate,
  });

  const publish = (nextTeams) => publishMutation.mutateAsync(nextTeams);
  const addSeasonPlayer = (teamId, playerId) => addPlayerMutation.mutateAsync({ teamId, playerId });
  const removeSeasonPlayer = (teamId, playerId) => removePlayerMutation.mutateAsync({ teamId, playerId });
  const moveSeasonPlayer = (teamId, playerId, toTeamId) =>
    movePlayerMutation.mutateAsync({ teamId, playerId, toTeamId });
  const setCaptain = (teamId, playerId) => setCaptainMutation.mutateAsync({ teamId, playerId });
  const batchEditRoster = ({ operations, captainPlayerId, captainTeamId }) =>
    batchEditMutation.mutateAsync({ operations, captainPlayerId, captainTeamId });

  return {
    teams: data?.teams ?? null,
    options: data?.options ?? null,
    loading: isLoading,
    error,
    publish,
    refetch,
    addSeasonPlayer,
    removeSeasonPlayer,
    moveSeasonPlayer,
    setCaptain,
    batchEditRoster,
  };
}
