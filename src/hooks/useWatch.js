import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect, useCallback, useRef } from 'react';
import { watchApi } from '../api/watch';

// ==================== 관제 그룹 Hooks ====================

// 플랫 리스트를 트리 구조로 변환
const buildTree = (flatList) => {
  const map = {};
  const roots = [];

  // 먼저 모든 노드를 맵에 저장
  flatList.forEach((item) => {
    map[item.watchGroupId] = { ...item, children: [] };
  });

  // 부모-자식 관계 설정
  flatList.forEach((item) => {
    if (item.parentGroupId && map[item.parentGroupId]) {
      map[item.parentGroupId].children.push(map[item.watchGroupId]);
    } else {
      roots.push(map[item.watchGroupId]);
    }
  });

  return roots;
};

// 관제 그룹 목록 조회
export const useWatchGroups = () => {
  return useQuery({
    queryKey: ['watchGroups'],
    queryFn: async () => {
      const response = await watchApi.getGroups();
      const groups = response.data?.data || [];
      // 백엔드 UPPER_SNAKE_CASE -> 프론트엔드 camelCase 변환
      const flatList = groups.map(g => ({
        watchGroupId: g.WATCH_GROUP_ID || g.watchGroupId,
        parentGroupId: g.PARENT_GROUP_ID || g.parentGroupId || null,
        groupName: g.GROUP_NAME || g.groupName,
        intervalSec: g.INTERVAL_SEC || g.intervalSec || 5,
        deviceCount: g.DEVICE_COUNT || g.deviceCount || 0,
        depth: g.DEPTH || g.depth || 0,
        iconName: g.ICON_NAME || g.iconName || null,
      }));
      // 트리 구조로 변환
      return buildTree(flatList);
    },
    staleTime: 0,
    refetchOnMount: 'always',
  });
};

// 관제 그룹 상세 조회
export const useWatchGroupDetail = (watchGroupId) => {
  return useQuery({
    queryKey: ['watchGroup', watchGroupId],
    queryFn: async () => {
      if (!watchGroupId) return null;
      const response = await watchApi.getGroupDetail(watchGroupId);
      const data = response.data?.data;
      if (!data) return null;
      // 백엔드 UPPER_SNAKE_CASE -> 프론트엔드 camelCase 변환
      return {
        watchGroupId: data.WATCH_GROUP_ID || data.watchGroupId,
        groupName: data.GROUP_NAME || data.groupName,
        intervalSec: data.INTERVAL_SEC || data.intervalSec || 5,
        devices: (data.devices || []).map(d => ({
          deviceId: d.DEVICE_ID || d.deviceId,
          deviceName: d.DEVICE_NAME || d.deviceName,
          deviceIp: d.DEVICE_IP || d.deviceIp,
          ifIndexes: (d.interfaces || []).map(i => i.IF_INDEX || i.ifIndex),
        })),
      };
    },
    enabled: !!watchGroupId,
  });
};

// 관제 그룹 생성
export const useCreateWatchGroup = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: watchApi.createGroup,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['watchGroups'] });
    },
  });
};

// 관제 그룹 수정
export const useUpdateWatchGroup = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ watchGroupId, data }) => watchApi.updateGroup(watchGroupId, data),
    onSuccess: (_, { watchGroupId }) => {
      queryClient.invalidateQueries({ queryKey: ['watchGroups'] });
      queryClient.invalidateQueries({ queryKey: ['watchGroup', watchGroupId] });
    },
  });
};

// 관제 그룹 삭제
export const useDeleteWatchGroup = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: watchApi.deleteGroup,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['watchGroups'] });
    },
  });
};

// 관제 그룹 이동 (드래그 앤 드롭)
export const useMoveWatchGroup = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ watchGroupId, parentGroupId }) =>
      watchApi.moveGroup(watchGroupId, parentGroupId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['watchGroups'] });
    },
  });
};

