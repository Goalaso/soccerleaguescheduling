import { useCallback, useEffect, useState } from 'react';
import { apiGet, apiPatch } from '../api/client';

export function useLeagues() {
  const [leagues, setLeagues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refetch = useCallback(() => {
    setLoading(true);
    return apiGet('/leagues')
      .then((data) => {
        setLeagues(data);
        setError(null);
      })
      .catch((err) => setError(err))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const renameLeague = useCallback(async (id, name) => {
    const updated = await apiPatch(`/leagues/${id}`, { name });
    setLeagues((prev) => prev.map((l) => (l.id === id ? updated : l)));
    return updated;
  }, []);

  return { leagues, loading, error, renameLeague, refetch };
}
