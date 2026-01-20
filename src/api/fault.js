import apiClient from './client';

export const faultApi = {
  // 실시간 장애 목록 조회
  getErrors: (params = {}) =>
    apiClient.get('/fault/errors', { params }),

  // 장애 상세 조회
  getError: (errorId) =>
    apiClient.get(`/fault/errors/${errorId}`),

  // 장애 인지 처리
  acknowledgeError: (errorId, userMessage) =>
    apiClient.put(`/fault/errors/${errorId}/acknowledge`, { userMessage }),

  // 장애 이력 목록 조회
  getHistory: (params = {}) =>
    apiClient.get('/fault/history', { params }),

  // 장애 이력 상세 조회
  getHistoryDetail: (errorHistoryId) =>
    apiClient.get(`/fault/history/${errorHistoryId}`),
};
