import { useQuery } from '@tanstack/react-query';
import { devicesApi } from '../../../api/devices';

const EMPTY_ARR = Object.freeze([]);

// 단일 장비 모달용 history 쿼리 wrapper — kind/api/argShape만 다른 3종을 동일 옵션 + queryKey 형태로 묶음.
// (CPU/MEM, Traffic은 positional args, ICMP는 options object — API 시그니처 차이 유지)
const useDeviceHistory = (kind, fetcher, ctx) => {
  const { deviceId, range, granularity, enabled } = ctx;
  return useQuery({
    queryKey: [`pedm-${kind}`, deviceId, range?.startDate, range?.endDate, granularity],
    queryFn: () => fetcher().then(r => r.data?.data || []),
    enabled: !!enabled && !!range?.startDate,
    staleTime: 30000,
  });
};

// PerformanceExplorer 모달용 단일 장비 시계열 fetch.
// modal scope의 period 변경이 페이지 batch와 분리되도록 별도 hook.
export function useDeviceModalMetrics({ deviceId, range, granularity, enabled }) {
  const cpuMemQ = useDeviceHistory('cpumem',
    () => devicesApi.getDeviceCpuMemHistory(deviceId, undefined, range?.startDate, range?.endDate),
    { deviceId, range, granularity, enabled }
  );
  const trafficQ = useDeviceHistory('traffic',
    () => devicesApi.getDeviceTrafficRaw(deviceId, undefined, range?.startDate, range?.endDate),
    { deviceId, range, granularity, enabled }
  );
  const icmpQ = useDeviceHistory('icmp',
    () => devicesApi.getDeviceIcmpHistory(deviceId, {
      startDate: range?.startDate,
      endDate: range?.endDate,
      granularity,
    }),
    { deviceId, range, granularity, enabled }
  );

  return {
    cpuMemRows: cpuMemQ.data || EMPTY_ARR,
    trafficRows: trafficQ.data || EMPTY_ARR,
    icmpRows: icmpQ.data || EMPTY_ARR,
    isLoading: cpuMemQ.isFetching || trafficQ.isFetching || icmpQ.isFetching,
  };
}
