/* eslint-disable react-refresh/only-export-components, max-lines-per-function, complexity, max-params, no-unused-vars, react-hooks/exhaustive-deps */
// RealtimePerformance: DnD modifier + SortableDeviceCard + WatchGroupNode.

import { useState, useEffect, useRef, useCallback, memo } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import DeviceMetricCard from '../../../components/DeviceMetricCard';

const restrictHorizontalToWindow = ({ transform, draggingNodeRect, windowRect }) => {
  if (!draggingNodeRect || !windowRect) return transform;
  return {
    ...transform,
    x: Math.min(
      Math.max(transform.x, windowRect.left - draggingNodeRect.left),
      windowRect.right - draggingNodeRect.right
    ),
  };
};

// 드래그 정렬 가능한 장비 카드 래퍼 (IntersectionObserver로 뷰포트 밖 카드 lazy 렌더링)
const SortableDeviceCard = memo(function SortableDeviceCard({ id, device, history, onHide }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });
  const cardRef = useRef(null);
  const [isVisible, setIsVisible] = useState(false);

  // 한 번이라도 보였으면 계속 렌더링 유지 (unmount 방지)
  const hasBeenVisible = useRef(false);

  useEffect(() => {
    const node = cardRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          hasBeenVisible.current = true;
        } else if (hasBeenVisible.current) {
          // 한번 보인 후 벗어나면 비활성화 (ECharts 메모리 해제)
          setIsVisible(false);
        }
      },
      { rootMargin: '200px 0px' } // 뷰포트 위아래 200px 여유
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const style = {
    transform: transform
      ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
      : undefined,
    transition,
    opacity: isDragging ? 0.3 : 1,
    zIndex: isDragging ? 999 : 'auto',
    position: isDragging ? 'relative' : undefined,
    minWidth: 0,
  };

  // dnd-kit에 양쪽 ref 모두 전달
  const mergedRef = useCallback((node) => {
    cardRef.current = node;
    setNodeRef(node);
  }, [setNodeRef]);

  return (
    <div ref={mergedRef} style={style} {...attributes} {...listeners}>
      {isVisible || isDragging ? (
        <DeviceMetricCard device={device} history={history} onHide={onHide} />
      ) : (
        <div className="device-card-placeholder" style={{ minHeight: '280px' }}>
          <span style={{ color: '#64748b', fontSize: '13px' }}>
            {device.deviceName || device.deviceIp || `Device ${device.deviceId}`}
          </span>
        </div>
      )}
    </div>
  );
}, (prev, next) => {
  if (prev.id !== next.id) return false;
  if (prev.device !== next.device) return false;
  if (prev.history === next.history) return true;
  if (prev.history?.length !== next.history?.length) return false;
  if (prev.history?.[0] !== next.history?.[0]) return false;
  return true;
});

// 관제 그룹 트리 노드 컴포넌트 (GroupTree 스타일 재사용)
function WatchGroupNode({
  group,
  depth = 0,
  selectedGroup,
  expandedNodes,
  onSelect,
  onToggle,
  onContextMenu,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onDrop,
}) {
  const hasChildren = group.children && group.children.length > 0;
  const isExpanded = expandedNodes.has(group.watchGroupId);
  const isSelected = selectedGroup?.watchGroupId === group.watchGroupId;
  const childCount = group.children?.length || 0;

  const handleToggle = (e) => {
    e.stopPropagation();
    onToggle(group.watchGroupId);
  };

  // 아이콘 렌더링
  const renderIcon = () => {
    const iconName = group.iconName;
    if (iconName) {
      if (iconName.startsWith('fa-')) {
        return <i className={`fa-solid ${iconName} group-icon custom-icon`} />;
      } else if (iconName.startsWith('bi-')) {
        return <i className={`${iconName} group-icon custom-icon`} />;
      } else {
        return <span className="material-icons group-icon custom-icon">{iconName}</span>;
      }
    }
    // 기본 아이콘
    return <i className="bi bi-speedometer2 group-icon custom-icon"></i>;
  };

  return (
    <li>
      <div className="group-item-wrapper">
        {hasChildren ? (
          <div
            className={`toggle-icon ${isExpanded ? 'expanded' : ''}`}
            onClick={handleToggle}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          </div>
        ) : (
          <div className="toggle-icon" style={{ visibility: 'hidden' }}></div>
        )}
        <div
          className={`group-item depth-${depth} ${isSelected ? 'selected' : ''}`}
          data-group-id={group.watchGroupId}
          draggable
          onClick={() => onSelect(group)}
          onContextMenu={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onContextMenu(e, group);
          }}
          onDragStart={(e) => onDragStart(e, group)}
          onDragEnd={onDragEnd}
          onDragOver={(e) => onDragOver(e, group)}
          onDragLeave={onDragLeave}
          onDrop={(e) => onDrop(e, group)}
        >
          {renderIcon()}
          <span>{group.groupName}</span>
          {group.deviceCount > 0 && <span className="ws-device-count">{group.deviceCount}</span>}
          {childCount > 0 && <span className="child-count">{childCount}</span>}
        </div>
      </div>
      {hasChildren && isExpanded && (
        <ul>
          {group.children.map((child) => (
            <WatchGroupNode
              key={child.watchGroupId}
              group={child}
              depth={depth + 1}
              selectedGroup={selectedGroup}
              expandedNodes={expandedNodes}
              onSelect={onSelect}
              onToggle={onToggle}
              onContextMenu={onContextMenu}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
            />
          ))}
        </ul>
      )}
    </li>
  );
}


export { restrictHorizontalToWindow, SortableDeviceCard, WatchGroupNode };
