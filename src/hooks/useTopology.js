import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { topologyApi, userTopologyApi } from '../api';

// 토폴로지 조회 (그룹 또는 장비 기준)
// id: groupId 또는 deviceId
// type: "group" | "device"
export const useTopologyView = (id, type = 'group') => {
  return useQuery({
    queryKey: ['topology', type, id],
    queryFn: async () => {
      const response = await topologyApi.getTopologyView(id, type);
      console.log('=== API 원본 응답 ===', response);
      console.log('=== response.data ===', response.data);

      const data = response.data?.data || response.data || { nodes: [], links: [] };
      console.log('=== 추출된 data ===', data);

      // 노드 ID를 nodeType_id 형식으로 변환 (같은 ID의 device/group 구분)
      const nodes = Array.isArray(data.nodes) ? data.nodes.map(node => {
        const nodeType = node.nodeType || 'device';
        const uniqueId = `${nodeType}_${node.id}`;
        return {
          ...node,
          id: uniqueId,
          originalId: node.id // 원본 ID 보존
        };
      }) : [];

      // 링크의 source/target도 nodeType_id 형식으로 변환
      const links = Array.isArray(data.links) ? data.links
        .filter(link => link.source && link.target) // null/undefined 필터링
        .map(link => {
          const srcType = link.srcType || 'device';
          const dstType = link.dstType || 'device';
          return {
            ...link,
            source: `${srcType}_${link.source}`,
            target: `${dstType}_${link.target}`
          };
        }) : [];

      // 배경 이미지 데이터 (BACK_ICON_DATA)
      const backIconData = data.backIconData || data.BACK_ICON_DATA || null;

      console.log('=== 최종 nodes ===', nodes);
      console.log('=== 최종 links ===', links);
      console.log('=== 배경 이미지 ===', backIconData ? backIconData.substring(0, 50) + '...' : null);

      return { nodes, links, backIconData };
    },
    enabled: !!id,
    staleTime: 30000, // 30초간 캐시 유지
    refetchInterval: 60000, // 60초마다 자동 갱신
  });
};

// 토폴로지 저장
export const useSaveTopology = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, type, data }) => topologyApi.saveTopology(id, type, data),
    onSuccess: (_, { id, type }) => {
      queryClient.invalidateQueries({ queryKey: ['topology', type, id] });
    },
  });
};

// 최상위(루트) 그룹 ID 조회
export const useRootGroupId = () => {
  return useQuery({
    queryKey: ['rootGroupId'],
    queryFn: async () => {
      const response = await topologyApi.getRootGroupId();
      return response.data?.data || response.data || null;
    },
    staleTime: Infinity, // 루트 그룹은 변하지 않으므로 캐시 유지
  });
};

// ===== 사용자 토폴로지 =====

// 사용자 토폴로지 조회 (GET /api/user-topo/{userId})
// API 응답의 노드 ID는 D15, G5 형식 → 변환 없이 그대로 사용
// 링크 필드 정규화 (백엔드 응답 필드명 차이 대응 + 고유 ID 보장)
let _linkIdSeq = 1;
const normalizeLink = (l) => ({
  ...l,
  id: l.id || l.linkId || `_link_${_linkIdSeq++}`,
  source: l.source,
  target: l.target,
  srcType: l.srcType || l.SRC_TYPE || 'DEVICE',
  dstType: l.dstType || l.DST_TYPE || 'DEVICE',
  srcIfIndex: l.srcIfIndex ?? l.SRC_IF_INDEX ?? l.srcIfindex ?? '',
  dstIfIndex: l.dstIfIndex ?? l.DST_IF_INDEX ?? l.dstIfindex ?? '',
  srcIfName: l.srcIfName || l.SRC_IF_NAME || l.srcIfname || '',
  dstIfName: l.dstIfName || l.DST_IF_NAME || l.dstIfname || '',
  status: l.status || l.STATUS || '',
});

export const useUserTopology = (userId) => {
  return useQuery({
    queryKey: ['userTopology', userId],
    queryFn: async () => {
      const response = await userTopologyApi.get(userId);
      const data = response.data?.data || response.data;
      if (!data) return null;
      return {
        viewId: data.viewId,
        userId: data.userId,
        zoom: data.zoom,
        centerX: data.centerX,
        centerY: data.centerY,
        backIconData: data.backIconData || null,
        nodes: Array.isArray(data.nodes) ? data.nodes : [],
        links: Array.isArray(data.links) ? data.links.filter(l => l.source && l.target).map(normalizeLink) : [],
      };
    },
    enabled: !!userId,
    staleTime: 0,
    refetchOnMount: 'always',
  });
};

// 사용자 토폴로지 그룹 하위 조회 (GET /api/user-topo/{userId}/group/{groupId})
export const useUserTopologyGroup = (userId, groupId) => {
  return useQuery({
    queryKey: ['userTopology', userId, 'group', groupId],
    queryFn: async () => {
      const response = await userTopologyApi.getGroup(userId, groupId);
      const data = response.data?.data || response.data;
      if (!data) return null;
      return {
        viewId: data.viewId,
        userId: data.userId,
        groupId: data.groupId,
        zoom: data.zoom,
        centerX: data.centerX,
        centerY: data.centerY,
        backIconData: data.backIconData || null,
        nodes: Array.isArray(data.nodes) ? data.nodes : [],
        links: Array.isArray(data.links) ? data.links.filter(l => l.source && l.target).map(normalizeLink) : [],
      };
    },
    enabled: !!userId && !!groupId,
    staleTime: 0,
    refetchOnMount: 'always',
  });
};

// 사용자 토폴로지 그룹 하위 저장 (PUT /api/user-topo/{userId}/group/{groupId})
export const useSaveUserTopologyGroup = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, groupId, data }) => userTopologyApi.saveGroup(userId, groupId, data),
    onSuccess: (_, { userId, groupId }) => {
      queryClient.invalidateQueries({ queryKey: ['userTopology', userId, 'group', groupId] });
    },
  });
};

// 사용자 토폴로지 저장 (PUT /api/user-topo/{userId})
export const useSaveUserTopology = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, data }) => userTopologyApi.save(userId, data),
    onSuccess: (_, { userId }) => {
      queryClient.invalidateQueries({ queryKey: ['userTopology', userId] });
    },
  });
};

// 사용자 토폴로지 배경 이미지 저장
export const useSaveUserBackgroundImage = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, imgSrc, groupId }) => userTopologyApi.saveBackgroundImage(userId, imgSrc, groupId),
    onSuccess: (_, { userId, groupId }) => {
      if (groupId) {
        queryClient.invalidateQueries({ queryKey: ['userTopology', userId, 'group', groupId] });
      } else {
        queryClient.invalidateQueries({ queryKey: ['userTopology', userId] });
      }
    },
  });
};

// 사용자 토폴로지 노드 아이콘 변경
export const useSaveUserNodeImage = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, nodeKey, imgSrc, groupId }) => userTopologyApi.saveNodeImage(userId, nodeKey, imgSrc, groupId),
    onSuccess: (_, { userId, groupId }) => {
      if (groupId) {
        queryClient.invalidateQueries({ queryKey: ['userTopology', userId, 'group', groupId] });
      } else {
        queryClient.invalidateQueries({ queryKey: ['userTopology', userId] });
      }
    },
  });
};
