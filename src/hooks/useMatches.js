import { useCallback, useEffect, useState } from 'react';
import { apiGet } from '../api/client';

export function useMatches(seasonId) {
  const [matches, setMatches] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refetch = useCallback(() => {
    if (!seasonId) {
      setMatches(null);
      setLoading(false);
      return Promise.resolve();
    }
    setLoading(true);
    return apiGet(`/matches?seasonId=${seasonId}`)
      .then((data) => {
        setMatches(data.matches);
        setError(null);
      })
      .catch((err) => setError(err))
      .finally(() => setLoading(false));
  }, [seasonId]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { matches, loading, error, refetch };
}
