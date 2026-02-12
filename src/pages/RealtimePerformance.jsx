import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
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
  useDeleteLinkedGroup,
} from '../hooks/useWatch';
import { useWatchStore } from '../stores/watchStore';
import { watchApi } from '../api/watch';
import DeviceMetricCard from '../components/DeviceMetricCard';
import WatchGroupModal from '../components/WatchGroupModal';
import WatchIconSelectorModal from '../components/WatchIconSelectorModal';
import ImportGroupModal from '../components/ImportGroupModal';
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

// 드래그 정렬 가능한 장비 카드 래퍼
function SortableDeviceCard({ id, device, history, onHide }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });

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

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <DeviceMetricCard device={device} history={history} onHide={onHide} />
    </div>
  );
}

// 컨텍스트 메뉴 컴포넌트
function WatchContextMenu({ x, y, group, onClose, onAdd, onAddChild, onRename, onEditDevices, onDelete, onSetIcon, onUnlink }) {
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

  const isLinked = !!group.linkedGroupId;

  return createPortal(
    <div
      ref={menuRef}
      className="watch-context-menu"
      style={{ left: x, top: y }}
    >
      {!isLinked && (
        <div
          className="watch-context-menu-item"
          onClick={() => {
            onSetIcon(group);
            onClose();
          }}
        >
          <i className="bi bi-palette"></i>
          <span>아이콘 설정</span>
        </div>
      )}
      {!isLinked && (
        <div
          className="watch-context-menu-item"
          onClick={() => {
            onRename(group);
            onClose();
          }}
        >
          <i className="bi bi-pencil"></i>
          <span>그룹 이름 변경</span>
        </div>
      )}
      <div
        className="watch-context-menu-item"
        onClick={() => {
          onEditDevices(group);
          onClose();
        }}
      >
        <i className="bi bi-hdd-network"></i>
        <span>관제 장비 설정</span>
      </div>
      {!isLinked && (
        <div
          className="watch-context-menu-item"
          onClick={() => {
            onAddChild(group);
            onClose();
          }}
        >
          <i className="bi bi-plus-lg"></i>
          <span>하위 그룹 추가</span>
        </div>
      )}
      <div className="watch-context-menu-divider"></div>
      {isLinked ? (
        <div
          className="watch-context-menu-item danger"
          onClick={() => {
            onUnlink(group);
            onClose();
          }}
        >
          <i className="bi bi-link-45deg"></i>
          <span>연동 해제</span>
        </div>
      ) : (
        <div
          className="watch-context-menu-item danger"
          onClick={() => {
            onDelete(group);
            onClose();
          }}
        >
          <i className="bi bi-trash"></i>
          <span>삭제</span>
        </div>
      )}
    </div>,
    document.body
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
    // 연동 그룹은 링크 아이콘
    if (group.linkedGroupId) {
      return <i className="bi bi-link-45deg group-icon custom-icon linked-icon"></i>;
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
          className={`group-item depth-${depth} ${isSelected ? 'selected' : ''} ${group.linkedGroupId ? 'linked' : ''}`}
          data-group-id={group.watchGroupId}
          draggable={!group.linkedGroupId}
          onClick={() => onSelect(group)}
          onContextMenu={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onContextMenu(e, group);
          }}
          onDragStart={(e) => !group.linkedGroupId && onDragStart(e, group)}
          onDragEnd={onDragEnd}
          onDragOver={(e) => onDragOver(e, group)}
          onDragLeave={onDragLeave}
          onDrop={(e) => onDrop(e, group)}
        >
          {renderIcon()}
          <span>{group.groupName}</span>
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

  // 장비 그룹 가져오기 모달 상태
  const [showImportModal, setShowImportModal] = useState(false);

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

  // 트리 확장 상태
  const [expandedNodes, setExpandedNodes] = useState(new Set());

  // 그룹 목록 조회
  const { data: watchGroups, isLoading: groupsLoading, refetch: refetchGroups } = useWatchGroups();

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
  const deleteLinkedGroupMutation = useDeleteLinkedGroup();

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

  // 연동 해제
  const handleUnlinkGroup = async (group) => {
    if (!confirm(`"${group.groupName}" 연동을 해제하시겠습니까?`)) return;

    try {
      await deleteLinkedGroupMutation.mutateAsync(group.linkedGroupId);
      if (selectedWatchGroup?.watchGroupId === group.watchGroupId) {
        setSelectedWatchGroup(null);
        setIsWatching(false);
      }
      refetchGroups();
    } catch (error) {
      console.error('연동 해제 실패:', error);
      alert('연동 해제에 실패했습니다.');
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

    const result = orderedIds.map(id => deviceMap.get(id)).filter(Boolean);
    console.log('[DEBUG-RENDER] orderedVisibleDevices:', result.length, '개, ids:', result.map(d => d.deviceId), 'currentDevices:', currentDevices.length, 'hidden:', currentHiddenIds.length);
    return result;
  }, [currentDevices, groupId, currentHiddenIds, currentOrder]);

  // 관제 중 위젯이 절대 사라지지 않도록 마지막 유효 목록 캐시
  const stableVisibleRef = useRef([]);
  useEffect(() => {
    if (orderedVisibleDevices.length > 0) {
      stableVisibleRef.current = orderedVisibleDevices;
    }
  }, [orderedVisibleDevices]);

  // 렌더링용: 관제 중 빈 목록이 되면 마지막 캐시 사용
  const useStableFallback = isWatching && orderedVisibleDevices.length === 0 && stableVisibleRef.current.length > 0;
  const renderDevices = useStableFallback ? stableVisibleRef.current : orderedVisibleDevices;
  if (useStableFallback) {
    console.warn('[DEBUG-RENDER] ⚠️ stableVisibleRef 폴백 사용! orderedVisible=0, stable=', stableVisibleRef.current.length);
  }
  console.log('[DEBUG-RENDER] renderDevices 최종:', renderDevices.length, '개, isWatching:', isWatching);

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

    const orderedIds = orderedVisibleDevices.map(d => d.deviceId);
    const oldIndex = orderedIds.indexOf(active.id);
    const newIndex = orderedIds.indexOf(over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const newOrder = arrayMove(orderedIds, oldIndex, newIndex);
    // 숨긴 장비도 순서에 보존
    const hiddenInOrder = currentOrder.filter(id => currentHiddenIds.includes(id));
    setDeviceOrder(groupId, [...newOrder, ...hiddenInOrder]);
  }, [groupId, orderedVisibleDevices, currentOrder, currentHiddenIds, setDeviceOrder]);

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
    if (group.linkedGroupId) {
      return <i className="bi bi-link-45deg linked-icon"></i>;
    }
    return <i className="bi bi-speedometer2"></i>;
  };

  return (
    <div className="realtime-performance-container">
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
          <div
            className="sidebar-content"
            onContextMenu={!sidebarCollapsed ? handleEmptyContextMenu : undefined}
            onDragOver={!sidebarCollapsed ? handleContainerDragOver : undefined}
            onDrop={!sidebarCollapsed ? handleContainerDrop : undefined}
          >
            {sidebarCollapsed ? (
              <div className="mini-group-list">
                {flattenedGroups.map(group => (
                  <div
                    key={group.watchGroupId}
                    className={`mini-group-item ${selectedWatchGroup?.watchGroupId === group.watchGroupId ? 'selected' : ''}`}
                    onClick={() => handleSelectGroup(group)}
                    title={group.groupName}
                  >
                    {renderGroupIcon(group)}
                  </div>
                ))}
              </div>
            ) : groupsLoading ? (
              <div className="watch-loading">
                <div className="spinner"></div>
                <p>그룹 목록 로딩 중...</p>
              </div>
            ) : watchGroups && watchGroups.length > 0 ? (
              <div className="gm-tree">
                <ul>
                  {watchGroups.map((group) => (
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
            ) : (
              <div className="watch-empty-state">
                <i className="bi bi-inbox"></i>
                <p>관제 그룹이 없습니다.<br />우클릭하여 그룹을 추가하세요.</p>
              </div>
            )}
          </div>
          {!sidebarCollapsed && (
            <div className="sidebar-footer">
              <button className="import-group-btn" onClick={() => setShowImportModal(true)}>
                <i className="bi bi-box-arrow-in-down"></i>
                장비 그룹 가져오기
              </button>
            </div>
          )}
        </aside>

        {/* 메인 콘텐츠 영역 */}
        <main className="watch-main">
          {selectedWatchGroup ? (
            <>
              {/* 헤더 */}
              <div className="watch-header">
                <div className="watch-header-left">
                  <h1>
                    <i className="bi bi-activity"></i>
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
          onUnlink={handleUnlinkGroup}
        />
      )}

      {/* 아이콘 선택 모달 */}
      {iconModalWatchGroup && (
        <WatchIconSelectorModal
          onClose={hideIconModal}
          onSuccess={() => refetchGroups()}
        />
      )}

      {/* 장비 그룹 가져오기 모달 */}
      <ImportGroupModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
      />

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
