import apiClient from './client';

export const historyApi = {
  // 로그인 이력 조회
  getLoginHistory: (params = {}) =>
    apiClient.get('/history/login', { params }),

  // 특정 로그인 세션의 활동 로그 조회
  getLoginActivities: (historyId, params = {}) =>
    apiClient.get(`/history/login/${historyId}/activities`, { params }),

  // 페이지 뷰 기록 (fire-and-forget)
  // context: { targetType, targetName, detail } (선택)
  recordPageView: (pageCode, pagePath, context = {}) =>
    apiClient.post('/history/page-view', { pageCode, pagePath, ...context }).catch(() => {}),
};
