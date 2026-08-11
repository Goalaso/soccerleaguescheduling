import { useQuery } from '@tanstack/react-query';
import { apiGet } from '../api/client';

// Games-played per player for a season, from match_rosters — goals are
// already available client-side via buildSeasonFromMatches, this only adds
// the one number that doesn't exist anywhere else on the client.
export function useTeamStats(seasonId) {
  const { data, isLoading } = useQuery({
    queryKey: ['teamStats', seasonId],
    queryFn: () => apiGet(`/teams/stats?seasonId=${seasonId}`),
    enabled: !!seasonId,
  });

  const gamesPlayedByPlayer = (data || []).reduce((acc, row) => {
    acc[row.playerId] = row.gamesPlayed;
    return acc;
  }, {});

  return { gamesPlayedByPlayer, loading: isLoading };
}
