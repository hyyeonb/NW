import { useEffect, useMemo, useRef } from 'react';
import SafeECharts from './SafeECharts';
import { useThemeStore } from '../stores/themeStore';

const CHART_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6',
  '#ef4444', '#06b6d4', '#ec4899', '#84cc16',
];

const colorToRgba = (hex, alpha) => {
  if (!hex) return `rgba(59,130,246,${alpha})`;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
};

const formatLargeValue = (val, unit) => {
  const abs = Math.abs(val);
  if (unit === 'bps') return val.toFixed(2) + ' %';
  if (unit === 'byte') {
    if (abs >= 1e9) return (val / 1e9).toFixed(2) + ' GB/s';
    if (abs >= 1e6) return (val / 1e6).toFixed(2) + ' MB/s';
    if (abs >= 1e3) return (val / 1e3).toFixed(2) + ' KB/s';
    return val.toFixed(2) + ' B/s';
  }
  if (abs >= 1e9) return (val / 1e9).toFixed(2) + ' Gbps';
  if (abs >= 1e6) return (val / 1e6).toFixed(2) + ' Mbps';
  if (abs >= 1e3) return (val / 1e3).toFixed(2) + ' Kbps';
  return val.toFixed(2) + ' bps';
};

const formatAxisValue = (v) => {
  const abs = Math.abs(v);
  if (abs >= 1e9) return (v / 1e9).toFixed(0) + 'G';
  if (abs >= 1e6) return (v / 1e6).toFixed(0) + 'M';
  if (abs >= 1e3) return (v / 1e3).toFixed(0) + 'K';
  return v.toFixed(0);
};

const formatCount = (val) => {
  const abs = Math.abs(val);
  if (abs >= 1e6) return (val / 1e6).toFixed(1) + 'M';
  if (abs >= 1e3) return (val / 1e3).toFixed(1) + 'K';
  return val.toFixed(0);
};

