import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { accountApi } from '../api/account';

export function useAccountInfo() {
  return useQuery({
    queryKey: ['account'],
    queryFn: () => accountApi.getAccountInfo().then((r) => r.data?.data || r.data),
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data) => accountApi.updateProfile(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['account'] });
    },
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: (data) => accountApi.changePassword(data),
  });
}

