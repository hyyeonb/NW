import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { devicesApi } from '../api';

export const useDevicesByGroup = (groupId) => {
  return useQuery({
    queryKey: ['devices', groupId],
    queryFn: async () => {
      const response = await devicesApi.getDevicesByGroup(groupId);
      // 응답 데이터 구조: { code, message, data: { content: [...], page, size, totalElements, totalPages } }
      const data = response.data?.data || response.data || {};
      // data가 배열이면 직접 사용, 객체면 content 추출
      const devices = Array.isArray(data) ? data : (data.content || []);
      return { content: Array.isArray(devices) ? devices : [] };
    },
    enabled: groupId !== undefined && groupId !== null,
    staleTime: 30000,
  });
};

// 페이지네이션 + 정렬 + 검색 지원 조회 (LIMIT OFFSET)
export const useDevicesByGroupPaged = (groupId, page = 1, size = 10, sort = 'DEVICE_ID', order = 'asc', search = {}) => {
  // queryKey에 객체 대신 직렬화된 문자열 사용 (안정적인 비교를 위해)
  const searchKey = JSON.stringify(search);

  return useQuery({
    queryKey: ['devices', groupId, 'paged', page, size, sort, order, searchKey],
    queryFn: async () => {
      const response = await devicesApi.getDevicesByGroupPaged(groupId, page, size, sort, order, true, search);
      // 응답 데이터 구조: { code, message, data: { content, page, size, totalElements, totalPages } }
      const pageData = response.data?.data || response.data || {};
      return {
        content: Array.isArray(pageData.content) ? pageData.content : [],
        page: pageData.page || page,
        size: pageData.size || size,
        totalElements: pageData.totalElements || 0,
        totalPages: pageData.totalPages || 0,
      };
    },
    enabled: !!groupId,
    staleTime: 30000,
    placeholderData: (previousData) => previousData, // 이전 데이터 유지하여 깜빡임 방지
  });
};

export const useDevice = (deviceId) => {
  return useQuery({
    queryKey: ['device', deviceId],
    queryFn: async () => {
      const response = await devicesApi.getDevice(deviceId);
      return response.data;
    },
    enabled: !!deviceId,
    staleTime: 30000,
  });
};

export const useDevicePorts = (deviceId) => {
  return useQuery({
    queryKey: ['devicePorts', deviceId],
    queryFn: async () => {
      const response = await devicesApi.getDevicePorts(deviceId);
      // 응답 데이터 구조: { code, message, data: [...] }
      const ports = response.data?.data || response.data || [];
      return Array.isArray(ports) ? ports : [];
    },
    enabled: !!deviceId,
    staleTime: 30000,
  });
};

export const useCreateDevice = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: devicesApi.createDevice,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devices'] });
    },
  });
};

export const useUpdateDevice = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ deviceId, data }) => devicesApi.updateDevice(deviceId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devices'] });
      queryClient.invalidateQueries({ queryKey: ['device'] });
    },
  });
};

export const useDeleteDevice = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: devicesApi.deleteDevice,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devices'] });
    },
  });
};

export const useDeleteDevices = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: devicesApi.deleteDevices,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devices'] });
    },
  });
};

export const useRegisterDevices = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ groupId, devices }) => devicesApi.registerDevices(groupId, devices),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devices'] });
    },
  });
};

export const useUpdatePort = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ deviceId, ifIndex, data }) =>
      devicesApi.updatePort(deviceId, ifIndex, data),
    // Optimistic Update: 즉시 로컬 캐시 업데이트 (리페치 없이)
    onMutate: async ({ deviceId, ifIndex, data }) => {
      // 진행 중인 쿼리 취소
      await queryClient.cancelQueries({ queryKey: ['devicePorts', deviceId] });

      // 이전 상태 저장 (롤백용)
      const previousPorts = queryClient.getQueryData(['devicePorts', deviceId]);

      // 캐시 즉시 업데이트
      queryClient.setQueryData(['devicePorts', deviceId], (old) => {
        if (!old) return old;
        return old.map((port) =>
          port.IF_INDEX === ifIndex ? { ...port, ...data } : port
        );
      });

      return { previousPorts };
    },
    onError: (err, variables, context) => {
      // 에러 시 롤백
      if (context?.previousPorts) {
        queryClient.setQueryData(['devicePorts', variables.deviceId], context.previousPorts);
      }
    },
    // onSuccess에서 invalidate 제거 - 이미 캐시가 업데이트됨
  });
};

// ==================== Device Scope (관제 설정) Hooks ====================

