import { useState, useEffect, useCallback, useRef, useMemo, memo } from 'react';
import { createPortal } from 'react-dom';
import {
  useWatchGroups,
  useWatchGroupDetail,
  useCreateWatchGroup,
  useUpdateWatchGroup,
  useDeleteWatchGroup,
  useMoveWatchGroup,
  useUpdateWatchGroupIcon,
  useStartWatch,
  useStopWatch,
  useSendHeartbeat,
  useWatchSSE,
} from '../hooks/useWatch';
import { useGroupTree } from '../hooks/useGroups';
import { useWatchStore } from '../stores/watchStore';
import { watchApi } from '../api/watch';
import DeviceMetricCard from '../components/DeviceMetricCard';
import WatchGroupModal from '../components/WatchGroupModal';
import WatchIconSelectorModal from '../components/WatchIconSelectorModal';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, useSortable, rectSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import '../styles/realtime-performance.css';
import '../styles/group-tree.css';

// 드래그 시 수평(X축) 이동을 윈도우 범위 내로 제한하는 modifier
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

// 컨텍스트 메뉴 컴포넌트
function WatchContextMenu({ x, y, group, onClose, onAdd, onAddChild, onRename, onEditDevices, onDelete, onSetIcon }) {
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        onClose();
      }
    };
    const handleEscape = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('click', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('click', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  // 메뉴 위치 조정 (화면 밖으로 나가지 않도록)
  useEffect(() => {
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      let newX = x;
      let newY = y;

      if (rect.right > window.innerWidth) {
        newX = x - rect.width;
      }
      if (rect.bottom > window.innerHeight) {
        newY = y - rect.height;
      }

      menuRef.current.style.left = `${newX}px`;
      menuRef.current.style.top = `${newY}px`;
    }
  }, [x, y]);

  // 그룹이 없으면 추가 메뉴만 표시
  if (!group) {
    return createPortal(
      <div
        ref={menuRef}
        className="watch-context-menu"
        style={{ left: x, top: y }}
      >
        <div
          className="watch-context-menu-item"
          onClick={() => {
            onAdd();
            onClose();
          }}
        >
          <i className="bi bi-plus-lg"></i>
          <span>그룹 추가</span>
        </div>
      </div>,
      document.body
    );
  }

  return createPortal(
    <div
      ref={menuRef}
      className="watch-context-menu"
      style={{ left: x, top: y }}
    >
      <div
        className="watch-context-menu-item"
        onClick={() => { onSetIcon(group); onClose(); }}
      >
        <i className="bi bi-palette"></i>
        <span>아이콘 설정</span>
      </div>
      <div
        className="watch-context-menu-item"
        onClick={() => { onRename(group); onClose(); }}
      >
        <i className="bi bi-pencil"></i>
        <span>그룹 이름 변경</span>
      </div>
      <div
        className="watch-context-menu-item"
        onClick={() => { onEditDevices(group); onClose(); }}
      >
        <i className="bi bi-hdd-network"></i>
        <span>관제 장비 설정</span>
      </div>
      <div
        className="watch-context-menu-item"
        onClick={() => { onAddChild(group); onClose(); }}
      >
        <i className="bi bi-plus-lg"></i>
        <span>하위 그룹 추가</span>
      </div>
      <div className="watch-context-menu-divider"></div>
      <div
        className="watch-context-menu-item danger"
        onClick={() => { onDelete(group); onClose(); }}
      >
        <i className="bi bi-trash"></i>
        <span>삭제</span>
      </div>
    </div>,
    document.body
  );
}

// 일반 그룹 컨텍스트 메뉴 (관제 장비 설정만)
function RegularGroupContextMenu({ x, y, group, onClose, onEditDevices }) {
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) onClose();
    };
    const handleEscape = (e) => {
      if (e.key === 'Escape') onClose();
    };
    // setTimeout으로 다음 틱에 등록해야 열리자마자 닫히는 것 방지
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  useEffect(() => {
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      let newX = x, newY = y;
      if (rect.right > window.innerWidth) newX = x - rect.width;
      if (rect.bottom > window.innerHeight) newY = y - rect.height;
      menuRef.current.style.left = `${newX}px`;
      menuRef.current.style.top = `${newY}px`;
    }
  }, [x, y]);

  return createPortal(
    <div ref={menuRef} className="watch-context-menu" style={{ left: x, top: y, zIndex: 9999 }}>
      <div
        className="watch-context-menu-item"
        onClick={() => { onEditDevices(group); onClose(); }}
      >
        <i className="bi bi-hdd-network"></i>
        <span>관제 장비 설정</span>
      </div>
    </div>,
    document.body
  );
}

