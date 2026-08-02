import { useQuery } from '@tanstack/react-query';
import { apiGet } from '../api/client';

// Single season detail, used by the per-season generate-teams sub-flow.
export function useSeason(seasonId) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['season', seasonId],
    queryFn: () => apiGet(`/seasons/${seasonId}`),
    enabled: !!seasonId,
  });

  return { season: data ?? null, loading: isLoading, error, refetch };
}
