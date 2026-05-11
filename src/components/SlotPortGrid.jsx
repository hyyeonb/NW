import { useEffect, useMemo, useState } from 'react';
import SafeECharts from './SafeECharts';
import { useDeviceTrafficRaw } from '../hooks/useDevices';
import '../styles/slot-port-grid.css';
import { TIME_RANGES } from '../features/slot-port-grid/model/constants';
import { parseAbcName, portStatusInfo } from '../features/slot-port-grid/lib/parsePort';
import { formatBpsValue as formatBps } from '../shared/lib/format';

/**
 * 이더넷 잭 아이콘 + 내부 미니 차트 오버레이
 */
function PortIcon({ data, color, isUp }) {
  const hasData = data && data.length > 1;
  // viewBox 50×34
  // 외곽 잭 (4,2) ~ (46,28) / LED 상단, 내부 캐비티 (8,8) ~ (42,24)
  let chartPts = '';
  if (hasData) {
    const max = Math.max(...data, 1);
    const min = Math.min(...data, 0);
    const range = max - min || 1;
    const x0 = 8, x1 = 42, y0 = 9, y1 = 23;
    const step = (x1 - x0) / (data.length - 1);
    chartPts = data.map((v, i) => {
      const x = x0 + i * step;
      const y = y1 - ((v - min) / range) * (y1 - y0);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
  }
  const gradId = `pg-${color.replace('#', '')}`;

  return (
    <svg className="spg-port-icon" viewBox="0 0 50 34" preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.5" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* 잭 외곽 */}
      <rect x="4" y="6" width="42" height="24" rx="3" fill="rgba(255,255,255,0.04)" stroke={color} strokeWidth="1.2" />
      {/* LED 상단 */}
      <circle cx="25" cy="3.5" r="1.5" fill={isUp ? color : 'rgba(148,163,184,0.4)'}>
        {isUp && <animate attributeName="opacity" values="1;0.4;1" dur="2s" repeatCount="indefinite" />}
      </circle>
      {/* 케이블 탭 */}
      <rect x="20" y="26" width="10" height="4" fill={color} opacity="0.5" />
      {/* 내부 미니 차트 */}
      {hasData && (
        <>
          <polygon points={`8,23 ${chartPts} 42,23`} fill={`url(#${gradId})`} />
          <polyline points={chartPts} fill="none" stroke={color} strokeWidth="1.2" strokeLinejoin="round" strokeLinecap="round" opacity="0.95" />
        </>
      )}
    </svg>
  );
}

/**
 * 개별 포트 카드
 */
function PortCard({ port, history, onClick, onContextMenu, selected }) {
  const speedBps = (port.IF_HIGH_SPEED || 0) * 1e6; // Mbps → bps
  const latestBps = history && history.length > 0 ? history[history.length - 1] : 0;
  const usagePercent = speedBps > 0 ? Math.min(100, (latestBps / speedBps) * 100) : 0;
  const status = portStatusInfo(port, usagePercent);
  const parsed = port._parsed;

  return (
    <div
      className={`spg-port-card ${status.cls} ${selected ? 'selected' : ''}`}
      onClick={onClick}
      onContextMenu={onContextMenu}
      title={`${parsed?.label || port.IF_NAME} · ${status.label}\n속도: ${port.IF_HIGH_SPEED || '-'} Mbps\n현재: ${formatBps(latestBps)}\n우클릭: 포트 점검`}
    >
      <div className="spg-port-name">{parsed?.label || port.IF_NAME}</div>
      <div className="spg-port-icon-wrap">
        <PortIcon data={history} color={status.color} isUp={status.cls === 'up' || status.cls === 'warn'} />
      </div>
      <div className="spg-port-usage" style={{ color: status.color }}>
        {Math.round(usagePercent)}%
      </div>
    </div>
  );
}

/**
 * 선택 포트 상세 정보 패널 — 좌측 info 카드 + 우측 트래픽 차트 + 통계
 */
function PortDetailPanel({ port, deviceId, inHistory, outHistory, timestamps, onClose }) {
  const [timeRange, setTimeRange] = useState('1h');
  const selectedRange = TIME_RANGES.find(r => r.key === timeRange) || TIME_RANGES[0];
  const needExtendedFetch = timeRange !== '1h';
  const { data: extendedRaw, isFetching: extendedLoading } = useDeviceTrafficRaw(
    needExtendedFetch ? deviceId : null,
    selectedRange.minutes
  );

  const extended = useMemo(() => {
    if (!needExtendedFetch) return null;
    if (!extendedRaw) return { in: [], out: [], ts: [] };
    const rows = Array.isArray(extendedRaw) ? extendedRaw : (extendedRaw.data || []);
    const filtered = rows.filter(r => (r.IF_INDEX ?? r.ifIndex) === port.IF_INDEX);
    const inArr = filtered.map(r => Number(r.IN_HIGH_BPS ?? r.IN_BPS ?? 0));
    const outArr = filtered.map(r => Number(r.OUT_HIGH_BPS ?? r.OUT_BPS ?? 0));
    const tsArr = filtered.map(r => r.COLLECTED_AT ?? r.collectedAt ?? null);
    return { in: inArr, out: outArr, ts: tsArr };
  }, [extendedRaw, needExtendedFetch, port.IF_INDEX]);

  const activeInHistory = needExtendedFetch ? extended.in : (inHistory || []);
  const activeOutHistory = needExtendedFetch ? extended.out : (outHistory || []);
  const activeTimestamps = needExtendedFetch ? extended.ts : (timestamps || []);

  if (!port) return null;
  const parsed = port._parsed;
  const speedMbps = port.IF_HIGH_SPEED || 0;
  const speedBps = speedMbps * 1e6;

  const inLatest = activeInHistory.length > 0 ? activeInHistory[activeInHistory.length - 1] : 0;
  const outLatest = activeOutHistory.length > 0 ? activeOutHistory[activeOutHistory.length - 1] : 0;
  const inAvg = activeInHistory.length > 0 ? activeInHistory.reduce((s, v) => s + v, 0) / activeInHistory.length : 0;
  const outAvg = activeOutHistory.length > 0 ? activeOutHistory.reduce((s, v) => s + v, 0) / activeOutHistory.length : 0;
  const inMax = activeInHistory.length > 0 ? Math.max(...activeInHistory) : 0;
  const outMax = activeOutHistory.length > 0 ? Math.max(...activeOutHistory) : 0;

  const inUtil = speedBps > 0 ? Math.min(100, (inLatest / speedBps) * 100) : 0;
  const outUtil = speedBps > 0 ? Math.min(100, (outLatest / speedBps) * 100) : 0;
  const topUtil = Math.max(inUtil, outUtil);
  const status = portStatusInfo(port, topUtil);
  const formatSpeed = (m) => m >= 1000 ? `${(m / 1000).toFixed(0)}G` : `${m}M`;

  const chartOption = useMemo(() => {
    const showDate = timeRange === '7d' || timeRange === '30d';
    const xLabels = activeTimestamps.map(t => {
      if (!t) return '';
      const d = typeof t === 'string' ? new Date(t) : t;
      if (showDate) {
        const mo = String(d.getMonth() + 1).padStart(2, '0');
        const da = String(d.getDate()).padStart(2, '0');
        return `${mo}/${da}`;
      }
      const h = String(d.getHours()).padStart(2, '0');
      const m = String(d.getMinutes()).padStart(2, '0');
      return `${h}:${m}`;
    });
    return {
      grid: { left: 50, right: 16, top: 12, bottom: 24 },
      tooltip: { trigger: 'axis' },
      xAxis: {
        type: 'category',
        data: xLabels,
        axisLabel: { fontSize: 10, hideOverlap: true },
        axisLine: { show: false },
        axisTick: { show: false },
      },
      yAxis: {
        type: 'value',
        axisLabel: { fontSize: 10, formatter: (v) => formatBps(v).replace(' ', '') },
        splitLine: { lineStyle: { type: 'dashed', opacity: 0.3 } },
      },
      series: [
        {
          name: 'IN', type: 'line', smooth: true, showSymbol: false, data: activeInHistory,
          lineStyle: { width: 2, color: '#3b82f6' },
          areaStyle: { color: 'rgba(59, 130, 246, 0.25)' },
          itemStyle: { color: '#3b82f6' },
        },
        {
          name: 'OUT', type: 'line', smooth: true, showSymbol: false, data: activeOutHistory,
          lineStyle: { width: 2, color: '#10b981' },
          areaStyle: { color: 'rgba(16, 185, 129, 0.2)' },
          itemStyle: { color: '#10b981' },
        },
      ],
    };
  }, [activeInHistory, activeOutHistory, activeTimestamps, timeRange]);

  return (
    <div className="spg-detail">
      {/* 좌측: 포트 정보 카드 */}
      <div className="spg-detail-info">
        <div className="spg-detail-head">
          <div className="spg-detail-title-row">
            <div className="spg-detail-title-label">선택 포트 상세 정보</div>
            {onClose && (
              <button className="spg-detail-close" onClick={onClose} title="선택 해제">
                <i className="bi bi-x-lg"></i>
              </button>
            )}
          </div>
          <div className="spg-detail-head-row">
            <div className="spg-detail-icon-wrap">
              <PortIcon data={activeInHistory} color={status.color} isUp={status.cls === 'up' || status.cls === 'warn'} />
            </div>
            <div className="spg-detail-title">
              <div className="spg-detail-name">{parsed?.label || port.IF_NAME}</div>
              <div className={`spg-detail-status ${status.cls}`}>● {status.label}</div>
            </div>
          </div>
        </div>
        <div className="spg-detail-rows">
          <div className="spg-detail-row"><span>슬롯 / 인터페이스</span><strong>{parsed?.label || '-'}</strong></div>
          <div className="spg-detail-row"><span>설명</span><strong>{port.IF_ALIAS || port.IF_DESCR || '-'}</strong></div>
          <div className="spg-detail-row"><span>속도</span><strong>{speedMbps ? formatSpeed(speedMbps) : '-'}</strong></div>
          <div className="spg-detail-row"><span>MTU</span><strong>{port.IF_MTU || '-'}</strong></div>
          <div className="spg-detail-row"><span>Duplex</span><strong>{port.IF_DUPLEX || 'Full'}</strong></div>
          <div className="spg-detail-row"><span>Last Change</span><strong>{port.IF_LAST_CHANGE || '-'}</strong></div>
        </div>
        <div className="spg-util">
          <div className="spg-util-label">In/Out Utilization</div>
          <div className="spg-util-row">
            <span className="spg-util-name in">IN</span>
            <div className="spg-util-track"><div className="spg-util-fill in" style={{ width: `${inUtil}%` }}></div></div>
            <span className="spg-util-value">{Math.round(inUtil)}%</span>
          </div>
          <div className="spg-util-row">
            <span className="spg-util-name out">OUT</span>
            <div className="spg-util-track"><div className="spg-util-fill out" style={{ width: `${outUtil}%` }}></div></div>
            <span className="spg-util-value">{Math.round(outUtil)}%</span>
          </div>
        </div>
      </div>

      {/* 우측: 트래픽 차트 + 통계 */}
      <div className="spg-detail-chart-area">
        <div className="spg-detail-chart-header">
          <span className="spg-detail-chart-title">포트 트래픽 (bps)</span>
          <div className="spg-time-range">
            {TIME_RANGES.map(r => (
              <button
                key={r.key}
                className={`spg-time-btn ${timeRange === r.key ? 'active' : ''}`}
                onClick={() => setTimeRange(r.key)}
              >
                {r.label}
              </button>
            ))}
          </div>
          <div className="spg-chart-legend">
            <span><span className="dot in"></span>IN</span>
            <span><span className="dot out"></span>OUT</span>
          </div>
        </div>
        <div className="spg-detail-chart">
          <SafeECharts option={chartOption} style={{ width: '100%', height: '100%' }} notMerge={false} />
          {needExtendedFetch && extendedLoading && (
            <div className="spg-chart-loading">
              <i className="bi bi-arrow-clockwise spg-spin"></i>
              <span>불러오는 중...</span>
            </div>
          )}
        </div>
        <div className="spg-detail-stats">
          <table className="spg-io-table">
            <thead>
              <tr>
                <th></th>
                <th>현재</th>
                <th>평균</th>
                <th>최대</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="dir in">IN</td>
                <td>{formatBps(inLatest)}</td>
                <td>{formatBps(inAvg)}</td>
                <td>{formatBps(inMax)}</td>
              </tr>
              <tr>
                <td className="dir out">OUT</td>
                <td>{formatBps(outLatest)}</td>
                <td>{formatBps(outAvg)}</td>
                <td>{formatBps(outMax)}</td>
              </tr>
            </tbody>
          </table>
          <div className="spg-err-group">
            <div className="spg-err-title">에러/드롭 (최근 {selectedRange.label})</div>
            <div className="spg-err-row">
              <div><div className="label">입력 에러</div><div className="value">{port.IF_IN_ERRORS ?? 0}</div></div>
              <div><div className="label">출력 에러</div><div className="value">{port.IF_OUT_ERRORS ?? 0}</div></div>
              <div><div className="label">입력 드롭</div><div className="value">{port.IF_IN_DISCARDS ?? 0}</div></div>
              <div><div className="label">출력 드롭</div><div className="value">{port.IF_OUT_DISCARDS ?? 0}</div></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * 색상 범례 (외부 노출용)
 */
export function SlotPortLegend() {
  return (
    <div className="spg-legend">
      <span className="spg-legend-item"><span className="dot up"></span>UP</span>
      <span className="spg-legend-item"><span className="dot down"></span>DOWN</span>
      <span className="spg-legend-item"><span className="dot admin-down"></span>ADMIN DOWN</span>
      <span className="spg-legend-item"><span className="dot warn"></span>WARN</span>
    </div>
  );
}

/**
 * 메인 — 슬롯 그리드 뷰
 */
export default function SlotPortGrid({ deviceId, portsData, trafficRawData, onPortClick, onPortContextMenu, selectedPorts, defaultBottom }) {
  const [activeChassis, setActiveChassis] = useState(null);
  const [focusedPortIndex, setFocusedPortIndex] = useState(null);

  useEffect(() => {
    const t = setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 100);
    return () => clearTimeout(t);
  }, [focusedPortIndex]);

  // 파싱 + 그룹핑
  const structure = useMemo(() => {
    if (!portsData || portsData.length === 0) return null;
    const parsed = portsData
      .map(p => ({ ...p, _parsed: parseAbcName(p.IF_NAME || p.IF_DESCR || '', p.IF_INDEX) }));

    if (parsed.length === 0) return null;

    // chassis → slot → ports
    const chassisMap = new Map();
    parsed.forEach(p => {
      const c = p._parsed.chassis;
      if (!chassisMap.has(c)) chassisMap.set(c, new Map());
      const slotMap = chassisMap.get(c);
      const s = p._parsed.slot;
      if (!slotMap.has(s)) slotMap.set(s, []);
      slotMap.get(s).push(p);
    });

    // 정렬
    const chassisList = [...chassisMap.keys()].sort((a, b) => a - b).map(c => {
      const slotMap = chassisMap.get(c);
      const slots = [...slotMap.keys()].sort((a, b) => a - b).map(s => {
        const ports = slotMap.get(s).sort((a, b) => a._parsed.port - b._parsed.port);
        return {
          slotNum: s,
          ports,
          firstLabel: ports[0]._parsed.label,
          lastLabel: ports[ports.length - 1]._parsed.label,
        };
      });
      return { chassisNum: c, slots };
    });

    return { chassisList };
  }, [portsData]);

  // 활성 chassis 기본값 설정
  const currentChassis = useMemo(() => {
    if (!structure) return null;
    if (activeChassis != null && structure.chassisList.find(c => c.chassisNum === activeChassis)) {
      return activeChassis;
    }
    return structure.chassisList[0]?.chassisNum;
  }, [structure, activeChassis]);

  // 포트별 트래픽 히스토리 맵 (ifIndex → { max: [], in: [], out: [], ts: [] })
  const portHistoryMap = useMemo(() => {
    const map = new Map();
    if (!trafficRawData) return map;
    const rows = Array.isArray(trafficRawData) ? trafficRawData : (trafficRawData.data || []);
    rows.forEach(row => {
      const idx = row.IF_INDEX ?? row.ifIndex;
      if (idx == null) return;
      if (!map.has(idx)) map.set(idx, { max: [], in: [], out: [], ts: [] });
      const inBps = Number(row.IN_HIGH_BPS ?? row.IN_BPS ?? 0);
      const outBps = Number(row.OUT_HIGH_BPS ?? row.OUT_BPS ?? 0);
      const entry = map.get(idx);
      entry.in.push(inBps);
      entry.out.push(outBps);
      entry.max.push(Math.max(inBps, outBps));
      entry.ts.push(row.COLLECTED_AT ?? row.collectedAt ?? null);
    });
    // 최근 60포인트만
    map.forEach((arr) => {
      if (arr.in.length > 60) {
        arr.in = arr.in.slice(-60);
        arr.out = arr.out.slice(-60);
        arr.max = arr.max.slice(-60);
        arr.ts = arr.ts.slice(-60);
      }
    });
    return map;
  }, [trafficRawData]);

  if (!structure) {
    return (
      <div className="spg-empty">
        <i className="bi bi-hdd-network"></i>
        <span>A/B/C 형식 포트가 없습니다</span>
      </div>
    );
  }

  const currentChassisData = structure.chassisList.find(c => c.chassisNum === currentChassis);
  const multiChassis = structure.chassisList.length > 1;

  // 포커스된 포트 찾기
  const focusedPort = useMemo(() => {
    if (focusedPortIndex == null || !portsData) return null;
    const p = portsData.find(pp => pp.IF_INDEX === focusedPortIndex);
    if (!p) return null;
    return { ...p, _parsed: parseAbcName(p.IF_NAME || p.IF_DESCR || '') };
  }, [focusedPortIndex, portsData]);

  const handlePortCardClick = (port) => {
    setFocusedPortIndex(port.IF_INDEX);
    onPortClick?.(port);
  };

  return (
    <div className={`spg-root ${focusedPort ? 'has-focus' : ''}`}>
      {/* Chassis 탭 (multi-chassis only) */}
      {multiChassis && (
        <div className="spg-chassis-tabs">
          {structure.chassisList.map(c => (
            <button
              key={c.chassisNum}
              className={`spg-chassis-tab ${currentChassis === c.chassisNum ? 'active' : ''}`}
              onClick={() => setActiveChassis(c.chassisNum)}
            >
              Chassis {c.chassisNum}
              <span className="spg-chassis-tab-count">
                {c.slots.reduce((sum, s) => sum + s.ports.length, 0)}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* 슬롯 그리드 — 3개 노출, 나머지 스크롤 */}
      <div className="spg-slots-scroll">
        <div className="spg-slots">
          {currentChassisData?.slots.map(slot => (
            <div key={slot.slotNum} className="spg-slot-card">
              <div className="spg-slot-header">
                <div className="spg-slot-title">
                  <div className="spg-slot-name">슬롯 {slot.slotNum}</div>
                  <div className="spg-slot-range">{slot.firstLabel} ~ {slot.lastLabel}</div>
                  <div className="spg-slot-count">{slot.ports.length} Ports</div>
                </div>
              </div>
              <div className="spg-slot-ports">
                {slot.ports.map(port => (
                  <PortCard
                    key={port.IF_INDEX}
                    port={port}
                    history={portHistoryMap.get(port.IF_INDEX)?.max}
                    selected={focusedPortIndex === port.IF_INDEX || selectedPorts?.has(port.IF_INDEX)}
                    onClick={() => handlePortCardClick(port)}
                    onContextMenu={onPortContextMenu ? (e) => { e.preventDefault(); onPortContextMenu(e, port); } : undefined}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 선택된 포트 상세 or 기본(포트별 트래픽) 하단 영역 */}
      {focusedPort ? (() => {
        const entry = portHistoryMap.get(focusedPort.IF_INDEX);
        return (
          <PortDetailPanel
            port={focusedPort}
            deviceId={deviceId}
            inHistory={entry?.in}
            outHistory={entry?.out}
            timestamps={entry?.ts}
            onClose={() => setFocusedPortIndex(null)}
          />
        );
      })() : defaultBottom}
    </div>
  );
}
