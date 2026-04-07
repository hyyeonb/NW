import { useState, useEffect, useMemo, useCallback } from 'react';
import { useQuery, useQueries } from '@tanstack/react-query';
import ReactECharts from 'echarts-for-react';
import { devicesApi } from '../api/devices';
import { DataTable } from '../components';
import WatchSidebar from '../components/WatchSidebar';
import PdfPreviewModal from '../components/PdfPreviewModal';
import { useWatchGroupDetail } from '../hooks/useWatch';
import '../styles/fault-stats.css';
import '../styles/performance-test.css';


const PERIOD_OPTIONS = [
  { label: '5분', minutes: 5 },
  { label: '30분', minutes: 30 },
  { label: '1시간', minutes: 60 },
  { label: '24시간', minutes: 1440 },
  { label: '커스텀', minutes: null },
];

const DIST_RANGES = [
  { label: '0~20%', min: 0, max: 20, color: '#10b981' },
  { label: '20~50%', min: 20, max: 50, color: '#3b82f6' },
  { label: '50~80%', min: 50, max: 80, color: '#f59e0b' },
  { label: '80~100%', min: 80, max: 100, color: '#ef4444' },
];

// DB 컬럼 직접 사용 — High 값 우선, 없으면 일반 값 폴백 (COALESCE 패턴)
// BPS: IN_HIGH_BPS → IN_BPS
// PERCENT: IN_HIGH_USED_PERCENT → IN_USED_PERCENT
function getInBps(r) {
  const v = r.IN_HIGH_BPS ?? r.IN_BPS;
  return v != null ? Number(v) : 0;
}
function getOutBps(r) {
  const v = r.OUT_HIGH_BPS ?? r.OUT_BPS;
  return v != null ? Number(v) : 0;
}
function getInPercent(r) {
  const v = r.IN_HIGH_USED_PERCENT ?? r.IN_USED_PERCENT;
  return v != null ? Number(v) : 0;
}
function getOutPercent(r) {
  const v = r.OUT_HIGH_USED_PERCENT ?? r.OUT_USED_PERCENT;
  return v != null ? Number(v) : 0;
}
function hasPercentData(rows) {
  if (!rows || rows.length === 0) return false;
  return rows.some(r => r.IN_HIGH_USED_PERCENT != null || r.IN_USED_PERCENT != null);
}

function formatMemory(value) {
  if (value == null || value === '' || value === 0) return '-';
  const v = Number(value);
  if (isNaN(v)) return '-';
  if (v < 1024) return `${v}`;
  // SNMP hrStorage 등에서 KB 단위로 올 수 있음
  // 10억 이상: 바이트 단위로 간주
  if (v >= 1e9) {
    if (v >= 1e12) return (v / 1e12).toFixed(2) + ' TB';
    return (v / 1e9).toFixed(2) + ' GB';
  }
  // 100만 ~ 10억: KB 단위로 간주 (서버 메모리 1GB~1TB 범위)
  if (v >= 1e6) {
    return (v / 1e6).toFixed(2) + ' GB';
  }
  // 1천 ~ 100만: KB 단위 → MB
  if (v >= 1e3) {
    return (v / 1e3).toFixed(2) + ' MB';
  }
  return v + ' KB';
}

function formatBpsValue(bps) {
  if (bps == null || isNaN(bps)) return '0 bps';
  if (bps >= 1e9) return (bps / 1e9).toFixed(2) + ' Gbps';
  if (bps >= 1e6) return (bps / 1e6).toFixed(2) + ' Mbps';
  if (bps >= 1e3) return (bps / 1e3).toFixed(2) + ' Kbps';
  return bps.toFixed(0) + ' bps';
}

// React 19 StrictMode safe wrapper
function SafeECharts(props) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setReady(true);
    return () => setReady(false);
  }, []);
  if (!ready) return <div style={props.style} />;
  return <ReactECharts {...props} />;
}

function LoadingSpinner() {
  return (
    <div className="stats-loading">
      <div className="loading-spinner" />
    </div>
  );
}

function EmptyState({ message }) {
  return (
    <div className="stats-empty">
      <i className="bi bi-inbox"></i>
      <span>{message}</span>
    </div>
  );
}

