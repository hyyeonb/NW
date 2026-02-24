import apiClient from './client';

export const topologyApi = {
  // 토폴로지 조회 (그룹 또는 장비 기준)
  // type: "group" | "device"
  getTopologyView: (id, type = 'group') =>
    apiClient.get('/topology/view', {
      params: { id, type }
    }),

  // 토폴로지 저장 (노드, 링크 정보)
  saveTopology: (id, type, data) =>
    apiClient.put('/topology/view', {
      id,
      type,
      ...data
    }),

  // 최상위 그룹 ID 조회 (루트 그룹)
  getRootGroupId: () =>
    apiClient.get('/mgmt/groups/root'),

  // 배경 이미지 저장
  saveBackgroundImage: (groupId, imgSrc) =>
    apiClient.put('/topology/view-back-img', {
      groupId,
      imgSrc
    }),

  // 노드 이미지 저장 (그룹/장비)
  saveNodeImage: (id, type, imgSrc) =>
    apiClient.put('/topology/view-img', {
      id,
      type,
      imgSrc
    }),
};

// 사용자 토폴로지 API
export const userTopologyApi = {
  // 메인 토폴로지 조회 (groupId=0)
  get: (userId) =>
    apiClient.get(`/user-topo/${userId}`),

  // 메인 토폴로지 저장
  save: (userId, data) =>
    apiClient.put(`/user-topo/${userId}`, data),

  // 그룹 하위 토폴로지 조회
  getGroup: (userId, groupId) =>
    apiClient.get(`/user-topo/${userId}/group/${groupId}`),

  // 그룹 하위 토폴로지 저장
  saveGroup: (userId, groupId, data) =>
    apiClient.put(`/user-topo/${userId}/group/${groupId}`, data),

  // 배경 이미지 저장 (groupId가 있으면 그룹 하위, 없으면 루트)
  saveBackgroundImage: (userId, imgSrc, groupId) =>
    apiClient.put('/user-topo/back-img', { userId, imgSrc, groupId: groupId || 0 }),

  // 노드 아이콘 변경 (groupId가 있으면 그룹 하위, 없으면 루트)
  saveNodeImage: (userId, nodeKey, imgSrc, groupId) =>
    apiClient.put('/user-topo/node-img', { userId, nodeKey, imgSrc, groupId: groupId || 0 }),
};