export default function PortTrafficChart({ rawData, chartPortsSet, portsData, settings = {}, loading = false }) {
  const { counterType = '64bit', trafficUnit = 'bit', showError = false, showDiscard = false } = settings;
  const resolvedTheme = useThemeStore(s => s.resolvedTheme);
  const isDark = resolvedTheme === 'dark';

  const portColorMap = useMemo(() => {
    const map = {};
    const sortedPorts = Array.from(chartPortsSet).sort((a, b) => a - b);
    sortedPorts.forEach((ifIndex, i) => {
      map[ifIndex] = CHART_COLORS[i % CHART_COLORS.length];
    });
    return map;
  }, [chartPortsSet]);

  const chartAreaRef = useRef(null);

  // 컨테이너 크기 변경 시 ECharts 재계산 (ResizeObserver)
  useEffect(() => {
    const el = chartAreaRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    let raf;
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        window.dispatchEvent(new Event('resize'));
      });
    });
    ro.observe(el);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  // portsData → O(1) 룩업 Map (포트명, 속도)
  const portLookup = useMemo(() => {
    const nameMap = {};
    const speedMap = {};
    if (portsData) {
      for (const p of portsData) {
        nameMap[p.IF_INDEX] = p.IF_NAME || p.IF_DESCR || `Port ${p.IF_INDEX}`;
        speedMap[p.IF_INDEX] = (p.IF_HIGH_SPEED && p.IF_HIGH_SPEED > 0)
          ? p.IF_HIGH_SPEED * 1e6
          : (p.IF_SPEED || 0);
      }
    }
    return { nameMap, speedMap };
  }, [portsData]);

  const chartData = useMemo(() => {
    if (!rawData || rawData.length === 0 || chartPortsSet.size === 0) {
      return { timeLabels: [], inSeries: [], outSeries: [], errorSeries: [], discardSeries: [] };
    }

    const filtered = rawData.filter(r => chartPortsSet.has(r.IF_INDEX));
    if (filtered.length === 0) {
      return { timeLabels: [], inSeries: [], outSeries: [], errorSeries: [], discardSeries: [] };
    }

    const byPort = {};
    filtered.forEach(r => {
      if (!byPort[r.IF_INDEX]) byPort[r.IF_INDEX] = [];
      byPort[r.IF_INDEX].push(r);
    });

    let maxPort = null;
    let maxLen = 0;
    Object.entries(byPort).forEach(([ifIdx, rows]) => {
      rows.sort((a, b) => new Date(a.COLLECTED_AT) - new Date(b.COLLECTED_AT));
      if (rows.length > maxLen) { maxLen = rows.length; maxPort = ifIdx; }
    });

    if (!maxPort) {
      return { timeLabels: [], inSeries: [], outSeries: [], errorSeries: [], discardSeries: [] };
    }

    const timeLabels = byPort[maxPort].map(r => {
      const d = new Date(r.COLLECTED_AT);
      return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    });

    const { nameMap, speedMap } = portLookup;

    const getInValue = (r) => {
      if (trafficUnit === 'bps') {
        // 사용률(%) — 신규 컬럼 우선, 기존 BPS(=%) 폴백
        return counterType === '64bit'
          ? (r.IN_HIGH_USED_PERCENT ?? r.IN_USED_PERCENT ?? r.IN_HIGH_BPS ?? r.IN_BPS ?? 0)
          : (r.IN_USED_PERCENT ?? r.IN_BPS ?? 0);
      }
      // 실제 bps
      let val = counterType === '64bit' ? (r.IN_HIGH_BPS ?? r.IN_BPS ?? 0) : (r.IN_BPS ?? 0);
      // 하위호환: % 컬럼 없으면 구 데이터 → 역산
      if (r.IN_USED_PERCENT == null && r.IN_HIGH_USED_PERCENT == null && val > 0 && val <= 100) {
        const speed = speedMap[r.IF_INDEX] || 0;
        val = speed > 0 ? (val / 100) * speed : 0;
      }
      return trafficUnit === 'byte' ? val / 8 : val;
    };
    const getOutValue = (r) => {
      if (trafficUnit === 'bps') {
        // 사용률(%) — 신규 컬럼 우선, 기존 BPS(=%) 폴백
        const pct = counterType === '64bit'
          ? (r.OUT_HIGH_USED_PERCENT ?? r.OUT_USED_PERCENT ?? r.OUT_HIGH_BPS ?? r.OUT_BPS ?? 0)
          : (r.OUT_USED_PERCENT ?? r.OUT_BPS ?? 0);
        return -pct;
      }
      // 실제 bps
      let val = counterType === '64bit' ? (r.OUT_HIGH_BPS ?? r.OUT_BPS ?? 0) : (r.OUT_BPS ?? 0);
      // 하위호환: % 컬럼 없으면 구 데이터 → 역산
      if (r.OUT_USED_PERCENT == null && r.OUT_HIGH_USED_PERCENT == null && val > 0 && val <= 100) {
        const speed = speedMap[r.IF_INDEX] || 0;
        val = speed > 0 ? (val / 100) * speed : 0;
      }
      return trafficUnit === 'byte' ? -(val / 8) : -val;
    };

    const inSeries = [];
    const outSeries = [];
    const errorSeries = [];
    const discardSeries = [];

    Object.entries(byPort).forEach(([ifIdx, rows]) => {
      const ifIndex = parseInt(ifIdx);
      const portName = nameMap[ifIndex] || `Port ${ifIndex}`;
      const color = portColorMap[ifIndex] || '#3b82f6';

      const timeMap = {};
      rows.forEach(r => {
        const d = new Date(r.COLLECTED_AT);
        const key = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
        timeMap[key] = r;
      });

      const inData = timeLabels.map(t => timeMap[t] ? getInValue(timeMap[t]) : null);
      const outData = timeLabels.map(t => timeMap[t] ? getOutValue(timeMap[t]) : null);

      inSeries.push({
        name: portName, ifIndex, type: 'line', smooth: true,
        symbol: 'circle', symbolSize: 4, showSymbol: false,
        lineStyle: { color, width: 2 }, itemStyle: { color },
        areaStyle: {
          color: {
            type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: colorToRgba(color, 0.25) },
              { offset: 1, color: colorToRgba(color, 0) },
            ],
          },
        },
        data: inData,
      });

      outSeries.push({
        name: portName, ifIndex, type: 'line', smooth: true,
        symbol: 'circle', symbolSize: 4, showSymbol: false,
        lineStyle: { color, width: 2 }, itemStyle: { color },
        areaStyle: {
          color: {
            type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: colorToRgba(color, 0) },
              { offset: 1, color: colorToRgba(color, 0.25) },
            ],
          },
        },
        data: outData,
      });

      if (showError) {
        errorSeries.push({
          name: `${portName} IN Err`, ifIndex, type: 'bar',
          stack: `err-in-${ifIndex}`, barMaxWidth: 6,
          itemStyle: { color: 'rgba(239,68,68,0.7)' },
          data: timeLabels.map(t => timeMap[t] ? (timeMap[t].IN_ERROR_USED ?? 0) : 0),
        });
        errorSeries.push({
          name: `${portName} OUT Err`, ifIndex, type: 'bar',
          stack: `err-out-${ifIndex}`, barMaxWidth: 6,
          itemStyle: { color: 'rgba(239,68,68,0.4)' },
          data: timeLabels.map(t => timeMap[t] ? -(timeMap[t].OUT_ERROR_USED ?? 0) : 0),
        });
      }

      if (showDiscard) {
        discardSeries.push({
          name: `${portName} IN Disc`, ifIndex, type: 'bar',
          stack: `disc-in-${ifIndex}`, barMaxWidth: 6,
          itemStyle: { color: 'rgba(245,158,11,0.7)' },
          data: timeLabels.map(t => timeMap[t] ? (timeMap[t].IN_DISCARD_USED ?? 0) : 0),
        });
        discardSeries.push({
          name: `${portName} OUT Disc`, ifIndex, type: 'bar',
          stack: `disc-out-${ifIndex}`, barMaxWidth: 6,
          itemStyle: { color: 'rgba(245,158,11,0.4)' },
          data: timeLabels.map(t => timeMap[t] ? -(timeMap[t].OUT_DISCARD_USED ?? 0) : 0),
        });
      }
    });

    return { timeLabels, inSeries, outSeries, errorSeries, discardSeries };
  }, [rawData, chartPortsSet, portLookup, counterType, trafficUnit, showError, showDiscard, portColorMap]);

  const hasQuality = showError || showDiscard;
  const qualitySeries = [...chartData.errorSeries, ...chartData.discardSeries];

  const mainOption = useMemo(() => {
    const allSeries = [...chartData.inSeries, ...chartData.outSeries];
    if (allSeries.length === 0) {
      return {
        graphic: {
          type: 'text', left: 'center', top: 'center',
          style: {
            text: loading ? '' : (chartPortsSet.size === 0 ? '포트를 클릭하여 차트에 추가하세요' : '선택된 포트의 트래픽 데이터가 없습니다'),
            fill: isDark ? '#64748b' : '#94a3b8', fontSize: 13,
          },
        },
      };
    }

    return {
      tooltip: {
        trigger: 'axis',
        backgroundColor: isDark ? 'rgba(30, 41, 59, 0.98)' : 'rgba(255, 255, 255, 0.98)',
        borderColor: isDark ? '#334155' : '#e2e8f0',
        borderWidth: 2,
        textStyle: { color: isDark ? '#f1f5f9' : '#1e293b', fontSize: 11 },
        confine: true,
        enterable: true,
        formatter: (params) => {
          if (!params || params.length === 0) return '';
          const chartH = chartAreaRef.current?.offsetHeight || 300;
          const maxH = Math.max(chartH - 60, 120);
          const dividerColor = isDark ? '#334155' : '#e2e8f0';
          const hintColor = isDark ? '#64748b' : '#94a3b8';
          const scrollbarColor = isDark ? '#64748b #1e293b' : '#cbd5e1 #f1f5f9';
          const shadow = isDark ? '0 4px 20px rgba(0,0,0,0.5)' : '0 4px 16px rgba(15,23,42,0.12)';
          const header = `<div style="font-weight:bold;margin-bottom:6px;border-bottom:1px solid ${dividerColor};padding-bottom:4px">${params[0].axisValue}</div>`;
          let items = '';
          params.forEach(p => {
            const marker = `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${p.color};margin-right:6px"></span>`;
            const dir = (p.value || 0) >= 0 ? 'IN' : 'OUT';
            const displayVal = formatLargeValue(Math.abs(p.value || 0), trafficUnit);
            items += `<div style="margin-top:4px;white-space:nowrap;font-size:12px">${marker}${p.seriesName} ${dir}: <strong>${displayVal}</strong></div>`;
          });
          const scrollHint = params.length > 10
            ? `<div style="text-align:center;padding:6px 0 2px;color:${hintColor};font-size:10px;border-top:1px solid ${dividerColor};margin-top:6px">↕ 스크롤</div>`
            : '';
          return `<div style="max-height:${maxH}px;max-width:300px;overflow-y:auto;scrollbar-width:thin;scrollbar-color:${scrollbarColor};box-shadow:${shadow};border-radius:6px">${header}${items}${scrollHint}</div>`;
        },
      },
      legend: {
        data: chartData.inSeries.map(s => s.name),
        textStyle: { color: isDark ? '#94a3b8' : '#64748b', fontSize: 10, overflow: 'truncate', width: 100 },
        bottom: 0, left: 'center', type: 'scroll', orient: 'horizontal',
        pageIconColor: '#3b82f6', pageIconInactiveColor: '#475569',
        pageTextStyle: { color: '#94a3b8' },
      },
      grid: { left: '2%', right: '2%', bottom: '15%', top: '8%', containLabel: true },
      toolbox: {
        show: true, right: 5, top: 0, itemSize: 12,
        feature: {
          dataZoom: { yAxisIndex: 'none', title: { zoom: '드래그 확대', back: '확대 복원' } },
          restore: { title: '복원' },
          saveAsImage: { title: '이미지 저장', backgroundColor: '#0f172a' },
        },
        iconStyle: { borderColor: '#94a3b8' },
        emphasis: { iconStyle: { borderColor: '#3b82f6' } },
      },
      dataZoom: [{
        type: 'inside', start: 0, end: 100,
        zoomOnMouseWheel: 'shift', moveOnMouseMove: true,
      }],
      xAxis: {
        type: 'category', boundaryGap: false, data: chartData.timeLabels,
        axisLabel: { color: '#94a3b8', fontSize: 9 },
        axisLine: { lineStyle: { color: isDark ? '#334155' : '#e2e8f0' } },
      },
      yAxis: {
        type: 'value',
        axisLabel: { color: '#94a3b8', fontSize: 9, formatter: (v) => trafficUnit === 'bps' ? Math.abs(v).toFixed(0) + '%' : formatAxisValue(Math.abs(v)) },
        axisLine: { lineStyle: { color: isDark ? '#334155' : '#e2e8f0' } },
        splitLine: { lineStyle: { color: isDark ? '#1e293b' : '#f1f5f9' } },
      },
      series: allSeries,
    };
  }, [chartData, trafficUnit, resolvedTheme]);

  const qualityOption = useMemo(() => {
    if (!hasQuality || qualitySeries.length === 0) return null;
    return {
      tooltip: {
        trigger: 'axis',
        backgroundColor: isDark ? 'rgba(30, 41, 59, 0.98)' : 'rgba(255, 255, 255, 0.98)',
        borderColor: isDark ? '#334155' : '#e2e8f0', borderWidth: 2,
        textStyle: { color: isDark ? '#f1f5f9' : '#1e293b', fontSize: 11 }, confine: true,
        formatter: (params) => {
          if (!params || params.length === 0) return '';
          const dividerColor = isDark ? '#334155' : '#e2e8f0';
          let result = `<div style="font-weight:bold;margin-bottom:4px;border-bottom:1px solid ${dividerColor};padding-bottom:4px">${params[0].axisValue}</div>`;
          params.forEach(p => {
            const marker = `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${p.color};margin-right:6px"></span>`;
            result += `<div style="margin-top:4px;font-size:12px">${marker}${p.seriesName}: <strong>${formatCount(Math.abs(p.value || 0))}</strong></div>`;
          });
          return result;
        },
      },
      legend: {
        type: 'scroll', show: true, bottom: 0, left: 'center', width: '90%',
        textStyle: { color: isDark ? '#94a3b8' : '#64748b', fontSize: 10 }, itemWidth: 12, itemHeight: 8,
        pageIconColor: '#3b82f6', pageIconInactiveColor: '#475569',
        pageTextStyle: { color: '#94a3b8', fontSize: 10 },
      },
      grid: { left: '2%', right: '2%', bottom: '18%', top: '8%', containLabel: true },
      xAxis: {
        type: 'category', boundaryGap: true, data: chartData.timeLabels,
        axisLabel: { color: '#94a3b8', fontSize: 9 },
        axisLine: { lineStyle: { color: isDark ? '#334155' : '#e2e8f0' } },
      },
      yAxis: {
        type: 'value',
        axisLabel: { color: '#94a3b8', fontSize: 9, formatter: (v) => formatCount(v) },
        axisLine: { lineStyle: { color: isDark ? '#334155' : '#e2e8f0' } },
        splitLine: { lineStyle: { color: isDark ? '#1e293b' : '#f1f5f9' } },
      },
      series: qualitySeries,
    };
  }, [hasQuality, qualitySeries, chartData.timeLabels, resolvedTheme]);

  return (
    <div className="port-traffic-chart">
      <div className="ptc-chart-area" ref={chartAreaRef}>
        <SafeECharts
          key={`main-${counterType}-${trafficUnit}-${Array.from(chartPortsSet).join('-')}`}
          notMerge={false}
          option={mainOption}
          style={{ height: '100%', width: '100%' }}
        />
      </div>

      {hasQuality && qualityOption && (
        <div className="ptc-quality-area">
          <div className="ptc-quality-label">
            {showError && <span className="ptc-ql-badge error">Error</span>}
            {showDiscard && <span className="ptc-ql-badge discard">Discard</span>}
          </div>
          <SafeECharts
            key={`quality-${showError}-${showDiscard}-${Array.from(chartPortsSet).join('-')}`}
            notMerge={false}
            option={qualityOption}
            style={{ height: '100%', width: '100%' }}
          />
        </div>
      )}
    </div>
  );
}
