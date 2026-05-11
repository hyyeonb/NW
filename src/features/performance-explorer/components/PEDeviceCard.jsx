/* eslint-disable max-lines, max-lines-per-function, complexity, max-params */
// PEDeviceCard — 800줄 monolithic. Phase 4 후속 PR에서 분해 예정:
//   1) usePerfChartData(rows, range) hook (chart options + stats)
//   2) usePEModalState() hook (modal state + open/close)
//   3) PECardHeader / PECardKpis / PECardPortBar / PECardChart sub-component

import { useState, useEffect, useMemo, useCallback, useRef, memo } from 'react';
import { createPortal } from 'react-dom';
import SafeECharts from '../../../components/SafeECharts';
import { useThemeStore } from '../../../stores/themeStore';
import { fmtPct, fmtBps } from '../../../shared/lib/format';
import { statsOf } from '../../../shared/lib/stats';
import { autoGranularity, expectedIntervalMs, insertGaps } from '../../../shared/lib/timeRange';
import { useDeviceModalMetrics } from '../hooks/useDeviceModalMetrics';
import { METRICS, PORT_COLORS } from '../model/constants';
import PEDeviceDetailModal from './PEDeviceDetailModal';

function makePortMiniOption(inData, outData) {
  return {
    grid: { left: 0, right: 0, top: 2, bottom: 2 },
    xAxis: { type: 'category', show: false, data: (inData || []).map((_, i) => i) },
    yAxis: { type: 'value', show: false },
    series: [
      { type: 'line', data: inData || [], smooth: true, symbol: 'none', lineStyle: { width: 1.5, color: '#3b82f6' }, areaStyle: { color: 'rgba(59, 130, 246, 0.2)' } },
      { type: 'line', data: outData || [], smooth: true, symbol: 'none', lineStyle: { width: 1.5, color: '#10b981' }, areaStyle: { color: 'rgba(16, 185, 129, 0.2)' } },
    ],
  };
}

