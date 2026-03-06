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
        linkedGroupId: g.LINKED_GROUP_ID || g.linkedGroupId || null,
      }));
      // 일반 그룹에서 동기화된 연동 그룹은 커스텀 목록에서 제외
      const customOnly = flatList.filter(g => !g.linkedGroupId);
      // 트리 구조로 변환
      return buildTree(customOnly);
    },
    staleTime: 30000,
    gcTime: 300000,
    refetchOnMount: false,
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

// ==================== 장비 그룹 연동 Hooks ====================

// 장비 그룹 가져오기 (R_GROUP_T → R_WATCH_GROUP_T)
export const useImportFromGroups = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (groupIds) => watchApi.importFromGroups(groupIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['watchGroups'] });
      queryClient.invalidateQueries({ queryKey: ['linkedGroupIds'] });
    },
  });
};

// 이미 연동된 GROUP_ID 목록 조회
export const useLinkedGroupIds = () => {
  return useQuery({
    queryKey: ['linkedGroupIds'],
    queryFn: async () => {
      const response = await watchApi.getLinkedGroupIds();
      return response.data?.data || [];
    },
  });
};

// 연동 해제
export const useDeleteLinkedGroup = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (linkedGroupId) => watchApi.deleteLinkedGroup(linkedGroupId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['watchGroups'] });
      queryClient.invalidateQueries({ queryKey: ['linkedGroupIds'] });
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
  const retryTimeoutRef = useRef(null);
  const retryDelayRef = useRef(1000); // 초기 1초, 최대 30초

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
      }
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
      retryDelayRef.current = 1000;
      setConnected(false);
      return;
    }

    let cancelled = false;

    const connect = () => {
      if (cancelled) return;

      const url = `/api/watch/stream/${groupId}`;
      const eventSource = new EventSource(url);
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        setConnected(true);
        setError(null);
        retryDelayRef.current = 1000; // 성공 시 backoff 리셋
      };

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          // 장비 데이터가 없는 메시지(heartbeat/ping)는 무시
          if (!Array.isArray(data.devices) || data.devices.length === 0) {
            return;
          }

          // 이전 상태와 병합 — 부분 수신 시 기존 장비가 사라지지 않도록
          setMetrics((prev) => {
            if (!prev?.devices || prev.devices.length === 0) {
              return data;
            }

            const merged = new Map(prev.devices.map(d => [d.deviceId, d]));
            data.devices.forEach(d => merged.set(d.deviceId, d));
            return { ...data, devices: Array.from(merged.values()) };
          });

          // 히스토리 업데이트 (실제 데이터가 있는 장비만 추가)
          setHistory((prev) => {
            const newHistory = { ...prev };
            const currentTime = new Date().toISOString();

            data.devices.forEach((device) => {
              // disabled 장비 또는 실제 메트릭이 없는 장비는 히스토리에 누적하지 않음
              if (device.disabled) return;
              if (device.cpu == null && device.mem == null && (!device.interfaces || device.interfaces.length === 0)) return;

              const deviceHistory = newHistory[device.deviceId] || [];
              const historyEntry = {
                time: currentTime,
                cpu: device.cpu?.usage ?? null,
                mem: device.mem?.usage ?? null,
                interfaces: device.interfaces || [],
              };

              // 최근 60개만 유지 (앞에 추가)
              newHistory[device.deviceId] = [historyEntry, ...deviceHistory].slice(0, 60);
            });

            return newHistory;
          });
        } catch (err) {
          // 메시지 파싱 오류 무시
        }
      };

      eventSource.onerror = () => {
        setConnected(false);
        setError('SSE 연결 오류');
        eventSource.close();
        eventSourceRef.current = null;

        if (cancelled) return;

        // 지수 backoff 재접속 (jitter 포함, 최대 30초)
        const jitter = Math.random() * 500;
        const delay = Math.min(retryDelayRef.current + jitter, 30000);
        retryTimeoutRef.current = setTimeout(connect, delay);
        retryDelayRef.current = Math.min(retryDelayRef.current * 2, 30000);
      };
    };

    connect();

    // 클린업
    return () => {
      cancelled = true;
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
      setConnected(false);
    };
  }, [groupId, enabled]);

  return { metrics, history, connected, error, resetHistory };
};