// 관제 그룹 아이콘 설정
export const useUpdateWatchGroupIcon = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ watchGroupId, iconName }) =>
      watchApi.updateGroupIcon(watchGroupId, iconName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['watchGroups'] });
    },
  });
};

// ==================== 관제 시작/중지 Hooks ====================

// 관제 시작
export const useStartWatch = () => {
  return useMutation({
    mutationFn: watchApi.startWatch,
  });
};

// 관제 중지
export const useStopWatch = () => {
  return useMutation({
    mutationFn: watchApi.stopWatch,
  });
};

// Heartbeat
export const useSendHeartbeat = () => {
  return useMutation({
    mutationFn: watchApi.sendHeartbeat,
  });
};

// ==================== SSE 실시간 메트릭 Hook ====================

/**
 * SSE 기반 실시간 메트릭 조회 Hook
 * Redis 미사용, Go Middleware에서 직접 SSE 스트림 수신
 *
 * @param {number} groupId - 관제 그룹 ID
 * @param {boolean} enabled - SSE 연결 활성화 여부
 * @returns {Object} { metrics, history, connected, error }
 */
export const useWatchSSE = (groupId, enabled = false) => {
  const [metrics, setMetrics] = useState(null);
  const [history, setHistory] = useState({}); // { [deviceId]: Array }
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState(null);
  const eventSourceRef = useRef(null);

  // 히스토리 초기화
  const resetHistory = useCallback(() => {
    setHistory({});
    setMetrics(null);
  }, []);

  useEffect(() => {
    if (!groupId || !enabled) {
      // 연결 해제
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
        setConnected(false);
      }
      return;
    }

    // SSE 연결
    const url = `/api/watch/stream/${groupId}`;
    console.log('[SSE] 연결 시도:', url);

    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      console.log('[SSE] 연결 성공');
      setConnected(true);
      setError(null);
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('[SSE] 메트릭 수신:', data);
        setMetrics(data);

        // 히스토리 업데이트
        setHistory((prev) => {
          const newHistory = { ...prev };
          // ISO 형식으로 저장하여 DeviceMetricCard에서 파싱 가능하게
          const currentTime = new Date().toISOString();

          data.devices?.forEach((device) => {
            const deviceHistory = newHistory[device.deviceId] || [];
            const historyEntry = {
              time: currentTime,
              cpu: device.cpu?.usage || 0,
              mem: device.mem?.usage || 0,
              interfaces: device.interfaces || [],
            };

            // 최근 60개만 유지 (앞에 추가)
            newHistory[device.deviceId] = [historyEntry, ...deviceHistory].slice(0, 60);
          });

          return newHistory;
        });
      } catch (err) {
        console.error('[SSE] 메시지 파싱 오류:', err);
      }
    };

    eventSource.onerror = (err) => {
      console.error('[SSE] 연결 오류:', err);
      setConnected(false);
      setError('SSE 연결 오류');

      // 자동 재연결 시도 (EventSource 기본 동작)
    };

    // 클린업
    return () => {
      console.log('[SSE] 연결 해제');
      eventSource.close();
      eventSourceRef.current = null;
      setConnected(false);
    };
  }, [groupId, enabled]);

  return { metrics, history, connected, error, resetHistory };
};

// ==================== 기존 Polling 방식 (더 이상 사용 안함) ====================

// 최신 메트릭 조회 (Polling) - DEPRECATED: useWatchSSE 사용
export const useWatchMetrics = (watchGroupId, enabled = true, refetchInterval = 10000) => {
  console.warn('useWatchMetrics is deprecated. Use useWatchSSE instead.');
  return useQuery({
    queryKey: ['watchMetrics', watchGroupId],
    queryFn: async () => null,
    enabled: false,
  });
};

// 히스토리 조회 - DEPRECATED: useWatchSSE 사용
export const useWatchHistory = (watchGroupId, deviceId) => {
  console.warn('useWatchHistory is deprecated. Use useWatchSSE instead.');
  return useQuery({
    queryKey: ['watchHistory', watchGroupId, deviceId],
    queryFn: async () => [],
    enabled: false,
  });
};
