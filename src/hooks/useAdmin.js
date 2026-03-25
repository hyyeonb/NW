import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../api/admin';

export function useAdminUsers() {
  return useQuery({
    queryKey: ['admin', 'users'],
    queryFn: () => adminApi.getUsers().then((r) => r.data?.data || r.data),
  });
}

export function useAdminUserDetail(userId) {
  return useQuery({
    queryKey: ['admin', 'users', userId],
    queryFn: () => adminApi.getUserDetail(userId).then((r) => r.data?.data || r.data),
    enabled: !!userId,
  });
}

export function useAdminPages() {
  return useQuery({
    queryKey: ['admin', 'pages'],
    queryFn: () => adminApi.getPages().then((r) => r.data?.data || r.data),
  });
}

export function useUpdatePageAccess() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, accessList }) => adminApi.updatePageAccess(userId, accessList),
    onSuccess: (_, { userId }) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users', userId] });
    },
  });
}

export function useUpdateGroupAccess() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, accessList }) => adminApi.updateGroupAccess(userId, accessList),
    onSuccess: (_, { userId }) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users', userId] });
    },
  });
}

export function useUpdateUserStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, status }) => adminApi.updateUserStatus(userId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
  });
}

export function useUpdateAllGroupView() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, allGroupView }) => adminApi.updateAllGroupView(userId, allGroupView),
    onSuccess: (_, { userId }) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users', userId] });
    },
  });
}

export function useReviewUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId) => adminApi.reviewUser(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
  });
}

export function useCopyPermissions() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, sourceUserId }) => adminApi.copyPermissions(userId, sourceUserId),
    onSuccess: (_, { userId }) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users', userId] });
    },
  });
}

export function useThresholds() {
  return useQuery({
    queryKey: ['admin', 'thresholds'],
    queryFn: () => adminApi.getThresholds().then((r) => r.data?.data || r.data),
  });
}

export function useUpdateThresholds() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (thresholds) => adminApi.updateThresholds(thresholds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'thresholds'] });
    },
  });
}

export function useDeviceThresholds() {
  return useQuery({
    queryKey: ['admin', 'thresholds', 'devices'],
    queryFn: () => adminApi.getDeviceThresholds().then(r => r.data?.data || r.data),
  });
}

export function useUpsertDeviceThresholds() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ deviceId, thresholds }) => adminApi.upsertDeviceThresholds(deviceId, thresholds),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'thresholds'] }),
  });
}

export function useDeleteDeviceThresholds() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (deviceId) => adminApi.deleteDeviceThresholds(deviceId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'thresholds'] }),
  });
}
