import apiClient from './client';

export const devicesApi = {
  getDevicesByGroup: (groupId, includeChildren = true) =>
    apiClient.get(`/mgmt/devices/by-group/${groupId}?includeChildren=${includeChildren}`),

  getDevicesByGroupPaged: (groupId, page = 1, size = 10, sort = 'DEVICE_ID', order = 'asc', includeChildren = true) =>
    apiClient.get(`/mgmt/devices/by-group/${groupId}?includeChildren=${includeChildren}&page=${page}&size=${size}&sort=${sort}&order=${order}`),

  // 전체 장비 목록 조회
  getAllDevices: () =>
    apiClient.get('/mgmt/devices'),

  // 장비 상세 조회
  getDevice: (deviceId) =>
    apiClient.get(`/mgmt/devices/${deviceId}`),

  // 장비 생성
  createDevice: (data) =>
    apiClient.post('/mgmt/devices', data),

  // 장비 수정
  updateDevice: (deviceId, data) =>
    apiClient.put(`/mgmt/devices/${deviceId}`, data),

  // 장비 삭제
  deleteDevice: (deviceId) =>
    apiClient.delete(`/mgmt/devices/${deviceId}`),

  // 일괄 삭제
  deleteDevices: (deviceIds) =>
    apiClient.delete('/mgmt/devices', { data: { deviceIds } }),

  // SNMP 장비 일괄 등록
  registerDevices: (groupId, devices) =>
    apiClient.post(`/mgmt/devices/register/${groupId}`, devices),

  // 장비 포트 목록 조회
  getDevicePorts: (deviceId) =>
    apiClient.get(`/mgmt/devices/${deviceId}/ports`),

  // 포트 정보 수정
  updatePort: (deviceId, ifIndex, data) =>
    apiClient.put(`/mgmt/devices/${deviceId}/ports/${ifIndex}`, data),

  // 장비 IP 중복 검증
  validateDevices: (devices) =>
    apiClient.post('/mgmt/devices/validate', devices),

  // 단일 IP 중복 확인
  checkDuplicateIp: (ip) =>
    apiClient.post('/mgmt/devices/validate', [{ DEVICE_IP: ip }]),

  // ==================== 임시 장비 (TEMP_DEVICE) 관련 ====================

  // 그룹별 임시 장비 목록 조회
  getTempDevicesByGroup: (groupIds) =>
    apiClient.post('/mgmt/temp-devices/search', groupIds),

  // 임시 장비 생성
  createTempDevice: (device) =>
    apiClient.post('/mgmt/temp-devices', device),

  // 임시 장비 대량 생성
  createTempDevices: (devices) =>
    apiClient.post('/mgmt/temp-devices/bulk', devices),

  // 임시 장비 삭제
  deleteTempDevices: (deviceIds) =>
    apiClient.delete('/mgmt/temp-devices', { data: deviceIds }),

  // ==================== Device Scope (관제 설정) 관련 ====================

  // 장비 관제 설정 조회
  getDeviceScope: (deviceId) =>
    apiClient.get(`/mgmt/devices/${deviceId}/scope`),

  // 장비 관제 설정 수정
  updateDeviceScope: (deviceId, data) =>
    apiClient.put(`/mgmt/devices/${deviceId}/scope`, data),

  // ==================== Vendor 관련 ====================

  // 벤더 목록 조회
  getVendors: () =>
    apiClient.get('/mgmt/vendors'),

  // 특정 벤더 조회
  getVendor: (vendorId) =>
    apiClient.get(`/mgmt/vendors/${vendorId}`),

  // ==================== Model 관련 ====================

  // 모델 목록 조회 (vendorId로 필터링 가능)
  getModels: (vendorId) =>
    apiClient.get('/mgmt/models', { params: vendorId ? { vendorId } : {} }),

  // 특정 모델 조회
  getModel: (modelId) =>
    apiClient.get(`/mgmt/models/${modelId}`),

  // 모델 생성
  createModel: (data) =>
    apiClient.post('/mgmt/models', data),

  // 모델 수정
  updateModel: (modelId, data) =>
    apiClient.put(`/mgmt/models/${modelId}`, data),

  // 모델 삭제
  deleteModel: (modelId) =>
    apiClient.delete(`/mgmt/models/${modelId}`),
};
