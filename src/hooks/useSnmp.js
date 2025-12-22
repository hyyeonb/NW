import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { snmpApi } from '../api/snmp';

// 모든 메트릭 조회
export function useSnmpMetrics() {
  return useQuery({
    queryKey: ['snmpMetrics'],
    queryFn: async () => {
      const response = await snmpApi.getMetrics();
      return response.data?.data || [];
    },
    staleTime: 5 * 60 * 1000, // 5분
  });
}

// 모델의 OID 설정 조회
export function useModelOids(modelId) {
  return useQuery({
    queryKey: ['modelOids', modelId],
    queryFn: async () => {
      const response = await snmpApi.getModelOids(modelId);
      return response.data?.data || [];
    },
    enabled: !!modelId,
  });
}

// 모델 OID 저장 (단일)
export function useSaveModelOid() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ modelId, oid }) => snmpApi.saveModelOid(modelId, oid),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['modelOids', variables.modelId] });
    },
  });
}

// 모델 OID 일괄 저장
export function useSaveModelOids() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ modelId, oids }) => snmpApi.saveModelOids(modelId, oids),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['modelOids', variables.modelId] });
    },
  });
}

// OID 삭제
export function useDeleteModelOid() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (oidId) => snmpApi.deleteOid(oidId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['modelOids'] });
    },
  });
}
