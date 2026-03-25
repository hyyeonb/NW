import apiClient from './client';

export const notificationsApi = {
  getPreferences: () => apiClient.get('/notifications/preferences'),

  updatePreferences: (data) => apiClient.put('/notifications/preferences', data),
};