export const useDeviceScope = (deviceId) => {
  return useQuery({
    queryKey: ['deviceScope', deviceId],
    queryFn: async () => {
      const response = await devicesApi.getDeviceScope(deviceId);
      return response.data?.data || response.data || null;
    },
    enabled: !!deviceId,
  });
};

export const useUpdateDeviceScope = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ deviceId, data }) => devicesApi.updateDeviceScope(deviceId, data),
    onSuccess: (_, { deviceId }) => {
      queryClient.invalidateQueries({ queryKey: ['deviceScope', deviceId] });
      queryClient.invalidateQueries({ queryKey: ['devices'] });
    },
  });
};

// ==================== Vendor Hooks ====================

export const useVendors = () => {
  return useQuery({
    queryKey: ['vendors'],
    queryFn: async () => {
      const response = await devicesApi.getVendors();
      return response.data?.data || response.data || [];
    },
    staleTime: 5 * 60 * 1000,
  });
};

// ==================== Model Hooks ====================

export const useModels = (vendorId) => {
  return useQuery({
    queryKey: ['models', vendorId],
    queryFn: async () => {
      const response = await devicesApi.getModels(vendorId);
      return response.data?.data || response.data || [];
    },
    staleTime: 5 * 60 * 1000,
  });
};

export const useCreateModel = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: devicesApi.createModel,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['models'] });
      queryClient.invalidateQueries({ queryKey: ['vendors'] });
    },
  });
};

export const useUpdateModel = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ modelId, data }) => devicesApi.updateModel(modelId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['models'] });
      queryClient.invalidateQueries({ queryKey: ['vendors'] });
    },
  });
};

export const useDeleteModel = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: devicesApi.deleteModel,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['models'] });
      queryClient.invalidateQueries({ queryKey: ['vendors'] });
    },
  });
};

// ==================== Traffic Hooks ====================

export const useDeviceTraffic = (deviceId, minutes = 60) => {
  return useQuery({
    queryKey: ['deviceTraffic', deviceId, minutes],
    queryFn: async () => {
      const response = await devicesApi.getDeviceTraffic(deviceId, minutes);
      return response.data?.data || response.data || { timeLabels: [], series: [] };
    },
    enabled: !!deviceId,
    staleTime: 30000, // 30초 동안 캐시 유지
    refetchInterval: 60000, // 1분마다 자동 리페치
  });
};

export const useDeviceTrafficRaw = (deviceId, minutes = 60) => {
  return useQuery({
    queryKey: ['deviceTrafficRaw', deviceId, minutes],
    queryFn: async () => {
      const response = await devicesApi.getDeviceTrafficRaw(deviceId, minutes);
      return response.data?.data || response.data || [];
    },
    enabled: !!deviceId,
    staleTime: 30000,
    refetchInterval: 30000,
  });
};

export const usePortTraffic = (deviceId, ifIndex, minutes = 60) => {
  return useQuery({
    queryKey: ['portTraffic', deviceId, ifIndex, minutes],
    queryFn: async () => {
      const response = await devicesApi.getPortTraffic(deviceId, ifIndex, minutes);
      return response.data?.data || response.data || [];
    },
    enabled: !!deviceId && !!ifIndex,
    staleTime: 30000,
  });
};

// ==================== DevCode (장비군) Hooks ====================

// 장비군 트리 조회
export const useDevCodeTree = () => {
  return useQuery({
    queryKey: ['devCodeTree'],
    queryFn: async () => {
      const response = await devicesApi.getDevCodeTree();
      return response.data?.data || response.data || [];
    },
    staleTime: 5 * 60 * 1000,
  });
};

// 장비군 목록 조회 (플랫 리스트)
export const useDevCodes = () => {
  return useQuery({
    queryKey: ['devCodes'],
    queryFn: async () => {
      const response = await devicesApi.getDevCodes();
      return response.data?.data || response.data || [];
    },
    staleTime: 5 * 60 * 1000,
  });
};

// 장비군 생성
export const useCreateDevCode = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: devicesApi.createDevCode,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devCodeTree'] });
      queryClient.invalidateQueries({ queryKey: ['devCodes'] });
    },
  });
};

// 장비군 수정
export const useUpdateDevCode = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ devCodeId, data }) => devicesApi.updateDevCode(devCodeId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devCodeTree'] });
      queryClient.invalidateQueries({ queryKey: ['devCodes'] });
    },
  });
};

// 장비군 삭제
export const useDeleteDevCode = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: devicesApi.deleteDevCode,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devCodeTree'] });
      queryClient.invalidateQueries({ queryKey: ['devCodes'] });
    },
  });
};
