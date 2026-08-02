import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPatch } from '../api/client';

export function useMyProfile() {
  const queryClient = useQueryClient();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['myProfile'],
    queryFn: () => apiGet('/players/me'),
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
