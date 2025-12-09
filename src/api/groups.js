import apiClient from './client';

export const groupsApi = {
  // 전체 그룹 트리 조회
  getGroupTree: () =>
    apiClient.get('/mgmt/groups/tree'),

  // 특정 그룹 조회
  getGroup: (groupId) =>
    apiClient.get(`/mgmt/groups/${groupId}`),

  // 하위 그룹 목록 조회
  getChildGroups: (parentId) =>
    apiClient.get(`/mgmt/groups/${parentId}/descendants`),

  // 하위 그룹 개수 조회
  getDescendantsCount: (groupId) =>
    apiClient.get(`/mgmt/groups/${groupId}/descendants/count`),

  // 그룹 생성
  createGroup: (data) =>
    apiClient.post('/mgmt/groups', {
      GROUP_NAME: data.GROUP_NAME,
      PARENT_GROUP_ID: data.PARENT_GROUP_ID || null,
      ADDRESS: data.ADDRESS || null,
      PHONE: data.PHONE || null,
    }),

  // 그룹 수정
  updateGroup: (groupId, data) =>
    apiClient.put(`/mgmt/groups/${groupId}`, {
      GROUP_NAME: data.GROUP_NAME,
      ADDRESS: data.ADDRESS || null,
      PHONE: data.PHONE || null,
    }),

  // 그룹 삭제
  deleteGroup: (groupId) =>
    apiClient.delete(`/mgmt/groups/${groupId}`),

  // 그룹 이동 (드래그 앤 드롭)
  moveGroup: (groupId, parentGroupId) =>
    apiClient.patch(`/mgmt/groups/${groupId}/move`, {
      PARENT_GROUP_ID: parentGroupId,
    }),

  // 그룹 아이콘 수정
  updateGroupIcon: (groupId, iconName, iconType) =>
    apiClient.patch(`/mgmt/groups/${groupId}/icon`, {
      ICON_NAME: iconName,
      ICON_TYPE: iconType,
    }),
};
