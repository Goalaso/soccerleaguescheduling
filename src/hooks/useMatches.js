import { useQuery } from '@tanstack/react-query';
import { apiGet } from '../api/client';

export function useMatches(seasonId) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['matches', seasonId],
    queryFn: () => apiGet(`/matches?seasonId=${seasonId}`),
    enabled: !!seasonId,
  });

  return { matches: data?.matches ?? null, loading: isLoading, error, refetch };
}
