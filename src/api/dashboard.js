import apiClient from './client';

export const dashboardApi = {
  // ==================== 위젯 마스터 (R_WIDGET_T) ====================

  // 위젯 목록 조회
  getWidgets: () =>
    apiClient.get('/dashboard/widgets'),

  // 위젯 상세 조회
  getWidget: (widgetId) =>
    apiClient.get(`/dashboard/widgets/${widgetId}`),

  // ==================== 기본 대시보드 (R_DEFAULT_DASHBOARD_WIDGET_T) ====================

  // 기본 대시보드 위젯 목록 조회
  getDefaultDashboard: () =>
    apiClient.get('/dashboard/default-widget'),

  // ==================== 사용자 대시보드 (R_USER_DASHBOARD_WIDGET_T) ====================

  // 사용자 대시보드 위젯 목록 조회
  getUserDashboard: (userId) =>
    apiClient.get(`/dashboard/user-widget/${userId}`),

  // 사용자 대시보드 저장 (전체 레이아웃)
  saveUserDashboard: (userId, widgets) =>
    apiClient.put(`/dashboard/user-widget/${userId}`, { widgets }),

  // 사용자 대시보드에 위젯 추가
  addUserWidget: (userId, data) =>
    apiClient.post(`/dashboard/user-widget/${userId}`, data),

  // 사용자 대시보드 위젯 수정
  updateUserWidget: (userId, userWidgetId, data) =>
    apiClient.put(`/dashboard/user-widget/${userId}/${userWidgetId}`, data),

  // 사용자 대시보드 위젯 삭제
  deleteUserWidget: (userId, userWidgetId) =>
    apiClient.delete(`/dashboard/user-widget/${userId}/${userWidgetId}`),

  // 사용자 대시보드 초기화 (기본값으로 복원)
  resetUserDashboard: (userId) =>
    apiClient.post(`/dashboard/user-widget/${userId}/reset`),

  // ==================== 위젯 데이터 조회 ====================

  // 위젯의 실제 차트 데이터 조회
  getWidgetData: (userDashboardWidgetId) =>
    apiClient.get(`/dashboard/widget-data/${userDashboardWidgetId}`),

  // ==================== 위젯 데이터 갱신 ====================

  // 기본 대시보드 특정 위젯 데이터 갱신
  refreshDefaultWidget: (widgetId) =>
    apiClient.get(`/dashboard/default-widget/${widgetId}`),

  // 사용자 대시보드 특정 위젯 데이터 갱신
  refreshUserWidget: (userDashboardWidgetId) =>
    apiClient.get(`/dashboard/user-widget/refresh/${userDashboardWidgetId}`),
};
