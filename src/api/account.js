import apiClient from './client';

export const accountApi = {
  getAccountInfo: () => apiClient.get('/account'),

  updateProfile: (data) => apiClient.put('/account/profile', data),

  changePassword: (data) => apiClient.put('/account/password', data),

  uploadProfileImage: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return apiClient.post('/account/profile-image', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  getAccessibleDevices: () => apiClient.get('/account/accessible-devices'),
};
