import { useCallback, useEffect, useState } from 'react';
import { apiGet, apiPatch } from '../api/client';

// Admin-facing availability review list for a season.
export function useSeasonAvailability(seasonId) {
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refetch = useCallback(() => {
    if (!seasonId) return Promise.resolve();
    setLoading(true);
    return apiGet(`/seasons/${seasonId}/availability`)
      .then((data) => {
        setPlayers(data);
        setError(null);
      })
      .catch((err) => setError(err))
      .finally(() => setLoading(false));
  }, [seasonId]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const setAvailability = useCallback(
    async (playerId, isAvailable) => {
      const updated = await apiPatch(`/seasons/${seasonId}/availability/${playerId}`, { isAvailable });
      setPlayers((prev) =>
        prev.map((p) => (p.playerId === playerId ? { ...p, ...updated } : p))
      );
      return updated;
    },
    [seasonId]
  );

  return { players, loading, error, refetch, setAvailability };
}
