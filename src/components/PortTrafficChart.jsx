import { useMemo, useRef } from 'react';
import ReactECharts from 'echarts-for-react';

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

export default function PortTrafficChart({ rawData, chartPortsSet, portsData, settings = {} }) {
  const { counterType = '64bit', trafficUnit = 'bit', showError = false, showDiscard = false } = settings;

  const portColorMap = useMemo(() => {
    const map = {};
    const sortedPorts = Array.from(chartPortsSet).sort((a, b) => a - b);
    sortedPorts.forEach((ifIndex, i) => {
      map[ifIndex] = CHART_COLORS[i % CHART_COLORS.length];
    });
    return map;
  }, [chartPortsSet]);

  const getPortName = (ifIndex) => {
    const port = portsData?.find(p => p.IF_INDEX === ifIndex);
    return port ? (port.IF_NAME || port.IF_DESCR || `Port ${ifIndex}`) : `Port ${ifIndex}`;
  };

  const chartAreaRef = useRef(null);

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

    // 포트별 ifSpeed (bps 단위) 조회
    const getIfSpeedBps = (ifIndex) => {
      const port = portsData?.find(p => p.IF_INDEX === ifIndex);
      if (!port) return 0;
      // IF_HIGH_SPEED는 Mbps 단위, IF_SPEED는 bps 단위
      if (port.IF_HIGH_SPEED && port.IF_HIGH_SPEED > 0) return port.IF_HIGH_SPEED * 1e6;
      return port.IF_SPEED || 0;
    };

    const getInValue = (r) => {
      let val = counterType === '64bit' ? (r.IN_HIGH_BPS ?? r.IN_BPS ?? 0) : (r.IN_BPS ?? 0);
      if (trafficUnit === 'byte') return val / 8;
      if (trafficUnit === 'bps') {
        const speed = getIfSpeedBps(r.IF_INDEX);
        return speed > 0 ? (val / speed) * 100 : 0;
      }
      return val;
    };
    const getOutValue = (r) => {
      let val = counterType === '64bit' ? (r.OUT_HIGH_BPS ?? r.OUT_BPS ?? 0) : (r.OUT_BPS ?? 0);
      if (trafficUnit === 'byte') return -(val / 8);
      if (trafficUnit === 'bps') {
        const speed = getIfSpeedBps(r.IF_INDEX);
        return speed > 0 ? -((val / speed) * 100) : 0;
      }
      return -val;
    };

    const inSeries = [];
    const outSeries = [];
    const errorSeries = [];
    const discardSeries = [];

    Object.entries(byPort).forEach(([ifIdx, rows]) => {
      const ifIndex = parseInt(ifIdx);
      const portName = getPortName(ifIndex);
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
  }, [rawData, chartPortsSet, portsData, counterType, trafficUnit, showError, showDiscard, portColorMap]);

  const hasQuality = showError || showDiscard;
  const qualitySeries = [...chartData.errorSeries, ...chartData.discardSeries];

  const mainOption = useMemo(() => {
    const allSeries = [...chartData.inSeries, ...chartData.outSeries];
    if (allSeries.length === 0) {
      return {
        graphic: {
          type: 'text', left: 'center', top: 'center',
          style: { text: '선택된 포트의 트래픽 데이터가 없습니다', fill: '#64748b', fontSize: 13 },
        },
      };
    }

    return {
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(30, 41, 59, 0.98)',
        borderColor: '#334155',
        borderWidth: 2,
        textStyle: { color: '#f1f5f9', fontSize: 11 },
        confine: true,
        enterable: true,
        formatter: (params) => {
          if (!params || params.length === 0) return '';
          const chartH = chartAreaRef.current?.offsetHeight || 300;
          const maxH = Math.max(chartH - 60, 120);
          const header = `<div style="font-weight:bold;margin-bottom:6px;border-bottom:1px solid #334155;padding-bottom:4px">${params[0].axisValue}</div>`;
          let items = '';
          params.forEach(p => {
            const marker = `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${p.color};margin-right:6px"></span>`;
            const dir = (p.value || 0) >= 0 ? 'IN' : 'OUT';
            const displayVal = formatLargeValue(Math.abs(p.value || 0), trafficUnit);
            items += `<div style="margin-top:4px;white-space:nowrap;font-size:12px">${marker}${p.seriesName} ${dir}: <strong>${displayVal}</strong></div>`;
          });
          const scrollHint = params.length > 10
            ? `<div style="text-align:center;padding:6px 0 2px;color:#64748b;font-size:10px;border-top:1px solid #334155;margin-top:6px">↕ 스크롤</div>`
            : '';
          return `<div style="max-height:${maxH}px;max-width:300px;overflow-y:auto;scrollbar-width:thin;scrollbar-color:#64748b #1e293b;box-shadow:0 4px 20px rgba(0,0,0,0.5)">${header}${items}${scrollHint}</div>`;
        },
      },
      legend: {
        data: chartData.inSeries.map(s => s.name),
        textStyle: { color: '#94a3b8', fontSize: 10, overflow: 'truncate', width: 100 },
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
        axisLine: { lineStyle: { color: '#334155' } },
      },
      yAxis: {
        type: 'value',
        axisLabel: { color: '#94a3b8', fontSize: 9, formatter: (v) => trafficUnit === 'bps' ? Math.abs(v).toFixed(0) + '%' : formatAxisValue(Math.abs(v)) },
        axisLine: { lineStyle: { color: '#334155' } },
        splitLine: { lineStyle: { color: '#1e293b' } },
      },
      series: allSeries,
    };
  }, [chartData, trafficUnit]);

  const qualityOption = useMemo(() => {
    if (!hasQuality || qualitySeries.length === 0) return null;
    return {
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(30, 41, 59, 0.98)',
        borderColor: '#334155', borderWidth: 2,
        textStyle: { color: '#f1f5f9', fontSize: 11 }, confine: true,
        formatter: (params) => {
          if (!params || params.length === 0) return '';
          let result = `<div style="font-weight:bold;margin-bottom:4px;border-bottom:1px solid #334155;padding-bottom:4px">${params[0].axisValue}</div>`;
          params.forEach(p => {
            const marker = `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${p.color};margin-right:6px"></span>`;
            result += `<div style="margin-top:4px;font-size:12px">${marker}${p.seriesName}: <strong>${formatCount(Math.abs(p.value || 0))}</strong></div>`;
          });
          return result;
        },
      },
      legend: {
        type: 'scroll', show: true, bottom: 0, left: 'center', width: '90%',
        textStyle: { color: '#94a3b8', fontSize: 10 }, itemWidth: 12, itemHeight: 8,
        pageIconColor: '#3b82f6', pageIconInactiveColor: '#475569',
        pageTextStyle: { color: '#94a3b8', fontSize: 10 },
      },
      grid: { left: '2%', right: '2%', bottom: '18%', top: '8%', containLabel: true },
      xAxis: {
        type: 'category', boundaryGap: true, data: chartData.timeLabels,
        axisLabel: { color: '#94a3b8', fontSize: 9 },
        axisLine: { lineStyle: { color: '#334155' } },
      },
      yAxis: {
        type: 'value',
        axisLabel: { color: '#94a3b8', fontSize: 9, formatter: (v) => formatCount(v) },
        axisLine: { lineStyle: { color: '#334155' } },
        splitLine: { lineStyle: { color: '#1e293b' } },
      },
      series: qualitySeries,
    };
  }, [hasQuality, qualitySeries, chartData.timeLabels]);

  return (
    <div className="port-traffic-chart">
      <div className="ptc-chart-area" ref={chartAreaRef}>
        <ReactECharts
          key={`main-${counterType}-${trafficUnit}-${Array.from(chartPortsSet).join('-')}`}
          notMerge={true}
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
          <ReactECharts
            key={`quality-${showError}-${showDiscard}-${Array.from(chartPortsSet).join('-')}`}
            notMerge={true}
            option={qualityOption}
            style={{ height: '100%', width: '100%' }}
          />
        </div>
      )}
    </div>
  );
}
