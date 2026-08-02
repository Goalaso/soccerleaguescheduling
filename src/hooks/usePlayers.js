import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPatch, apiDelete } from '../api/client';

export function usePlayers() {
  const queryClient = useQueryClient();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['players'],
    queryFn: () => apiGet('/players'),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['players'] });

  const createMutation = useMutation({
    mutationFn: (payload) => apiPost('/players', payload),
    onSuccess: invalidate,
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, payload }) => apiPatch(`/players/${id}`, payload),
    onSuccess: invalidate,
  });
  const deleteMutation = useMutation({
    mutationFn: (id) => apiDelete(`/players/${id}`),
    onSuccess: invalidate,
  });

  const createPlayer = (payload) => createMutation.mutateAsync(payload);
  const updatePlayer = (id, payload) => updateMutation.mutateAsync({ id, payload });
  const deletePlayer = (id) => deleteMutation.mutateAsync(id);

  return { players: data || [], loading: isLoading, error, refetch, createPlayer, updatePlayer, deletePlayer };
}
