import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notificationsApi } from '../api/notifications';

export function useNotificationPrefs() {
  return useQuery({
    queryKey: ['notifications', 'preferences'],
    queryFn: () => notificationsApi.getPreferences().then((r) => r.data?.data || r.data),
  });
}

export function useUpdateNotificationPrefs() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data) => notificationsApi.updatePreferences(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', 'preferences'] });
    },
  });
}

// ==================== 이메일 알림 설정 Hooks ====================

export function useEmailPreferences() {
  return useQuery({
    queryKey: ['email', 'preferences'],
    queryFn: () => notificationsApi.getEmailPreferences().then((r) => r.data?.data || r.data),
  });
}

export function useSaveEmailPreferences() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data) => notificationsApi.saveEmailPreferences(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email', 'preferences'] });
    },
  });
}

export function useSaveEmailDevicePrefs() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ deviceId, prefs }) => notificationsApi.saveEmailDevicePrefs(deviceId, prefs),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email', 'preferences'] });
    },
  });
}

export function useDeleteEmailDevicePrefs() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (deviceId) => notificationsApi.deleteEmailDevicePrefs(deviceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email', 'preferences'] });
    },
  });
}
