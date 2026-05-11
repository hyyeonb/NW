import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { devicesApi } from '../../../api/devices';

const EMPTY_LATEST = Object.freeze({ cpuMem: {}, icmp: {} });

const toNumberOrNull = (v) => {
  if (v == null) return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
};

const hasPingFault = (latestIcmp) => {
  if (!latestIcmp) return true;
  const loss = toNumberOrNull(latestIcmp.PACKET_LOSS);
  return loss != null && loss >= 100;
};

const isSnmpMissing = (latestCm) =>
  !latestCm || (latestCm.CPU_USAGE == null && latestCm.MEM_USAGE == null);

const exceedsAny = (values, thresholds) =>
  values.some((v, i) => v != null && v >= thresholds[i]);

// 장비 LED 등급 ('crit' | 'warn' | 'ok') 판정 — 최근 5분 raw 데이터 기준
const computeLedStatus = (latestCm, latestIcmp) => {
  if (hasPingFault(latestIcmp)) return 'crit';

  const cpu = toNumberOrNull(latestCm?.CPU_USAGE);
  const mem = toNumberOrNull(latestCm?.MEM_USAGE);
  const lossVal = toNumberOrNull(latestIcmp?.PACKET_LOSS) ?? 0;

  if (exceedsAny([cpu, mem, lossVal], [90, 90, 5])) return 'crit';
  if (isSnmpMissing(latestCm)) return 'warn';
  if (exceedsAny([cpu, mem, lossVal], [75, 80, 1])) return 'warn';
  return 'ok';
};

const latestByKey = (rows, key) =>
  rows.length
    ? rows.reduce((acc, r) => (!acc || String(r[key]) > String(acc[key]) ? r : acc), null)
    : null;

// period batch 쿼리 wrapper — kind/api만 다른 3종을 동일 옵션으로 묶음 (ADR 0011 § 함수형 합성)
const useBatchHistory = (kind, fetcher, ctx) => {
  const { deviceIds, appliedRange, granularity, groupId } = ctx;
  const enabled =
    !!appliedRange?.startDate && !!appliedRange?.endDate && deviceIds.length > 0;
  return useQuery({
    queryKey: [`pe-${kind}-batch`, groupId, appliedRange?.startDate, appliedRange?.endDate, deviceIds.join(',')],
    queryFn: () => fetcher(deviceIds, {
      startDate: appliedRange.startDate, endDate: appliedRange.endDate, granularity,
    }).then(r => r.data?.data || {}),
    enabled,
    staleTime: 60000,
  });
};

// 장비 ID 묶음에 대한 기간 batch 메트릭 + 최근 5분 raw 상태(LED용) 조회.
// - period batches: 차트용 (cpuMem / traffic / icmp), staleTime 60s
// - latestStatus: LED/정렬 판정용, 1분 자동 갱신
export function usePerfDeviceMetrics(deviceIds, appliedRange, granularity, groupId) {
  const ctx = { deviceIds, appliedRange, granularity, groupId };
  const cpuMemBatchQuery = useBatchHistory('cpumem', devicesApi.getDeviceCpuMemHistoryBatch, ctx);
  const trafficBatchQuery = useBatchHistory('traffic', devicesApi.getDeviceTrafficRawBatch, ctx);
  const icmpBatchQuery = useBatchHistory('icmp', devicesApi.getDeviceIcmpHistoryBatch, ctx);

  // LED/정렬은 period batch가 아닌 최근 5분 raw로만 판정 (period 변경 영향 차단)
  const latestStatusQuery = useQuery({
    queryKey: ['pe-latest-status', groupId, deviceIds.join(',')],
    queryFn: async () => {
      if (deviceIds.length === 0) return EMPTY_LATEST;
      const [cm, ic] = await Promise.all([
        devicesApi.getDeviceCpuMemHistoryBatch(deviceIds, { minutes: 5, granularity: 'raw' }).then(r => r.data?.data || {}),
        devicesApi.getDeviceIcmpHistoryBatch(deviceIds, { minutes: 5, granularity: 'raw' }).then(r => r.data?.data || {}),
      ]);
      return { cpuMem: cm, icmp: ic };
    },
    enabled: deviceIds.length > 0,
    staleTime: 30000,
    refetchInterval: 60000,
  });

  const cpuMemBatch = cpuMemBatchQuery.data || {};
  const trafficBatch = trafficBatchQuery.data || {};
  const icmpBatch = icmpBatchQuery.data || {};
  const latestStatus = latestStatusQuery.data ?? EMPTY_LATEST;

  const isLoading =
    cpuMemBatchQuery.isFetching || trafficBatchQuery.isFetching || icmpBatchQuery.isFetching;

  const ledStatusMap = useMemo(() => {
    const m = new Map();
    deviceIds.forEach((deviceId) => {
      const cm = (latestStatus.cpuMem[deviceId] || []).filter(r => r.CORE_INDEX == null);
      const icmp = latestStatus.icmp[deviceId] || [];
      const latestCm = latestByKey(cm, 'COLLECTED_AT');
      const latestIcmp = latestByKey(icmp, 'COLLECT_TIME');
      m.set(deviceId, computeLedStatus(latestCm, latestIcmp));
    });
    return m;
  }, [deviceIds, latestStatus]);

  return {
    cpuMemBatch,
    trafficBatch,
    icmpBatch,
    latestStatus,
    isLoading,
    ledStatusMap,
  };
}
