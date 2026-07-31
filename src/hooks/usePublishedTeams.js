import { useCallback, useEffect, useState } from 'react';
import { apiGet, apiPost } from '../api/client';

export function usePublishedTeams(seasonId) {
  const [teams, setTeams] = useState(null);
  const [options, setOptions] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refetch = useCallback(() => {
    if (!seasonId) {
      setTeams(null);
      setOptions(null);
      setLoading(false);
      return Promise.resolve();
    }
    setLoading(true);
    return apiGet(`/teams/published?seasonId=${seasonId}`)
      .then((data) => {
        setTeams(data.teams);
        setOptions(data.options);
        setError(null);
      })
      .catch((err) => setError(err))
      .finally(() => setLoading(false));
  }, [seasonId]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const publish = useCallback(
    async (nextTeams) => {
      const data = await apiPost('/teams/publish', { seasonId, teams: nextTeams });
      setTeams(data.teams);
      setOptions(data.options);
      return data;
    },
    [seasonId]
  );

  return { teams, options, loading, error, publish, refetch };
}
