import { useCallback, useEffect, useState } from 'react';
import { apiGet, apiPost } from '../api/client';

export function useMatch(matchId) {
  const [match, setMatch] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refetch = useCallback(() => {
    setLoading(true);
    return apiGet(`/matches/${matchId}`)
      .then((data) => {
        setMatch(data);
        setError(null);
      })
      .catch((err) => setError(err))
      .finally(() => setLoading(false));
  }, [matchId]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const submitResults = useCallback(
    async (payload) => {
      const updated = await apiPost(`/matches/${matchId}/results`, payload);
      setMatch((prev) => ({ ...prev, ...updated }));
      return updated;
    },
    [matchId]
  );

  return { match, loading, error, refetch, submitResults };
}
