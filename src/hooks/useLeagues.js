import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPatch } from '../api/client';

export function useLeagues() {
  const queryClient = useQueryClient();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['leagues'],
    queryFn: () => apiGet('/leagues'),
  });

  const renameMutation = useMutation({
    mutationFn: ({ id, name }) => apiPatch(`/leagues/${id}`, { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leagues'] });
      // Seasons embed a denormalized leagueName snapshot.
      queryClient.invalidateQueries({ queryKey: ['seasons'] });
    },
  });

  const renameLeague = (id, name) => renameMutation.mutateAsync({ id, name });

  return { leagues: data || [], loading: isLoading, error, renameLeague, refetch };
}
