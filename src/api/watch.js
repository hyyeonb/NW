import apiClient from './client';

/**
 * 프론트엔드 데이터를 백엔드 형식으로 변환
 * Frontend: { groupName, parentGroupId, devices: [{ deviceId, ifIndexes: [] }] }
 * Backend: { group: { GROUP_NAME, PARENT_GROUP_ID, INTERVAL_SEC }, devices: [{ DEVICE_ID, interfaces: [{ IF_INDEX }] }] }
 */
const transformToBackend = (data) => {
  return {
    group: {
      GROUP_NAME: data.groupName,
      PARENT_GROUP_ID: data.parentGroupId || null,
      INTERVAL_SEC: 5, // 5초 고정
    },
    devices: (data.devices || []).map(d => ({
      DEVICE_ID: d.deviceId,
      interfaces: (d.ifIndexes || []).map(ifIdx => ({ IF_INDEX: ifIdx })),
    })),
  };
};

export const watchApi = {
  // ==================== 관제 그룹 CRUD ====================

  // 관제 그룹 목록 조회
  getGroups: () =>
    apiClient.get('/watch/groups'),

  // 관제 그룹 상세 조회 (장비 + 인터페이스 포함)
  getGroupDetail: (watchGroupId) => {
    if (!watchGroupId) return Promise.reject(new Error('watchGroupId is required'));
    return apiClient.get(`/watch/groups/${watchGroupId}`);
  },

  // 관제 그룹 생성
  createGroup: (data) =>
    apiClient.post('/watch/groups', transformToBackend(data)),

  // 관제 그룹 수정
  updateGroup: (watchGroupId, data) => {
    if (!watchGroupId) return Promise.reject(new Error('watchGroupId is required'));
    return apiClient.put(`/watch/groups/${watchGroupId}`, transformToBackend(data));
  },

  // 관제 그룹 삭제
  deleteGroup: (watchGroupId) => {
    if (!watchGroupId) return Promise.reject(new Error('watchGroupId is required'));
    return apiClient.delete(`/watch/groups/${watchGroupId}`);
  },

  // 관제 그룹 이동 (드래그 앤 드롭)
  moveGroup: (watchGroupId, parentGroupId) => {
    if (!watchGroupId) return Promise.reject(new Error('watchGroupId is required'));
    return apiClient.patch(`/watch/groups/${watchGroupId}/move`, {
      PARENT_GROUP_ID: parentGroupId,
    });
  },

  // 관제 그룹 아이콘 설정
  updateGroupIcon: (watchGroupId, iconName) => {
    if (!watchGroupId) return Promise.reject(new Error('watchGroupId is required'));
    return apiClient.patch(`/watch/groups/${watchGroupId}/icon`, {
      ICON_NAME: iconName,
    });
  },

  // 하위 그룹 개수 조회
  getDescendantsCount: (watchGroupId) => {
    if (!watchGroupId) return Promise.reject(new Error('watchGroupId is required'));
    return apiClient.get(`/watch/groups/${watchGroupId}/descendants/count`);
  },

  // ==================== 장비 그룹 연동 ====================

  // 장비 그룹 가져오기 (R_GROUP_T → R_WATCH_GROUP_T 연동)
  importFromGroups: (groupIds) =>
    apiClient.post('/watch/groups/import', { groupIds }),

  // 이미 연동된 GROUP_ID 목록 조회
  getLinkedGroupIds: () =>
    apiClient.get('/watch/groups/linked-ids'),

  // 연동 해제
  deleteLinkedGroup: (linkedGroupId) =>
    apiClient.delete(`/watch/groups/linked/${linkedGroupId}`),

  // 연동된 관제 그룹 조회 (read-only, 동기화 없이 조회만)
  getByLinkedGroup: (groupId) =>
    apiClient.get(`/watch/groups/by-linked/${groupId}`),

  // 일반 그룹 → 관제 그룹 동기화 (장비+인터페이스 매핑 테이블에 저장)
  syncFromGroup: (groupId) =>
    apiClient.post(`/watch/groups/sync-from-group/${groupId}`),

  // ==================== 관제 시작/중지/Heartbeat ====================

  // 관제 수집 시작
  startWatch: (watchGroupId) => {
    if (!watchGroupId) return Promise.reject(new Error('watchGroupId is required'));
    return apiClient.post(`/watch/start/${watchGroupId}`);
  },

  // 관제 수집 중지
  stopWatch: (watchGroupId) => {
    if (!watchGroupId) return Promise.reject(new Error('watchGroupId is required'));
    return apiClient.post(`/watch/stop/${watchGroupId}`);
  },

  // Heartbeat 전송
  sendHeartbeat: (watchGroupId) => {
    if (!watchGroupId) return Promise.reject(new Error('watchGroupId is required'));
    return apiClient.post(`/watch/heartbeat/${watchGroupId}`);
  },

  // ==================== 메트릭 조회 (Redis) ====================

  // 최신 메트릭 조회
  getMetrics: (watchGroupId) => {
    if (!watchGroupId) return Promise.reject(new Error('watchGroupId is required'));
    return apiClient.get(`/watch/metrics/${watchGroupId}`);
  },

  // 히스토리 조회 (차트용)
  getHistory: (watchGroupId, deviceId) => {
    if (!watchGroupId || !deviceId) return Promise.reject(new Error('watchGroupId and deviceId are required'));
    return apiClient.get(`/watch/history/${watchGroupId}/${deviceId}`);
  },
};
