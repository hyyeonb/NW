import apiClient from './client';

export const adminApi = {
  getUsers: () => apiClient.get('/admin/users'),

  getUserDetail: (userId) => apiClient.get(`/admin/users/${userId}`),

  updatePageAccess: (userId, accessList) =>
    apiClient.put(`/admin/users/${userId}/page-access`, accessList),

  updateGroupAccess: (userId, accessList) =>
    apiClient.put(`/admin/users/${userId}/group-access`, accessList),

  updateUserStatus: (userId, status) =>
    apiClient.put(`/admin/users/${userId}/status`, { STATUS: status }),

  updateAllGroupView: (userId, allGroupView) =>
    apiClient.put(`/admin/users/${userId}/all-group-view`, { ALL_GROUP_VIEW: allGroupView }),

  reviewUser: (userId) =>
    apiClient.post(`/admin/users/${userId}/review`),

  getPages: () => apiClient.get('/admin/pages'),

  copyPermissions: (userId, sourceUserId) =>
    apiClient.post(`/admin/users/${userId}/copy-from/${sourceUserId}`),

  getThresholds: () => apiClient.get('/admin/thresholds'),

  updateThresholds: (thresholds) => apiClient.put('/admin/thresholds', thresholds),

  getDeviceThresholds: () => apiClient.get('/admin/thresholds/devices'),
  getDeviceThreshold: (deviceId) => apiClient.get(`/admin/thresholds/devices/${deviceId}`),
  upsertDeviceThresholds: (deviceId, thresholds) => apiClient.put(`/admin/thresholds/devices/${deviceId}`, thresholds),
  deleteDeviceThresholds: (deviceId) => apiClient.delete(`/admin/thresholds/devices/${deviceId}`),
};
