import apiClient from './client';

export const devicesApi = {
  getDevicesByGroup: (groupId, includeChildren = true) =>
    apiClient.get(`/mgmt/devices/by-group/${groupId}?includeChildren=${includeChildren}&size=9999`),

  getDevicesByGroupPaged: (groupId, page = 1, size = 10, sort = 'DEVICE_ID', order = 'asc', includeChildren = true, search = {}) => {
    const params = new URLSearchParams({
      includeChildren,
      page,
      size,
      sort,
      order
    });
    if (search.deviceName) params.append('deviceName', search.deviceName);
    if (search.deviceIp) params.append('deviceIp', search.deviceIp);
    if (search.groupName) params.append('groupName', search.groupName);
    if (search.devCodeId) params.append('devCodeId', search.devCodeId);
    return apiClient.get(`/mgmt/devices/by-group/${groupId}?${params.toString()}`);
  },

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

  // 전체 임시 장비 목록 조회
  getAllTempDevices: () =>
    apiClient.get('/mgmt/temp-devices/all'),

  // 그룹별 임시 장비 목록 조회
  getTempDevicesByGroup: (groupIds) =>
    apiClient.post('/mgmt/temp-devices/search', groupIds),

  // 임시 장비 생성
  createTempDevice: (device) =>
    apiClient.post('/mgmt/temp-devices', device),

  // 임시 장비 대량 생성
  createTempDevices: (devices) =>
    apiClient.post('/mgmt/temp-devices/bulk', devices),

  // 임시 장비 수정 (그룹 변경 등)
  updateTempDevice: (deviceId, device) =>
    apiClient.put(`/mgmt/temp-devices/${deviceId}`, device),

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

  // SNMP 수집 시도 후 장비 정보 업데이트
  collectSnmp: (deviceId, snmpConfig) =>
    apiClient.post(`/mgmt/devices/${deviceId}/snmp-collect`, snmpConfig),

  // PING → SNMP → SSH 장비 점검
  checkConnectivity: (deviceId) =>
    apiClient.post(`/mgmt/devices/${deviceId}/connectivity-check`),

  // 포트 상태 실시간 체크 (AdminStatus / OperStatus)
  checkPortStatus: (deviceId, ifIndex) =>
    apiClient.get(`/mgmt/devices/${deviceId}/ports/${ifIndex}/check`),

  // ==================== Device SSH (접속 정보) 관련 ====================

  // 장비 접속 정보 조회
  getDeviceSsh: (deviceId) =>
    apiClient.get(`/mgmt/devices/${deviceId}/ssh`),

  // 장비 접속 정보 저장/수정
  saveDeviceSsh: (deviceId, data) =>
    apiClient.put(`/mgmt/devices/${deviceId}/ssh`, data),

  // 장비 접속 정보 삭제
  deleteDeviceSsh: (deviceId) =>
    apiClient.delete(`/mgmt/devices/${deviceId}/ssh`),

  // ==================== Traffic 관련 ====================

  // 장비 트래픽 데이터 조회 (차트용)
  getDeviceTraffic: (deviceId, minutes = 60) =>
    apiClient.get(`/mgmt/devices/${deviceId}/traffic`, { params: { minutes } }),

  // 장비 트래픽 원시 데이터 조회
  getDeviceTrafficRaw: (deviceId, minutes = 60, startDate, endDate) =>
    apiClient.get(`/mgmt/devices/${deviceId}/traffic/raw`, {
      params: { minutes, ...(startDate && { startDate }), ...(endDate && { endDate }) }
    }),

  // 포트별 트래픽 데이터 조회
  getPortTraffic: (deviceId, ifIndex, minutes = 60) =>
    apiClient.get(`/mgmt/devices/${deviceId}/ports/${ifIndex}/traffic`, { params: { minutes } }),

  // ==================== CPU/MEM 관련 ====================

  // 장비 CPU/MEM 최신 데이터 조회
  getDeviceCpuMem: (deviceId) =>
    apiClient.get(`/mgmt/devices/${deviceId}/cpu-mem`),

  // 장비 CPU/MEM 시계열 데이터 조회
  getDeviceCpuMemHistory: (deviceId, minutes = 60, startDate, endDate) =>
    apiClient.get(`/mgmt/devices/${deviceId}/cpu-mem/history`, {
      params: { minutes, ...(startDate && { startDate }), ...(endDate && { endDate }) }
    }),

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

  // ==================== DevCode (장비군) 관련 ====================

  // 장비군 트리 조회
  getDevCodeTree: () =>
    apiClient.get('/mgmt/dev-codes/tree'),

  // 장비군 목록 조회 (플랫 리스트)
  getDevCodes: () =>
    apiClient.get('/mgmt/dev-codes'),

  // 특정 장비군 조회
  getDevCode: (devCodeId) =>
    apiClient.get(`/mgmt/dev-codes/${devCodeId}`),

  // 장비군 생성
  createDevCode: (data) =>
    apiClient.post('/mgmt/dev-codes', data),

  // 장비군 수정
  updateDevCode: (devCodeId, data) =>
    apiClient.put(`/mgmt/dev-codes/${devCodeId}`, data),

  // 장비군 삭제
  deleteDevCode: (devCodeId) =>
    apiClient.delete(`/mgmt/dev-codes/${devCodeId}`),

  // ==================== 네트워크 도구 ====================

  // SSH 정보가 등록된 장비 목록 (Traceroute 트리용)
  getSshEnabledDevices: () =>
    apiClient.get('/mgmt/devices/ssh-enabled'),

  // Traceroute - 장비 간 경로 추적 (SSH 원격 실행)
  traceroute: (sourceDeviceId, targetDeviceId, maxHops = 30, timeout = 1000, targetIp = null) => {
    const body = { maxHops, timeout };
    if (sourceDeviceId != null) body.sourceDeviceId = sourceDeviceId;
    if (targetDeviceId != null) body.targetDeviceId = targetDeviceId;
    if (targetIp != null) body.targetIp = targetIp;
    return apiClient.post('/mgmt/tools/traceroute', body);
  },

  // 메트릭 유형
  getMetricTypes: () => apiClient.get('/mgmt/metric-types'),
  getModelMetrics: (modelId) => apiClient.get(`/mgmt/models/${modelId}/metrics`),
  saveModelMetrics: (modelId, metricCodes) => apiClient.put(`/mgmt/models/${modelId}/metrics`, metricCodes),
  getDeviceMetrics: (deviceId) => apiClient.get(`/mgmt/devices/${deviceId}/metrics`),

  // 환경 데이터 (온도/습도)
  getEnvironmentLatest: (deviceId) => apiClient.get(`/mgmt/devices/${deviceId}/environment`),
  getEnvironmentHistory: (deviceId, metricCode, minutes = 60) =>
    apiClient.get(`/mgmt/devices/${deviceId}/environment/history?metricCode=${metricCode}&minutes=${minutes}`),

  // 수집 서버(미들웨어) 목록
  getMiddlewares: () => apiClient.get('/middleware'),

  // 장비별 이력 조회
  getDeviceChangeHistory: (deviceId, page = 1, size = 20) =>
    apiClient.get(`/mgmt/devices/${deviceId}/change-history`, { params: { page, size } }),
  getDeviceSshHistory: (deviceId, page = 1, size = 20) =>
    apiClient.get(`/mgmt/devices/${deviceId}/ssh-history`, { params: { page, size } }),
};
