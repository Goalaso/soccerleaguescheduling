import { useCallback, useEffect, useState } from 'react';
import { apiGet, apiPost } from '../api/client';

// List of seasons, optionally scoped to one league — used by the season
// dropdown and the SeasonsPage list.
export function useSeasons(leagueId) {
  const [seasons, setSeasons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refetch = useCallback(() => {
    setLoading(true);
    const query = leagueId ? `?leagueId=${leagueId}` : '';
    return apiGet(`/seasons${query}`)
      .then((data) => {
        setSeasons(data);
        setError(null);
      })
      .catch((err) => setError(err))
      .finally(() => setLoading(false));
  }, [leagueId]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const createSeason = useCallback(async (payload) => {
    const season = await apiPost('/seasons', payload);
    setSeasons((prev) => [season, ...prev]);
    return season;
  }, []);

  return { seasons, loading, error, refetch, createSeason };
}