// 일반 그룹 트리 노드 (읽기 전용, 외부 컴포넌트로 분리하여 unmount/remount 방지)
function RegularGroupNode({ group, depth = 0, expandedNodes, selectedGroupId, searchText, onToggle, onSelect, onContextMenu }) {
  const hasChildren = group.children && group.children.length > 0;
  const isExpanded = expandedNodes.has(group.GROUP_ID);
  const isSelected = selectedGroupId === group.GROUP_ID;

  const renderIcon = () => {
    const iconName = group.ICON_NAME;
    if (iconName) {
      if (iconName.startsWith('fa-')) return <i className={`fa-solid ${iconName} group-icon custom-icon`} />;
      if (iconName.startsWith('bi-')) return <i className={`${iconName} group-icon custom-icon`} />;
      return <span className="material-icons group-icon custom-icon">{iconName}</span>;
    }
    return <i className="bi bi-folder group-icon custom-icon"></i>;
  };

  const renderName = () => {
    const name = group.GROUP_NAME;
    if (!searchText) return name;
    const idx = name.toLowerCase().indexOf(searchText.toLowerCase());
    if (idx === -1) return name;
    return (
      <>
        {name.substring(0, idx)}
        <mark className="ws-search-highlight">{name.substring(idx, idx + searchText.length)}</mark>
        {name.substring(idx + searchText.length)}
      </>
    );
  };

  return (
    <li>
      <div className="group-item-wrapper">
        {hasChildren ? (
          <div className={`toggle-icon ${isExpanded ? 'expanded' : ''}`} onClick={(e) => { e.stopPropagation(); onToggle(group.GROUP_ID); }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          </div>
        ) : (
          <div className="toggle-icon" style={{ visibility: 'hidden' }}></div>
        )}
        <div
          className={`group-item depth-${depth} ${isSelected ? 'selected' : ''}`}
          onClick={() => onSelect(group)}
          onContextMenu={(e) => onContextMenu(e, group)}
        >
          {renderIcon()}
          <span>{renderName()}</span>
          {group.DEVICE_COUNT > 0 && <span className="ws-device-count">{group.DEVICE_COUNT}</span>}
        </div>
      </div>
      {hasChildren && isExpanded && (
        <ul>
          {group.children.map((child) => (
            <RegularGroupNode
              key={child.GROUP_ID}
              group={child}
              depth={depth + 1}
              expandedNodes={expandedNodes}
              selectedGroupId={selectedGroupId}
              searchText={searchText}
              onToggle={onToggle}
              onSelect={onSelect}
              onContextMenu={onContextMenu}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

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

export default function RealtimePerformance() {
  const {
    selectedWatchGroup,
    setSelectedWatchGroup,
    isWatching,
    setIsWatching,
    isGroupModalOpen,
    editingGroup,
    parentGroupIdForCreate,
    modalMode,
    openGroupModal,
    closeGroupModal,
    lastUpdated,
    setLastUpdated,
    expandedDeviceId,
    reset,
    draggedWatchGroup,
    setDraggedWatchGroup,
    iconModalWatchGroup,
    showIconModal,
    hideIconModal,
    globalChartSettings,
    setGlobalChartSettings,
    applyGlobalSettings,
    gridSize,
    setGridSize,
    hiddenDeviceIds,
    hideDevice,
    showDevice,
    showAllDevices,
    deviceOrder,
    setDeviceOrder,
  } = useWatchStore();

  // 첫 그룹 등록 모달 상태
  const [showFirstGroupModal, setShowFirstGroupModal] = useState(false);
  const [firstGroupName, setFirstGroupName] = useState('');

  // 사이드바 접힘 상태
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // 일괄 설정 드롭다운 상태
  const [showGlobalSettings, setShowGlobalSettings] = useState(false);
  const globalSettingsRef = useRef(null);

  // 숨긴 장비 드롭다운 상태
  const [showHiddenDropdown, setShowHiddenDropdown] = useState(false);
  const hiddenDropdownRef = useRef(null);

  // 드래그 앤 드롭
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  // 컨텍스트 메뉴 상태
  const [contextMenu, setContextMenu] = useState(null);
  const [regularContextMenu, setRegularContextMenu] = useState(null);

  // 트리 확장 상태
  const [expandedNodes, setExpandedNodes] = useState(new Set());

  // 탭 상태
  const [activeTab, setActiveTab] = useState('custom'); // 'custom' | 'regular'
  const [regularExpandedNodes, setRegularExpandedNodes] = useState(new Set());
  const [selectedRegularGroup, setSelectedRegularGroup] = useState(null);
  const [syncingRegularGroup, setSyncingRegularGroup] = useState(false);
  const syncedGroupCache = useRef(new Map());
  const [searchText, setSearchText] = useState('');

  // 그룹 목록 조회
  const { data: watchGroups, isLoading: groupsLoading, refetch: refetchGroups } = useWatchGroups();

  // 일반 그룹 (R_GROUP_T) 트리 조회
  const { data: regularGroups, isLoading: regularLoading } = useGroupTree();

  // 선택된 그룹 상세 조회
  const { data: groupDetail } = useWatchGroupDetail(selectedWatchGroup?.watchGroupId);

  // 관제 시작/중지 뮤테이션
  const startWatchMutation = useStartWatch();
  const stopWatchMutation = useStopWatch();
  const heartbeatMutation = useSendHeartbeat();

  // 그룹 CRUD 뮤테이션
  const createGroupMutation = useCreateWatchGroup();
  const updateGroupMutation = useUpdateWatchGroup();
  const deleteGroupMutation = useDeleteWatchGroup();
  const moveGroupMutation = useMoveWatchGroup();
  const updateIconMutation = useUpdateWatchGroupIcon();

  // SSE 기반 실시간 메트릭 (Redis 미사용)
  const {
    metrics: metricsData,
    history: deviceHistories,
    connected: sseConnected,
    error: sseError,
    resetHistory,
  } = useWatchSSE(selectedWatchGroup?.watchGroupId, isWatching);

  // Heartbeat 인터벌 참조
  const heartbeatIntervalRef = useRef(null);

  // 그룹이 없으면 첫 그룹 등록 모달 표시
  useEffect(() => {
    if (!groupsLoading && watchGroups && watchGroups.length === 0) {
      setShowFirstGroupModal(true);
    }
  }, [groupsLoading, watchGroups]);

  // 첫 그룹 등록 핸들러
  const handleFirstGroupSubmit = async (e) => {
    e.preventDefault();
    if (!firstGroupName.trim()) {
      alert('그룹명을 입력해주세요.');
      return;
    }

    try {
      const response = await createGroupMutation.mutateAsync({
        groupName: firstGroupName.trim(),
        intervalSec: 5,
        devices: [],
        parentGroupId: null, // 첫 그룹은 항상 최상위
      });
      setShowFirstGroupModal(false);
      setFirstGroupName('');

      // 생성된 그룹 자동 선택
      const { data: groups } = await refetchGroups();
      if (groups && groups.length > 0) {
        setSelectedWatchGroup(groups[0]);
      }
    } catch (error) {
      console.error('그룹 생성 오류:', error);
      alert('그룹 생성에 실패했습니다: ' + error.message);
    }
  };

  // 관제 시작
  const handleStartWatch = async () => {
    if (!selectedWatchGroup?.watchGroupId) return;

    const groupId = selectedWatchGroup.watchGroupId;

    try {
      // 연동 그룹이면 관제 시작 전 매핑 테이블 동기화 (최신 장비 반영)
      if (selectedWatchGroup.linkedGroupId) {
        await watchApi.syncFromGroup(selectedWatchGroup.linkedGroupId);
      }

      await startWatchMutation.mutateAsync(groupId);
      setIsWatching(true);
      setLastUpdated(new Date());
      setSidebarCollapsed(true);

      // Heartbeat 시작 (30초 주기)
      heartbeatIntervalRef.current = setInterval(() => {
        if (groupId) {
          heartbeatMutation.mutate(groupId);
        }
      }, 30000);
    } catch (error) {
      console.error('관제 시작 실패:', error);
      alert('관제 시작에 실패했습니다.');
    }
  };

  // 관제 중지
  const handleStopWatch = async () => {
    if (!selectedWatchGroup?.watchGroupId) return;

    try {
      await stopWatchMutation.mutateAsync(selectedWatchGroup.watchGroupId);
      setIsWatching(false);

      // Heartbeat 중지
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }

      // SSE 히스토리 + 캐시 초기화
      resetHistory();
      lastDevicesRef.current = [];
      stableVisibleRef.current = [];
    } catch (error) {
      console.error('관제 중지 실패:', error);
    }
  };

  // 그룹 선택
  const handleSelectGroup = (group) => {
    if (isWatching) {
      handleStopWatch();
    }
    setSelectedWatchGroup(group);
    resetHistory();
    lastDevicesRef.current = [];
    stableVisibleRef.current = [];
  };

  // 그룹 저장 (생성/수정)
  const handleSaveGroup = async (data) => {
    try {
      if (editingGroup) {
        await updateGroupMutation.mutateAsync({
          watchGroupId: editingGroup.watchGroupId,
          data,
        });
      } else {
        // 새 그룹 생성 (data에 parentGroupId 포함됨)
        await createGroupMutation.mutateAsync(data);
      }
      closeGroupModal(); // 스토어에서 parentGroupIdForCreate도 함께 초기화됨
      refetchGroups();
    } catch (error) {
      console.error('그룹 저장 실패:', error);
      alert('그룹 저장에 실패했습니다.');
    }
  };

  // 그룹 삭제
  const handleDeleteGroup = async (group) => {
    if (!confirm(`"${group.groupName}" 그룹을 삭제하시겠습니까?`)) return;

    try {
      await deleteGroupMutation.mutateAsync(group.watchGroupId);
      if (selectedWatchGroup?.watchGroupId === group.watchGroupId) {
        setSelectedWatchGroup(null);
        setIsWatching(false);
      }
      refetchGroups();
    } catch (error) {
      console.error('그룹 삭제 실패:', error);
      alert('그룹 삭제에 실패했습니다.');
    }
  };

  // 컨텍스트 메뉴 열기 (그룹 우클릭)
  const handleContextMenu = (e, group) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      group,
    });
  };

  // 빈 공간 우클릭 (그룹 추가)
  const handleEmptyContextMenu = (e) => {
    // 그룹 아이템 클릭이 아닌 경우에만
    if (e.target.closest('.watch-group-item')) return;
    e.preventDefault();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      group: null,
    });
  };

  // 컨텍스트 메뉴 닫기
  const closeContextMenu = () => {
    setContextMenu(null);
  };

  // 일반 그룹 컨텍스트 메뉴
  const handleRegularContextMenu = (e, group) => {
    e.preventDefault();
    e.stopPropagation();
    setRegularContextMenu({
      x: e.clientX,
      y: e.clientY,
      group,
    });
  };

  const closeRegularContextMenu = () => {
    setRegularContextMenu(null);
  };

  // 일반 그룹 관제 장비 설정
  const handleRegularEditDevices = async (group) => {
    const toWatchGroup = (data) => ({
      watchGroupId: data.WATCH_GROUP_ID,
      groupName: data.GROUP_NAME,
      linkedGroupId: data.LINKED_GROUP_ID,
      intervalSec: data.INTERVAL_SEC,
      depth: data.DEPTH,
      parentGroupId: data.PARENT_GROUP_ID,
    });

    // 1) GET 조회 (기존 포트 선택 유지)
    try {
      const res = await watchApi.getByLinkedGroup(group.GROUP_ID);
      const data = res.data?.data;
      if (data) {
        openGroupModal(toWatchGroup(data), null, 'devices');
        return;
      }
    } catch (e) { /* 미동기화 → 아래로 진행 */ }

    // 2) 미동기화 → 첫 1회만 sync
    try {
      const res = await watchApi.syncFromGroup(group.GROUP_ID);
      const data = res.data?.data;
      if (data) {
        openGroupModal(toWatchGroup(data), null, 'devices');
      }
    } catch (err) {
      console.error('일반 그룹 동기화 실패:', err);
    }
  };

  // 트리 노드 토글
  const handleToggleNode = (groupId) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  // 그룹 추가 (최상위)
  const handleAddGroup = () => {
    openGroupModal(null, null); // 최상위 그룹: parentGroupId = null
  };

  // 하위 그룹 추가
  const handleAddChildGroup = (parentGroup) => {
    // 부모 노드 확장
    setExpandedNodes((prev) => new Set([...prev, parentGroup.watchGroupId]));
    openGroupModal(null, parentGroup.watchGroupId); // 하위 그룹: parentGroupId 전달
  };

  // 아이콘 설정
  const handleSetIcon = (group) => {
    showIconModal(group);
  };

  // ==================== 드래그 앤 드롭 핸들러 ====================

  // 자손인지 확인하는 함수
  const isDescendantOf = useCallback((potentialDescendantId, ancestorId, nodes) => {
    const findInChildren = (nodeList, targetId) => {
      for (const node of nodeList) {
        if (node.watchGroupId === targetId) return true;
        if (node.children && node.children.length > 0) {
          if (findInChildren(node.children, targetId)) return true;
        }
      }
      return false;
    };

    const findAncestor = (nodeList) => {
      for (const node of nodeList) {
        if (node.watchGroupId === ancestorId) {
          return findInChildren(node.children || [], potentialDescendantId);
        }
        if (node.children && node.children.length > 0) {
          const result = findAncestor(node.children);
          if (result !== null) return result;
        }
      }
      return false;
    };

    return findAncestor(nodes);
  }, []);

  const handleDragStart = useCallback((e, group) => {
    setDraggedWatchGroup(group);
    e.currentTarget.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
  }, [setDraggedWatchGroup]);

  const handleDragEnd = useCallback((e) => {
    e.currentTarget.classList.remove('dragging');
    document.querySelectorAll('.drag-over, .drag-invalid').forEach(el => {
      el.classList.remove('drag-over', 'drag-invalid');
    });
    setDraggedWatchGroup(null);
  }, [setDraggedWatchGroup]);

  const handleDragOver = useCallback((e, targetGroup) => {
    if (!draggedWatchGroup || draggedWatchGroup.watchGroupId === targetGroup.watchGroupId) return;
    e.preventDefault();

    // 자신의 자손으로 이동 불가
    if (watchGroups && isDescendantOf(targetGroup.watchGroupId, draggedWatchGroup.watchGroupId, watchGroups)) {
      e.currentTarget.classList.add('drag-invalid');
      e.currentTarget.classList.remove('drag-over');
    } else {
      e.currentTarget.classList.add('drag-over');
      e.currentTarget.classList.remove('drag-invalid');
    }
  }, [draggedWatchGroup, watchGroups, isDescendantOf]);

  const handleDragLeave = useCallback((e) => {
    e.currentTarget.classList.remove('drag-over', 'drag-invalid');
  }, []);

  const handleDrop = useCallback(async (e, targetGroup) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.remove('drag-over', 'drag-invalid');

    if (!draggedWatchGroup || draggedWatchGroup.watchGroupId === targetGroup.watchGroupId) return;
    if (watchGroups && isDescendantOf(targetGroup.watchGroupId, draggedWatchGroup.watchGroupId, watchGroups)) return;

    try {
      // 하위 그룹 개수 확인
      const countResponse = await watchApi.getDescendantsCount(draggedWatchGroup.watchGroupId);
      const childCount = countResponse.data?.data || 0;

      const message = childCount > 0
        ? `"${draggedWatchGroup.groupName}" 그룹과 하위 ${childCount}개 그룹을 "${targetGroup.groupName}" 아래로 이동하시겠습니까?`
        : `"${draggedWatchGroup.groupName}" 그룹을 "${targetGroup.groupName}" 아래로 이동하시겠습니까?`;

      if (confirm(message)) {
        await moveGroupMutation.mutateAsync({
          watchGroupId: draggedWatchGroup.watchGroupId,
          parentGroupId: targetGroup.watchGroupId,
        });
        refetchGroups();
      }
    } catch (error) {
      console.error('그룹 이동 실패:', error);
      alert('그룹 이동에 실패했습니다.');
    }

    setDraggedWatchGroup(null);
  }, [draggedWatchGroup, watchGroups, isDescendantOf, moveGroupMutation, refetchGroups, setDraggedWatchGroup]);

  // 빈 공간에 드롭 (최상위로 이동)
  const handleContainerDrop = useCallback(async (e) => {
    if (e.target.closest('.group-item')) return;
    e.preventDefault();
    e.stopPropagation();

    if (draggedWatchGroup && draggedWatchGroup.parentGroupId !== null) {
      try {
        const countResponse = await watchApi.getDescendantsCount(draggedWatchGroup.watchGroupId);
        const childCount = countResponse.data?.data || 0;

        const message = childCount > 0
          ? `"${draggedWatchGroup.groupName}" 그룹과 하위 ${childCount}개 그룹을 최상위로 이동하시겠습니까?`
          : `"${draggedWatchGroup.groupName}" 그룹을 최상위로 이동하시겠습니까?`;

        if (confirm(message)) {
          await moveGroupMutation.mutateAsync({
            watchGroupId: draggedWatchGroup.watchGroupId,
            parentGroupId: null,
          });
          refetchGroups();
        }
      } catch (error) {
        console.error('그룹 이동 실패:', error);
        alert('그룹 이동에 실패했습니다.');
      }
    }
    setDraggedWatchGroup(null);
  }, [draggedWatchGroup, moveGroupMutation, refetchGroups, setDraggedWatchGroup]);

  const handleContainerDragOver = useCallback((e) => {
    if (e.target.closest('.group-item')) return;
    e.preventDefault();
  }, []);

  // 모든 노드 확장 (초기 로드 시)
  useEffect(() => {
    if (watchGroups && watchGroups.length > 0) {
      const allIds = new Set();
      const collectIds = (groups) => {
        groups.forEach((g) => {
          allIds.add(g.watchGroupId);
          if (g.children) collectIds(g.children);
        });
      };
      collectIds(watchGroups);
      setExpandedNodes(allIds);
    }
  }, [watchGroups]);

  // SSE 메트릭 수신 시 마지막 갱신 시간 업데이트
  useEffect(() => {
    if (metricsData?.devices && isWatching) {
      setLastUpdated(new Date());
    }
  }, [metricsData, isWatching, setLastUpdated]);

  // 컴포넌트 언마운트 시 정리
  useEffect(() => {
    return () => {
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
    };
  }, []);

  // 관제 중지 요청을 확실하게 전송 (페이지 이탈/언마운트 시에도 동작)
  const fireAndForgetStop = useCallback((groupId) => {
    if (!groupId) return;
    const url = `/api/watch/stop/${groupId}`;
    // sendBeacon: 페이지 닫힘/새로고침 시에도 브라우저가 요청 완료를 보장
    if (navigator.sendBeacon) {
      navigator.sendBeacon(url, new Blob(['{}'], { type: 'application/json' }));
    } else {
      fetch(url, { method: 'POST', keepalive: true, headers: { 'Content-Type': 'application/json' }, body: '{}' });
    }
  }, []);

  // ref로 최신 상태 추적 (cleanup에서 stale closure 방지)
  const watchStateRef = useRef({ isWatching: false, groupId: null });
  useEffect(() => {
    watchStateRef.current = {
      isWatching,
      groupId: selectedWatchGroup?.watchGroupId || null,
    };
  }, [isWatching, selectedWatchGroup]);

  // 페이지 닫기/새로고침 시 관제 중지
  useEffect(() => {
    const handleBeforeUnload = () => {
      const { isWatching: watching, groupId } = watchStateRef.current;
      if (watching && groupId) {
        fireAndForgetStop(groupId);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [fireAndForgetStop]);

  // 컴포넌트 언마운트 시 관제 중지 (SPA 페이지 이동)
  useEffect(() => {
    return () => {
      const { isWatching: watching, groupId } = watchStateRef.current;
      if (watching && groupId) {
        fireAndForgetStop(groupId);
        // Zustand 상태 즉시 초기화 (다시 돌아올 때 '대기 중' 표시)
        setIsWatching(false);
      }
      // Heartbeat 정리
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }
    };
  }, [fireAndForgetStop, setIsWatching]);

  // 일괄 설정 드롭다운 외부 클릭 감지
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (globalSettingsRef.current && !globalSettingsRef.current.contains(e.target)) {
        setShowGlobalSettings(false);
      }
    };
    if (showGlobalSettings) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showGlobalSettings]);

  // 마지막 갱신 시간 포맷
  const formatLastUpdated = () => {
    if (!lastUpdated) return '-';
    return lastUpdated.toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  // ==================== 장비 숨기기 / 순서 관리 ====================
  const groupId = selectedWatchGroup?.watchGroupId;
  const currentHiddenIds = useMemo(() => (groupId && hiddenDeviceIds[groupId]) || [], [groupId, hiddenDeviceIds]);
  const currentOrder = useMemo(() => (groupId && deviceOrder[groupId]) || [], [groupId, deviceOrder]);

  // 마지막 유효 장비 데이터 캐시 (관제 중 데이터 일시 공백 시 위젯 유지용)
  const lastDevicesRef = useRef([]);

  // 현재 장비 목록 통합 (관제 중 or 미리보기)
  // SSE 부분 수신 시 groupDetail 프리뷰와 병합하여 카드가 사라지지 않도록 처리
  const currentDevices = useMemo(() => {
    const previewDevices = (groupDetail?.devices && groupDetail.devices.length > 0)
      ? groupDetail.devices.map(d => ({
          deviceId: d.deviceId,
          deviceName: d.deviceName,
          deviceIp: d.deviceIp,
          cpu: {},
          mem: {},
          interfaces: d.ifIndexes?.map(idx => ({ ifIndex: idx })) || [],
          _isPreview: true,
        }))
      : [];

    if (metricsData?.devices && metricsData.devices.length > 0) {
      // SSE 데이터가 groupDetail보다 적으면 (부분 수신) → 프리뷰와 병합
      if (previewDevices.length > 0 && metricsData.devices.length < previewDevices.length) {
        const merged = new Map(previewDevices.map(d => [d.deviceId, d]));
        metricsData.devices.forEach(d => merged.set(d.deviceId, d));
        const result = Array.from(merged.values());
        lastDevicesRef.current = result;
        return result;
      }
      lastDevicesRef.current = metricsData.devices;
      return metricsData.devices;
    }
    // 관제 중인데 SSE 데이터가 일시적으로 비어있으면 마지막 수신 데이터 유지
    if (isWatching && lastDevicesRef.current.length > 0) {
      return lastDevicesRef.current;
    }
    if (previewDevices.length > 0) {
      return previewDevices;
    }
    return [];
  }, [metricsData, groupDetail, isWatching]);

  // 정렬 + 필터링된 장비 목록
  const orderedVisibleDevices = useMemo(() => {
    if (!currentDevices.length || !groupId) return [];
    const hidden = new Set(currentHiddenIds);
    const deviceMap = new Map(currentDevices.map(d => [d.deviceId, d]));
    const allIds = currentDevices.map(d => d.deviceId);

    const orderedIds = [];
    const seen = new Set();

    // 저장된 순서 우선
    currentOrder.forEach(id => {
      if (deviceMap.has(id) && !hidden.has(id) && !seen.has(id)) {
        orderedIds.push(id);
        seen.add(id);
      }
    });

    // 새 장비 (순서에 없는 것)는 ID순으로 뒤에 추가
    allIds.sort((a, b) => a - b).forEach(id => {
      if (!seen.has(id) && !hidden.has(id)) {
        orderedIds.push(id);
        seen.add(id);
      }
    });

    return orderedIds.map(id => deviceMap.get(id)).filter(Boolean);
  }, [currentDevices, groupId, currentHiddenIds, currentOrder]);

  // 관제 중 위젯이 절대 사라지지 않도록 마지막 유효 목록 캐시
  const stableVisibleRef = useRef([]);
  // handleCardDragEnd 콜백 안정화용 ref (SSE 업데이트마다 콜백 재생성 방지)
  const orderedVisibleRef = useRef(orderedVisibleDevices);
  useEffect(() => {
    orderedVisibleRef.current = orderedVisibleDevices;
    if (orderedVisibleDevices.length > 0) {
      stableVisibleRef.current = orderedVisibleDevices;
    }
  }, [orderedVisibleDevices]);

  // 렌더링용: 관제 중 빈 목록이 되면 마지막 캐시 사용
  const useStableFallback = isWatching && orderedVisibleDevices.length === 0 && stableVisibleRef.current.length > 0;
  const renderDevices = useStableFallback ? stableVisibleRef.current : orderedVisibleDevices;

  // 숨긴 장비 정보 (드롭다운 표시용)
  const hiddenDevicesInfo = useMemo(() => {
    if (!currentHiddenIds.length) return [];
    const allDevices = [
      ...(metricsData?.devices || []),
      ...(groupDetail?.devices || []).map(d => ({
        deviceId: d.deviceId,
        deviceName: d.deviceName,
        deviceIp: d.deviceIp,
      })),
    ];
    const deviceMap = new Map(allDevices.map(d => [d.deviceId, d]));
    return currentHiddenIds.map(id => deviceMap.get(id)).filter(Boolean);
  }, [currentHiddenIds, metricsData, groupDetail]);

  // 장비 숨기기
  const handleHideDevice = useCallback((deviceId) => {
    if (!groupId) return;
    hideDevice(groupId, deviceId);
  }, [groupId, hideDevice]);

  // 장비 표시
  const handleShowDevice = useCallback((deviceId) => {
    if (!groupId) return;
    showDevice(groupId, deviceId);
    if (currentHiddenIds.length <= 1) {
      setShowHiddenDropdown(false);
    }
  }, [groupId, showDevice, currentHiddenIds]);

  // 모두 표시
  const handleShowAllDevices = useCallback(() => {
    if (!groupId) return;
    showAllDevices(groupId);
    setShowHiddenDropdown(false);
  }, [groupId, showAllDevices]);

  // 숨긴 장비 드롭다운 외부 클릭
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (hiddenDropdownRef.current && !hiddenDropdownRef.current.contains(e.target)) {
        setShowHiddenDropdown(false);
      }
    };
    if (showHiddenDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showHiddenDropdown]);

  // ==================== 드래그 앤 드롭 핸들러 (장비 카드) ====================
  const handleCardDragEnd = useCallback((event) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !groupId) return;

    const orderedIds = orderedVisibleRef.current.map(d => d.deviceId);
    const oldIndex = orderedIds.indexOf(active.id);
    const newIndex = orderedIds.indexOf(over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const newOrder = arrayMove(orderedIds, oldIndex, newIndex);
    // 숨긴 장비도 순서에 보존
    const hiddenInOrder = currentOrder.filter(id => currentHiddenIds.includes(id));
    setDeviceOrder(groupId, [...newOrder, ...hiddenInOrder]);
  }, [groupId, currentOrder, currentHiddenIds, setDeviceOrder]);

  // 트리 구조를 1차원 배열로 풀기 (미니 사이드바용)
  const flattenedGroups = useMemo(() => {
    const result = [];
    const flatten = (groups) => {
      groups?.forEach(g => {
        result.push(g);
        if (g.children) flatten(g.children);
      });
    };
    flatten(watchGroups);
    return result;
  }, [watchGroups]);

  // 그룹 아이콘 렌더링 (미니 사이드바용)
  const renderGroupIcon = (group) => {
    const iconName = group.iconName;
    if (iconName) {
      if (iconName.startsWith('fa-')) return <i className={`fa-solid ${iconName}`} />;
      if (iconName.startsWith('bi-')) return <i className={iconName} />;
      return <span className="material-icons">{iconName}</span>;
    }
    return <i className="bi bi-speedometer2"></i>;
  };

  // ==================== 일반 그룹 관련 ====================

  // 일반 그룹 '미등록 장비' 필터링 + 검색 필터링
  const filteredRegularGroups = useMemo(() => {
    const filterUnregistered = (nodes) => {
      if (!nodes) return [];
      return nodes
        .filter(g => g.GROUP_NAME !== '미등록 장비')
        .map(node => ({ ...node, children: filterUnregistered(node.children) }));
    };
    const cleaned = filterUnregistered(regularGroups);
    if (!searchText.trim()) return cleaned;
    const searchLower = searchText.toLowerCase().trim();
    const matchesSearch = (node) => node.GROUP_NAME?.toLowerCase().includes(searchLower);
    const filterNodes = (nodes) => {
      if (!nodes) return [];
      return nodes.map(node => {
        const filteredChildren = filterNodes(node.children);
        if (matchesSearch(node) || filteredChildren.length > 0) return { ...node, children: filteredChildren };
        return null;
      }).filter(Boolean);
    };
    return filterNodes(cleaned);
  }, [regularGroups, searchText]);

  // 커스텀 그룹 검색 필터링
  const filteredWatchGroups = useMemo(() => {
    if (!watchGroups || !searchText.trim()) return watchGroups;
    const searchLower = searchText.toLowerCase().trim();
    const matchesSearch = (node) => node.groupName?.toLowerCase().includes(searchLower);
    const filterNodes = (nodes) => {
      if (!nodes) return [];
      return nodes.map(node => {
        const filteredChildren = filterNodes(node.children);
        if (matchesSearch(node) || filteredChildren.length > 0) return { ...node, children: filteredChildren };
        return null;
      }).filter(Boolean);
    };
    return filterNodes(watchGroups);
  }, [watchGroups, searchText]);

  // 일반 그룹 전체 확장 (초기 로드)
  useEffect(() => {
    if (regularGroups && regularGroups.length > 0) {
      const allIds = new Set();
      const collectIds = (groups) => {
        groups.forEach((g) => {
          allIds.add(g.GROUP_ID);
          if (g.children) collectIds(g.children);
        });
      };
      collectIds(regularGroups);
      setRegularExpandedNodes(allIds);
    }
  }, [regularGroups]);

  // 일반 그룹용 플랫 목록 (미니 사이드바)
  const flattenedRegularGroups = useMemo(() => {
    if (!regularGroups) return [];
    const result = [];
    const flatten = (groups) => {
      groups.forEach((g) => {
        if (g.GROUP_NAME !== '미등록 장비') {
          result.push(g);
          if (g.children) flatten(g.children);
        }
      });
    };
    flatten(regularGroups);
    return result;
  }, [regularGroups]);

  // 일반 그룹 선택 → 캐시/GET 조회 우선, 미동기화 시에만 sync
  const handleSelectRegularGroup = async (group) => {
    if (isWatching) {
      handleStopWatch();
    }
    setSelectedRegularGroup(group);

    const toWatchGroup = (data) => ({
      watchGroupId: data.WATCH_GROUP_ID,
      groupName: data.GROUP_NAME,
      linkedGroupId: data.LINKED_GROUP_ID,
      intervalSec: data.INTERVAL_SEC,
      depth: data.DEPTH,
      parentGroupId: data.PARENT_GROUP_ID,
    });

    // 1) 프론트 캐시 확인 (즉시)
    const cached = syncedGroupCache.current.get(group.GROUP_ID);
    if (cached) {
      setSelectedWatchGroup(cached);
      return;
    }

    // 2) GET 조회 (read-only, 빠름)
    try {
      const res = await watchApi.getByLinkedGroup(group.GROUP_ID);
      const data = res.data?.data;
      if (data) {
        const watchGroup = toWatchGroup(data);
        syncedGroupCache.current.set(group.GROUP_ID, watchGroup);
        setSelectedWatchGroup(watchGroup);
        resetHistory();
        lastDevicesRef.current = [];
        stableVisibleRef.current = [];
        return;
      }
    } catch (e) { /* 미동기화 → 아래로 진행 */ }

    // 3) 미동기화 → 첫 1회만 sync
    setSyncingRegularGroup(true);
    try {
      const res = await watchApi.syncFromGroup(group.GROUP_ID);
      const data = res.data?.data;
      if (data) {
        const watchGroup = toWatchGroup(data);
        syncedGroupCache.current.set(group.GROUP_ID, watchGroup);
        setSelectedWatchGroup(watchGroup);
        resetHistory();
        lastDevicesRef.current = [];
        stableVisibleRef.current = [];
      }
    } catch (err) {
      console.error('일반 그룹 동기화 실패:', err);
    } finally {
      setSyncingRegularGroup(false);
    }
  };

  // 일반 그룹 노드 토글
  const handleToggleRegularNode = useCallback((groupId) => {
    setRegularExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  }, []);

  // 탭 전환
  const handleTabChange = useCallback((tab) => {
    if (tab === activeTab) return;
    setActiveTab(tab);
    setSearchText('');
    if (tab === 'custom') {
      setSelectedRegularGroup(null);
    } else {
      setSelectedWatchGroup(null);
      setIsWatching(false);
    }
  }, [activeTab, setSelectedWatchGroup, setIsWatching]);

  // (RegularGroupNode는 파일 상단에 별도 컴포넌트로 분리됨)

  return (
    <div className="realtime-performance-container">
      {/* 페이지 헤더 */}
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">
            <i className="bi bi-activity"></i>
            실시간 성능 감시
          </h1>
          <span className="page-subtitle">관제 그룹별 장비 상태를 실시간으로 모니터링합니다</span>
        </div>
      </div>

      <div className={`realtime-panels-wrapper ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
        {/* 왼쪽 사이드바 - 관제 그룹 목록 (미니 사이드바 지원) */}
        <aside className={`watch-sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
          <div className="sidebar-header-fixed">
            {!sidebarCollapsed && (
              <h2>
                <i className="bi bi-collection"></i>
                관제 그룹
              </h2>
            )}
            <button
              className="sidebar-toggle-btn"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              title={sidebarCollapsed ? '사이드바 펼치기' : '사이드바 접기'}
            >
              <i className={`bi bi-chevron-${sidebarCollapsed ? 'right' : 'left'}`}></i>
            </button>
          </div>

          {/* 탭 (펼쳐진 상태에서만) */}
          {!sidebarCollapsed && (
            <div className="ws-tab-bar">
              <button
                className={`ws-tab-btn ${activeTab === 'custom' ? 'active' : ''}`}
                onClick={() => handleTabChange('custom')}
              >
                커스텀 그룹
              </button>
              <button
                className={`ws-tab-btn ${activeTab === 'regular' ? 'active' : ''}`}
                onClick={() => handleTabChange('regular')}
              >
                일반 그룹
              </button>
            </div>
          )}

          {/* 검색 (펼쳐진 상태에서만) */}
          {!sidebarCollapsed && (
            <div className="ws-search-box">
              <i className="bi bi-search ws-search-icon"></i>
              <input
                type="text"
                className="ws-search-input"
                placeholder="그룹 검색..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
              />
              {searchText && (
                <button className="ws-search-clear" onClick={() => setSearchText('')} title="검색어 지우기">
                  <i className="bi bi-x"></i>
                </button>
              )}
            </div>
          )}

          <div
            className="sidebar-content"
            onContextMenu={!sidebarCollapsed && activeTab === 'custom' ? handleEmptyContextMenu : undefined}
            onDragOver={!sidebarCollapsed && activeTab === 'custom' ? handleContainerDragOver : undefined}
            onDrop={!sidebarCollapsed && activeTab === 'custom' ? handleContainerDrop : undefined}
          >
            {sidebarCollapsed ? (
              <div className="mini-group-list">
                {activeTab === 'custom' ? (
                  flattenedGroups.map(group => (
                    <div
                      key={group.watchGroupId}
                      className={`mini-group-item ${selectedWatchGroup?.watchGroupId === group.watchGroupId ? 'selected' : ''}`}
                      onClick={() => handleSelectGroup(group)}
                      title={group.groupName}
                    >
                      {renderGroupIcon(group)}
                    </div>
                  ))
                ) : (
                  flattenedRegularGroups.map(group => (
                    <div
                      key={group.GROUP_ID}
                      className={`mini-group-item ${selectedRegularGroup?.GROUP_ID === group.GROUP_ID ? 'selected' : ''}`}
                      onClick={() => handleSelectRegularGroup(group)}
                      title={group.GROUP_NAME}
                    >
                      {group.ICON_NAME ? (
                        group.ICON_NAME.startsWith('fa-') ? <i className={`fa-solid ${group.ICON_NAME}`} /> :
                        group.ICON_NAME.startsWith('bi-') ? <i className={group.ICON_NAME} /> :
                        <span className="material-icons">{group.ICON_NAME}</span>
                      ) : (
                        <i className="bi bi-folder"></i>
                      )}
                    </div>
                  ))
                )}
              </div>
            ) : activeTab === 'custom' ? (
              /* ===== 커스텀 그룹 탭 ===== */
              groupsLoading ? (
                <div className="watch-loading">
                  <div className="spinner"></div>
                  <p>그룹 목록 로딩 중...</p>
                </div>
              ) : filteredWatchGroups && filteredWatchGroups.length > 0 ? (
                <div className="gm-tree">
                  <ul>
                    {filteredWatchGroups.map((group) => (
                      <WatchGroupNode
                        key={group.watchGroupId}
                        group={group}
                        depth={0}
                        selectedGroup={selectedWatchGroup}
                        expandedNodes={expandedNodes}
                        onSelect={handleSelectGroup}
                        onToggle={handleToggleNode}
                        onContextMenu={handleContextMenu}
                        onDragStart={handleDragStart}
                        onDragEnd={handleDragEnd}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                      />
                    ))}
                  </ul>
                </div>
              ) : searchText.trim() ? (
                <div className="watch-empty-state">
                  <i className="bi bi-search"></i>
                  <p>"{searchText}" 검색 결과가 없습니다.</p>
                </div>
              ) : (
                <div className="watch-empty-state">
                  <i className="bi bi-inbox"></i>
                  <p>관제 그룹이 없습니다.<br />우클릭하여 그룹을 추가하세요.</p>
                </div>
              )
            ) : (
              /* ===== 일반 그룹 탭 ===== */
              regularLoading ? (
                <div className="watch-loading">
                  <div className="spinner"></div>
                  <p>그룹 목록 로딩 중...</p>
                </div>
              ) : filteredRegularGroups && filteredRegularGroups.length > 0 ? (
                <div className="gm-tree">
                  <ul>
                    {filteredRegularGroups.map((group) => (
                      <RegularGroupNode
                        key={group.GROUP_ID}
                        group={group}
                        depth={0}
                        expandedNodes={regularExpandedNodes}
                        selectedGroupId={selectedRegularGroup?.GROUP_ID}
                        searchText={searchText}
                        onToggle={handleToggleRegularNode}
                        onSelect={handleSelectRegularGroup}
                        onContextMenu={handleRegularContextMenu}
                      />
                    ))}
                  </ul>
                </div>
              ) : searchText.trim() ? (
                <div className="watch-empty-state">
                  <i className="bi bi-search"></i>
                  <p>"{searchText}" 검색 결과가 없습니다.</p>
                </div>
              ) : (
                <div className="watch-empty-state">
                  <i className="bi bi-inbox"></i>
                  <p>등록된 그룹이 없습니다.</p>
                </div>
              )
            )}
          </div>
        </aside>

        {/* 메인 콘텐츠 영역 */}
        <main className="watch-main">
          {syncingRegularGroup ? (
            <div className="watch-no-selection">
              <div className="spinner" style={{ width: 40, height: 40, border: '3px solid rgba(255,255,255,0.1)', borderTop: '3px solid #6366f1', borderRadius: '50%', animation: 'spin 1s linear infinite', marginBottom: 16 }}></div>
              <h2>장비 정보 동기화 중...</h2>
              <p>처음 선택한 그룹입니다. 잠시만 기다려주세요.</p>
            </div>
          ) : selectedWatchGroup ? (
            <>
              {/* 헤더 */}
              <div className="watch-header">
                <div className="watch-header-left">
                  <h1>
                    <i className="bi bi-collection"></i>
                    {selectedWatchGroup.groupName}
                  </h1>
                  <div className={`watch-status ${isWatching ? (sseConnected ? 'active' : 'connecting') : 'inactive'}`}>
                    <span className="pulse-dot"></span>
                    {isWatching ? (sseConnected ? '관제 중' : '연결 중...') : '대기 중'}
                  </div>
                  <div className="chart-legend-hint">
                    <span className="legend-item legend-cpu"><span className="legend-dot"></span>CPU/MEM</span>
                    <span className="legend-item legend-traffic"><span className="legend-dot"></span>Traffic</span>
                    <span className="legend-item legend-error"><span className="legend-dot"></span>Error/Discard</span>
                  </div>
                </div>
                <div className="watch-header-right">
                  <span className="last-updated">
                    마지막 갱신: {formatLastUpdated()}
                  </span>
                  <div className="grid-size-toggle">
                    {[
                      { size: 'S', cols: 5, label: '5열 그리드' },
                      { size: 'M', cols: 4, label: '4열 그리드' },
                      { size: 'L', cols: 3, label: '3열 그리드' },
                    ].map(({ size, cols, label }) => (
                      <button
                        key={size}
                        className={`grid-size-btn ${gridSize === size ? 'active' : ''}`}
                        onClick={() => setGridSize(size)}
                        title={label}
                      >
                        <span className={`grid-icon grid-icon-${cols}`}>
                          {Array.from({ length: cols * 2 }).map((_, i) => (
                            <span key={i} className="grid-dot" />
                          ))}
                        </span>
                      </button>
                    ))}
                  </div>
                  {currentHiddenIds.length > 0 && (
                    <div className="hidden-devices-wrapper" ref={hiddenDropdownRef}>
                      <button
                        className="hidden-devices-badge"
                        onClick={() => setShowHiddenDropdown(!showHiddenDropdown)}
                      >
                        <i className="bi bi-eye-slash"></i>
                        숨김 {currentHiddenIds.length}
                      </button>
                      {showHiddenDropdown && (
                        <div className="hidden-devices-dropdown">
                          <div className="hidden-devices-header">숨긴 장비</div>
                          {hiddenDevicesInfo.map(device => (
                            <div key={device.deviceId} className="hidden-device-item">
                              <div className="hidden-device-info">
                                <span className="hidden-device-name">{device.deviceName}</span>
                                <span className="hidden-device-ip">{device.deviceIp}</span>
                              </div>
                              <button
                                className="hidden-device-show-btn"
                                onClick={() => handleShowDevice(device.deviceId)}
                              >
                                표시
                              </button>
                            </div>
                          ))}
                          <button
                            className="hidden-devices-show-all"
                            onClick={handleShowAllDevices}
                          >
                            모두 표시
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                  <div className="global-settings-wrapper" ref={globalSettingsRef}>
                    <button
                      className="btn btn-icon"
                      onClick={() => setShowGlobalSettings(!showGlobalSettings)}
                      title="전체 차트 일괄 설정"
                    >
                      <i className="bi bi-sliders"></i>
                    </button>
                    {showGlobalSettings && (
                      <div className="global-settings-dropdown">
                        <div className="option-group-label">시스템</div>
                        <label className="option-item">
                          <input
                            type="checkbox"
                            checked={globalChartSettings.showCpu}
                            onChange={(e) => {
                              setGlobalChartSettings({ ...globalChartSettings, showCpu: e.target.checked });
                              applyGlobalSettings();
                            }}
                          />
                          <span style={{ color: '#3b82f6' }}>CPU</span>
                        </label>
                        <label className="option-item">
                          <input
                            type="checkbox"
                            checked={globalChartSettings.showMem}
                            onChange={(e) => {
                              setGlobalChartSettings({ ...globalChartSettings, showMem: e.target.checked });
                              applyGlobalSettings();
                            }}
                          />
                          <span style={{ color: '#8b5cf6' }}>MEM</span>
                        </label>
                        <div className="option-group-label">트래픽 카운터</div>
                        <label className="option-item">
                          <input
                            type="radio"
                            name="globalCounter"
                            checked={globalChartSettings.counterType === '32bit'}
                            onChange={() => {
                              setGlobalChartSettings({ ...globalChartSettings, counterType: '32bit' });
                              applyGlobalSettings();
                            }}
                          />
                          <span>32-bit</span>
                        </label>
                        <label className="option-item">
                          <input
                            type="radio"
                            name="globalCounter"
                            checked={globalChartSettings.counterType === '64bit'}
                            onChange={() => {
                              setGlobalChartSettings({ ...globalChartSettings, counterType: '64bit' });
                              applyGlobalSettings();
                            }}
                          />
                          <span>64-bit</span>
                        </label>
                        <div className="option-group-label">표시 단위</div>
                        <label className="option-item">
                          <input
                            type="radio"
                            name="globalTrafficUnit"
                            checked={(globalChartSettings.trafficUnit || 'bit') === 'bit'}
                            onChange={() => {
                              setGlobalChartSettings({ ...globalChartSettings, trafficUnit: 'bit' });
                              applyGlobalSettings();
                            }}
                          />
                          <span>bit (bps)</span>
                        </label>
                        <label className="option-item">
                          <input
                            type="radio"
                            name="globalTrafficUnit"
                            checked={globalChartSettings.trafficUnit === 'byte'}
                            onChange={() => {
                              setGlobalChartSettings({ ...globalChartSettings, trafficUnit: 'byte' });
                              applyGlobalSettings();
                            }}
                          />
                          <span>byte (B/s)</span>
                        </label>
                        <label className="option-item">
                          <input
                            type="radio"
                            name="globalTrafficUnit"
                            checked={globalChartSettings.trafficUnit === 'bps'}
                            onChange={() => {
                              setGlobalChartSettings({ ...globalChartSettings, trafficUnit: 'bps' });
                              applyGlobalSettings();
                            }}
                          />
                          <span>사용률 (%)</span>
                        </label>
                        <div className="option-group-label">품질 지표</div>
                        <label className="option-item">
                          <input
                            type="checkbox"
                            checked={globalChartSettings.showError}
                            onChange={(e) => {
                              setGlobalChartSettings({ ...globalChartSettings, showError: e.target.checked });
                              applyGlobalSettings();
                            }}
                          />
                          <span style={{ color: '#ef4444' }}>Error</span>
                        </label>
                        <label className="option-item">
                          <input
                            type="checkbox"
                            checked={globalChartSettings.showDiscard}
                            onChange={(e) => {
                              setGlobalChartSettings({ ...globalChartSettings, showDiscard: e.target.checked });
                              applyGlobalSettings();
                            }}
                          />
                          <span style={{ color: '#f97316' }}>Discard</span>
                        </label>
                      </div>
                    )}
                  </div>
                  {isWatching ? (
                    <button
                      className="btn btn-secondary"
                      onClick={handleStopWatch}
                      disabled={stopWatchMutation.isPending}
                    >
                      <i className="bi bi-stop-fill"></i>
                      관제 중지
                    </button>
                  ) : (
                    <button
                      className="btn btn-primary"
                      onClick={handleStartWatch}
                      disabled={startWatchMutation.isPending}
                    >
                      <i className="bi bi-play-fill"></i>
                      관제 시작
                    </button>
                  )}
                </div>
              </div>

              {/* 장비 카드 그리드 */}
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleCardDragEnd}
                modifiers={[restrictHorizontalToWindow]}
                autoScroll={false}
              >
                <div className="watch-content-wrapper">
                  <SortableContext
                    items={renderDevices.map(d => d.deviceId)}
                    strategy={rectSortingStrategy}
                  >
                    <div className={`watch-content-grid grid-${gridSize.toLowerCase()}`}>
                      {renderDevices.length > 0 ? (
                        renderDevices.map((device) => (
                          <SortableDeviceCard
                            key={device.deviceId}
                            id={device.deviceId}
                            device={device}
                            history={deviceHistories[device.deviceId] || []}
                            onHide={handleHideDevice}
                          />
                        ))
                      ) : isWatching ? (
                        <div className="watch-loading-full">
                          <div className="spinner"></div>
                          <p>메트릭 데이터 수집 중...</p>
                        </div>
                      ) : (
                        <div className="watch-no-selection-full">
                          <i className="bi bi-hdd-network"></i>
                          <h2>장비가 없습니다</h2>
                          <p>그룹을 수정하여 장비를 추가해주세요.</p>
                        </div>
                      )}
                    </div>
                  </SortableContext>
                </div>
              </DndContext>
            </>
          ) : (
            <div className="watch-no-selection">
              <i className="bi bi-speedometer2"></i>
              <h2>관제 그룹을 선택하세요</h2>
              <p>왼쪽에서 관제 그룹을 선택하거나 새로운 그룹을 생성해주세요.</p>
            </div>
          )}
        </main>
      </div>

      {/* 그룹 편집 모달 */}
      <WatchGroupModal
        isOpen={isGroupModalOpen}
        onClose={closeGroupModal}
        onSave={handleSaveGroup}
        editingGroup={editingGroup}
        parentGroupId={parentGroupIdForCreate}
        mode={modalMode}
      />

      {/* 컨텍스트 메뉴 */}
      {contextMenu && (
        <WatchContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          group={contextMenu.group}
          onClose={closeContextMenu}
          onAdd={handleAddGroup}
          onAddChild={handleAddChildGroup}
          onRename={(group) => openGroupModal(group, null, 'rename')}
          onEditDevices={(group) => openGroupModal(group, null, 'devices')}
          onDelete={handleDeleteGroup}
          onSetIcon={handleSetIcon}
        />
      )}

      {/* 일반 그룹 컨텍스트 메뉴 (관제 장비 설정만) */}
      {regularContextMenu && (
        <RegularGroupContextMenu
          x={regularContextMenu.x}
          y={regularContextMenu.y}
          group={regularContextMenu.group}
          onClose={closeRegularContextMenu}
          onEditDevices={handleRegularEditDevices}
        />
      )}

      {/* 아이콘 선택 모달 */}
      {iconModalWatchGroup && (
        <WatchIconSelectorModal
          onClose={hideIconModal}
          onSuccess={() => refetchGroups()}
        />
      )}

      {/* 첫 관제 그룹 등록 모달 */}
      {showFirstGroupModal && (
        <div className="modal" style={{ display: 'flex' }}>
          <div className="modal-content first-watch-group-modal">
            <h3 className="modal-title">
              <i className="bi bi-speedometer2"></i> 첫 번째 관제 그룹 등록
            </h3>
            <p style={{ color: 'var(--theme-text-muted)', marginBottom: '20px', fontSize: '14px' }}>
              등록된 관제 그룹이 없습니다. 첫 번째 관제 그룹을 등록해주세요.
            </p>
            <form onSubmit={handleFirstGroupSubmit}>
              <div className="form-group">
                <label>그룹명 *</label>
                <input
                  type="text"
                  value={firstGroupName}
                  onChange={(e) => setFirstGroupName(e.target.value)}
                  placeholder="관제 그룹명을 입력하세요"
                  required
                  autoFocus
                />
              </div>
              <div className="modal-footer">
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={createGroupMutation.isPending}
                >
                  등록
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
