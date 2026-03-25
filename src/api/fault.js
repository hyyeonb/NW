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

  // 장애 이력의 페이지 위치 조회 (해당 이력이 몇 페이지에 있는지)
  getHistoryPosition: (errorHistoryId, deviceId, size = 20) =>
    apiClient.get(`/fault/history/${errorHistoryId}/position`, { params: { deviceId, size } }),

  // 장애 이력 상세 조회
  getHistoryDetail: (errorHistoryId) =>
    apiClient.get(`/fault/history/${errorHistoryId}`),

  // ========== 장애 통계 ==========

  // 통계 요약 (등급별/유형별 현재장애수 + Aging)
  getStatsSummary: (params = {}) =>
    apiClient.get('/fault/stats/summary', { params }),

  // 발생 추이 (일별)
  getStatsTrend: (params) =>
    apiClient.get('/fault/stats/trend', { params }),

  // MTTR 통계
  getStatsMttr: (params = {}) =>
    apiClient.get('/fault/stats/mttr', { params }),

  // 상습 장애 장비 Top N
  getStatsTopDevices: (params) =>
    apiClient.get('/fault/stats/top-devices', { params }),

  // 시간대/요일 패턴
  getStatsPattern: (params) =>
    apiClient.get('/fault/stats/pattern', { params }),
};
