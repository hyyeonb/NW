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
};