const PEDeviceCard = memo(function PEDeviceCard({ device, cpuMemRows, trafficRows, icmpRows, ledStatus, appliedRange, isLoading, onHide, onModalToggle }) {
  const resolvedTheme = useThemeStore(s => s.resolvedTheme);
  const isLight = resolvedTheme === 'light';
  const [activeMetric, setActiveMetric] = useState('cpu');
  const [trafficMode, setTrafficMode] = useState('sum');
  const [selectedPorts, setSelectedPorts] = useState(null);
  const [showPortPicker, setShowPortPicker] = useState(false);
  const [portPickerPos, setPortPickerPos] = useState(null);
  const portBtnRef = useRef(null);
  const portPickerRef = useRef(null);
  const [showCardOptions, setShowCardOptions] = useState(false);
  const cardOptionsBtnRef = useRef(null);
  const cardOptionsRef = useRef(null);
  const [showDetail, setShowDetail] = useState(false);
  const [modalPeriod, setModalPeriod] = useState('24h');
  const [modalCustomStart, setModalCustomStart] = useState(null);
  const [modalCustomEnd, setModalCustomEnd] = useState(null);
  const [modalAppliedRange, setModalAppliedRange] = useState(null);
  const [modalTrafficMode, setModalTrafficMode] = useState('sum');
  const [modalSelectedPorts, setModalSelectedPorts] = useState(null);
  const [modalShowPortPicker, setModalShowPortPicker] = useState(false);
  const [modalPortPickerPos, setModalPortPickerPos] = useState(null);
  const modalPortBtnRef = useRef(null);
  const modalPortPickerRef = useRef(null);
  const chartCpuRef = useRef(null);
  const chartMemRef = useRef(null);
  const chartTrafficRef = useRef(null);
  const chartIcmpRef = useRef(null);

  useEffect(() => {
    if (!showDetail) return;
    const onKey = (e) => { if (e.key === 'Escape') setShowDetail(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [showDetail]);

  useEffect(() => {
    onModalToggle?.(showDetail);
    return () => { if (showDetail) onModalToggle?.(false); };
  }, [showDetail, onModalToggle]);

  useEffect(() => {
    if (!showDetail) return;
    setModalPeriod('24h');
    setModalAppliedRange(appliedRange);
    if (appliedRange?.startDate) setModalCustomStart(new Date(appliedRange.startDate));
    if (appliedRange?.endDate) setModalCustomEnd(new Date(appliedRange.endDate));
    setModalTrafficMode('sum');
    setModalSelectedPorts(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showDetail]);

  useEffect(() => {
    if (!modalShowPortPicker) return;
    const handler = (e) => {
      if (modalPortBtnRef.current?.contains(e.target)) return;
      if (modalPortPickerRef.current?.contains(e.target)) return;
      setModalShowPortPicker(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [modalShowPortPicker]);

  const togglePortPicker = () => {
    if (showPortPicker) { setShowPortPicker(false); return; }
    const r = portBtnRef.current?.getBoundingClientRect();
    if (!r) return;
    const width = 280;
    const estimatedHeight = 50 + Math.min(availablePorts.length, 7) * 50;
    const left = Math.max(8, Math.min(window.innerWidth - width - 8, r.right - width));
    const spaceBelow = window.innerHeight - r.bottom;
    const top = spaceBelow >= estimatedHeight + 12 || r.top < estimatedHeight + 12
      ? r.bottom + 6
      : r.top - estimatedHeight - 6;
    setPortPickerPos({ top, left });
    setShowPortPicker(true);
  };

  const availablePorts = useMemo(() => {
    const stats = new Map();
    (trafficRows || []).forEach(r => {
      const ifIndex = r.IF_INDEX ?? r.ifIndex;
      if (ifIndex == null) return;
      if (!stats.has(ifIndex)) {
        stats.set(ifIndex, {
          ifIndex,
          ifName: r.IF_NAME ?? r.ifName ?? `IF${ifIndex}`,
          rows: [],
        });
      }
      stats.get(ifIndex).rows.push({
        t: r.COLLECTED_AT,
        inBps: Number(r.IN_HIGH_BPS ?? r.IN_BPS ?? 0),
        outBps: Number(r.OUT_HIGH_BPS ?? r.OUT_BPS ?? 0),
      });
    });
    const list = [...stats.values()].map(s => {
      s.rows.sort((a, b) => String(a.t).localeCompare(String(b.t)));
      const inSeries = s.rows.map(r => r.inBps);
      const outSeries = s.rows.map(r => r.outBps);
      const inPeak = inSeries.length ? Math.max(...inSeries) : 0;
      const outPeak = outSeries.length ? Math.max(...outSeries) : 0;
      return {
        ifIndex: s.ifIndex,
        ifName: s.ifName,
        inSeries, outSeries,
        totalPeak: Math.max(inPeak, outPeak),
      };
    });
    list.sort((a, b) => a.ifIndex - b.ifIndex);
    return list;
  }, [trafficRows]);

  const effectiveSelectedPorts = useMemo(() => {
    if (selectedPorts == null) return new Set(availablePorts.map(p => p.ifIndex));
    return selectedPorts;
  }, [selectedPorts, availablePorts]);

  useEffect(() => {
    const handler = (e) => {
      if (portBtnRef.current?.contains(e.target)) return;
      if (portPickerRef.current?.contains(e.target)) return;
      setShowPortPicker(false);
    };
    if (showPortPicker) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showPortPicker]);

  useEffect(() => {
    const handler = (e) => {
      if (cardOptionsBtnRef.current?.contains(e.target)) return;
      if (cardOptionsRef.current?.contains(e.target)) return;
      setShowCardOptions(false);
    };
    if (showCardOptions) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showCardOptions]);

  const stats = useMemo(() => {
    const cpu = (cpuMemRows || []).filter(r => r.CORE_INDEX == null).map(r => Number(r.CPU_USAGE)).filter(v => !isNaN(v));
    const mem = (cpuMemRows || []).filter(r => r.CORE_INDEX == null).map(r => Number(r.MEM_USAGE)).filter(v => !isNaN(v));
    const cpuMaxIdx = cpu.length ? cpu.indexOf(Math.max(...cpu)) : -1;
    const cpuMaxRow = cpuMaxIdx >= 0 ? (cpuMemRows || []).filter(r => r.CORE_INDEX == null)[cpuMaxIdx] : null;
    const cpuMaxTime = cpuMaxRow?.COLLECTED_AT;

    let trfInPeak = 0, trfOutPeak = 0;
    (trafficRows || []).forEach(r => {
      trfInPeak = Math.max(trfInPeak, Number(r.IN_HIGH_BPS ?? r.IN_BPS ?? 0));
      trfOutPeak = Math.max(trfOutPeak, Number(r.OUT_HIGH_BPS ?? r.OUT_BPS ?? 0));
    });

    const rtt = (icmpRows || []).map(r => Number(r.RESPONSE_TIME)).filter(v => !isNaN(v));
    const loss = (icmpRows || []).map(r => Number(r.PACKET_LOSS)).filter(v => !isNaN(v));

    return {
      cpu: statsOf(cpu),
      mem: statsOf(mem),
      cpuMaxTime,
      trfInPeak, trfOutPeak,
      rtt: statsOf(rtt),
      loss: statsOf(loss),
    };
  }, [cpuMemRows, trafficRows, icmpRows]);

  const gapMs = useMemo(
    () => expectedIntervalMs(appliedRange?.startDate, appliedRange?.endDate) * 2.5,
    [appliedRange]
  );

  const buildBaseOption = useCallback((yMax, yFormatter) => ({
    backgroundColor: 'transparent',
    animation: true,
    animationDuration: 600,
    animationEasing: 'cubicOut',
    grid: { top: 12, right: 12, bottom: 26, left: 36 },
    tooltip: {
      trigger: 'axis', appendToBody: true, transitionDuration: 0,
      confine: false, enterable: true,
      backgroundColor: isLight ? 'rgba(255,255,255,0.95)' : 'rgba(15, 15, 35, 0.95)',
      borderColor: isLight ? 'rgba(15,23,42,0.15)' : 'rgba(255,255,255,0.1)',
      textStyle: { color: isLight ? '#1e293b' : '#e2e8f0', fontSize: 11 },
      axisPointer: { lineStyle: { color: isLight ? 'rgba(15,23,42,0.2)' : 'rgba(255,255,255,0.2)', type: 'dashed' } },
      extraCssText: 'max-height: 220px; max-width: 360px; overflow-y: auto; pointer-events: auto;',
      position: (point, params, dom, rect, size) => {
        const x = point[0], y = point[1];
        const ww = size.viewSize[0], wh = size.viewSize[1];
        const tw = size.contentSize[0], th = size.contentSize[1];
        let left = x + 14;
        if (left + tw > ww - 8) left = Math.max(8, x - tw - 14);
        let top = y - th / 2;
        if (top < 8) top = 8;
        if (top + th > wh - 8) top = Math.max(8, wh - th - 8);
        return [left, top];
      },
    },
    xAxis: {
      type: 'time',
      min: appliedRange?.startDate ? new Date(appliedRange.startDate).getTime() : 'dataMin',
      max: appliedRange?.endDate ? new Date(appliedRange.endDate).getTime() : 'dataMax',
      axisLine: { show: false }, axisTick: { show: false },
      axisLabel: { color: '#64748b', fontSize: 9 },
      splitLine: { show: false },
    },
    yAxis: {
      type: 'value', max: yMax,
      axisLine: { show: false }, axisTick: { show: false },
      axisLabel: { color: '#64748b', fontSize: 9, formatter: yFormatter },
      splitLine: { lineStyle: { color: isLight ? 'rgba(15,23,42,0.06)' : 'rgba(255,255,255,0.04)' } },
    },
  }), [isLight, appliedRange]);

  const buildOption = useCallback((yMax, yFormatter, color, series, showThreshold, allowArea) => ({
    ...buildBaseOption(yMax, yFormatter),
    series: series.map((s, i) => ({
      name: s.name,
      type: 'line',
      data: s.data,
      smooth: true,
      symbol: 'none',
      connectNulls: false,
      color: s.color || color,
      itemStyle: { color: s.color || color },
      lineStyle: { width: s.dashed ? 1.5 : 2, color: s.color || color, type: s.dashed ? 'dashed' : 'solid', shadowBlur: s.dashed ? 0 : 10, shadowColor: (s.color || color) + '66' },
      areaStyle: (i === 0 && !s.dashed && allowArea) ? {
        color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [
          { offset: 0, color: (s.color || color) + '55' },
          { offset: 0.6, color: (s.color || color) + '15' },
          { offset: 1, color: (s.color || color) + '00' },
        ] },
      } : undefined,
      markLine: showThreshold ? {
        silent: true, symbol: 'none',
        lineStyle: { color: '#ef4444', type: 'dashed', width: 1, opacity: 0.5 },
        label: { color: '#fca5a5', fontSize: 9, position: 'insideEndTop', formatter: '임계 80%' },
        data: [{ yAxis: 80 }],
      } : undefined,
    })),
  }), [buildBaseOption]);

  const buildThresholdChart = useCallback((rawPoints, mainColor, name, threshold = 80) => {
    const valueSeries = {
      name,
      type: 'line',
      data: rawPoints,
      smooth: true,
      symbol: 'none',
      connectNulls: false,
      color: mainColor,
      itemStyle: { color: mainColor },
      lineStyle: { width: 2, color: mainColor, shadowBlur: 10, shadowColor: mainColor + '66' },
      areaStyle: {
        color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [
          { offset: 0, color: mainColor + '55' },
          { offset: 0.6, color: mainColor + '15' },
          { offset: 1, color: mainColor + '00' },
        ] },
      },
      markLine: {
        silent: true, symbol: 'none',
        lineStyle: { color: '#ef4444', type: 'dashed', width: 1, opacity: 0.5 },
        label: { color: '#fca5a5', fontSize: 9, position: 'insideEndTop', formatter: `임계 ${threshold}%` },
        data: [{ yAxis: threshold }],
      },
      z: 3,
    };
    const overSeries = {
      name: name + '_over',
      type: 'line',
      data: rawPoints.map(([t, v]) => [t, v != null && v > threshold ? v : null]),
      smooth: true,
      symbol: 'none',
      connectNulls: false,
      lineStyle: { width: 0, opacity: 0 },
      areaStyle: {
        origin: threshold,
        color: 'rgba(239, 68, 68, 0.45)',
      },
      tooltip: { show: false },
      z: 2,
      silent: true,
    };
    return [overSeries, valueSeries];
  }, []);

  const cpuChartOption = useMemo(() => {
    const raw = (cpuMemRows || []).filter(r => r.CORE_INDEX == null)
      .map(r => [r.COLLECTED_AT, r.CPU_USAGE != null ? Number(r.CPU_USAGE) : null]);
    const points = insertGaps(raw, gapMs);
    return { ...buildBaseOption(100, '{value}%'), series: buildThresholdChart(points, '#3b82f6', 'CPU') };
  }, [cpuMemRows, gapMs, buildBaseOption, buildThresholdChart]);

  const memChartOption = useMemo(() => {
    const raw = (cpuMemRows || []).filter(r => r.CORE_INDEX == null)
      .map(r => [r.COLLECTED_AT, r.MEM_USAGE != null ? Number(r.MEM_USAGE) : null]);
    const points = insertGaps(raw, gapMs);
    return { ...buildBaseOption(100, '{value}%'), series: buildThresholdChart(points, '#8b5cf6', 'MEM') };
  }, [cpuMemRows, gapMs, buildBaseOption, buildThresholdChart]);

  const trafficChartOption = useMemo(() => {
    let series = [];
    const filtered = (trafficRows || []).filter(r => effectiveSelectedPorts.has(r.IF_INDEX ?? r.ifIndex));
    if (trafficMode === 'sum') {
      const timeMap = new Map();
      filtered.forEach(r => {
        const t = r.COLLECTED_AT;
        if (!t) return;
        const inBps = Number(r.IN_HIGH_BPS ?? r.IN_BPS ?? 0);
        const outBps = Number(r.OUT_HIGH_BPS ?? r.OUT_BPS ?? 0);
        const cur = timeMap.get(t) || { in: 0, out: 0 };
        cur.in += inBps; cur.out += outBps;
        timeMap.set(t, cur);
      });
      const sorted = [...timeMap.entries()].sort((a, b) => String(a[0]).localeCompare(String(b[0])));
      const inData = insertGaps(sorted.map(([t, v]) => [t, v.in]), gapMs);
      const outData = insertGaps(sorted.map(([t, v]) => [t, v.out]), gapMs);
      series = [
        { name: 'IN', data: inData, color: '#10b981' },
        { name: 'OUT', data: outData, color: '#3b82f6' },
      ];
    } else {
      const byPort = new Map();
      filtered.forEach(r => {
        const ifIndex = r.IF_INDEX ?? r.ifIndex;
        const t = r.COLLECTED_AT;
        if (!t || ifIndex == null) return;
        if (!byPort.has(ifIndex)) byPort.set(ifIndex, { in: [], out: [], name: r.IF_NAME ?? r.ifName ?? `IF${ifIndex}` });
        const inBps = Number(r.IN_HIGH_BPS ?? r.IN_BPS ?? 0);
        const outBps = Number(r.OUT_HIGH_BPS ?? r.OUT_BPS ?? 0);
        byPort.get(ifIndex).in.push([t, inBps]);
        byPort.get(ifIndex).out.push([t, outBps]);
      });
      const ifIdxList = [...byPort.keys()].sort((a, b) => a - b);
      ifIdxList.forEach((ifIdx, i) => {
        const portIdxInAvail = availablePorts.findIndex(p => p.ifIndex === ifIdx);
        const c = PORT_COLORS[(portIdxInAvail >= 0 ? portIdxInAvail : i) % PORT_COLORS.length];
        const p = byPort.get(ifIdx);
        const inSorted = p.in.sort((a, b) => String(a[0]).localeCompare(String(b[0])));
        const outSorted = p.out.sort((a, b) => String(a[0]).localeCompare(String(b[0])));
        series.push({ name: `${p.name} IN`, data: insertGaps(inSorted, gapMs), color: c });
        series.push({ name: `${p.name} OUT`, data: insertGaps(outSorted, gapMs), color: c, dashed: true });
      });
    }
    return buildOption(null, (v) => fmtBps(v), '#10b981', series, false, trafficMode === 'sum');
  }, [trafficRows, trafficMode, effectiveSelectedPorts, availablePorts, gapMs, buildOption]);

  const icmpChartOption = useMemo(() => {
    const raw = (icmpRows || [])
      .map(r => [r.COLLECT_TIME, r.RESPONSE_TIME != null ? Number(r.RESPONSE_TIME) : null])
      .sort((a, b) => String(a[0]).localeCompare(String(b[0])));
    const series = [{ name: 'RTT', data: insertGaps(raw, gapMs) }];
    return buildOption(null, (v) => `${Number(v).toFixed(1)}ms`, '#f59e0b', series, false, true);
  }, [icmpRows, gapMs, buildOption]);

  const chartOption = activeMetric === 'cpu' ? cpuChartOption
    : activeMetric === 'mem' ? memChartOption
    : activeMetric === 'traffic' ? trafficChartOption
    : icmpChartOption;

  const modalGranularity = useMemo(
    () => autoGranularity(modalAppliedRange?.startDate, modalAppliedRange?.endDate),
    [modalAppliedRange]
  );
  const modalGapMs = useMemo(
    () => expectedIntervalMs(modalAppliedRange?.startDate, modalAppliedRange?.endDate) * 2.5,
    [modalAppliedRange]
  );

  const {
    cpuMemRows: modalCpuMemRows,
    trafficRows: modalTrafficRows,
    icmpRows: modalIcmpRows,
    isLoading: modalLoading,
  } = useDeviceModalMetrics({
    deviceId: device.deviceId,
    range: modalAppliedRange,
    granularity: modalGranularity,
    enabled: showDetail,
  });

  const modalAvailablePorts = useMemo(() => {
    const stats = new Map();
    (modalTrafficRows || []).forEach(r => {
      const ifIndex = r.IF_INDEX ?? r.ifIndex;
      if (ifIndex == null) return;
      if (!stats.has(ifIndex)) {
        stats.set(ifIndex, { ifIndex, ifName: r.IF_NAME ?? r.ifName ?? `IF${ifIndex}` });
      }
    });
    return [...stats.values()].sort((a, b) => a.ifIndex - b.ifIndex);
  }, [modalTrafficRows]);

  const modalEffectivePorts = useMemo(() => {
    if (modalSelectedPorts == null) return new Set(modalAvailablePorts.map(p => p.ifIndex));
    return modalSelectedPorts;
  }, [modalSelectedPorts, modalAvailablePorts]);

  const modalBuildOption = useCallback((yMax, yFormatter, color, series, allowArea, threshold) => ({
    backgroundColor: 'transparent',
    animation: true, animationDuration: 400,
    grid: { top: 24, right: 18, bottom: 28, left: 56 },
    tooltip: {
      trigger: 'axis', appendToBody: true, transitionDuration: 0, confine: false,
      backgroundColor: isLight ? 'rgba(255,255,255,0.95)' : 'rgba(15,15,35,0.95)',
      borderColor: isLight ? 'rgba(15,23,42,0.15)' : 'rgba(255,255,255,0.1)',
      textStyle: { color: isLight ? '#1e293b' : '#e2e8f0', fontSize: 11 },
    },
    xAxis: {
      type: 'time',
      min: modalAppliedRange?.startDate ? new Date(modalAppliedRange.startDate).getTime() : 'dataMin',
      max: modalAppliedRange?.endDate ? new Date(modalAppliedRange.endDate).getTime() : 'dataMax',
      axisLine: { show: false }, axisTick: { show: false },
      axisLabel: { color: '#64748b', fontSize: 11 },
      splitLine: { show: false },
    },
    yAxis: {
      type: 'value', max: yMax,
      axisLine: { show: false }, axisTick: { show: false },
      axisLabel: { color: '#64748b', fontSize: 11, formatter: yFormatter },
      splitLine: { lineStyle: { color: isLight ? 'rgba(15,23,42,0.06)' : 'rgba(255,255,255,0.04)' } },
    },
    toolbox: { show: false },
    dataZoom: [{
      type: 'inside', start: 0, end: 100,
      zoomOnMouseWheel: true, moveOnMouseMove: false, moveOnMouseWheel: false,
    }],
    series: series.map((s, i) => ({
      name: s.name, type: 'line', data: s.data,
      smooth: true, symbol: 'none', connectNulls: false,
      color: s.color || color,
      itemStyle: { color: s.color || color },
      lineStyle: { width: s.dashed ? 1.5 : 2, color: s.color || color, type: s.dashed ? 'dashed' : 'solid' },
      areaStyle: (i === 0 && !s.dashed && allowArea) ? {
        color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [
          { offset: 0, color: (s.color || color) + '55' },
          { offset: 0.6, color: (s.color || color) + '15' },
          { offset: 1, color: (s.color || color) + '00' },
        ] },
      } : undefined,
      markLine: threshold ? {
        silent: true, symbol: 'none',
        lineStyle: { color: '#ef4444', type: 'dashed', width: 1, opacity: 0.5 },
        label: { color: '#fca5a5', fontSize: 10, position: 'insideEndTop', formatter: `임계 ${threshold}%` },
        data: [{ yAxis: threshold }],
      } : undefined,
    })),
  }), [isLight, modalAppliedRange]);

  const modalAddThresholdFill = (option, threshold = 80) => {
    if (!option.series?.[0]?.data) return option;
    const baseData = option.series[0].data;
    const overData = baseData.map(p => Array.isArray(p) ? [p[0], (p[1] != null && p[1] > threshold) ? p[1] : null] : p);
    const baseSeries = option.series[0];
    const overSeries = {
      name: baseSeries.name + '_over',
      type: 'line',
      data: overData,
      smooth: true,
      symbol: 'none',
      connectNulls: false,
      lineStyle: { width: 0, opacity: 0 },
      areaStyle: { origin: threshold, color: 'rgba(239,68,68,0.45)' },
      tooltip: { show: false },
      silent: true,
      z: 2,
    };
    return { ...option, series: [overSeries, baseSeries] };
  };

  const modalCpuOption = useMemo(() => {
    const raw = (modalCpuMemRows || []).filter(r => r.CORE_INDEX == null)
      .map(r => [r.COLLECTED_AT, r.CPU_USAGE != null ? Number(r.CPU_USAGE) : null]);
    const series = [{ name: 'CPU', data: insertGaps(raw, modalGapMs) }];
    return modalAddThresholdFill(modalBuildOption(100, '{value}%', '#3b82f6', series, true, 80), 80);
  }, [modalCpuMemRows, modalGapMs, modalBuildOption]);

  const modalMemOption = useMemo(() => {
    const raw = (modalCpuMemRows || []).filter(r => r.CORE_INDEX == null)
      .map(r => [r.COLLECTED_AT, r.MEM_USAGE != null ? Number(r.MEM_USAGE) : null]);
    const series = [{ name: 'MEM', data: insertGaps(raw, modalGapMs) }];
    return modalAddThresholdFill(modalBuildOption(100, '{value}%', '#8b5cf6', series, true, 80), 80);
  }, [modalCpuMemRows, modalGapMs, modalBuildOption]);

  const modalTrafficOption = useMemo(() => {
    let series = [];
    const filtered = (modalTrafficRows || []).filter(r => modalEffectivePorts.has(r.IF_INDEX ?? r.ifIndex));
    if (modalTrafficMode === 'sum') {
      const tm = new Map();
      filtered.forEach(r => {
        const t = r.COLLECTED_AT;
        if (!t) return;
        const inBps = Number(r.IN_HIGH_BPS ?? r.IN_BPS ?? 0);
        const outBps = Number(r.OUT_HIGH_BPS ?? r.OUT_BPS ?? 0);
        const cur = tm.get(t) || { in: 0, out: 0 };
        cur.in += inBps; cur.out += outBps;
        tm.set(t, cur);
      });
      const sorted = [...tm.entries()].sort((a, b) => String(a[0]).localeCompare(String(b[0])));
      series = [
        { name: 'IN', data: insertGaps(sorted.map(([t, v]) => [t, v.in]), modalGapMs), color: '#10b981' },
        { name: 'OUT', data: insertGaps(sorted.map(([t, v]) => [t, v.out]), modalGapMs), color: '#3b82f6' },
      ];
    } else {
      const byPort = new Map();
      filtered.forEach(r => {
        const ifx = r.IF_INDEX ?? r.ifIndex;
        const t = r.COLLECTED_AT;
        if (!t || ifx == null) return;
        if (!byPort.has(ifx)) byPort.set(ifx, { in: [], out: [], name: r.IF_NAME ?? r.ifName ?? `IF${ifx}` });
        byPort.get(ifx).in.push([t, Number(r.IN_HIGH_BPS ?? r.IN_BPS ?? 0)]);
        byPort.get(ifx).out.push([t, Number(r.OUT_HIGH_BPS ?? r.OUT_BPS ?? 0)]);
      });
      const ifList = [...byPort.keys()].sort((a, b) => a - b);
      ifList.forEach((ifx, i) => {
        const portIdx = modalAvailablePorts.findIndex(p => p.ifIndex === ifx);
        const c = PORT_COLORS[(portIdx >= 0 ? portIdx : i) % PORT_COLORS.length];
        const p = byPort.get(ifx);
        const inS = p.in.sort((a, b) => String(a[0]).localeCompare(String(b[0])));
        const outS = p.out.sort((a, b) => String(a[0]).localeCompare(String(b[0])));
        series.push({ name: `${p.name} IN`, data: insertGaps(inS, modalGapMs), color: c });
        series.push({ name: `${p.name} OUT`, data: insertGaps(outS, modalGapMs), color: c, dashed: true });
      });
    }
    return modalBuildOption(null, (v) => fmtBps(v), '#10b981', series, modalTrafficMode === 'sum', null);
  }, [modalTrafficRows, modalTrafficMode, modalEffectivePorts, modalAvailablePorts, modalGapMs, modalBuildOption]);

  const modalIcmpOption = useMemo(() => {
    const raw = (modalIcmpRows || [])
      .map(r => [r.COLLECT_TIME, r.RESPONSE_TIME != null ? Number(r.RESPONSE_TIME) : null])
      .sort((a, b) => String(a[0]).localeCompare(String(b[0])));
    const series = [{ name: 'RTT', data: insertGaps(raw, modalGapMs) }];
    return modalBuildOption(null, (v) => `${Number(v).toFixed(1)}ms`, '#f59e0b', series, true, null);
  }, [modalIcmpRows, modalGapMs, modalBuildOption]);

  const fmtTime = (t) => {
    if (!t) return '-';
    const d = new Date(t);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  return (
    <div className="pe-card">
      <div className="pe-card-head">
        <div className="pe-card-id">
          <span className={`pe-card-led ${ledStatus === 'crit' ? 'crit' : ledStatus === 'warn' ? 'warn' : ''}`} />
          <div className="pe-card-text">
            <div className="pe-card-name">{device.deviceName}</div>
            <div className="pe-card-ip">{device.deviceIp}{device.modelName ? ` · ${device.modelName}` : ''}</div>
          </div>
        </div>
        <div className="pe-card-actions" style={{ position: 'relative' }}>
          <button className="pe-card-action" title="확대 보기" onClick={() => setShowDetail(true)}>
            <i className="bi bi-arrows-fullscreen" />
          </button>
          <button
            ref={cardOptionsBtnRef}
            className={`pe-card-action ${showCardOptions ? 'active' : ''}`}
            title="설정"
            onClick={() => setShowCardOptions(s => !s)}
          >
            <i className="bi bi-three-dots-vertical" />
          </button>
          {showCardOptions && (
            <div className="pe-card-options" ref={cardOptionsRef}>
              {onHide && (
                <button
                  className="pe-card-option-item danger"
                  onClick={() => { onHide(device.deviceId); setShowCardOptions(false); }}
                >
                  <i className="bi bi-eye-slash" />
                  <span>이 장비 숨기기</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="pe-kpi-row">
        <div className="pe-kpi">
          <span className="pe-kpi-label">CPU 평균</span>
          <span className="pe-kpi-val">{fmtPct(stats.cpu.avg)}<span className="unit">%</span></span>
          <span className="pe-kpi-trend">샘플 {stats.cpu.count}</span>
        </div>
        <div className="pe-kpi">
          <span className="pe-kpi-label">CPU 최대</span>
          <span className="pe-kpi-val" style={(stats.cpu.max ?? 0) >= 90 ? { color: '#fca5a5' } : (stats.cpu.max ?? 0) >= 75 ? { color: '#fcd34d' } : undefined}>
            {fmtPct(stats.cpu.max)}<span className="unit">%</span>
          </span>
          <span className="pe-kpi-trend">{fmtTime(stats.cpuMaxTime)}</span>
        </div>
        <div className="pe-kpi">
          <span className="pe-kpi-label">MEM 평균</span>
          <span className="pe-kpi-val" style={(stats.mem.max ?? 0) >= 85 ? { color: '#fcd34d' } : undefined}>
            {fmtPct(stats.mem.avg)}<span className="unit">%</span>
          </span>
          <span className="pe-kpi-trend">peak {fmtPct(stats.mem.max)}%</span>
        </div>
        <div className="pe-kpi">
          <span className="pe-kpi-label">RTT</span>
          <span className="pe-kpi-val" style={(stats.loss.avg ?? 0) >= 1 ? { color: '#fcd34d' } : undefined}>
            {stats.rtt.avg != null ? Math.round(stats.rtt.avg * 10) / 10 : '-'}<span className="unit">ms</span>
          </span>
          <span className="pe-kpi-trend">loss {stats.loss.avg != null ? Math.round(stats.loss.avg * 10) / 10 : '0.0'}%</span>
        </div>
      </div>

      {activeMetric === 'traffic' && availablePorts.length > 0 && (
        <div className="pe-port-bar">
          <div className="pe-segment pe-segment-sm">
            <button className={trafficMode === 'sum' ? 'active' : ''} onClick={() => setTrafficMode('sum')}>합산</button>
            <button className={trafficMode === 'ports' ? 'active' : ''} onClick={() => setTrafficMode('ports')}>포트별</button>
          </div>
          <div className="pe-port-picker-wrap">
            <button ref={portBtnRef} className="pe-port-picker-btn" onClick={togglePortPicker}>
              <i className="bi bi-ethernet" />
              포트 {effectiveSelectedPorts.size}/{availablePorts.length}
              <i className="bi bi-chevron-down" />
            </button>
            {showPortPicker && portPickerPos && createPortal(
              <div ref={portPickerRef} className="pe-port-picker pe-port-picker-fixed"
                   style={{ top: portPickerPos.top, left: portPickerPos.left }}>
                <div className="pe-port-picker-head">
                  <span>포트 선택</span>
                  <div className="pe-port-picker-actions">
                    <button onClick={() => setSelectedPorts(new Set(availablePorts.map(p => p.ifIndex)))}>전체</button>
                    <button onClick={() => setSelectedPorts(new Set())}>해제</button>
                  </div>
                </div>
                <div className="pe-port-picker-list">
                  {availablePorts.map((p, i) => {
                    const checked = effectiveSelectedPorts.has(p.ifIndex);
                    const c = PORT_COLORS[i % PORT_COLORS.length];
                    const isIdle = p.totalPeak < 1;
                    return (
                      <label key={p.ifIndex} className={`pe-port-item ${checked ? 'on' : ''} ${isIdle ? 'idle' : ''}`}>
                        <input type="checkbox" checked={checked}
                          onChange={() => {
                            const next = new Set(effectiveSelectedPorts);
                            if (next.has(p.ifIndex)) next.delete(p.ifIndex); else next.add(p.ifIndex);
                            setSelectedPorts(next);
                          }} />
                        <span className="pe-port-dot" style={{ background: c }} />
                        <div className="pe-port-info">
                          <div className="pe-port-row1">
                            <span className="pe-port-name">{p.ifName}</span>
                            <span className="pe-port-idx">#{p.ifIndex}</span>
                          </div>
                          <div className="pe-port-row2">
                            {isIdle ? (
                              <span className="pe-port-idle">idle</span>
                            ) : (
                              <>
                                <div className="port-mini-chart pe-port-mini">
                                  <SafeECharts
                                    option={makePortMiniOption(p.inSeries, p.outSeries)}
                                    style={{ width: '100%', height: 32 }}
                                    opts={{ renderer: 'svg' }}
                                  />
                                </div>
                                <span className="pe-port-peak">peak <b>{fmtBps(p.totalPeak)}</b></span>
                              </>
                            )}
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>,
              document.body
            )}
          </div>
        </div>
      )}

      <div className="pe-chart-host pe-chart-host-clickable" onClick={() => setShowDetail(true)} title="확대 보기">
        <SafeECharts option={chartOption} notMerge={true} style={{ height: 180, width: '100%' }} />
        {isLoading && (
          <div className="pe-chart-loading">
            <div className="pe-chart-loading-spinner" />
            <span>로딩 중</span>
          </div>
        )}
      </div>

      <div className="pe-card-foot">
        {METRICS.map(m => (
          <button key={m.id}
            className={`pe-mtab ${activeMetric === m.id ? 'active' : ''}`}
            onClick={() => setActiveMetric(m.id)}>
            <span className="dot" style={{ background: m.color }} />
            {m.label}
          </button>
        ))}
      </div>

      {showDetail && createPortal(
        <PEDeviceDetailModal
          device={device}
          ledStatus={ledStatus}
          modalPeriod={modalPeriod}
          modalCustomStart={modalCustomStart}
          modalCustomEnd={modalCustomEnd}
          modalAppliedRange={modalAppliedRange}
          modalTrafficMode={modalTrafficMode}
          modalAvailablePorts={modalAvailablePorts}
          modalEffectivePorts={modalEffectivePorts}
          modalShowPortPicker={modalShowPortPicker}
          modalPortPickerPos={modalPortPickerPos}
          modalPortBtnRef={modalPortBtnRef}
          modalPortPickerRef={modalPortPickerRef}
          modalLoading={modalLoading}
          cpuOption={modalCpuOption}
          memOption={modalMemOption}
          trafficOption={modalTrafficOption}
          icmpOption={modalIcmpOption}
          chartCpuRef={chartCpuRef}
          chartMemRef={chartMemRef}
          chartTrafficRef={chartTrafficRef}
          chartIcmpRef={chartIcmpRef}
          onClose={() => setShowDetail(false)}
          setModalPeriod={setModalPeriod}
          setModalCustomStart={setModalCustomStart}
          setModalCustomEnd={setModalCustomEnd}
          setModalAppliedRange={setModalAppliedRange}
          setModalTrafficMode={setModalTrafficMode}
          setModalSelectedPorts={setModalSelectedPorts}
          setModalShowPortPicker={setModalShowPortPicker}
          setModalPortPickerPos={setModalPortPickerPos}
        />,
        document.body
      )}
    </div>
  );
}, (prev, next) => {
  if (prev.device !== next.device) return false;
  if (prev.cpuMemRows !== next.cpuMemRows) return false;
  if (prev.trafficRows !== next.trafficRows) return false;
  if (prev.icmpRows !== next.icmpRows) return false;
  if (prev.ledStatus !== next.ledStatus) return false;
  if (prev.isLoading !== next.isLoading) return false;
  if (prev.onModalToggle !== next.onModalToggle) return false;
  if (prev.appliedRange?.startDate !== next.appliedRange?.startDate) return false;
  if (prev.appliedRange?.endDate !== next.appliedRange?.endDate) return false;
  return true;
});

export default PEDeviceCard;
