import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { topologyApi } from '../api';

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
