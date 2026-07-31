import { useCallback, useEffect, useState } from 'react';
import { apiGet } from '../api/client';

// Single season detail, used by the per-season generate-teams sub-flow.
export function useSeason(seasonId) {
  const [season, setSeason] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refetch = useCallback(() => {
    if (!seasonId) return Promise.resolve();
    setLoading(true);
    return apiGet(`/seasons/${seasonId}`)
      .then((data) => {
        setSeason(data);
        setError(null);
      })
      .catch((err) => setError(err))
      .finally(() => setLoading(false));
  }, [seasonId]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { season, loading, error, refetch };
}
