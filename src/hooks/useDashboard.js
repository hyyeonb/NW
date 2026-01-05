import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { dashboardApi } from '../api';

// ==================== 위젯 마스터 (R_WIDGET_T) ====================

// 위젯 목록 조회
export const useWidgets = () => {
  return useQuery({
    queryKey: ['widgets'],
    queryFn: async () => {
      const response = await dashboardApi.getWidgets();
      return response.data?.data || response.data || [];
    },
    staleTime: 5 * 60 * 1000, // 5분간 캐시 유지
  });
};

// ==================== 기본 대시보드 (R_DEFAULT_DASHBOARD_WIDGET_T) ====================

// 기본 대시보드 조회
export const useDefaultDashboard = () => {
  return useQuery({
    queryKey: ['defaultDashboard'],
    queryFn: async () => {
      const response = await dashboardApi.getDefaultDashboard();
      return response.data?.data || response.data || [];
    },
    staleTime: 5 * 60 * 1000, // 5분간 캐시 유지
  });
};

// ==================== 사용자 대시보드 ====================

// 사용자 대시보드 조회
export const useUserDashboard = (userId) => {
  return useQuery({
    queryKey: ['userDashboard', userId],
    queryFn: async () => {
      if (!userId) return [];
      try {
        const response = await dashboardApi.getUserDashboard(userId);
        const data = response.data?.data || response.data;
        // undefined, null, 빈 배열 모두 빈 배열로 반환
        return Array.isArray(data) ? data : [];
      } catch (error) {
        console.error('사용자 대시보드 조회 실패:', error);
        return []; // 에러 시 빈 배열 반환
      }
    },
    enabled: !!userId, // userId가 있을 때만 쿼리 실행
    staleTime: 30000, // 30초간 캐시 유지
  });
};

// 사용자 대시보드 저장
export const useSaveUserDashboard = (userId) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (widgets) => dashboardApi.saveUserDashboard(userId, widgets),
    onSuccess: () => {
      // 저장 후 데이터 refetch
      queryClient.invalidateQueries({ queryKey: ['userDashboard', userId] });
    },
  });
};

// 사용자 대시보드 위젯 추가
export const useAddUserWidget = (userId) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data) => dashboardApi.addUserWidget(userId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userDashboard', userId] });
    },
  });
};

// 사용자 대시보드 위젯 삭제
export const useDeleteUserWidget = (userId) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userWidgetId) => dashboardApi.deleteUserWidget(userId, userWidgetId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userDashboard', userId] });
    },
  });
};

// 사용자 대시보드 초기화
export const useResetUserDashboard = (userId) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => dashboardApi.resetUserDashboard(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userDashboard', userId] });
    },
  });
};

// ==================== 위젯 데이터 ====================

// 위젯 차트 데이터 조회
export const useWidgetData = (userDashboardWidgetId, enabled = true) => {
  return useQuery({
    queryKey: ['widgetData', userDashboardWidgetId],
    queryFn: async () => {
      if (!userDashboardWidgetId) return null;
      const response = await dashboardApi.getWidgetData(userDashboardWidgetId);
      return response.data?.data || response.data || null;
    },
    enabled: !!userDashboardWidgetId && enabled,
    staleTime: 30000, // 30초간 캐시 유지
    refetchInterval: 30000, // 30초마다 자동 갱신
  });
};
