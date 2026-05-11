/* eslint-disable react-refresh/only-export-components */
// WatchGroupModal sub-components + helpers — fast refresh 룰 비활성 (컴포넌트와 함수 혼재).

import { useMemo, useState } from 'react';
import SafeECharts from '../../components/SafeECharts';

const formatBps = (bps) => {
  if (bps === null || bps === undefined || bps === 0) return '0 bps';
  if (bps >= 1e9) return `${(bps / 1e9).toFixed(1)} Gbps`;
  if (bps >= 1e6) return `${(bps / 1e6).toFixed(1)} Mbps`;
  if (bps >= 1e3) return `${(bps / 1e3).toFixed(1)} Kbps`;
  return `${bps.toFixed(0)} bps`;
};

function PortMiniChart({ trafficData, isLoading }) {
  const chartOption = useMemo(() => {
    if (!trafficData || trafficData.length === 0) return null;
    const inData = trafficData.map(d => d.IN_HIGH_BPS || d.IN_BPS || 0);
    const outData = trafficData.map(d => d.OUT_HIGH_BPS || d.OUT_BPS || 0);
    return {
      grid: { left: 0, right: 0, top: 2, bottom: 2 },
      xAxis: { type: 'category', show: false, data: trafficData.map((_, i) => i) },
      yAxis: { type: 'value', show: false },
      series: [
        { type: 'line', data: inData, smooth: true, symbol: 'none', lineStyle: { width: 1.5, color: '#3b82f6' }, areaStyle: { color: 'rgba(59, 130, 246, 0.2)' } },
        { type: 'line', data: outData, smooth: true, symbol: 'none', lineStyle: { width: 1.5, color: '#10b981' }, areaStyle: { color: 'rgba(16, 185, 129, 0.2)' } },
      ],
    };
  }, [trafficData]);

  if (isLoading) return <div className="port-mini-chart loading"><div className="mini-spinner"></div></div>;
  if (!chartOption) return <div className="port-mini-chart no-data"><span>-</span></div>;

  return (
    <div className="port-mini-chart">
      <SafeECharts option={chartOption} style={{ width: 120, height: 32 }} opts={{ renderer: 'svg' }} />
    </div>
  );
}

// 포트별 피크 트래픽 (텍스트만) - 부모가 trafficData prop으로 주입
function PortMiniPeak({ trafficData }) {
  const { peakIn, peakOut } = useMemo(() => {
    if (!trafficData || trafficData.length === 0) return { peakIn: 0, peakOut: 0 };
    const inValues = trafficData.map(d => d.IN_HIGH_BPS || d.IN_BPS || 0);
    const outValues = trafficData.map(d => d.OUT_HIGH_BPS || d.OUT_BPS || 0);
    return { peakIn: Math.max(...inValues), peakOut: Math.max(...outValues) };
  }, [trafficData]);

  return (
    <div className="port-traffic-info">
      <span className="traffic-peak">
        <span className="in">▲{formatBps(peakIn)}</span>
        <span className="out">▼{formatBps(peakOut)}</span>
      </span>
    </div>
  );
}

// 그룹별 장비 수 계산 (자기 자신 + 하위 그룹 재귀)
function countDevicesInGroup(group, countMap) {
  let count = countMap.get(group.GROUP_ID) || 0;
  if (group.children) {
    for (const child of group.children) {
      count += countDevicesInGroup(child, countMap);
    }
  }
  return count;
}

// 그룹 필터 트리 노드 (경량 - 필터링 전용)
function GroupFilterNode({ group, selectedGroupId, onSelect, depth, deviceCountMap }) {
  const [expanded, setExpanded] = useState(depth < 2);
  const hasChildren = group.children?.length > 0;
  const totalCount = useMemo(() => countDevicesInGroup(group, deviceCountMap), [group, deviceCountMap]);
  return (
    <div>
      <div
        className={`group-filter-node ${selectedGroupId === group.GROUP_ID ? 'active' : ''}`}
        style={{ paddingLeft: `${(depth + 1) * 16}px` }}
        onClick={() => onSelect(group.GROUP_ID)}
      >
        {hasChildren ? (
          <i
            className={`bi bi-chevron-${expanded ? 'down' : 'right'} expand-icon`}
            onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
          />
        ) : (
          <span className="expand-icon-placeholder" />
        )}
        {(() => {
          const iconName = group.ICON_NAME;
          if (iconName) {
            if (iconName.startsWith('fa-')) return <i className={`fa-solid ${iconName} group-icon custom-icon`} />;
            if (iconName.startsWith('bi-')) return <i className={`${iconName} group-icon custom-icon`} />;
            return <span className="material-icons group-icon custom-icon">{iconName}</span>;
          }
          return <i className="bi bi-folder2 group-icon default-icon" />;
        })()}
        <span className="group-name">{group.GROUP_NAME}</span>
        <span className="group-device-count">{totalCount}</span>
      </div>
      {expanded && hasChildren && group.children.map(child => (
        <GroupFilterNode
          key={child.GROUP_ID}
          group={child}
          selectedGroupId={selectedGroupId}
          onSelect={onSelect}
          depth={depth + 1}
          deviceCountMap={deviceCountMap}
        />
      ))}
    </div>
  );
}

export { formatBps, PortMiniChart, PortMiniPeak, countDevicesInGroup, GroupFilterNode };
