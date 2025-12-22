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
  });
};

// 페이지네이션 + 정렬 지원 조회 (LIMIT OFFSET)
export const useDevicesByGroupPaged = (groupId, page = 1, size = 10, sort = 'DEVICE_ID', order = 'asc') => {
  return useQuery({
    queryKey: ['devices', groupId, 'paged', page, size, sort, order],
    queryFn: async () => {
      const response = await devicesApi.getDevicesByGroupPaged(groupId, page, size, sort, order);
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
