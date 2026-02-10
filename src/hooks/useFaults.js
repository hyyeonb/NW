import { useQuery } from '@tanstack/react-query';
import { faultApi } from '../api';

// 현재 활성 장애 목록 조회
export const useActiveErrors = () => {
  return useQuery({
    queryKey: ['activeErrors'],
    queryFn: async () => {
      const response = await faultApi.getErrors();
      const data = response.data?.data || {};
      // API 응답: { list: [...], ... } 형태
      return data.list || data || [];
    },
    refetchInterval: 30000, // 30초마다 자동 갱신
    staleTime: 10000,
  });
};

// 장비별 최고 장애 등급 맵 생성 (DEVICE_ID -> ERROR_LEVEL)
export const useDeviceErrorLevels = () => {
  const { data, ...rest } = useActiveErrors();

  // data가 배열인지 확인 (API 응답이 다양한 형태일 수 있음)
  const errors = Array.isArray(data) ? data : [];

  // 장비별/그룹별 최고 등급 매핑 (C > M > N > W)
  const levelPriority = { 'C': 4, 'M': 3, 'N': 2, 'W': 1 };
  const deviceErrorMap = new Map();
  const groupErrorMap = new Map();

  errors.forEach(error => {
    const priority = levelPriority[error.ERROR_LEVEL] || 0;

    // 장비별 최고 등급
    if (error?.DEVICE_ID) {
      const current = deviceErrorMap.get(error.DEVICE_ID);
      if (priority > (levelPriority[current] || 0)) {
        deviceErrorMap.set(error.DEVICE_ID, error.ERROR_LEVEL);
      }
    }

    // 그룹별 최고 등급
    if (error?.GROUP_NAME) {
      const current = groupErrorMap.get(error.GROUP_NAME);
      if (priority > (levelPriority[current] || 0)) {
        groupErrorMap.set(error.GROUP_NAME, error.ERROR_LEVEL);
      }
    }
  });

  return { deviceErrorMap, groupErrorMap, errors, ...rest };
};
