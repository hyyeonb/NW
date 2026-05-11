import { useState, useMemo, useRef, useEffect, memo } from 'react';
import { createPortal } from 'react-dom';
import SafeECharts from './SafeECharts';
import { useWatchStore } from '../stores/watchStore';
import { useThemeStore } from '../stores/themeStore';
import { getChartTheme } from '../constants/chartTheme';

// 값 포맷팅 함수 (단위별 분기)
const formatTrafficValue = (value, unit) => {
  if (value === null || value === undefined) return '-';
  if (unit === 'bps') return `${value.toFixed(1)}%`;
  const absValue = Math.abs(value);
  const suffix = unit === 'byte' ? 'B/s' : 'bps';
  if (absValue >= 1e9) return `${(value / 1e9).toFixed(1)}G`;
  if (absValue >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
  if (absValue >= 1e3) return `${(value / 1e3).toFixed(1)}K`;
  return `${value.toFixed(0)}`;
};

// 기존 호환 (bit 기본)
const formatBps = (value) => formatTrafficValue(value, 'bit');

import { PORT_COLORS } from '../features/device-metric-card/model/constants';
import { formatTimeHHMMSS as formatTime } from '../shared/lib/format';

function DeviceMetricCard({ device, history = [], onHide }) {
  const globalChartSettings = useWatchStore((s) => s.globalChartSettings);
  const globalSettingsVersion = useWatchStore((s) => s.globalSettingsVersion);
  const gridSize = useWatchStore((s) => s.gridSize);
  const resolvedTheme = useThemeStore((s) => s.resolvedTheme);
  const chartTheme = getChartTheme(resolvedTheme);

  const [showCpu, setShowCpu] = useState(globalChartSettings.showCpu);
  const [showMem, setShowMem] = useState(globalChartSettings.showMem);
  const [counterType, setCounterType] = useState(globalChartSettings.counterType);
  const [showTraffic, setShowTraffic] = useState(true); // IN/OUT 항상 함께 표시
  const [showError, setShowError] = useState(globalChartSettings.showError);
  const [showDiscard, setShowDiscard] = useState(globalChartSettings.showDiscard);
  const [trafficUnit, setTrafficUnit] = useState(globalChartSettings.trafficUnit || 'bit');
  const [showOptions, setShowOptions] = useState(false);
  const optionsRef = useRef(null);
  const dropdownRef = useRef(null);

  // 전역 설정 변경 감지
  useEffect(() => {
    if (globalSettingsVersion > 0) {
      setShowCpu(globalChartSettings.showCpu);
      setShowMem(globalChartSettings.showMem);
      setCounterType(globalChartSettings.counterType);
      setShowError(globalChartSettings.showError);
      setShowDiscard(globalChartSettings.showDiscard);
      setTrafficUnit(globalChartSettings.trafficUnit || 'bit');
    }
  }, [globalSettingsVersion, globalChartSettings]);

  // interfaces를 ifIndex로 정렬하여 일관된 순서 유지
  const interfaces = useMemo(() => {
    return [...(device.interfaces || [])].sort((a, b) => a.ifIndex - b.ifIndex);
  }, [device.interfaces]);

  const cpuValue = device.cpu?.usage;
  const memValue = device.mem?.usage;

  // 옵션 드롭다운 외부 클릭 감지 (Portal 포함)
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (optionsRef.current && !optionsRef.current.contains(e.target) &&
          dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowOptions(false);
      }
    };
    if (showOptions) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showOptions]);

  // history 전처리: slice + reverse + ifMap 인덱싱 (1회)
  const processedHistory = useMemo(() => {
    const sliced = history.slice(0, 20).reverse();
    return sliced.map(h => ({
      ...h,
      ifMap: new Map((h.interfaces || []).map(i => [i.ifIndex, i])),
    }));
  }, [history]);

  // CPU/MEM 차트 옵션
  const cpuMemChartOption = useMemo(() => {
    const times = processedHistory.map(h => formatTime(h.time));
    const cpuData = processedHistory.map(h => h.cpu ?? null);
    const memData = processedHistory.map(h => h.mem ?? null);

    const series = [];
    if (showCpu) {
      series.push({
        name: 'CPU',
        type: 'line',
        data: cpuData,
        smooth: true,
        showSymbol: false,
        color: '#3b82f6',
        itemStyle: { color: '#3b82f6' },
        lineStyle: { width: 2, color: '#3b82f6' },
        areaStyle: {
          color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [{ offset: 0, color: 'rgba(59,130,246,0.3)' }, { offset: 1, color: 'rgba(59,130,246,0)' }]
          },
        },
      });
    }
    if (showMem) {
      series.push({
        name: 'MEM',
        type: 'line',
        data: memData,
        smooth: true,
        showSymbol: false,
        color: '#8b5cf6',
        itemStyle: { color: '#8b5cf6' },
        lineStyle: { width: 2, color: '#8b5cf6' },
        areaStyle: {
          color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [{ offset: 0, color: 'rgba(139,92,246,0.3)' }, { offset: 1, color: 'rgba(139,92,246,0)' }]
          },
        },
      });
    }

    return {
      backgroundColor: 'transparent',
      grid: { top: 2, right: 4, bottom: 16, left: 24 },
      tooltip: {
        trigger: 'axis', backgroundColor: chartTheme.tooltipBg, borderColor: chartTheme.tooltipBorder,
        textStyle: { color: chartTheme.textPrimary, fontSize: 10 },
        confine: false, appendToBody: true,
        formatter: (params) => {
          if (!params?.length) return '';
          let r = `<div style="font-size:10px;color:#94a3b8;margin-bottom:2px">${params[0].axisValue}</div>`;
          params.forEach(p => { r += `<div>${p.marker}${p.seriesName}: <b>${p.value != null ? p.value.toFixed(1) + '%' : '-'}</b></div>`; });
          return r;
        },
      },
      legend: { show: false },
      xAxis: {
        type: 'category',
        data: times,
        axisLine: { show: false },
        axisLabel: {
          show: true,
          color: chartTheme.axisLabel,
          fontSize: 7,
          interval: Math.floor(times.length / 3),
          formatter: (value) => value,
        },
        axisTick: { show: false },
      },
      yAxis: {
        type: 'value',
        min: 0,
        max: 100,
        interval: 50,
        axisLine: { show: false },
        splitLine: { show: false },
        axisLabel: { color: chartTheme.axisLabel, fontSize: 8, formatter: '{value}' },
      },
      series: series.length > 0 ? series : [{ name: 'No Data', type: 'line', data: [] }],
    };
  }, [processedHistory, showCpu, showMem]);

  // 트래픽 차트 옵션 (IN/OUT 항상 함께 표시)
  const trafficChartOption = useMemo(() => {
    const times = processedHistory.map(h => formatTime(h.time));
    const series = [];
    let maxValue = 1;

    interfaces.forEach((iface, idx) => {
      const colorPair = PORT_COLORS[idx % PORT_COLORS.length];
      const portName = iface.ifName || `IF${iface.ifIndex}`;

      // IN 데이터 (단위별 변환) - 인터페이스 데이터 없으면 null (0이 아님)
      const inData = processedHistory.map(h => {
        const histIface = h.ifMap.get(iface.ifIndex);
        if (!histIface) return null;
        if (trafficUnit === 'bps') {
          return histIface.inUsed ?? null;
        }
        let raw;
        if (counterType === '64bit') {
          raw = histIface.highInBps ?? null;
        } else {
          raw = histIface.inBps ?? null;
        }
        if (raw == null) return null;
        return trafficUnit === 'byte' ? raw / 8 : raw;
      });

      maxValue = Math.max(maxValue, ...inData.filter(v => v != null).map(Math.abs));

      series.push({
        name: `${portName} IN`,
        type: 'line',
        data: inData,
        smooth: true,
        showSymbol: false,
        color: colorPair[0],
        itemStyle: { color: colorPair[0] },
        lineStyle: { width: 2, color: colorPair[0] },
        areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [{ offset: 0, color: `${colorPair[0]}4D` }, { offset: 1, color: `${colorPair[0]}00` }]
        }},
      });

      // OUT 데이터 (단위별 변환) - 인터페이스 데이터 없으면 null (0이 아님)
      const outData = processedHistory.map(h => {
        const histIface = h.ifMap.get(iface.ifIndex);
        if (!histIface) return null;
        if (trafficUnit === 'bps') {
          return histIface.outUsed != null ? -histIface.outUsed : null;
        }
        let raw;
        if (counterType === '64bit') {
          raw = histIface.highOutBps ?? null;
        } else {
          raw = histIface.outBps ?? null;
        }
        if (raw == null) return null;
        return trafficUnit === 'byte' ? -(raw / 8) : -raw;
      });

      maxValue = Math.max(maxValue, ...outData.filter(v => v != null).map(Math.abs));

      series.push({
        name: `${portName} OUT`,
        type: 'line',
        data: outData,
        smooth: true,
        showSymbol: false,
        color: colorPair[1],
        itemStyle: { color: colorPair[1] },
        lineStyle: { width: 2, color: colorPair[1] },
        areaStyle: { color: { type: 'linear', x: 0, y: 1, x2: 0, y2: 0,
          colorStops: [{ offset: 0, color: `${colorPair[1]}4D` }, { offset: 1, color: `${colorPair[1]}00` }]
        }},
      });
    });

    // bps 모드: Y축 0~100% 고정
    const yAxisMax = trafficUnit === 'bps' ? 100 : maxValue * 1.2;

    return {
      backgroundColor: 'transparent',
      grid: { top: 2, right: 4, bottom: 16, left: 30 },
      tooltip: {
        trigger: 'axis', backgroundColor: chartTheme.tooltipBg, borderColor: chartTheme.tooltipBorder,
        textStyle: { color: chartTheme.textPrimary, fontSize: 10 },
        confine: false, appendToBody: true,
        formatter: (params) => {
          if (!params?.length) return '';
          let r = `<div style="font-size:10px;color:#94a3b8;margin-bottom:2px">${params[0].axisValue}</div>`;
          params.forEach(p => { r += `<div>${p.marker}${p.seriesName}: <b>${formatTrafficValue(Math.abs(p.value || 0), trafficUnit)}</b></div>`; });
          return r;
        },
      },
      legend: { show: false },
      xAxis: {
        type: 'category',
        data: times,
        axisLine: { show: false },
        axisLabel: {
          show: true,
          color: chartTheme.axisLabel,
          fontSize: 7,
          interval: Math.floor(times.length / 3),
          formatter: (value) => value,
        },
        axisTick: { show: false },
      },
      yAxis: {
        type: 'value',
        min: -yAxisMax,
        max: yAxisMax,
        splitNumber: 2,
        axisLine: { show: false },
        splitLine: { show: false },
        axisLabel: { color: chartTheme.axisLabel, fontSize: 8, formatter: (v) => formatTrafficValue(Math.abs(v), trafficUnit) },
      },
      series: series.length > 0 ? series : [{ name: 'No Data', type: 'line', data: [] }],
    };
  }, [processedHistory, interfaces, counterType, trafficUnit]);

  // Error/Discard 차트 옵션
  const errorDiscardChartOption = useMemo(() => {
    const times = processedHistory.map(h => formatTime(h.time));
    const series = [];
    let maxValue = 1;

    interfaces.forEach((iface, idx) => {
      const portName = iface.ifName || `IF${iface.ifIndex}`;

      if (showError) {
        const inErrData = processedHistory.map(h => {
          const histIface = h.ifMap.get(iface.ifIndex);
          return histIface ? (histIface.inError ?? null) : null;
        });
        const outErrData = processedHistory.map(h => {
          const histIface = h.ifMap.get(iface.ifIndex);
          return histIface ? (histIface.outError ?? null) : null;
        });

        maxValue = Math.max(maxValue, ...inErrData.filter(v => v != null), ...outErrData.filter(v => v != null));

        series.push({
          name: `${portName} InErr`,
          type: 'line',
          data: inErrData,
          smooth: true,
          showSymbol: false,
          color: '#ef4444',
          itemStyle: { color: '#ef4444' },
          lineStyle: { width: 2, color: '#ef4444' },
        });
        series.push({
          name: `${portName} OutErr`,
          type: 'line',
          data: outErrData,
          smooth: true,
          showSymbol: false,
          color: '#f87171',
          itemStyle: { color: '#f87171' },
          lineStyle: { width: 2, color: '#f87171', type: 'dashed' },
        });
      }

      if (showDiscard) {
        const inDiscData = processedHistory.map(h => {
          const histIface = h.ifMap.get(iface.ifIndex);
          return histIface ? (histIface.inDiscard ?? null) : null;
        });
        const outDiscData = processedHistory.map(h => {
          const histIface = h.ifMap.get(iface.ifIndex);
          return histIface ? (histIface.outDiscard ?? null) : null;
        });

        maxValue = Math.max(maxValue, ...inDiscData.filter(v => v != null), ...outDiscData.filter(v => v != null));

        series.push({
          name: `${portName} InDisc`,
          type: 'line',
          data: inDiscData,
          smooth: true,
          showSymbol: false,
          color: '#f97316',
          itemStyle: { color: '#f97316' },
          lineStyle: { width: 2, color: '#f97316' },
        });
        series.push({
          name: `${portName} OutDisc`,
          type: 'line',
          data: outDiscData,
          smooth: true,
          showSymbol: false,
          color: '#fb923c',
          itemStyle: { color: '#fb923c' },
          lineStyle: { width: 2, color: '#fb923c', type: 'dashed' },
        });
      }
    });

    return {
      backgroundColor: 'transparent',
      grid: { top: 2, right: 4, bottom: 16, left: 30 },
      tooltip: {
        trigger: 'axis',
        backgroundColor: chartTheme.tooltipBg,
        borderColor: chartTheme.tooltipBorder,
        textStyle: { color: chartTheme.textPrimary, fontSize: 10 },
        confine: false, appendToBody: true,
        formatter: (params) => {
          if (!params || params.length === 0) return '';
          let r = `<div style="font-size:10px;color:#94a3b8;margin-bottom:2px">${params[0].axisValue}</div>`;
          params.forEach(p => { r += `<div>${p.marker}${p.seriesName}: <b>${p.value != null ? p.value.toFixed(0) : '-'}</b></div>`; });
          return r;
        },
      },
      legend: { show: false },
      xAxis: {
        type: 'category',
        data: times,
        axisLine: { show: false },
        axisLabel: {
          show: true,
          color: chartTheme.axisLabel,
          fontSize: 7,
          interval: Math.floor(times.length / 3),
          formatter: (value) => value,
        },
        axisTick: { show: false },
      },
      yAxis: {
        type: 'value',
        min: 0,
        max: maxValue * 1.2,
        splitNumber: 2,
        axisLine: { show: false },
        splitLine: { show: false },
        axisLabel: { color: chartTheme.axisLabel, fontSize: 8 },
      },
      series: series.length > 0 ? series : [{ name: 'No Data', type: 'line', data: [] }],
    };
  }, [processedHistory, interfaces, showError, showDiscard]);

  // 장비 비활성화 또는 실제 데이터 없는 상태 확인
  const isDisabled = device.disabled === true;
  const hasNoData = !isDisabled && device.cpu == null && device.mem == null
    && (!device.interfaces || device.interfaces.length === 0 || device._isPreview);
  const showWarning = isDisabled || hasNoData;

  return (
    <div className={`device-card-mini ${showWarning ? 'disabled' : ''}`}>
      {/* 헤더 */}
      <div className="card-header-mini">
        <span className="device-name" title={`${device.deviceName} (${device.deviceIp})`}>{device.deviceName}</span>
        <div className="card-header-right">
          <span className="device-stats">
            <span className="cpu">CPU:{cpuValue != null ? `${cpuValue}%` : '-'}</span>
            <span className="mem">MEM:{memValue != null ? `${memValue.toFixed(0)}%` : '-'}</span>
            {gridSize !== 'S' && <span className="traffic-unit-hint">{counterType === '64bit' ? '64' : '32'}bit·{trafficUnit === 'bps' ? '%' : trafficUnit === 'byte' ? 'B/s' : 'bps'}</span>}
          </span>
          <div className="port-dots">
            {Array.from({ length: 5 }, (_, idx) => {
              const iface = interfaces[idx];
              const hasPort = !!iface;
              return (
                <span
                  key={idx}
                  className={`port-dot ${!hasPort ? 'empty' : ''}`}
                  style={{
                    background: hasPort
                      ? PORT_COLORS[idx % PORT_COLORS.length][0]
                      : '#4a4a4a'
                  }}
                  title={hasPort ? (iface.ifName || `IF${iface.ifIndex}`) : '미선택'}
                />
              );
            })}
          </div>
          <div className="card-options-wrapper" ref={optionsRef}>
            <button
              className="card-options-btn"
              onClick={() => setShowOptions(!showOptions)}
              title="차트 설정"
            >
              <i className="bi bi-gear"></i>
            </button>
            {showOptions && createPortal(
              <div
                ref={dropdownRef}
                className="card-options-dropdown"
                style={{
                  position: 'fixed',
                  top: optionsRef.current?.getBoundingClientRect().bottom + 4,
                  left: optionsRef.current?.getBoundingClientRect().right - 150,
                  zIndex: 99999,
                }}
              >
                <div className="option-group-label">시스템</div>
                <label className="option-item">
                  <input
                    type="checkbox"
                    checked={showCpu}
                    onChange={(e) => setShowCpu(e.target.checked)}
                  />
                  <span style={{ color: '#3b82f6' }}>CPU</span>
                </label>
                <label className="option-item">
                  <input
                    type="checkbox"
                    checked={showMem}
                    onChange={(e) => setShowMem(e.target.checked)}
                  />
                  <span style={{ color: '#8b5cf6' }}>MEM</span>
                </label>
                <div className="option-group-label">트래픽 카운터</div>
                <label className="option-item">
                  <input
                    type="radio"
                    name={`counter-${device.deviceId}`}
                    checked={counterType === '32bit'}
                    onChange={() => setCounterType('32bit')}
                  />
                  <span>32-bit Counter</span>
                </label>
                <label className="option-item">
                  <input
                    type="radio"
                    name={`counter-${device.deviceId}`}
                    checked={counterType === '64bit'}
                    onChange={() => setCounterType('64bit')}
                  />
                  <span>64-bit Counter</span>
                </label>
                <div className="option-group-label">표시 단위</div>
                <label className="option-item">
                  <input
                    type="radio"
                    name={`unit-${device.deviceId}`}
                    checked={trafficUnit === 'bit'}
                    onChange={() => setTrafficUnit('bit')}
                  />
                  <span>bit (bps)</span>
                </label>
                <label className="option-item">
                  <input
                    type="radio"
                    name={`unit-${device.deviceId}`}
                    checked={trafficUnit === 'byte'}
                    onChange={() => setTrafficUnit('byte')}
                  />
                  <span>byte (B/s)</span>
                </label>
                <label className="option-item">
                  <input
                    type="radio"
                    name={`unit-${device.deviceId}`}
                    checked={trafficUnit === 'bps'}
                    onChange={() => setTrafficUnit('bps')}
                  />
                  <span>사용률 (%)</span>
                </label>
                <div className="option-group-label">품질 지표</div>
                <label className="option-item">
                  <input
                    type="checkbox"
                    checked={showError}
                    onChange={(e) => setShowError(e.target.checked)}
                  />
                  <span style={{ color: '#ef4444' }}>Error</span>
                </label>
                <label className="option-item">
                  <input
                    type="checkbox"
                    checked={showDiscard}
                    onChange={(e) => setShowDiscard(e.target.checked)}
                  />
                  <span style={{ color: '#f97316' }}>Discard</span>
                </label>
                {onHide && (
                  <>
                    <div className="card-options-divider"></div>
                    <button
                      className="card-hide-btn"
                      onClick={() => {
                        onHide(device.deviceId);
                        setShowOptions(false);
                      }}
                    >
                      <i className="bi bi-eye-slash"></i>
                      <span>이 장비 숨기기</span>
                    </button>
                  </>
                )}
              </div>,
              document.body
            )}
          </div>
        </div>
      </div>

      {/* 비활성화 또는 데이터 없는 상태: 경고 표시 */}
      {showWarning ? (
        <div className="chart-disabled">
          <i className="bi bi-exclamation-triangle"></i>
          <span>{isDisabled ? '장비 확인 필요' : '데이터 수집 대기 중'}</span>
        </div>
      ) : (
        <>
          {/* CPU/MEM 차트 */}
          {(showCpu || showMem) && (
            <div className="chart-mini chart-accent-cpu">
              {history.length > 0 ? (
                <SafeECharts option={cpuMemChartOption} notMerge={false} style={{ height: '100%', width: '100%' }} opts={{ renderer: 'canvas' }} />
              ) : (
                <div className="chart-no-data">-</div>
              )}
            </div>
          )}

          {/* Traffic 차트 (IN/OUT 항상 표시) */}
          <div className="chart-mini chart-accent-traffic">
            {history.length > 0 ? (
              <SafeECharts option={trafficChartOption} notMerge={false} style={{ height: '100%', width: '100%' }} opts={{ renderer: 'canvas' }} />
            ) : (
              <div className="chart-no-data">-</div>
            )}
          </div>

          {/* Error/Discard 차트 */}
          {(showError || showDiscard) && (
            <div className="chart-mini chart-accent-error">
              {history.length > 0 ? (
                <SafeECharts option={errorDiscardChartOption} notMerge={false} style={{ height: '100%', width: '100%' }} opts={{ renderer: 'canvas' }} />
              ) : (
                <div className="chart-no-data">-</div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default memo(DeviceMetricCard, (prev, next) => {
  // device.deviceId가 같고, 핵심 데이터가 같으면 re-render 스킵
  if (prev.device.deviceId !== next.device.deviceId) return false;
  if (prev.device.cpu?.usage !== next.device.cpu?.usage) return false;
  if (prev.device.mem?.usage !== next.device.mem?.usage) return false;
  if (prev.device.disabled !== next.device.disabled) return false;
  if (prev.device._isPreview !== next.device._isPreview) return false;
  if (prev.history.length !== next.history.length) return false;
  if (prev.history[0] !== next.history[0]) return false;
  // interfaces 변경 체크 (길이 + 첫 항목 inBps)
  const pIf = prev.device.interfaces || [];
  const nIf = next.device.interfaces || [];
  if (pIf.length !== nIf.length) return false;
  if (pIf.length > 0 && (pIf[0].inBps !== nIf[0].inBps || pIf[0].outBps !== nIf[0].outBps)) return false;
  return true;
});
