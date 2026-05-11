import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { faultApi } from '../api/fault';
import apiClient from '../api/client';
import SafeECharts from './SafeECharts';
import { useThemeStore } from '../stores/themeStore';

import { LEVEL_META, LEVEL_ORDER, OPEN_EVENT } from '../features/daily-summary/model/constants';
import { getYesterdayString, getStorageKey, fmtDate } from '../features/daily-summary/lib/dateHelpers';

export function DailySummaryTriggerButton() {
  return (
    <button type="button" onClick={() => window.dispatchEvent(new CustomEvent(OPEN_EVENT))}
      title="전일 종합 현황" style={{
        position: 'fixed', right: 20, bottom: 20, zIndex: 1000,
        padding: '10px 16px', borderRadius: 999, border: '1px solid rgba(255,255,255,0.15)',
        background: 'rgba(20,24,38,0.85)', color: '#e6edf3',
        boxShadow: '0 6px 20px rgba(0,0,0,0.35)', cursor: 'pointer',
        backdropFilter: 'blur(8px)', fontSize: 13, fontWeight: 600,
        display: 'inline-flex', alignItems: 'center', gap: 6,
      }}>
      <i className="bi bi-clipboard-data" />전일 현황
    </button>
  );
}

export default function DailySummaryModal() {
  const isLight = useThemeStore(s => s.resolvedTheme === 'light');
  const C = {
    text:      isLight ? '#1e293b' : '#e2e8f0',
    textMuted: isLight ? '#64748b' : 'rgba(255,255,255,0.45)',
    gridLine:  isLight ? 'rgba(15,23,42,0.06)' : 'rgba(255,255,255,0.06)',
    panelBg:   isLight ? '#f8fafc' : 'rgba(255,255,255,0.04)',
    panelBdr:  isLight ? 'rgba(15,23,42,0.08)' : 'rgba(255,255,255,0.07)',
    tipBg:     isLight ? '#ffffff' : '#1e293b',
    tipBdr:    isLight ? 'rgba(15,23,42,0.12)' : 'rgba(255,255,255,0.12)',
    tipText:   isLight ? '#0f172a' : '#e6edf3',
    modalBg:   isLight ? '#ffffff' : '#0f1623',
    hdrBdr:    isLight ? 'rgba(15,23,42,0.08)' : 'rgba(255,255,255,0.07)',
    emptyTxt:  isLight ? '#94a3b8' : 'rgba(255,255,255,0.3)',
    rowBg:     isLight ? 'rgba(15,23,42,0.03)' : 'rgba(255,255,255,0.03)',
  };

  const yyyyMMdd = getYesterdayString();
  const storageKey = getStorageKey(yyyyMMdd);
  const [isOpen, setIsOpen] = useState(() => {
    try { return localStorage.getItem(storageKey) !== '1'; } catch { return true; }
  });

  useEffect(() => {
    const onOpen = () => setIsOpen(true);
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_EVENT, onOpen);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = e => { if (e.key === 'Escape') handleClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const summaryQ = useQuery({
    queryKey: ['dsm-summary', yyyyMMdd],
    queryFn: () => faultApi.getStatsSummary({ startDate: yyyyMMdd, endDate: yyyyMMdd }).then(r => r.data?.data ?? null),
    enabled: isOpen, staleTime: 0, refetchOnMount: true,
  });
  const topQ = useQuery({
    queryKey: ['dsm-top', yyyyMMdd],
    queryFn: () => faultApi.getStatsTopDevices({ startDate: yyyyMMdd, endDate: yyyyMMdd, limit: 7 }).then(r => r.data?.data ?? null),
    enabled: isOpen, staleTime: 0, refetchOnMount: true,
  });
  const patternQ = useQuery({
    queryKey: ['dsm-hourly-trend', yyyyMMdd],
    queryFn: () => faultApi.getStatsTrend({ startDate: yyyyMMdd, endDate: yyyyMMdd, period: 'hourly' }).then(r => r.data?.data ?? null),
    enabled: isOpen, staleTime: 0, refetchOnMount: true,
  });
  const changesQ = useQuery({
    queryKey: ['dsm-changes', yyyyMMdd],
    queryFn: () => apiClient.get('/dashboard/daily-summary', { params: { date: yyyyMMdd } }).then(r => r.data?.data ?? null),
    enabled: isOpen, staleTime: 0, refetchOnMount: true,
  });


  const handleClose = () => {
    try { localStorage.setItem(storageKey, '1'); } catch {}
    setIsOpen(false);
  };

  // ── 데이터 ──
  const byLevel = summaryQ.data?.byLevel ?? [];
  const totalFault = byLevel.reduce((a, x) => a + Number(x.CNT ?? x.COUNT ?? 0), 0);
  const levelMap = Object.fromEntries(byLevel.map(x => [x.LEVEL_CODE ?? x.LEVEL, Number(x.CNT ?? x.COUNT ?? 0)]));
  const topDevices = Array.isArray(topQ.data) ? topQ.data.filter(d => Number(d.TOTAL_CNT ?? d.COUNT ?? d.count ?? 0) > 0) : [];
  const changes = changesQ.data ?? {};
  const cpuMemTop = Array.isArray(changes.cpuMemTop) ? changes.cpuMemTop : [];
  const cpuMemHourly = Array.isArray(changes.cpuMemHourly) ? changes.cpuMemHourly : [];
  const faultHourlyByLevel = Array.isArray(changes.faultHourlyByLevel) ? changes.faultHourlyByLevel : [];
  const topDevicesByLevel = Array.isArray(changes.topDevicesByLevel) ? changes.topDevicesByLevel : [];
  const topDevicesByType = Array.isArray(changes.topDevicesByType) ? changes.topDevicesByType : [];

  // 장비별 요약 (level + type 통합)
  const deviceSummaries = useMemo(() => {
    if (!topDevicesByLevel.length && !topDevicesByType.length) return [];
    const map = new Map();
    topDevicesByLevel.forEach(d => {
      if (!map.has(d.DEVICE_NAME)) map.set(d.DEVICE_NAME, { name: d.DEVICE_NAME, ip: '', total: Number(d.TOTAL_CNT ?? 0), levels: {}, types: [] });
      map.get(d.DEVICE_NAME).levels[d.ERROR_LEVEL] = Number(d.CNT ?? 0);
    });
    topDevicesByType.forEach(d => {
      if (!map.has(d.DEVICE_NAME)) map.set(d.DEVICE_NAME, { name: d.DEVICE_NAME, ip: d.DEVICE_IP ?? '', total: Number(d.TOTAL_CNT ?? 0), levels: {}, types: [] });
      const e = map.get(d.DEVICE_NAME);
      if (!e.ip && d.DEVICE_IP) e.ip = d.DEVICE_IP;
      if (!e.total) e.total = Number(d.TOTAL_CNT ?? 0);
      e.types.push({ type: d.ERROR_TYPE ?? '기타', cnt: Number(d.CNT ?? 0) });
    });
    return [...map.values()]
      .sort((a, b) => b.total - a.total).slice(0, 7)
      .map(d => ({ ...d, types: d.types.sort((a, b) => b.cnt - a.cnt).slice(0, 5) }));
  }, [topDevicesByLevel, topDevicesByType]);

  // ── Chart: 도넛 (장애 등급별) ──
  const pieOpt = useMemo(() => ({
    animation: true, backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item', appendToBody: true,
      backgroundColor: C.tipBg, borderColor: C.tipBdr,
      textStyle: { color: C.tipText, fontSize: 12 },
      formatter: p => `<b>${LEVEL_META[p.name]?.label ?? p.name}</b><br/>${p.value}건 (${p.percent}%)`,
    },
    legend: { show: false },
    series: [{
      type: 'pie', radius: ['38%', '60%'], center: ['50%', '50%'],
      avoidLabelOverlap: true,
      label: {
        show: true, position: 'outside', fontSize: 11, fontWeight: 600,
        formatter: p => `${p.percent.toFixed(1)}%`,
        color: C.text,
        overflow: 'none',
      },
      labelLine: { show: true, length: 8, length2: 5, smooth: true, lineStyle: { color: C.textMuted, width: 1 } },
      data: LEVEL_ORDER.filter(lv => (levelMap[lv] ?? 0) > 0).map(lv => ({
        name: lv, value: levelMap[lv],
        itemStyle: { color: LEVEL_META[lv].color },
      })),
      emphasis: { scale: true, scaleSize: 4 },
    }],
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [levelMap, isLight]);

  // ── Chart: 시간대별 × 등급별 장애 발생 (스택드 바) ──
  const hourlyFaultOpt = useMemo(() => {
    const hours = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}`);
    const levelSeries = LEVEL_ORDER.map(lv => {
      const data = hours.map((_, h) => {
        const rows = faultHourlyByLevel.filter(d => Number(d.STAT_HOUR) === h && d.ERROR_LEVEL === lv);
        return rows.reduce((s, d) => s + Number(d.CNT ?? 0), 0);
      });
      return {
        name: LEVEL_META[lv].short,
        type: 'bar', stack: 'fault', data, barMaxWidth: 22,
        itemStyle: { color: LEVEL_META[lv].color },
        label: { show: false },
        emphasis: { focus: 'series' },
      };
    });
    // fallback: faultHourlyByLevel 없으면 patternQ hourly 사용
    const fallbackData = patternQ.data?.hourly ?? [];
    const useFallback = faultHourlyByLevel.length === 0 && fallbackData.length > 0;
    const fallbackSeries = useFallback ? [{
      name: '장애',  type: 'bar', data: hours.map((_, h) => {
        const m = fallbackData.filter(d => Number(d.STAT_HOUR) === h);
        return m.reduce((s, d) => s + Number(d.OCCURRED ?? d.CNT ?? 0), 0);
      }), barMaxWidth: 22,
      itemStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: '#6366f1' }, { offset: 1, color: '#4338ca' }] }, borderRadius: [3, 3, 0, 0] },
    }] : [];
    return {
      animation: true, backgroundColor: 'transparent',
      legend: useFallback ? undefined : {
        data: LEVEL_ORDER.map(lv => LEVEL_META[lv].short), top: 2, right: 8,
        textStyle: { color: C.textMuted, fontSize: 10 }, itemWidth: 10, itemHeight: 10,
      },
      grid: { top: useFallback ? 16 : 34, right: 12, bottom: 32, left: 40 },
      xAxis: {
        type: 'category', data: hours,
        axisLine: { lineStyle: { color: C.gridLine } },
        axisLabel: { color: C.textMuted, fontSize: 10, interval: 3, formatter: v => `${v}시` },
        axisTick: { show: false },
      },
      yAxis: {
        type: 'value', minInterval: 1,
        axisLabel: { color: C.textMuted, fontSize: 10 },
        splitLine: { lineStyle: { color: C.gridLine } },
      },
      tooltip: {
        trigger: 'axis', appendToBody: true,
        backgroundColor: C.tipBg, borderColor: C.tipBdr,
        textStyle: { color: C.tipText, fontSize: 11 },
        formatter: params => {
          const total = params.reduce((s, p) => s + (p.value || 0), 0);
          const rows = params.filter(p => p.value > 0).map(p => `${p.marker}${p.seriesName}: <b>${p.value}</b>건`);
          return `${params[0].name}시<br/>${rows.join('<br/>')}${rows.length > 1 ? `<br/>합계: <b>${total}</b>건` : ''}`;
        },
      },
      series: useFallback ? fallbackSeries : levelSeries,
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [faultHourlyByLevel, patternQ.data, isLight]);

  // ── Chart: TOP 장비 × 등급별 (스택드 가로 바) ──
  const topDevOpt = useMemo(() => {
    // topDevicesByLevel: [{DEVICE_NAME, ERROR_LEVEL, CNT, TOTAL_CNT}]
    const useByLevel = topDevicesByLevel.length > 0;
    const deviceNames = useByLevel
      ? [...new Map(topDevicesByLevel.map(d => [d.DEVICE_NAME, d.TOTAL_CNT])).entries()]
          .sort((a, b) => b[1] - a[1]).map(e => e[0]).slice(0, 7)
      : topDevices.slice(0, 7).map(d => d.DEVICE_NAME ?? d.deviceName ?? '-');
    const reversed = deviceNames.slice().reverse();
    const levelSeriesTop = useByLevel ? LEVEL_ORDER.map(lv => ({
      name: LEVEL_META[lv].short, type: 'bar', stack: 'dev',
      data: reversed.map(name => {
        const row = topDevicesByLevel.find(d => d.DEVICE_NAME === name && d.ERROR_LEVEL === lv);
        return Number(row?.CNT ?? 0);
      }),
      barMaxWidth: 20, itemStyle: { color: LEVEL_META[lv].color },
      label: { show: false },
      emphasis: { focus: 'series' },
    })) : [{
      type: 'bar',
      data: reversed.map(name => {
        const d = topDevices.find(x => (x.DEVICE_NAME ?? x.deviceName) === name);
        return Number(d?.TOTAL_CNT ?? d?.COUNT ?? d?.count ?? 0);
      }),
      barMaxWidth: 20,
      itemStyle: { color: { type: 'linear', x: 0, y: 0, x2: 1, y2: 0, colorStops: [{ offset: 0, color: '#6366f1' }, { offset: 1, color: '#8b5cf6' }] }, borderRadius: [0, 4, 4, 0] },
      label: { show: true, position: 'right', color: C.textMuted, fontSize: 11, formatter: '{c}건' },
    }];
    return {
      animation: true, backgroundColor: 'transparent',
      legend: useByLevel ? {
        data: LEVEL_ORDER.map(lv => LEVEL_META[lv].short), top: 2, right: 8,
        textStyle: { color: C.textMuted, fontSize: 10 }, itemWidth: 10, itemHeight: 10,
      } : undefined,
      grid: { top: useByLevel ? 32 : 4, right: useByLevel ? 12 : 52, bottom: 4, left: 8, containLabel: true },
      xAxis: { type: 'value', axisLabel: { show: false }, splitLine: { lineStyle: { color: C.gridLine } } },
      yAxis: {
        type: 'category', data: reversed,
        axisLabel: { color: C.text, fontSize: 11 },
        axisLine: { show: false }, axisTick: { show: false },
      },
      tooltip: {
        trigger: 'axis', appendToBody: true,
        backgroundColor: C.tipBg, borderColor: C.tipBdr,
        textStyle: { color: C.tipText, fontSize: 11 },
        formatter: params => {
          const total = params.reduce((s, p) => s + (p.value || 0), 0);
          const rows = params.filter(p => p.value > 0).map(p => `${p.marker}${p.seriesName ?? ''}: <b>${p.value}</b>건`);
          return `${params[0].name}<br/>${rows.join('<br/>')}${useByLevel ? `<br/>합계: <b>${total}</b>건` : ''}`;
        },
      },
      series: levelSeriesTop,
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topDevices, topDevicesByLevel, isLight]);

  // ── Chart: CPU/MEM 시간대별 평균 추이 ──
  const cpuMemLineOpt = useMemo(() => {
    const hours = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}시`);
    const avgCpu = hours.map((_, h) => {
      const f = cpuMemHourly.find(d => Number(d.STAT_HOUR) === h);
      return f?.AVG_CPU != null ? Number(f.AVG_CPU) : null;
    });
    const maxCpu = hours.map((_, h) => {
      const f = cpuMemHourly.find(d => Number(d.STAT_HOUR) === h);
      return f?.MAX_CPU != null ? Number(f.MAX_CPU) : null;
    });
    const avgMem = hours.map((_, h) => {
      const f = cpuMemHourly.find(d => Number(d.STAT_HOUR) === h);
      return f?.AVG_MEM != null ? Number(f.AVG_MEM) : null;
    });
    const maxMem = hours.map((_, h) => {
      const f = cpuMemHourly.find(d => Number(d.STAT_HOUR) === h);
      return f?.MAX_MEM != null ? Number(f.MAX_MEM) : null;
    });
    return {
      animation: true, backgroundColor: 'transparent',
      legend: {
        data: ['CPU 평균', 'CPU 최대', 'MEM 평균', 'MEM 최대'],
        textStyle: { color: C.textMuted, fontSize: 10 }, top: 2,
        itemWidth: 12, itemHeight: 6,
      },
      grid: { top: 36, right: 16, bottom: 28, left: 44 },
      xAxis: {
        type: 'category', data: hours, boundaryGap: false,
        axisLine: { lineStyle: { color: C.gridLine } },
        axisLabel: { color: C.textMuted, fontSize: 9, interval: 3 },
        axisTick: { show: false },
      },
      yAxis: {
        type: 'value', min: 0, max: 100,
        axisLabel: { color: C.textMuted, fontSize: 10, formatter: '{value}%' },
        splitLine: { lineStyle: { color: C.gridLine } },
      },
      tooltip: {
        trigger: 'axis', appendToBody: true,
        backgroundColor: C.tipBg, borderColor: C.tipBdr,
        textStyle: { color: C.tipText, fontSize: 11 },
        formatter: params => {
          const p0 = params[0];
          const rows = params.filter(p => p.value != null).map(p => `${p.marker}${p.seriesName}: <b>${p.value}%</b>`);
          return `${p0.name}<br/>${rows.join('<br/>')}`;
        },
      },
      series: [
        { name: 'CPU 평균', type: 'line', data: avgCpu, smooth: true, connectNulls: true, symbolSize: 3, lineStyle: { color: '#3b82f6', width: 2 }, itemStyle: { color: '#3b82f6' }, areaStyle: { opacity: 0.08, color: '#3b82f6' } },
        { name: 'CPU 최대', type: 'line', data: maxCpu, smooth: true, connectNulls: true, symbolSize: 0, lineStyle: { color: '#93c5fd', width: 1.5, type: 'dashed' }, itemStyle: { color: '#93c5fd' } },
        { name: 'MEM 평균', type: 'line', data: avgMem, smooth: true, connectNulls: true, symbolSize: 3, lineStyle: { color: '#10b981', width: 2 }, itemStyle: { color: '#10b981' }, areaStyle: { opacity: 0.06, color: '#10b981' } },
        { name: 'MEM 최대', type: 'line', data: maxMem, smooth: true, connectNulls: true, symbolSize: 0, lineStyle: { color: '#6ee7b7', width: 1.5, type: 'dashed' }, itemStyle: { color: '#6ee7b7' } },
      ],
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cpuMemHourly, isLight]);

  // ── Chart: CPU/MEM 장비별 피크 ──
  const cpuMemPeakOpt = useMemo(() => {
    const items = cpuMemTop.slice(0, 7);
    const names = items.map(d => d.DEVICE_NAME ?? '-');
    const cpuVals = items.map(d => Number(d.MAX_CPU ?? 0));
    const memVals = items.map(d => Number(d.MAX_MEM ?? 0));
    return {
      animation: true, backgroundColor: 'transparent',
      legend: {
        data: ['CPU MAX', 'MEM MAX'], top: 2,
        textStyle: { color: C.textMuted, fontSize: 10 },
        itemWidth: 10, itemHeight: 8, icon: 'roundRect',
      },
      grid: { top: 32, right: 60, bottom: 8, left: 8, containLabel: true },
      xAxis: { type: 'value', max: 100, axisLabel: { show: false }, splitLine: { lineStyle: { color: C.gridLine } } },
      yAxis: {
        type: 'category', data: names.slice().reverse(),
        axisLabel: { color: C.text, fontSize: 10 },
        axisLine: { show: false }, axisTick: { show: false },
      },
      tooltip: {
        trigger: 'axis', appendToBody: true,
        backgroundColor: C.tipBg, borderColor: C.tipBdr,
        textStyle: { color: C.tipText, fontSize: 11 },
        formatter: params => params.filter(p => p.value > 0).map(p => `${p.marker}${p.seriesName}: <b>${p.value}%</b>`).join('<br/>'),
      },
      series: [
        { name: 'CPU MAX', type: 'bar', data: cpuVals.slice().reverse(), barMaxWidth: 10, itemStyle: { color: '#3b82f6', borderRadius: [0, 3, 3, 0] }, label: { show: true, position: 'right', color: C.textMuted, fontSize: 10, formatter: v => v.value > 0 ? `${v.value}%` : '' } },
        { name: 'MEM MAX', type: 'bar', data: memVals.slice().reverse(), barMaxWidth: 10, itemStyle: { color: '#10b981', borderRadius: [0, 3, 3, 0] }, label: { show: true, position: 'right', color: C.textMuted, fontSize: 10, formatter: v => v.value > 0 ? `${v.value}%` : '' } },
      ],
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cpuMemTop, isLight]);

  if (!isOpen) return <DailySummaryTriggerButton />;

  const card = (extra) => ({ padding: '14px 16px', borderRadius: 14, background: C.panelBg, border: `1px solid ${C.panelBdr}`, ...extra });
  const ttl = { fontSize: 11, fontWeight: 700, letterSpacing: 0.5, color: C.textMuted, textTransform: 'uppercase', marginBottom: 10 };
  const empty = { color: C.emptyTxt, fontSize: 12, padding: '12px 0', textAlign: 'center' };

  return (
    <div role="presentation" onClick={handleClose} style={{
      position: 'fixed', inset: 0, zIndex: 10000,
      background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px',
    }}>
      <div role="dialog" aria-modal="true" onClick={e => e.stopPropagation()} style={{
        width: '96vw', maxWidth: 1440, maxHeight: '92vh',
        borderRadius: 20, background: C.modalBg,
        border: `1px solid ${C.panelBdr}`,
        boxShadow: isLight ? '0 24px 60px rgba(15,23,42,0.18)' : '0 24px 60px rgba(0,0,0,0.55)',
        overflowY: 'auto',
      }}>

        {/* ── 헤더 ── */}
        <div style={{ padding: '16px 24px', borderBottom: `1px solid ${C.hdrBdr}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className="bi bi-clipboard-data" style={{ color: '#818cf8', fontSize: 17 }} />
            </span>
            <div>
              <div style={{ fontWeight: 800, fontSize: 17, color: C.text }}>{fmtDate(yyyyMMdd)} 전일 종합 현황</div>
              <div style={{ fontSize: 11, color: C.textMuted, marginTop: 1 }}>장애 · 성능 · 장비 변경 종합 리포트</div>
            </div>
          </div>
          <button onClick={handleClose} style={{ background: C.panelBg, border: `1px solid ${C.panelBdr}`, borderRadius: 9, width: 34, height: 34, color: C.textMuted, fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
        </div>

        {/* ── 요약 카드 4개 ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, padding: '12px 24px 0' }}>
          {[
            { label: '전일 총 장애', value: totalFault, unit: '건', icon: 'bi-exclamation-octagon-fill', color: '#ef4444', loading: summaryQ.isLoading },
            { label: '긴급(CR)', value: levelMap.C ?? 0, unit: '건', icon: 'bi-fire', color: '#ef4444', loading: summaryQ.isLoading },
            { label: '장비 변경', value: Number(changes.TOTAL_COUNT ?? 0), unit: '건', icon: 'bi-hdd-network', color: '#6366f1', loading: changesQ.isLoading },
            { label: '장애 발생 장비', value: topDevices.length, unit: '대', icon: 'bi-cpu', color: '#f59e0b', loading: topQ.isLoading },
          ].map(({ label, value, unit, icon, color, loading }) => (
            <div key={label} style={{ ...card({ background: `${color}0d`, border: `1px solid ${color}22`, display: 'flex', alignItems: 'center', gap: 10 }) }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: `${color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <i className={`bi ${icon}`} style={{ color, fontSize: 18 }} />
              </div>
              <div>
                <div style={{ fontSize: 10, color: C.textMuted, marginBottom: 1 }}>{label}</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: C.text, lineHeight: 1 }}>
                  {loading ? '…' : value}
                  <span style={{ fontSize: 11, fontWeight: 500, marginLeft: 3, color: C.textMuted }}>{unit}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* ── 스크롤 가능한 메인 콘텐츠 ── */}
        <div style={{ padding: '12px 24px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* Row 1: 장애 2열 */}
          <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 12 }}>
            {/* 등급별 도넛 */}
            <div style={card({ display: 'flex', flexDirection: 'column' })}>
              <div style={ttl}>장애 등급별</div>
              {totalFault === 0 && !summaryQ.isLoading
                ? <div style={empty}>전일 장애 없음</div>
                : <div style={{ height: 180, width: '100%' }}>
                    <SafeECharts option={pieOpt} notMerge style={{ height: 180, width: '100%' }} />
                  </div>
              }
              {/* 수치 요약 */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 6, marginTop: 8 }}>
                {LEVEL_ORDER.map(lv => {
                  const cnt = levelMap[lv] ?? 0;
                  const { short, color } = LEVEL_META[lv];
                  const pct = totalFault > 0 ? ((cnt / totalFault) * 100).toFixed(1) : 0;
                  return (
                    <div key={lv} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', borderRadius: 8, background: `${color}10`, border: `1px solid ${color}25` }}>
                      <span style={{ width: 28, fontSize: 10, fontWeight: 800, color, textAlign: 'center' }}>{short}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 16, fontWeight: 800, color: C.text, lineHeight: 1 }}>{cnt}<span style={{ fontSize: 9, color: C.textMuted, marginLeft: 2 }}>건</span></div>
                        <div style={{ fontSize: 9, color: C.textMuted }}>{pct}%</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 시간대별 장애 발생 */}
            <div style={card({ display: 'flex', flexDirection: 'column' })}>
              <div style={ttl}>시간대별 장애 발생 현황 (24시간)</div>
              <div style={{ height: 240 }}>
                <SafeECharts option={hourlyFaultOpt} notMerge style={{ height: 240, width: '100%' }} />
              </div>
            </div>
          </div>

          {/* Row 2: TOP 장비 */}
          <div style={card({})}>
            <div style={ttl}>상습 장애 장비 TOP 7</div>
            {topDevices.length === 0
              ? <div style={empty}>전일 장애 없음</div>
              : <div style={{ height: 180 }}>
                  <SafeECharts option={topDevOpt} notMerge style={{ height: 180, width: '100%' }} />
                </div>
            }
          </div>

          {/* Row 3: 성능 추이 + 성능 피크 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 12 }}>
            {/* CPU/MEM 시간대별 평균 추이 */}
            <div style={card({ display: 'flex', flexDirection: 'column' })}>
              <div style={ttl}>성능 시간대별 평균 추이 (CPU / MEM)</div>
              {cpuMemHourly.length === 0 && !changesQ.isLoading
                ? <div style={empty}>성능 데이터 없음</div>
                : <div style={{ height: 220 }}>
                    <SafeECharts option={cpuMemLineOpt} notMerge style={{ height: 220, width: '100%' }} />
                  </div>
              }
            </div>

            {/* CPU/MEM 장비별 피크 */}
            <div style={card({ display: 'flex', flexDirection: 'column' })}>
              <div style={ttl}>장비별 성능 피크</div>
              {cpuMemTop.length === 0 && !changesQ.isLoading
                ? <div style={empty}>데이터 없음</div>
                : <div style={{ height: 220 }}>
                    <SafeECharts option={cpuMemPeakOpt} notMerge style={{ height: 220, width: '100%' }} />
                  </div>
              }
            </div>
          </div>

          {/* Row 4: 장비 변경 + 장애 유형별 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {/* 장비 변경 */}
            <div style={card({})}>
              <div style={ttl}>장비 변경 이력</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 10 }}>
                {[
                  { label: '신규 등록', v: Number(changes.CREATED_COUNT ?? 0), color: '#10b981' },
                  { label: '정보 수정', v: Number(changes.UPDATED_COUNT ?? 0), color: '#6366f1' },
                  { label: '삭제', v: Number(changes.DELETED_COUNT ?? 0), color: '#ef4444' },
                ].map(({ label, v, color }) => (
                  <div key={label} style={{ textAlign: 'center', padding: '12px 8px', borderRadius: 10, background: `${color}12`, border: `1px solid ${color}28` }}>
                    <div style={{ fontSize: 10, color: C.textMuted, marginBottom: 4 }}>{label}</div>
                    <div style={{ fontSize: 26, fontWeight: 800, color }}>{changesQ.isLoading ? '…' : v}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* 장애 유형별 */}
            <div style={card({})}>
              <div style={ttl}>장애 유형별</div>
              {summaryQ.isLoading
                ? <div style={empty}>로딩 중...</div>
                : (summaryQ.data?.byType ?? []).length === 0
                  ? <div style={empty}>데이터 없음</div>
                  : <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                      {(summaryQ.data?.byType ?? []).slice(0, 6).map((row, i) => {
                        const maxCnt = Math.max(...(summaryQ.data?.byType ?? []).map(r => Number(r.CNT ?? r.COUNT ?? 0)), 1);
                        const cnt = Number(row.CNT ?? row.COUNT ?? 0);
                        const colors = ['#6366f1', '#ef4444', '#f59e0b', '#10b981', '#06b6d4', '#ec4899'];
                        const c = colors[i % colors.length];
                        return (
                          <div key={row.ERROR_TYPE ?? row.TYPE ?? i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 11, fontWeight: 600, color: C.text, minWidth: 90 }}>{row.ERROR_TYPE ?? row.TYPE ?? '-'}</span>
                            <div style={{ flex: 1, height: 8, background: C.gridLine, borderRadius: 4, overflow: 'hidden' }}>
                              <div style={{ width: `${(cnt / maxCnt) * 100}%`, height: '100%', background: c, borderRadius: 4 }} />
                            </div>
                            <span style={{ fontSize: 12, fontWeight: 700, color: C.text, minWidth: 30, textAlign: 'right' }}>{cnt}</span>
                          </div>
                        );
                      })}
                    </div>
              }
            </div>
          </div>
        </div>

          {/* Row 5: 장비별 상세 장애 요약 카드 */}
          {deviceSummaries.length > 0 && (
            <div style={card({})}>
              <div style={ttl}>장비별 장애 상세 요약</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
                {deviceSummaries.map(dev => {
                  const maxType = Math.max(...dev.types.map(t => t.cnt), 1);
                  const dominantLevel = LEVEL_ORDER.find(lv => (dev.levels[lv] ?? 0) > 0);
                  const domColor = dominantLevel ? LEVEL_META[dominantLevel].color : '#6366f1';
                  const levelColors = { C: '#ef4444', M: '#f97316', N: '#eab308', W: '#3b82f6' };
                  return (
                    <div key={dev.name} style={{ borderRadius: 14, border: `1px solid ${domColor}30`, background: C.panelBg, padding: '14px 16px' }}>
                      {/* 헤더 */}
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 13, color: C.text }}>{dev.name}</div>
                          {dev.ip && <div style={{ fontSize: 10, color: C.textMuted, marginTop: 1, fontFamily: 'monospace' }}>{dev.ip}</div>}
                        </div>
                        <div style={{ fontWeight: 800, fontSize: 20, color: domColor }}>
                          {dev.total}<span style={{ fontSize: 10, fontWeight: 500, color: C.textMuted, marginLeft: 2 }}>건</span>
                        </div>
                      </div>

                      {/* 등급별 스택드 바 */}
                      <div style={{ marginBottom: 8 }}>
                        <div style={{ fontSize: 10, color: C.textMuted, marginBottom: 4 }}>등급별 분포</div>
                        <div style={{ display: 'flex', height: 14, borderRadius: 7, overflow: 'hidden', gap: 1 }}>
                          {LEVEL_ORDER.filter(lv => (dev.levels[lv] ?? 0) > 0).map(lv => (
                            <div key={lv} title={`${LEVEL_META[lv].short}: ${dev.levels[lv]}건`}
                              style={{ flex: dev.levels[lv], background: levelColors[lv], display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: dev.levels[lv] / dev.total > 0.15 ? 'auto' : 0 }}>
                              {dev.levels[lv] / dev.total > 0.12 && (
                                <span style={{ fontSize: 9, fontWeight: 700, color: '#fff' }}>{LEVEL_META[lv].short}</span>
                              )}
                            </div>
                          ))}
                        </div>
                        {/* 등급별 수치 */}
                        <div style={{ display: 'flex', gap: 6, marginTop: 5, flexWrap: 'wrap' }}>
                          {LEVEL_ORDER.filter(lv => (dev.levels[lv] ?? 0) > 0).map(lv => (
                            <span key={lv} style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10 }}>
                              <span style={{ width: 8, height: 8, borderRadius: 2, background: levelColors[lv], flexShrink: 0 }} />
                              <span style={{ color: C.textMuted }}>{LEVEL_META[lv].short}</span>
                              <span style={{ fontWeight: 700, color: levelColors[lv] }}>{dev.levels[lv]}</span>
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* 유형별 수평 바 */}
                      {dev.types.length > 0 && (
                        <div>
                          <div style={{ fontSize: 10, color: C.textMuted, marginBottom: 5 }}>장애 유형</div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                            {dev.types.map((t, ti) => {
                              // 유형 색 = 카운트 순위 기반 레벨 색 매핑
                              // 유형 내림차순 ↔ 레벨 내림차순 매칭
                              // ex) PING(35)→CR(35)→빨강, SNMP(10)→MJ(10)→주황
                              const sortedLevels = LEVEL_ORDER
                                .filter(lv => (dev.levels[lv] ?? 0) > 0)
                                .sort((a, b) => (dev.levels[b] ?? 0) - (dev.levels[a] ?? 0));
                              const tc = sortedLevels[ti]
                                ? LEVEL_META[sortedLevels[ti]].color
                                : (sortedLevels[sortedLevels.length - 1] ? LEVEL_META[sortedLevels[sortedLevels.length - 1]].color : '#6366f1');
                              return (
                                <div key={t.type} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <span style={{ fontSize: 10, color: C.text, width: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexShrink: 0 }} title={t.type}>{t.type}</span>
                                  <div style={{ flex: 1, height: 7, background: C.gridLine, borderRadius: 4, overflow: 'hidden' }}>
                                    <div style={{ width: `${(t.cnt / maxType) * 100}%`, height: '100%', background: tc, borderRadius: 4, transition: 'width 0.5s ease' }} />
                                  </div>
                                  <span style={{ fontSize: 10, fontWeight: 700, color: tc, width: 24, textAlign: 'right', flexShrink: 0 }}>{t.cnt}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        {/* ── 푸터 ── */}
        <div style={{ padding: '12px 24px', borderTop: `1px solid ${C.hdrBdr}`, display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={handleClose} style={{ background: 'linear-gradient(135deg,#6366f1,#4f46e5)', color: '#fff', border: 'none', borderRadius: 10, padding: '9px 26px', fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 12px rgba(99,102,241,0.4)' }}>
            확인
          </button>
        </div>
      </div>
    </div>
  );
}
