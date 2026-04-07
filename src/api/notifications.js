import apiClient from './client';

export const notificationsApi = {
  getPreferences: () => apiClient.get('/notifications/preferences'),

  updatePreferences: (data) => apiClient.put('/notifications/preferences', data),

  // 이메일 알림 설정
  getEmailPreferences: () => apiClient.get('/email/preferences'),
  saveEmailPreferences: (data) => apiClient.put('/email/preferences', data),
  saveEmailDevicePrefs: (deviceId, prefs) => apiClient.put(`/email/preferences/devices/${deviceId}`, prefs),
  deleteEmailDevicePrefs: (deviceId) => apiClient.delete(`/email/preferences/devices/${deviceId}`),

  // 장애 유형별 등급 정보 (DB 기반)
  getAlertTypes: () => apiClient.get('/email/alert-types'),
};
