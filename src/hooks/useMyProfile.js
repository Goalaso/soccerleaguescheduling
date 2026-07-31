import { useCallback, useEffect, useState } from 'react';
import { apiGet, apiPatch } from '../api/client';

export function useMyProfile() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refetch = useCallback(() => {
    setLoading(true);
    return apiGet('/players/me')
      .then((data) => {
        setProfile(data);
        setError(null);
      })
      .catch((err) => setError(err))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const updateProfile = useCallback(async (payload) => {
    const updated = await apiPatch('/players/me', payload);
    setProfile(updated);
    return updated;
  }, []);

  return { profile, loading, error, refetch, updateProfile };
}
