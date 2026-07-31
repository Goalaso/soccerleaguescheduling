import { useCallback, useEffect, useState } from 'react';
import { apiGet, apiPost, apiPatch, apiDelete } from '../api/client';

export function usePlayers() {
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refetch = useCallback(() => {
    setLoading(true);
    return apiGet('/players')
      .then((data) => {
        setPlayers(data);
        setError(null);
      })
      .catch((err) => setError(err))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const createPlayer = useCallback(async (payload) => {
    const player = await apiPost('/players', payload);
    setPlayers((prev) => [...prev, player]);
    return player;
  }, []);

  const updatePlayer = useCallback(async (id, payload) => {
    const player = await apiPatch(`/players/${id}`, payload);
    setPlayers((prev) => prev.map((p) => (p.id === id ? player : p)));
    return player;
  }, []);

  const deletePlayer = useCallback(async (id) => {
    await apiDelete(`/players/${id}`);
    setPlayers((prev) => prev.filter((p) => p.id !== id));
  }, []);

  return { players, loading, error, refetch, createPlayer, updatePlayer, deletePlayer };
}
