import { useState, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import ReactECharts from 'echarts-for-react';
import { useWatchStore } from '../stores/watchStore';

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

// 포트별 색상
const PORT_COLORS = [
  ['#3b82f6', '#60a5fa'],
  ['#10b981', '#34d399'],
  ['#f59e0b', '#fbbf24'],
  ['#8b5cf6', '#a78bfa'],
  ['#ef4444', '#f87171'],
  ['#06b6d4', '#22d3ee'],
];

// 시간 포맷팅 함수 (HH:mm:ss)
const formatTime = (timeValue) => {
  if (!timeValue) return '';
  const date = new Date(timeValue);
  if (isNaN(date.getTime())) return timeValue;
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
};

export default function DeviceMetricCard({ device, history = [] }) {
  const { globalChartSettings, globalSettingsVersion } = useWatchStore();

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

  // CPU/MEM 차트 옵션
  const cpuMemChartOption = useMemo(() => {
    const times = history.slice(0, 20).map(h => formatTime(h.time)).reverse();
    const cpuData = history.slice(0, 20).map(h => h.cpu || 0).reverse();
    const memData = history.slice(0, 20).map(h => h.mem || 0).reverse();

    const series = [];
    if (showCpu) {
      series.push({
        name: 'CPU',
        type: 'line',
        data: cpuData,
        smooth: true,
        showSymbol: false,
        lineStyle: { width: 1, color: '#3b82f6' },
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
        lineStyle: { width: 1, color: '#8b5cf6' },
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
      tooltip: { show: false },
      legend: { show: false },
      xAxis: {
        type: 'category',
        data: times,
        axisLine: { show: false },
        axisLabel: {
          show: true,
          color: '#64748b',
          fontSize: 7,
          interval: Math.floor(times.length / 3),
          formatter: (value) => value.substring(0, 5),
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
        axisLabel: { color: '#64748b', fontSize: 8, formatter: '{value}' },
      },
      series: series.length > 0 ? series : [{ name: 'No Data', type: 'line', data: [] }],
    };
  }, [history, showCpu, showMem]);

  // 트래픽 차트 옵션 (IN/OUT 항상 함께 표시)
  const trafficChartOption = useMemo(() => {
    const times = history.slice(0, 20).map(h => formatTime(h.time)).reverse();
    const series = [];
    let maxValue = 1;

    interfaces.forEach((iface, idx) => {
      const colorPair = PORT_COLORS[idx % PORT_COLORS.length];

      // IN 데이터 (단위별 변환)
      const inData = history.slice(0, 20).map(h => {
        const histIface = h.interfaces?.find(i => i.ifIndex === iface.ifIndex);
        if (trafficUnit === 'bps') {
          return histIface?.inUsed || 0;
        }
        let raw;
        if (counterType === '64bit') {
          raw = histIface?.highInBps || 0;
        } else {
          raw = histIface?.inBps || 0;
        }
        return trafficUnit === 'byte' ? raw / 8 : raw;
      }).reverse();

      maxValue = Math.max(maxValue, ...inData.map(Math.abs));

      series.push({
        name: `IN`,
        type: 'line',
        data: inData,
        smooth: true,
        showSymbol: false,
        lineStyle: { width: 1, color: colorPair[0] },
        areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [{ offset: 0, color: `${colorPair[0]}4D` }, { offset: 1, color: `${colorPair[0]}00` }]
        }},
      });

      // OUT 데이터 (단위별 변환)
      const outData = history.slice(0, 20).map(h => {
        const histIface = h.interfaces?.find(i => i.ifIndex === iface.ifIndex);
        if (trafficUnit === 'bps') {
          return -(histIface?.outUsed || 0);
        }
        let raw;
        if (counterType === '64bit') {
          raw = histIface?.highOutBps || 0;
        } else {
          raw = histIface?.outBps || 0;
        }
        return trafficUnit === 'byte' ? -(raw / 8) : -raw;
      }).reverse();

      maxValue = Math.max(maxValue, ...outData.map(Math.abs));

      series.push({
        name: `OUT`,
        type: 'line',
        data: outData,
        smooth: true,
        showSymbol: false,
        lineStyle: { width: 1, color: colorPair[1] },
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
      tooltip: { show: false },
      legend: { show: false },
      xAxis: {
        type: 'category',
        data: times,
        axisLine: { show: false },
        axisLabel: {
          show: true,
          color: '#64748b',
          fontSize: 7,
          interval: Math.floor(times.length / 3),
          formatter: (value) => value.substring(0, 5),
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
        axisLabel: { color: '#64748b', fontSize: 8, formatter: (v) => formatTrafficValue(Math.abs(v), trafficUnit) },
      },
      series: series.length > 0 ? series : [{ name: 'No Data', type: 'line', data: [] }],
    };
  }, [history, interfaces, counterType, trafficUnit]);

  // Error/Discard 차트 옵션
  const errorDiscardChartOption = useMemo(() => {
    const times = history.slice(0, 20).map(h => formatTime(h.time)).reverse();
    const series = [];
    let maxValue = 1;

    interfaces.forEach((iface, idx) => {
      if (showError) {
        const inErrData = history.slice(0, 20).map(h => {
          const histIface = h.interfaces?.find(i => i.ifIndex === iface.ifIndex);
          return histIface?.inError || 0;
        }).reverse();
        const outErrData = history.slice(0, 20).map(h => {
          const histIface = h.interfaces?.find(i => i.ifIndex === iface.ifIndex);
          return histIface?.outError || 0;
        }).reverse();

        maxValue = Math.max(maxValue, ...inErrData, ...outErrData);

        series.push({
          name: `InErr`,
          type: 'line',
          data: inErrData,
          smooth: true,
          showSymbol: false,
          lineStyle: { width: 1, color: '#ef4444' },
        });
        series.push({
          name: `OutErr`,
          type: 'line',
          data: outErrData,
          smooth: true,
          showSymbol: false,
          lineStyle: { width: 1, color: '#f87171', type: 'dashed' },
        });
      }

      if (showDiscard) {
        const inDiscData = history.slice(0, 20).map(h => {
          const histIface = h.interfaces?.find(i => i.ifIndex === iface.ifIndex);
          return histIface?.inDiscard || 0;
        }).reverse();
        const outDiscData = history.slice(0, 20).map(h => {
          const histIface = h.interfaces?.find(i => i.ifIndex === iface.ifIndex);
          return histIface?.outDiscard || 0;
        }).reverse();

        maxValue = Math.max(maxValue, ...inDiscData, ...outDiscData);

        series.push({
          name: `InDisc`,
          type: 'line',
          data: inDiscData,
          smooth: true,
          showSymbol: false,
          lineStyle: { width: 1, color: '#f97316' },
        });
        series.push({
          name: `OutDisc`,
          type: 'line',
          data: outDiscData,
          smooth: true,
          showSymbol: false,
          lineStyle: { width: 1, color: '#fb923c', type: 'dashed' },
        });
      }
    });

    return {
      backgroundColor: 'transparent',
      grid: { top: 2, right: 4, bottom: 16, left: 30 },
      tooltip: { show: false },
      legend: { show: false },
      xAxis: {
        type: 'category',
        data: times,
        axisLine: { show: false },
        axisLabel: {
          show: true,
          color: '#64748b',
          fontSize: 7,
          interval: Math.floor(times.length / 3),
          formatter: (value) => value.substring(0, 5),
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
        axisLabel: { color: '#64748b', fontSize: 8 },
      },
      series: series.length > 0 ? series : [{ name: 'No Data', type: 'line', data: [] }],
    };
  }, [history, interfaces, showError, showDiscard]);

  // 장비 비활성화 상태 확인
  const isDisabled = device.disabled === true;

  return (
    <div className={`device-card-mini ${isDisabled ? 'disabled' : ''}`}>
      {/* 헤더 */}
      <div className="card-header-mini">
        <span className="device-name" title={device.deviceIp}>{device.deviceName}</span>
        <div className="card-header-right">
          <span className="device-stats">
            <span className="cpu">CPU:{cpuValue !== undefined ? `${cpuValue}%` : '-'}</span>
            <span className="mem">MEM:{memValue !== undefined ? `${memValue.toFixed(0)}%` : '-'}</span>
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
              </div>,
              document.body
            )}
          </div>
        </div>
      </div>

      {/* 비활성화 상태: 전체 영역에 메시지 표시 */}
      {isDisabled ? (
        <div className="chart-disabled">
          <i className="bi bi-exclamation-triangle"></i>
          <span>장비 확인 필요</span>
        </div>
      ) : (
        <>
          {/* CPU/MEM 차트 */}
          {(showCpu || showMem) && (
            <div className="chart-mini chart-accent-cpu">
              {history.length > 0 ? (
                <ReactECharts option={cpuMemChartOption} notMerge={true} style={{ height: '100%', width: '100%' }} opts={{ renderer: 'canvas' }} />
              ) : (
                <div className="chart-no-data">-</div>
              )}
            </div>
          )}

          {/* Traffic 차트 (IN/OUT 항상 표시) */}
          <div className="chart-mini chart-accent-traffic">
            {history.length > 0 ? (
              <ReactECharts option={trafficChartOption} notMerge={true} style={{ height: '100%', width: '100%' }} opts={{ renderer: 'canvas' }} />
            ) : (
              <div className="chart-no-data">-</div>
            )}
          </div>

          {/* Error/Discard 차트 */}
          {(showError || showDiscard) && (
            <div className="chart-mini chart-accent-error">
              {history.length > 0 ? (
                <ReactECharts option={errorDiscardChartOption} notMerge={true} style={{ height: '100%', width: '100%' }} opts={{ renderer: 'canvas' }} />
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
