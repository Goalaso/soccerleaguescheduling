import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPatch } from '../api/client';

// enabled lets a caller who already knows there's no player to find (e.g.
// SchedulePage for an admin viewer) skip the request entirely — an admin
// account has no linked player row, so this would otherwise 404 on every
// single mount rather than just being genuinely absent once.
export function useMyProfile({ enabled = true } = {}) {
  const queryClient = useQueryClient();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['myProfile'],
    queryFn: () => apiGet('/players/me'),
    enabled,
  });

  const updateMutation = useMutation({
    mutationFn: (payload) => apiPatch('/players/me', payload),
    onSuccess: (updated) => {
      queryClient.setQueryData(['myProfile'], updated);
    },
  });

  const updateProfile = (payload) => updateMutation.mutateAsync(payload);

  return { profile: data ?? null, loading: isLoading, error, refetch, updateProfile };
}