function PortLegendTable({ ports, direction, unit, colors }) {
  const isBps = unit === 'bps';
  return (
    <div style={{ overflowX: 'auto', marginTop: 4 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            <th style={thStyle}></th>
            <th style={{ ...thStyle, textAlign: 'left' }}>장비</th>
            <th style={{ ...thStyle, textAlign: 'left' }}>포트</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>Peak BPS</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>Peak %</th>
            <th style={{ ...thStyle, textAlign: 'center' }}>시각</th>
          </tr>
        </thead>
        <tbody>
          {ports.map((p, idx) => {
            const color = colors[idx % colors.length];
            const peakBps = direction === 'in' ? p.peakInBps : p.peakOutBps;
            const peakUsed = direction === 'in' ? p.peakInUsed : p.peakOutUsed;
            const peakTime = direction === 'in' ? p.peakInTime : p.peakOutTime;
            return (
              <tr key={p.key} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <td style={tdStyle}>
                  <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 3, background: color }} />
                </td>
                <td style={{ ...tdStyle, color: '#e2e8f0', fontWeight: 500 }}>{p.deviceName}</td>
                <td style={{ ...tdStyle, color: '#94a3b8' }}>{p.ifName}</td>
                <td style={{ ...tdStyle, textAlign: 'right', fontFamily: "'JetBrains Mono', monospace", color: '#e2e8f0' }}>
                  {formatBpsValue(peakBps)}
                </td>
                <td style={{ ...tdStyle, textAlign: 'right', fontFamily: "'JetBrains Mono', monospace", color: '#94a3b8' }}>
                  {peakUsed != null ? `${Number(peakUsed).toFixed(2)}%` : '-'}
                </td>
                <td style={{ ...tdStyle, textAlign: 'center', color: '#64748b', fontSize: 10 }}>
                  {peakTime ? peakTime.substring(11) : '-'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const thStyle = { padding: '6px 8px', color: '#64748b', fontWeight: 600, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.5px' };
const tdStyle = { padding: '5px 8px', fontSize: 11 };

export default function PerformanceTest() {
  const [periodIdx, setPeriodIdx] = useState(2); // 기본 1시간
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [customRange, setCustomRange] = useState({ start: '', end: '' });
  const [pdfPreviewOpen, setPdfPreviewOpen] = useState(false);
  const [portTopUnit, setPortTopUnit] = useState('percent'); // 'percent' | 'bps'

  const currentPeriod = PERIOD_OPTIONS[periodIdx];
  const isCustomMode = currentPeriod?.minutes === null;
  const isSnapshotMode = currentPeriod?.minutes === 5;
  const minutes = currentPeriod?.minutes ?? 60;

  const customStartDate = isCustomMode && customRange.start ? customRange.start.replace('T', ' ') + ':00' : null;
  const customEndDate = isCustomMode && customRange.end ? customRange.end.replace('T', ' ') + ':00' : null;
  const isCustomReady = isCustomMode ? (customStartDate && customEndDate) : true;

  // 관제 그룹 상세 (장비 목록 포함) — 그룹 선택 시에만 fetch
  const { data: groupDetail, isLoading: groupDetailLoading } = useWatchGroupDetail(
    selectedGroup?.watchGroupId
  );

  // 일반 그룹 선택 시 장비 목록 조회
  const { data: regularDevicesRaw = [], isLoading: regularDevicesLoading } = useQuery({
    queryKey: ['perfStats', 'regularGroupDevices', selectedGroup?.groupId],
    queryFn: () => devicesApi.getDevicesByGroup(selectedGroup.groupId).then(r => r.data?.data?.content || []),
    enabled: !!selectedGroup?.groupId && selectedGroup?.type === 'regular',
  });

  // 전체 장비 목록 — 그룹 미선택 시에만 fetch
  const { data: allDevicesRaw = [], isLoading: allDevicesLoading } = useQuery({
    queryKey: ['perfStats', 'allDevices'],
    queryFn: async () => {
      const res = await devicesApi.getAllDevices();
      return res.data?.data || [];
    },
    staleTime: 30000,
    enabled: !selectedGroup,
  });

  // 통합 장비 목록: 그룹 선택 시 groupDetail.devices, 미선택 시 전체
  const devices = useMemo(() => {
    if (selectedGroup?.type === 'regular') {
      return regularDevicesRaw.length > 0 ? regularDevicesRaw : [];
    }
    if (selectedGroup?.watchGroupId) {
      if (!groupDetail) return []; // 로딩 중 → 빈 결과
      return (groupDetail.devices || [])
        .filter(d => d.deviceId != null)
        .map(d => ({
          DEVICE_ID: d.deviceId,
          DEVICE_NAME: d.deviceName,
          DEVICE_IP: d.deviceIp,
        }));
    }
    return allDevicesRaw;
  }, [selectedGroup, groupDetail, regularDevicesRaw, allDevicesRaw]);

  const devicesLoading = selectedGroup
    ? (selectedGroup.type === 'regular' ? regularDevicesLoading : groupDetailLoading)
    : allDevicesLoading;
  const validDevices = useMemo(() => devices.filter(d => d.DEVICE_ID != null), [devices]);

  // 모든 장비 CPU/MEM 최신값 병렬 fetch
  const cpuMemQueries = useQueries({
    queries: validDevices.map(d => ({
      queryKey: ['perfStats', 'cpuMem', d.DEVICE_ID],
      queryFn: () => devicesApi.getDeviceCpuMem(d.DEVICE_ID).then(r => r.data?.data || null),
      staleTime: 60000,
    })),
  });

  // 모든 장비 CPU/MEM 히스토리 병렬 fetch
  const historyQueries = useQueries({
    queries: validDevices.map(d => ({
      queryKey: ['perfStats', 'history', d.DEVICE_ID, minutes, customStartDate, customEndDate],
      queryFn: () => devicesApi.getDeviceCpuMemHistory(d.DEVICE_ID, minutes, customStartDate, customEndDate).then(r => r.data?.data || []),
      staleTime: 60000,
      enabled: isCustomReady,
    })),
  });

  // 모든 장비 트래픽 Raw 데이터 병렬 fetch
  const trafficQueries = useQueries({
    queries: validDevices.map(d => ({
      queryKey: ['perfStats', 'traffic', d.DEVICE_ID, minutes, customStartDate, customEndDate],
      queryFn: () => devicesApi.getDeviceTrafficRaw(d.DEVICE_ID, minutes, customStartDate, customEndDate).then(r => r.data?.data || []),
      staleTime: 60000,
      enabled: isCustomReady,
    })),
  });

  const isLoadingData = devicesLoading || cpuMemQueries.some(q => q.isLoading);
  const isLoadingTraffic = trafficQueries.some(q => q.isLoading);

  // 장비별 최신 CPU/MEM 매핑
  const deviceMetrics = useMemo(() => {
    return validDevices.map((d, i) => {
      const data = cpuMemQueries[i]?.data;
      return {
        ...d,
        cpu: data ? Number(data.CPU_USAGE || 0) : null,
        mem: data ? Number(data.MEM_USAGE || 0) : null,
        memUsed: data?.MEM_USED ?? null,
        memTotal: data?.MEM_TOTAL ?? null,
      };
    }).filter(d => d.cpu !== null);
  }, [validDevices, cpuMemQueries]);

  // ========== 집계 ==========

  const summary = useMemo(() => {
    if (deviceMetrics.length === 0) {
      return { count: devices.length, avgCpu: 0, avgMem: 0, maxCpu: { value: 0, name: '-' }, maxMem: { value: 0, name: '-' } };
    }
    const avgCpu = deviceMetrics.reduce((s, d) => s + d.cpu, 0) / deviceMetrics.length;
    const avgMem = deviceMetrics.reduce((s, d) => s + d.mem, 0) / deviceMetrics.length;
    const maxCpuDevice = deviceMetrics.reduce((max, d) => d.cpu > max.cpu ? d : max, deviceMetrics[0]);
    const maxMemDevice = deviceMetrics.reduce((max, d) => d.mem > max.mem ? d : max, deviceMetrics[0]);
    return {
      count: devices.length,
      avgCpu: avgCpu.toFixed(2),
      avgMem: avgMem.toFixed(2),
      maxCpu: { value: maxCpuDevice.cpu.toFixed(2), name: maxCpuDevice.DEVICE_NAME },
      maxMem: { value: maxMemDevice.mem.toFixed(2), name: maxMemDevice.DEVICE_NAME },
    };
  }, [devices, deviceMetrics]);

  // TOP 10 CPU
  const topCpu = useMemo(() => {
    return [...deviceMetrics].sort((a, b) => b.cpu - a.cpu).slice(0, 10);
  }, [deviceMetrics]);

  // TOP 10 MEM
  const topMem = useMemo(() => {
    return [...deviceMetrics].sort((a, b) => b.mem - a.mem).slice(0, 10);
  }, [deviceMetrics]);

  // CPU 분포
  const cpuDist = useMemo(() => {
    return DIST_RANGES.map(r => ({
      ...r,
      count: deviceMetrics.filter(d => d.cpu >= r.min && d.cpu < (r.max === 100 ? 101 : r.max)).length,
    }));
  }, [deviceMetrics]);

  // MEM 분포
  const memDist = useMemo(() => {
    return DIST_RANGES.map(r => ({
      ...r,
      count: deviceMetrics.filter(d => d.mem >= r.min && d.mem < (r.max === 100 ? 101 : r.max)).length,
    }));
  }, [deviceMetrics]);

  // 고부하 장비 (CPU or MEM >= 80%)
  const highLoadDevices = useMemo(() => {
    return deviceMetrics.filter(d => d.cpu >= 80 || d.mem >= 80)
      .sort((a, b) => Math.max(b.cpu, b.mem) - Math.max(a.cpu, a.mem));
  }, [deviceMetrics]);

  // ========== 추이 집계 ==========
  const trendData = useMemo(() => {
    // 시간대별로 모든 장비의 기록을 합쳐서 AVG/MAX 계산
    const timeMap = new Map(); // key: timeLabel, value: { cpus: [], mems: [] }

    validDevices.forEach((d, i) => {
      const history = historyQueries[i]?.data || [];
      history.forEach(h => {
        const t = (h.COLLECTED_AT || '').substring(0, 16); // "YYYY-MM-DD HH:MM"
        if (!t) return;
        if (!timeMap.has(t)) timeMap.set(t, { cpus: [], mems: [] });
        const entry = timeMap.get(t);
        entry.cpus.push(Number(h.CPU_USAGE || 0));
        entry.mems.push(Number(h.MEM_USAGE || 0));
      });
    });

    const sorted = [...timeMap.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    return sorted.map(([time, { cpus, mems }]) => ({
      time: time.substring(11), // "HH:MM"
      cpuAvg: cpus.reduce((s, v) => s + v, 0) / cpus.length,
      cpuMin: Math.min(...cpus),
      cpuMax: Math.max(...cpus),
      memAvg: mems.reduce((s, v) => s + v, 0) / mems.length,
      memMin: Math.min(...mems),
      memMax: Math.max(...mems),
    }));
  }, [validDevices, historyQueries]);

  // ========== 트래픽 집계 ==========

  // 장비별 최신 트래픽 이용률(%) — 포트별 최대값 기준
  const deviceTrafficMetrics = useMemo(() => {
    return validDevices.map((d, i) => {
      const rows = trafficQueries[i]?.data || [];
      if (rows.length === 0) return { ...d, maxInUsed: 0, maxOutUsed: 0, avgInUsed: 0, avgOutUsed: 0 };
      // 가장 최근 시간대의 레코드만 취합
      const latest = rows.reduce((max, r) => (!max || r.COLLECTED_AT > max) ? r.COLLECTED_AT : max, null);
      const latestRows = rows.filter(r => r.COLLECTED_AT === latest);
      const inUseds = latestRows.map(r => getInPercent(r));
      const outUseds = latestRows.map(r => getOutPercent(r));
      const maxIn = Math.max(...inUseds, 0);
      const maxOut = Math.max(...outUseds, 0);
      const avgIn = inUseds.length > 0 ? inUseds.reduce((s, v) => s + v, 0) / inUseds.length : 0;
      const avgOut = outUseds.length > 0 ? outUseds.reduce((s, v) => s + v, 0) / outUseds.length : 0;
      return { ...d, maxInUsed: maxIn, maxOutUsed: maxOut, avgInUsed: avgIn, avgOutUsed: avgOut };
    }).filter(d => d.maxInUsed > 0 || d.maxOutUsed > 0);
  }, [validDevices, trafficQueries]);

  // Traffic TOP 10 (포트 최대 이용률 기준)
  const topTrafficIn = useMemo(() => {
    return [...deviceTrafficMetrics].sort((a, b) => b.maxInUsed - a.maxInUsed).slice(0, 10);
  }, [deviceTrafficMetrics]);

  const topTrafficOut = useMemo(() => {
    return [...deviceTrafficMetrics].sort((a, b) => b.maxOutUsed - a.maxOutUsed).slice(0, 10);
  }, [deviceTrafficMetrics]);

  // 포트별 시계열 데이터 (전체 기간, 포트별로 시간축 데이터 + 피크값)
  const portTimeSeriesData = useMemo(() => {
    const portMap = new Map(); // key: "deviceId_ifIndex"
    validDevices.forEach((d, i) => {
      const rows = trafficQueries[i]?.data || [];
      rows.forEach(r => {
        const key = `${d.DEVICE_ID}_${r.IF_INDEX}`;
        if (!portMap.has(key)) {
          portMap.set(key, {
            key,
            deviceName: d.DEVICE_NAME,
            deviceIp: d.DEVICE_IP,
            ifIndex: r.IF_INDEX,
            ifName: r.IF_NAME || r.IF_DESCR || `Port ${r.IF_INDEX}`,
            series: [],   // { time, inBps, outBps }
            peakInBps: 0, peakOutBps: 0,
            peakInTime: null, peakOutTime: null,
            peakInUsed: 0, peakOutUsed: 0,
          });
        }
        const entry = portMap.get(key);
        const t = (r.COLLECTED_AT || '').substring(0, 16);
        const inBps = getInBps(r);
        const outBps = getOutBps(r);
        const inUsed = getInPercent(r);
        const outUsed = getOutPercent(r);
        entry.series.push({ time: t, inBps, outBps, inUsed, outUsed });
        if (inBps > entry.peakInBps) { entry.peakInBps = inBps; entry.peakInTime = t; entry.peakInUsed = inUsed; }
        if (outBps > entry.peakOutBps) { entry.peakOutBps = outBps; entry.peakOutTime = t; entry.peakOutUsed = outUsed; }
      });
    });
    // 각 포트의 시리즈를 시간순 정렬
    portMap.forEach(p => p.series.sort((a, b) => a.time.localeCompare(b.time)));
    return [...portMap.values()];
  }, [validDevices, trafficQueries]);

  // TOP 10 포트 (피크 BPS 기준 정렬)
  const topPortIn = useMemo(() => {
    if (portTopUnit === 'bps') {
      return [...portTimeSeriesData].sort((a, b) => b.peakInBps - a.peakInBps).slice(0, 10);
    }
    return [...portTimeSeriesData].sort((a, b) => b.peakInUsed - a.peakInUsed).slice(0, 10);
  }, [portTimeSeriesData, portTopUnit]);

  const topPortOut = useMemo(() => {
    if (portTopUnit === 'bps') {
      return [...portTimeSeriesData].sort((a, b) => b.peakOutBps - a.peakOutBps).slice(0, 10);
    }
    return [...portTimeSeriesData].sort((a, b) => b.peakOutUsed - a.peakOutUsed).slice(0, 10);
  }, [portTimeSeriesData, portTopUnit]);

  // 트래픽 이용률 추이 (시간대별 전체 장비 평균)
  const trafficTrendData = useMemo(() => {
    const timeMap = new Map();
    validDevices.forEach((d, i) => {
      const rows = trafficQueries[i]?.data || [];
      rows.forEach(r => {
        const t = (r.COLLECTED_AT || '').substring(0, 16);
        if (!t) return;
        if (!timeMap.has(t)) timeMap.set(t, { inUseds: [], outUseds: [], inBpsList: [], outBpsList: [] });
        const entry = timeMap.get(t);
        entry.inUseds.push(getInPercent(r));
        entry.outUseds.push(getOutPercent(r));
        entry.inBpsList.push(getInBps(r));
        entry.outBpsList.push(getOutBps(r));
      });
    });
    const sorted = [...timeMap.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    return sorted.map(([time, { inUseds, outUseds, inBpsList, outBpsList }]) => ({
      time: time.substring(11),
      avgIn: inUseds.reduce((s, v) => s + v, 0) / inUseds.length,
      avgOut: outUseds.reduce((s, v) => s + v, 0) / outUseds.length,
      maxIn: Math.max(...inUseds, 0),
      maxOut: Math.max(...outUseds, 0),
      avgInBps: inBpsList.reduce((s, v) => s + v, 0) / inBpsList.length,
      avgOutBps: outBpsList.reduce((s, v) => s + v, 0) / outBpsList.length,
      maxInBps: Math.max(...inBpsList, 0),
      maxOutBps: Math.max(...outBpsList, 0),
    }));
  }, [validDevices, trafficQueries]);

  // ========== 5분 스냅샷 카드 데이터 ==========
  const snapshotCards = useMemo(() => {
    if (!isSnapshotMode) return [];
    const trafficMap = new Map();
    deviceTrafficMetrics.forEach(d => trafficMap.set(d.DEVICE_ID, d));
    // 인터페이스별 트래픽을 장비별로 그룹핑
    const portsByDevice = new Map();
    portTimeSeriesData.forEach(p => {
      const deviceKey = p.key.split('_')[0];
      if (!portsByDevice.has(deviceKey)) portsByDevice.set(deviceKey, []);
      portsByDevice.get(deviceKey).push(p);
    });
    return deviceMetrics.map(d => {
      const t = trafficMap.get(d.DEVICE_ID);
      const ports = portsByDevice.get(String(d.DEVICE_ID)) || [];
      return {
        ...d,
        inUsed: t?.maxInUsed ?? 0,
        outUsed: t?.maxOutUsed ?? 0,
        ports: ports.map(p => ({
          ifName: p.ifName,
          ifIndex: p.ifIndex,
          inUsed: p.peakInUsed || 0,
          outUsed: p.peakOutUsed || 0,
          inBps: p.peakInBps || 0,
          outBps: p.peakOutBps || 0,
        })),
      };
    });
  }, [isSnapshotMode, deviceMetrics, deviceTrafficMetrics, portTimeSeriesData]);

  // ========== 차트 옵션 ==========

  const tooltipStyle = {
    backgroundColor: 'rgba(15, 15, 35, 0.95)',
    borderColor: 'rgba(255,255,255,0.1)',
    textStyle: { color: '#f8fafc' },
  };

  // CPU TOP 10 바 차트
  const cpuTopOption = useMemo(() => {
    const list = [...topCpu].reverse();
    return {
      tooltip: {
        ...tooltipStyle,
        trigger: 'axis',
        formatter: (params) => {
          const d = params[0];
          return `<b>${d.name}</b><br/>CPU: ${Number(d.value).toFixed(2)}%`;
        },
      },
      grid: { left: 100, right: 30, top: 8, bottom: 8 },
      xAxis: {
        type: 'value', max: 100,
        axisLabel: { color: '#e2e8f0', fontSize: 11, formatter: '{value}%' },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.06)' } },
      },
      yAxis: {
        type: 'category',
        data: list.map(d => d.DEVICE_NAME),
        axisLabel: {
          color: '#94a3b8', fontSize: 11, fontWeight: 500,
          width: 85, overflow: 'truncate',
        },
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.08)' } },
      },
      series: [{
        type: 'bar', barMaxWidth: 20,
        data: list.map(d => ({
          value: d.cpu,
          itemStyle: {
            color: d.cpu >= 80 ? '#ef4444' : d.cpu >= 50 ? '#f59e0b' : '#3b82f6',
            borderRadius: [0, 4, 4, 0],
          },
        })),
        label: {
          show: true, position: 'right', color: '#94a3b8', fontSize: 11,
          formatter: (p) => `${Number(p.value).toFixed(2)}%`,
        },
      }],
    };
  }, [topCpu]);

  // MEM TOP 10 바 차트
  const memTopOption = useMemo(() => {
    const list = [...topMem].reverse();
    return {
      tooltip: {
        ...tooltipStyle,
        trigger: 'axis',
        formatter: (params) => {
          const d = params[0];
          return `<b>${d.name}</b><br/>MEM: ${Number(d.value).toFixed(2)}%`;
        },
      },
      grid: { left: 100, right: 30, top: 8, bottom: 8 },
      xAxis: {
        type: 'value', max: 100,
        axisLabel: { color: '#e2e8f0', fontSize: 11, formatter: '{value}%' },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.06)' } },
      },
      yAxis: {
        type: 'category',
        data: list.map(d => d.DEVICE_NAME),
        axisLabel: {
          color: '#94a3b8', fontSize: 11, fontWeight: 500,
          width: 85, overflow: 'truncate',
        },
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.08)' } },
      },
      series: [{
        type: 'bar', barMaxWidth: 20,
        data: list.map(d => ({
          value: d.mem,
          itemStyle: {
            color: d.mem >= 80 ? '#ef4444' : d.mem >= 50 ? '#f59e0b' : '#10b981',
            borderRadius: [0, 4, 4, 0],
          },
        })),
        label: {
          show: true, position: 'right', color: '#94a3b8', fontSize: 11,
          formatter: (p) => `${Number(p.value).toFixed(2)}%`,
        },
      }],
    };
  }, [topMem]);

  // CPU 추이 라인 차트
  const cpuTrendOption = useMemo(() => {
    if (trendData.length === 0) return {};
    return {
      tooltip: {
        ...tooltipStyle,
        trigger: 'axis',
        formatter: (params) => {
          const time = params[0]?.axisValue;
          let html = `<div style="font-weight:600;margin-bottom:4px">${time}</div>`;
          params.forEach(p => {
            html += `<div>${p.marker} ${p.seriesName}: <b>${Number(p.value).toFixed(2)}%</b></div>`;
          });
          return html;
        },
      },
      legend: {
        data: ['평균', '최대', '최소'],
        textStyle: { color: '#94a3b8', fontSize: 11 },
        top: 0,
      },
      grid: { left: 45, right: 16, top: 36, bottom: 24 },
      xAxis: {
        type: 'category',
        data: trendData.map(d => d.time),
        axisLabel: { color: '#e2e8f0', fontSize: 10 },
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.08)' } },
      },
      yAxis: {
        type: 'value', max: 100,
        axisLabel: { color: '#e2e8f0', fontSize: 10, formatter: '{value}%' },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.06)' } },
      },
      series: [
        {
          name: '평균', type: 'line', smooth: true, showSymbol: false,
          lineStyle: { width: 2, color: '#3b82f6' },
          itemStyle: { color: '#3b82f6' },
          areaStyle: { color: 'rgba(59,130,246,0.08)' },
          data: trendData.map(d => d.cpuAvg),
        },
        {
          name: '최대', type: 'line', smooth: true, showSymbol: false,
          lineStyle: { width: 1, color: 'rgba(239,68,68,0.5)', type: 'dashed' },
          itemStyle: { color: '#ef4444' },
          data: trendData.map(d => d.cpuMax),
        },
        {
          name: '최소', type: 'line', smooth: true, showSymbol: false,
          lineStyle: { width: 1, color: 'rgba(59,130,246,0.3)', type: 'dashed' },
          itemStyle: { color: '#60a5fa' },
          data: trendData.map(d => d.cpuMin),
        },
      ],
    };
  }, [trendData]);

  // MEM 추이 라인 차트
  const memTrendOption = useMemo(() => {
    if (trendData.length === 0) return {};
    return {
      tooltip: {
        ...tooltipStyle,
        trigger: 'axis',
        formatter: (params) => {
          const time = params[0]?.axisValue;
          let html = `<div style="font-weight:600;margin-bottom:4px">${time}</div>`;
          params.forEach(p => {
            html += `<div>${p.marker} ${p.seriesName}: <b>${Number(p.value).toFixed(2)}%</b></div>`;
          });
          return html;
        },
      },
      legend: {
        data: ['평균', '최대', '최소'],
        textStyle: { color: '#94a3b8', fontSize: 11 },
        top: 0,
      },
      grid: { left: 45, right: 16, top: 36, bottom: 24 },
      xAxis: {
        type: 'category',
        data: trendData.map(d => d.time),
        axisLabel: { color: '#e2e8f0', fontSize: 10 },
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.08)' } },
      },
      yAxis: {
        type: 'value', max: 100,
        axisLabel: { color: '#e2e8f0', fontSize: 10, formatter: '{value}%' },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.06)' } },
      },
      series: [
        {
          name: '평균', type: 'line', smooth: true, showSymbol: false,
          lineStyle: { width: 2, color: '#10b981' },
          itemStyle: { color: '#10b981' },
          areaStyle: { color: 'rgba(16,185,129,0.08)' },
          data: trendData.map(d => d.memAvg),
        },
        {
          name: '최대', type: 'line', smooth: true, showSymbol: false,
          lineStyle: { width: 1, color: 'rgba(239,68,68,0.5)', type: 'dashed' },
          itemStyle: { color: '#ef4444' },
          data: trendData.map(d => d.memMax),
        },
        {
          name: '최소', type: 'line', smooth: true, showSymbol: false,
          lineStyle: { width: 1, color: 'rgba(16,185,129,0.3)', type: 'dashed' },
          itemStyle: { color: '#34d399' },
          data: trendData.map(d => d.memMin),
        },
      ],
    };
  }, [trendData]);

  // CPU 분포 도넛
  const cpuDistOption = useMemo(() => ({
    tooltip: {
      trigger: 'item',
      ...tooltipStyle,
      formatter: '{b}: {c}대 ({d}%)',
    },
    legend: {
      orient: 'vertical', right: 10, top: 'center',
      textStyle: { color: '#94a3b8', fontSize: 12 },
    },
    series: [{
      type: 'pie', radius: ['45%', '70%'], center: ['35%', '50%'],
      avoidLabelOverlap: false,
      itemStyle: { borderRadius: 6, borderColor: 'rgba(15,15,35,0.8)', borderWidth: 2 },
      label: {
        show: true, fontSize: 12, color: '#e2e8f0',
        formatter: '{b}\n{c}대 ({d}%)',
      },
      emphasis: {
        label: { fontSize: 14, fontWeight: 'bold', color: '#f8fafc' },
      },
      data: cpuDist.map(r => ({
        value: r.count, name: r.label,
        itemStyle: { color: r.color },
      })),
    }],
  }), [cpuDist]);

  // MEM 분포 도넛
  const memDistOption = useMemo(() => ({
    tooltip: {
      trigger: 'item',
      ...tooltipStyle,
      formatter: '{b}: {c}대 ({d}%)',
    },
    legend: {
      orient: 'vertical', right: 10, top: 'center',
      textStyle: { color: '#94a3b8', fontSize: 12 },
    },
    series: [{
      type: 'pie', radius: ['45%', '70%'], center: ['35%', '50%'],
      avoidLabelOverlap: false,
      itemStyle: { borderRadius: 6, borderColor: 'rgba(15,15,35,0.8)', borderWidth: 2 },
      label: {
        show: true, fontSize: 12, color: '#e2e8f0',
        formatter: '{b}\n{c}대 ({d}%)',
      },
      emphasis: {
        label: { fontSize: 14, fontWeight: 'bold', color: '#f8fafc' },
      },
      data: memDist.map(r => ({
        value: r.count, name: r.label,
        itemStyle: { color: r.color },
      })),
    }],
  }), [memDist]);

  // Traffic IN TOP 10 바 차트 (이용률 %)
  const trafficInTopOption = useMemo(() => {
    const list = [...topTrafficIn].reverse();
    return {
      tooltip: {
        ...tooltipStyle,
        trigger: 'axis',
        formatter: (params) => {
          const d = params[0];
          return `<b>${d.name}</b><br/>IN 이용률: ${Number(d.value).toFixed(2)}%`;
        },
      },
      grid: { left: 100, right: 30, top: 8, bottom: 8 },
      xAxis: {
        type: 'value', max: 100,
        axisLabel: { color: '#e2e8f0', fontSize: 11, formatter: '{value}%' },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.06)' } },
      },
      yAxis: {
        type: 'category',
        data: list.map(d => d.DEVICE_NAME),
        axisLabel: { color: '#94a3b8', fontSize: 11, fontWeight: 500, width: 85, overflow: 'truncate' },
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.08)' } },
      },
      series: [{
        type: 'bar', barMaxWidth: 20,
        data: list.map(d => ({
          value: d.maxInUsed,
          itemStyle: {
            color: d.maxInUsed >= 80 ? '#ef4444' : d.maxInUsed >= 50 ? '#f59e0b' : '#06b6d4',
            borderRadius: [0, 4, 4, 0],
          },
        })),
        label: {
          show: true, position: 'right', color: '#94a3b8', fontSize: 11,
          formatter: (p) => `${Number(p.value).toFixed(2)}%`,
        },
      }],
    };
  }, [topTrafficIn]);

  // Traffic OUT TOP 10 바 차트 (이용률 %)
  const trafficOutTopOption = useMemo(() => {
    const list = [...topTrafficOut].reverse();
    return {
      tooltip: {
        ...tooltipStyle,
        trigger: 'axis',
        formatter: (params) => {
          const d = params[0];
          return `<b>${d.name}</b><br/>OUT 이용률: ${Number(d.value).toFixed(2)}%`;
        },
      },
      grid: { left: 100, right: 30, top: 8, bottom: 8 },
      xAxis: {
        type: 'value', max: 100,
        axisLabel: { color: '#e2e8f0', fontSize: 11, formatter: '{value}%' },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.06)' } },
      },
      yAxis: {
        type: 'category',
        data: list.map(d => d.DEVICE_NAME),
        axisLabel: { color: '#94a3b8', fontSize: 11, fontWeight: 500, width: 85, overflow: 'truncate' },
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.08)' } },
      },
      series: [{
        type: 'bar', barMaxWidth: 20,
        data: list.map(d => ({
          value: d.maxOutUsed,
          itemStyle: {
            color: d.maxOutUsed >= 80 ? '#ef4444' : d.maxOutUsed >= 50 ? '#f59e0b' : '#8b5cf6',
            borderRadius: [0, 4, 4, 0],
          },
        })),
        label: {
          show: true, position: 'right', color: '#94a3b8', fontSize: 11,
          formatter: (p) => `${Number(p.value).toFixed(2)}%`,
        },
      }],
    };
  }, [topTrafficOut]);

  // 포트별 IN TOP 10 라인 차트 (시계열 + 피크 포인트)
  const PORT_COLORS = ['#06b6d4', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#ec4899', '#84cc16', '#f97316', '#14b8a6'];
  const portInTopOption = useMemo(() => {
    if (topPortIn.length === 0) return {};
    const isBps = portTopUnit === 'bps';
    // 전체 시간축 통합
    const allTimes = [...new Set(topPortIn.flatMap(p => p.series.map(s => s.time)))].sort();
    const series = topPortIn.map((port, idx) => {
      const color = PORT_COLORS[idx % PORT_COLORS.length];
      const timeValueMap = new Map(port.series.map(s => [s.time, isBps ? s.inBps : s.inUsed]));
      const data = allTimes.map(t => timeValueMap.get(t) ?? null);
      // 피크 포인트 인덱스
      const peakTime = isBps ? port.peakInTime : port.series.reduce((max, s) => (!max || s.inUsed > max.inUsed) ? s : max, null)?.time;
      const peakIdx = allTimes.indexOf(peakTime);
      return {
        name: `${port.deviceName} - ${port.ifName}`,
        type: 'line', smooth: true, showSymbol: false,
        lineStyle: { width: 1.5, color },
        itemStyle: { color },
        data: data,
        markPoint: peakIdx >= 0 ? {
          symbol: 'circle', symbolSize: 8,
          itemStyle: { color, borderColor: '#fff', borderWidth: 2 },
          label: {
            show: true, position: 'top', fontSize: 10, fontWeight: 600,
            color,
            formatter: () => isBps ? formatBpsValue(data[peakIdx]) : `${Number(data[peakIdx]).toFixed(2)}%`,
          },
          data: [{ coord: [peakIdx, data[peakIdx]] }],
        } : undefined,
      };
    });
    return {
      tooltip: {
        ...tooltipStyle, trigger: 'axis',
        formatter: (params) => {
          let html = `<div style="font-weight:600;margin-bottom:4px">${params[0]?.axisValue}</div>`;
          params.forEach(p => {
            if (p.value != null) {
              const val = isBps ? formatBpsValue(p.value) : `${Number(p.value).toFixed(2)}%`;
              html += `<div>${p.marker} ${p.seriesName}: <b>${val}</b></div>`;
            }
          });
          return html;
        },
      },
      legend: { show: false },
      grid: { left: isBps ? 70 : 45, right: 16, top: 8, bottom: 24 },
      xAxis: {
        type: 'category', data: allTimes.map(t => t.substring(11)),
        axisLabel: { color: '#e2e8f0', fontSize: 10 },
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.08)' } },
      },
      yAxis: {
        type: 'value',
        axisLabel: { color: '#e2e8f0', fontSize: 10, formatter: isBps ? (v) => formatBpsValue(v) : (v) => `${v.toFixed(2)}%` },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.06)' } },
      },
      series,
    };
  }, [topPortIn, portTopUnit]);

  // 포트별 OUT TOP 10 라인 차트 (시계열 + 피크 포인트)
  const portOutTopOption = useMemo(() => {
    if (topPortOut.length === 0) return {};
    const isBps = portTopUnit === 'bps';
    const allTimes = [...new Set(topPortOut.flatMap(p => p.series.map(s => s.time)))].sort();
    const series = topPortOut.map((port, idx) => {
      const color = PORT_COLORS[idx % PORT_COLORS.length];
      const timeValueMap = new Map(port.series.map(s => [s.time, isBps ? s.outBps : s.outUsed]));
      const data = allTimes.map(t => timeValueMap.get(t) ?? null);
      const peakTime = isBps ? port.peakOutTime : port.series.reduce((max, s) => (!max || s.outUsed > max.outUsed) ? s : max, null)?.time;
      const peakIdx = allTimes.indexOf(peakTime);
      return {
        name: `${port.deviceName} - ${port.ifName}`,
        type: 'line', smooth: true, showSymbol: false,
        lineStyle: { width: 1.5, color },
        itemStyle: { color },
        data: data,
        markPoint: peakIdx >= 0 ? {
          symbol: 'circle', symbolSize: 8,
          itemStyle: { color, borderColor: '#fff', borderWidth: 2 },
          label: {
            show: true, position: 'top', fontSize: 10, fontWeight: 600,
            color,
            formatter: () => isBps ? formatBpsValue(data[peakIdx]) : `${Number(data[peakIdx]).toFixed(2)}%`,
          },
          data: [{ coord: [peakIdx, data[peakIdx]] }],
        } : undefined,
      };
    });
    return {
      tooltip: {
        ...tooltipStyle, trigger: 'axis',
        formatter: (params) => {
          let html = `<div style="font-weight:600;margin-bottom:4px">${params[0]?.axisValue}</div>`;
          params.forEach(p => {
            if (p.value != null) {
              const val = isBps ? formatBpsValue(p.value) : `${Number(p.value).toFixed(2)}%`;
              html += `<div>${p.marker} ${p.seriesName}: <b>${val}</b></div>`;
            }
          });
          return html;
        },
      },
      legend: { show: false },
      grid: { left: isBps ? 70 : 45, right: 16, top: 8, bottom: 24 },
      xAxis: {
        type: 'category', data: allTimes.map(t => t.substring(11)),
        axisLabel: { color: '#e2e8f0', fontSize: 10 },
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.08)' } },
      },
      yAxis: {
        type: 'value',
        axisLabel: { color: '#e2e8f0', fontSize: 10, formatter: isBps ? (v) => formatBpsValue(v) : (v) => `${v.toFixed(2)}%` },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.06)' } },
      },
      series,
    };
  }, [topPortOut, portTopUnit]);

  // 트래픽 이용률 추이 라인 차트
  const trafficTrendOption = useMemo(() => {
    if (trafficTrendData.length === 0) return {};
    const isBps = portTopUnit === 'bps';
    return {
      tooltip: {
        ...tooltipStyle,
        trigger: 'axis',
        formatter: (params) => {
          const time = params[0]?.axisValue;
          let html = `<div style="font-weight:600;margin-bottom:4px">${time}</div>`;
          params.forEach(p => {
            const val = isBps ? formatBpsValue(p.value) : `${Number(p.value).toFixed(2)}%`;
            html += `<div>${p.marker} ${p.seriesName}: <b>${val}</b></div>`;
          });
          return html;
        },
      },
      legend: {
        data: ['IN 평균', 'OUT 평균', 'IN 최대', 'OUT 최대'],
        textStyle: { color: '#94a3b8', fontSize: 11 },
        top: 0,
      },
      grid: { left: isBps ? 70 : 45, right: 16, top: 36, bottom: 24 },
      xAxis: {
        type: 'category',
        data: trafficTrendData.map(d => d.time),
        axisLabel: { color: '#e2e8f0', fontSize: 10 },
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.08)' } },
      },
      yAxis: {
        type: 'value',
        axisLabel: { color: '#e2e8f0', fontSize: 10, formatter: isBps ? (v) => formatBpsValue(v) : (v) => `${v.toFixed(2)}%` },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.06)' } },
      },
      series: [
        {
          name: 'IN 평균', type: 'line', smooth: true, showSymbol: false,
          lineStyle: { width: 2, color: '#06b6d4' },
          itemStyle: { color: '#06b6d4' },
          areaStyle: { color: 'rgba(6,182,212,0.08)' },
          data: trafficTrendData.map(d => isBps ? d.avgInBps : d.avgIn),
        },
        {
          name: 'OUT 평균', type: 'line', smooth: true, showSymbol: false,
          lineStyle: { width: 2, color: '#8b5cf6' },
          itemStyle: { color: '#8b5cf6' },
          areaStyle: { color: 'rgba(139,92,246,0.08)' },
          data: trafficTrendData.map(d => isBps ? d.avgOutBps : d.avgOut),
        },
        {
          name: 'IN 최대', type: 'line', smooth: true, showSymbol: false,
          lineStyle: { width: 1, color: 'rgba(6,182,212,0.4)', type: 'dashed' },
          itemStyle: { color: '#06b6d4' },
          data: trafficTrendData.map(d => isBps ? d.maxInBps : d.maxIn),
        },
        {
          name: 'OUT 최대', type: 'line', smooth: true, showSymbol: false,
          lineStyle: { width: 1, color: 'rgba(139,92,246,0.4)', type: 'dashed' },
          itemStyle: { color: '#8b5cf6' },
          data: trafficTrendData.map(d => isBps ? d.maxOutBps : d.maxOut),
        },
      ],
    };
  }, [trafficTrendData, portTopUnit]);

  // 고부하 장비 테이블 컬럼
  const highLoadColumns = useMemo(() => [
    {
      key: 'DEVICE_NAME', label: '장비명', width: '160px', sortable: true,
      render: (v) => <span style={{ color: '#f8fafc', fontWeight: 600 }}>{v}</span>,
    },
    {
      key: 'DEVICE_IP', label: 'IP', width: '140px', sortable: true,
      render: (v) => <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#94a3b8' }}>{v}</span>,
    },
    {
      key: 'cpu', label: 'CPU %', width: '100px', sortable: true, align: 'center',
      render: (v) => (
        <span style={{ color: v >= 80 ? '#ef4444' : v >= 50 ? '#f59e0b' : '#3b82f6', fontWeight: 600 }}>
          {Number(v).toFixed(2)}%
        </span>
      ),
    },
    {
      key: 'mem', label: 'MEM %', width: '100px', sortable: true, align: 'center',
      render: (v) => (
        <span style={{ color: v >= 80 ? '#ef4444' : v >= 50 ? '#f59e0b' : '#10b981', fontWeight: 600 }}>
          {Number(v).toFixed(2)}%
        </span>
      ),
    },
    {
      key: 'memUsed', label: 'MEM Used', width: '120px', sortable: true, align: 'right',
      render: (v) => formatMemory(v),
    },
    {
      key: 'memTotal', label: 'MEM Total', width: '120px', sortable: true, align: 'right',
      render: (v) => <span style={{ color: '#64748b' }}>{formatMemory(v)}</span>,
    },
  ], []);

  const [sortField, setSortField] = useState('cpu');
  const [sortOrder, setSortOrder] = useState('desc');

  const handleSort = useCallback((field) => {
    setSortField(prev => {
      if (prev === field) {
        setSortOrder(o => o === 'asc' ? 'desc' : 'asc');
        return field;
      }
      setSortOrder('desc');
      return field;
    });
  }, []);

  const sortedHighLoad = useMemo(() => {
    return [...highLoadDevices].sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      const cmp = typeof aVal === 'string' ? aVal.localeCompare(bVal) : aVal - bVal;
      return sortOrder === 'asc' ? cmp : -cmp;
    });
  }, [highLoadDevices, sortField, sortOrder]);

  const handlePeriod = useCallback((idx) => {
    setPeriodIdx(idx);
  }, []);

  return (
    <div className="perf-stats-container">
      {/* Header */}
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">
            <i className="bi bi-speedometer2"></i>
            성능 통계
          </h1>
          <span className="page-subtitle">CPU / Memory 성능 현황 분석</span>
        </div>
        <div className="page-header-right">
          <button
            className="pdf-export-btn"
            onClick={() => setPdfPreviewOpen(true)}
            title="PDF 미리보기"
          >
            <i className="bi bi-file-earmark-pdf"></i>
            PDF
          </button>
          <div className="period-selector">
            {PERIOD_OPTIONS.map((opt, idx) => (
              <button
                key={idx}
                className={`period-btn ${periodIdx === idx ? 'active' : ''}`}
                onClick={() => handlePeriod(idx)}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {isCustomMode && (
            <div className="custom-range-picker">
              <input
                type="datetime-local"
                className="custom-range-input"
                value={customRange.start}
                onChange={e => setCustomRange(prev => ({ ...prev, start: e.target.value }))}
              />
              <span className="custom-range-separator">~</span>
              <input
                type="datetime-local"
                className="custom-range-input"
                value={customRange.end}
                onChange={e => setCustomRange(prev => ({ ...prev, end: e.target.value }))}
              />
            </div>
          )}
        </div>
      </div>

      {/* 패널 래퍼 */}
      <div className="perf-stats-panels-wrapper">
        <WatchSidebar
          onGroupSelect={setSelectedGroup}
          title="관제 그룹"
          titleIcon="bi bi-speedometer2"
          showImportButton={false}
        />
        <div className="perf-stats-content">
          <PdfPreviewModal
            open={pdfPreviewOpen}
            onClose={() => setPdfPreviewOpen(false)}
            fileName={`성능통계_${currentPeriod?.label || ''}`}
            reportType="performance"
            chartOptions={{
              cpuTop: cpuTopOption,
              memTop: memTopOption,
              cpuTrend: cpuTrendOption,
              memTrend: memTrendOption,
              cpuDist: cpuDistOption,
              memDist: memDistOption,
              trafficInTop: trafficInTopOption,
              trafficOutTop: trafficOutTopOption,
              portInTop: portInTopOption,
              portOutTop: portOutTopOption,
              trafficTrend: trafficTrendOption,
            }}
            reportData={{
              summary,
              highLoadDevices,
              portTrafficMetrics: portTimeSeriesData || [],
              period: currentPeriod,
            }}
          />
          {/* Summary Cards */}
          <div className="stats-summary-row perf-summary-7col">
            <div className="stats-card">
              <div className="stats-card-label">장비 수</div>
              <div className="stats-card-value" style={{ color: '#818cf8' }}>
                {summary.count}
              </div>
            </div>
            <div className="stats-card">
              <div className="stats-card-label">평균 CPU</div>
              <div className="stats-card-value" style={{ color: '#3b82f6' }}>
                {isLoadingData ? '-' : `${summary.avgCpu}%`}
              </div>
            </div>
            <div className="stats-card">
              <div className="stats-card-label">평균 MEM</div>
              <div className="stats-card-value" style={{ color: '#10b981' }}>
                {isLoadingData ? '-' : `${summary.avgMem}%`}
              </div>
            </div>
            <div className="stats-card">
              <div className="stats-card-label">최고 CPU</div>
              <div className="stats-card-value" style={{ color: '#f97316' }}>
                {isLoadingData ? '-' : `${summary.maxCpu.value}%`}
              </div>
              {!isLoadingData && summary.maxCpu.name !== '-' && (
                <div className="stats-card-sub">{summary.maxCpu.name}</div>
              )}
            </div>
            <div className="stats-card">
              <div className="stats-card-label">최고 MEM</div>
              <div className="stats-card-value" style={{ color: '#ef4444' }}>
                {isLoadingData ? '-' : `${summary.maxMem.value}%`}
              </div>
              {!isLoadingData && summary.maxMem.name !== '-' && (
                <div className="stats-card-sub">{summary.maxMem.name}</div>
              )}
            </div>
            <div className="stats-card">
              <div className="stats-card-label">최대 IN</div>
              <div className="stats-card-value" style={{ color: '#06b6d4' }}>
                {isLoadingTraffic ? '-' : topTrafficIn[0] ? `${topTrafficIn[0].maxInUsed.toFixed(2)}%` : '-'}
              </div>
              {!isLoadingTraffic && topTrafficIn[0] && (
                <div className="stats-card-sub">{topTrafficIn[0].DEVICE_NAME}</div>
              )}
            </div>
            <div className="stats-card">
              <div className="stats-card-label">최대 OUT</div>
              <div className="stats-card-value" style={{ color: '#8b5cf6' }}>
                {isLoadingTraffic ? '-' : topTrafficOut[0] ? `${topTrafficOut[0].maxOutUsed.toFixed(2)}%` : '-'}
              </div>
              {!isLoadingTraffic && topTrafficOut[0] && (
                <div className="stats-card-sub">{topTrafficOut[0].DEVICE_NAME}</div>
              )}
            </div>
          </div>

          {/* Charts Grid */}
          <div className="stats-grid">
            {/* Row 1: CPU TOP 10 + MEM TOP 10 */}
            <div className="stats-panel">
              <div className="stats-panel-header">
                <i className="bi bi-cpu"></i>
                CPU TOP 10
              </div>
              <div className="stats-panel-body">
                {isLoadingData ? <LoadingSpinner /> :
                  topCpu.length === 0 ? <EmptyState message="데이터가 없습니다" /> :
                  <SafeECharts option={cpuTopOption} style={{ height: '100%' }} notMerge={false} />
                }
              </div>
            </div>

            <div className="stats-panel">
              <div className="stats-panel-header">
                <i className="bi bi-memory"></i>
                MEM TOP 10
              </div>
              <div className="stats-panel-body">
                {isLoadingData ? <LoadingSpinner /> :
                  topMem.length === 0 ? <EmptyState message="데이터가 없습니다" /> :
                  <SafeECharts option={memTopOption} style={{ height: '100%' }} notMerge={false} />
                }
              </div>
            </div>

            {/* Row 2: CPU 추이 + MEM 추이 OR 5분 스냅샷 카드 */}
            {isSnapshotMode ? (
              <div className="stats-panel panel-full-width">
                <div className="stats-panel-header">
                  <i className="bi bi-grid-3x3-gap"></i>
                  장비별 현재 스냅샷
                </div>
                <div className="stats-panel-body" style={{ padding: '16px' }}>
                  {isLoadingData ? <LoadingSpinner /> :
                    snapshotCards.length === 0 ? <EmptyState message="스냅샷 데이터가 없습니다" /> :
                    <div className="snapshot-grid">
                      {snapshotCards.map(card => (
                        <div key={card.DEVICE_ID} className="snapshot-card">
                          <div className="snapshot-card-header">
                            <span className="snapshot-card-name">{card.DEVICE_NAME}</span>
                            <span className="snapshot-card-ip">{card.DEVICE_IP}</span>
                          </div>
                          <div className="snapshot-metric-row">
                            <span className="snapshot-metric-label">CPU</span>
                            <div className="snapshot-progress">
                              <div
                                className="snapshot-progress-fill"
                                style={{
                                  width: `${Math.min(card.cpu, 100)}%`,
                                  background: card.cpu >= 80 ? '#ef4444' : card.cpu >= 50 ? '#f59e0b' : '#10b981',
                                }}
                              />
                            </div>
                            <span className="snapshot-metric-value" style={{
                              color: card.cpu >= 80 ? '#ef4444' : card.cpu >= 50 ? '#f59e0b' : '#10b981',
                            }}>
                              {card.cpu.toFixed(2)}%
                            </span>
                          </div>
                          <div className="snapshot-metric-row">
                            <span className="snapshot-metric-label">MEM</span>
                            <div className="snapshot-progress">
                              <div
                                className="snapshot-progress-fill"
                                style={{
                                  width: `${Math.min(card.mem, 100)}%`,
                                  background: card.mem >= 80 ? '#ef4444' : card.mem >= 50 ? '#f59e0b' : '#3b82f6',
                                }}
                              />
                            </div>
                            <span className="snapshot-metric-value" style={{
                              color: card.mem >= 80 ? '#ef4444' : card.mem >= 50 ? '#f59e0b' : '#3b82f6',
                            }}>
                              {card.mem.toFixed(2)}%
                            </span>
                          </div>
                          <div className="snapshot-traffic-row">
                            <span>IN <b style={{ color: '#06b6d4' }}>{card.inUsed.toFixed(2)}%</b></span>
                            <span>OUT <b style={{ color: '#8b5cf6' }}>{card.outUsed.toFixed(2)}%</b></span>
                          </div>
                        </div>
                      ))}
                    </div>
                  }
                </div>
              </div>
            ) : (
              <>
                <div className="stats-panel">
                  <div className="stats-panel-header">
                    <i className="bi bi-graph-up"></i>
                    CPU 추이 ({currentPeriod?.label})
                  </div>
                  <div className="stats-panel-body">
                    {historyQueries.some(q => q.isLoading) ? <LoadingSpinner /> :
                      trendData.length === 0 ? <EmptyState message="추이 데이터가 없습니다" /> :
                      <SafeECharts option={cpuTrendOption} style={{ height: '100%' }} notMerge={false} />
                    }
                  </div>
                </div>

                <div className="stats-panel">
                  <div className="stats-panel-header">
                    <i className="bi bi-graph-up"></i>
                    MEM 추이 ({currentPeriod?.label})
                  </div>
                  <div className="stats-panel-body">
                    {historyQueries.some(q => q.isLoading) ? <LoadingSpinner /> :
                      trendData.length === 0 ? <EmptyState message="추이 데이터가 없습니다" /> :
                      <SafeECharts option={memTrendOption} style={{ height: '100%' }} notMerge={false} />
                    }
                  </div>
                </div>
              </>
            )}

            {/* Row 3: CPU 분포 + MEM 분포 */}
            <div className="stats-panel">
              <div className="stats-panel-header">
                <i className="bi bi-pie-chart"></i>
                CPU 분포
              </div>
              <div className="stats-panel-body">
                {isLoadingData ? <LoadingSpinner /> :
                  deviceMetrics.length === 0 ? <EmptyState message="데이터가 없습니다" /> :
                  <SafeECharts option={cpuDistOption} style={{ height: '100%' }} notMerge={false} />
                }
              </div>
            </div>

            <div className="stats-panel">
              <div className="stats-panel-header">
                <i className="bi bi-pie-chart"></i>
                MEM 분포
              </div>
              <div className="stats-panel-body">
                {isLoadingData ? <LoadingSpinner /> :
                  deviceMetrics.length === 0 ? <EmptyState message="데이터가 없습니다" /> :
                  <SafeECharts option={memDistOption} style={{ height: '100%' }} notMerge={false} />
                }
              </div>
            </div>

            {/* Row 4: 장비별 Traffic IN/OUT TOP 10 */}
            <div className="stats-panel">
              <div className="stats-panel-header">
                <i className="bi bi-arrow-down-circle"></i>
                장비별 IN TOP 10
              </div>
              <div className="stats-panel-body">
                {isLoadingTraffic ? <LoadingSpinner /> :
                  topTrafficIn.length === 0 ? <EmptyState message="트래픽 데이터가 없습니다" /> :
                  <SafeECharts option={trafficInTopOption} style={{ height: '100%' }} notMerge={false} />
                }
              </div>
            </div>

            <div className="stats-panel">
              <div className="stats-panel-header">
                <i className="bi bi-arrow-up-circle"></i>
                장비별 OUT TOP 10
              </div>
              <div className="stats-panel-body">
                {isLoadingTraffic ? <LoadingSpinner /> :
                  topTrafficOut.length === 0 ? <EmptyState message="트래픽 데이터가 없습니다" /> :
                  <SafeECharts option={trafficOutTopOption} style={{ height: '100%' }} notMerge={false} />
                }
              </div>
            </div>

            {/* Row 5: 포트별 Traffic IN/OUT TOP 10 — 5분 모드에서는 카드 */}
            {isSnapshotMode ? (
              <div className="stats-panel panel-full-width">
                <div className="stats-panel-header">
                  <i className="bi bi-ethernet"></i> 포트별 트래픽 스냅샷
                </div>
                <div className="stats-panel-body" style={{ padding: '16px' }}>
                  {isLoadingTraffic ? <LoadingSpinner /> :
                    portTimeSeriesData.length === 0 ? <EmptyState message="포트 트래픽 데이터가 없습니다" /> :
                    <div className="snapshot-grid">
                      {[...portTimeSeriesData].sort((a, b) => (b.peakInUsed + b.peakOutUsed) - (a.peakInUsed + a.peakOutUsed)).slice(0, 10).map(port => (
                        <div key={port.key} className="snapshot-card">
                          <div className="snapshot-card-header">
                            <span className="snapshot-card-name">{port.deviceName}</span>
                            <span className="snapshot-card-ip">{port.ifName}</span>
                          </div>
                          <div className="snapshot-metric-row">
                            <span className="snapshot-metric-label" style={{ color: '#06b6d4' }}>IN</span>
                            <div className="snapshot-progress">
                              <div className="snapshot-progress-fill" style={{ width: `${Math.min((port.peakInBps / Math.max(...portTimeSeriesData.map(p => p.peakInBps), 1)) * 100, 100)}%`, background: '#06b6d4' }} />
                            </div>
                            <span className="snapshot-metric-value" style={{ color: '#06b6d4', minWidth: '80px', textAlign: 'right' }}>
                              {formatBpsValue(port.peakInBps)}
                            </span>
                          </div>
                          <div className="snapshot-metric-row">
                            <span className="snapshot-metric-label" style={{ color: '#8b5cf6' }}>OUT</span>
                            <div className="snapshot-progress">
                              <div className="snapshot-progress-fill" style={{ width: `${Math.min((port.peakOutBps / Math.max(...portTimeSeriesData.map(p => p.peakOutBps), 1)) * 100, 100)}%`, background: '#8b5cf6' }} />
                            </div>
                            <span className="snapshot-metric-value" style={{ color: '#8b5cf6', minWidth: '80px', textAlign: 'right' }}>
                              {formatBpsValue(port.peakOutBps)}
                            </span>
                          </div>
                          {port.peakInUsed > 0 && (
                            <div className="snapshot-traffic-row">
                              <span>IN <b style={{ color: '#06b6d4' }}>{port.peakInUsed.toFixed(2)}%</b></span>
                              <span>OUT <b style={{ color: '#8b5cf6' }}>{port.peakOutUsed.toFixed(2)}%</b></span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  }
                </div>
              </div>
            ) : (
              <>
                <div className="stats-panel">
                  <div className="stats-panel-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span><i className="bi bi-ethernet"></i> 포트별 IN TOP 10</span>
                    <div style={{ display: 'flex', gap: '4px', background: 'rgba(255,255,255,0.06)', borderRadius: '8px', padding: '2px' }}>
                      <button onClick={() => setPortTopUnit('percent')} style={{ padding: '4px 10px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '11px', fontWeight: 600, transition: 'all 0.2s', background: portTopUnit === 'percent' ? 'rgba(99,102,241,0.8)' : 'transparent', color: portTopUnit === 'percent' ? '#fff' : '#94a3b8' }}>%</button>
                      <button onClick={() => setPortTopUnit('bps')} style={{ padding: '4px 10px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '11px', fontWeight: 600, transition: 'all 0.2s', background: portTopUnit === 'bps' ? 'rgba(99,102,241,0.8)' : 'transparent', color: portTopUnit === 'bps' ? '#fff' : '#94a3b8' }}>BPS</button>
                    </div>
                  </div>
                  <div className="stats-panel-body" style={{ minHeight: 320 }}>
                    {isLoadingTraffic ? <LoadingSpinner /> :
                      topPortIn.length === 0 ? <EmptyState message="포트 트래픽 데이터가 없습니다" /> :
                      <>
                        <SafeECharts key={`portIn-${portTopUnit}`} option={portInTopOption} style={{ height: 240 }} notMerge />
                        <PortLegendTable ports={topPortIn} direction="in" unit={portTopUnit} colors={PORT_COLORS} />
                      </>
                    }
                  </div>
                </div>

                <div className="stats-panel">
                  <div className="stats-panel-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span><i className="bi bi-ethernet"></i> 포트별 OUT TOP 10</span>
                    <div style={{ display: 'flex', gap: '4px', background: 'rgba(255,255,255,0.06)', borderRadius: '8px', padding: '2px' }}>
                      <button onClick={() => setPortTopUnit('percent')} style={{ padding: '4px 10px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '11px', fontWeight: 600, transition: 'all 0.2s', background: portTopUnit === 'percent' ? 'rgba(99,102,241,0.8)' : 'transparent', color: portTopUnit === 'percent' ? '#fff' : '#94a3b8' }}>%</button>
                      <button onClick={() => setPortTopUnit('bps')} style={{ padding: '4px 10px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '11px', fontWeight: 600, transition: 'all 0.2s', background: portTopUnit === 'bps' ? 'rgba(99,102,241,0.8)' : 'transparent', color: portTopUnit === 'bps' ? '#fff' : '#94a3b8' }}>BPS</button>
                    </div>
                  </div>
                  <div className="stats-panel-body" style={{ minHeight: 320 }}>
                    {isLoadingTraffic ? <LoadingSpinner /> :
                      topPortOut.length === 0 ? <EmptyState message="포트 트래픽 데이터가 없습니다" /> :
                      <>
                        <SafeECharts key={`portOut-${portTopUnit}`} option={portOutTopOption} style={{ height: 240 }} notMerge />
                        <PortLegendTable ports={topPortOut} direction="out" unit={portTopUnit} colors={PORT_COLORS} />
                      </>
                    }
                  </div>
                </div>
              </>
            )}

            {/* Row 6: Traffic 추이 (full-width) — 5분 모드에서는 숨김 */}
            {!isSnapshotMode && (
              <div className="stats-panel panel-full-width">
                <div className="stats-panel-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span><i className="bi bi-arrow-left-right"></i> 트래픽 추이 ({currentPeriod?.label})</span>
                  <div style={{ display: 'flex', gap: '4px', background: 'rgba(255,255,255,0.06)', borderRadius: '8px', padding: '2px' }}>
                    <button
                      onClick={() => setPortTopUnit('percent')}
                      style={{
                        padding: '4px 10px', borderRadius: '6px', border: 'none', cursor: 'pointer',
                        fontSize: '11px', fontWeight: 600, transition: 'all 0.2s',
                        background: portTopUnit === 'percent' ? 'rgba(99,102,241,0.8)' : 'transparent',
                        color: portTopUnit === 'percent' ? '#fff' : '#94a3b8',
                      }}
                    >%</button>
                    <button
                      onClick={() => setPortTopUnit('bps')}
                      style={{
                        padding: '4px 10px', borderRadius: '6px', border: 'none', cursor: 'pointer',
                        fontSize: '11px', fontWeight: 600, transition: 'all 0.2s',
                        background: portTopUnit === 'bps' ? 'rgba(99,102,241,0.8)' : 'transparent',
                        color: portTopUnit === 'bps' ? '#fff' : '#94a3b8',
                      }}
                    >BPS</button>
                  </div>
                </div>
                <div className="stats-panel-body">
                  {isLoadingTraffic ? <LoadingSpinner /> :
                    trafficTrendData.length === 0 ? <EmptyState message="트래픽 추이 데이터가 없습니다" /> :
                    <SafeECharts key={`trend-${portTopUnit}`} option={trafficTrendOption} style={{ height: 300 }} notMerge />
                  }
                </div>
              </div>
            )}

            {/* Row 6: 고부하 장비 테이블 (full-width) */}
            <div className="stats-panel panel-full-width">
              <div className="stats-panel-header">
                <i className="bi bi-exclamation-triangle"></i>
                고부하 장비 (CPU 또는 MEM &ge; 80%)
              </div>
              <div className="stats-panel-body" style={{ padding: 0 }}>
                {isLoadingData ? <LoadingSpinner /> :
                  highLoadDevices.length === 0 ? (
                    <EmptyState message="고부하 장비가 없습니다" />
                  ) : (
                    <DataTable
                      columns={highLoadColumns}
                      data={sortedHighLoad}
                      rowKey="DEVICE_ID"
                      sort={{ field: sortField, order: sortOrder }}
                      onSort={handleSort}
                      emptyText="고부하 장비가 없습니다"
                      maxHeight="360px"
                      tableId="perf-high-load"
                      enableColumnReorder={false}
                    />
                  )
                }
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
