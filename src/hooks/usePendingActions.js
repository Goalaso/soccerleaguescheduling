import { useCallback, useEffect, useState } from 'react';
import { apiGet, apiPatch } from '../api/client';

export function usePendingActions() {
  const [actions, setActions] = useState([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(() => {
    setLoading(true);
    return apiGet('/me/pending-actions')
      .then((data) => setActions(data.actions))
      .catch(() => setActions([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const respondToSeasonAvailability = useCallback(async (seasonId, isAvailable) => {
    await apiPatch(`/seasons/${seasonId}/availability/me`, { isAvailable });
    setActions((prev) => prev.filter((a) => !(a.type === 'season_availability' && a.seasonId === seasonId)));
  }, []);

  return { actions, loading, refetch, respondToSeasonAvailability };
}
