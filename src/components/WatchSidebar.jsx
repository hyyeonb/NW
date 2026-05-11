import { useState, useEffect, useCallback, useRef, useMemo, memo } from 'react';
import { useLocation } from 'react-router-dom';
import { createPortal } from 'react-dom';
import {
  useWatchGroups,
  useCreateWatchGroup,
  useUpdateWatchGroup,
  useDeleteWatchGroup,
  useMoveWatchGroup,
  useUpdateWatchGroupIcon,
} from '../hooks/useWatch';
import { useGroupTree } from '../hooks/useGroups';
import { useWatchStore } from '../stores/watchStore';
import { watchApi } from '../api/watch';
import WatchGroupModal from './WatchGroupModal';
import WatchIconSelectorModal from './WatchIconSelectorModal';
import { useAlert } from './CustomAlert';
import { WatchContextMenu, WatchGroupNode, RegularGroupNode } from '../features/watch-sidebar/parts';
import '../styles/realtime-performance.css';
import '../styles/group-tree.css';

// ==================== 컨텍스트 메뉴 ====================
export default function WatchSidebar({ onGroupSelect, title = '관제 그룹', titleIcon = 'bi bi-collection' }) {
  const location = useLocation();
  const { alert: showAlert, success: showSuccess, error: showError, warning: showWarning, confirm: showConfirm } = useAlert();
  const {
    selectedWatchGroup, setSelectedWatchGroup,
    isGroupModalOpen, editingGroup, parentGroupIdForCreate, modalMode,
    openGroupModal, closeGroupModal,
    draggedWatchGroup, setDraggedWatchGroup,
    iconModalWatchGroup, showIconModal, hideIconModal,
  } = useWatchStore();

  // 로컬 상태
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showFirstGroupModal, setShowFirstGroupModal] = useState(false);
  const [firstGroupName, setFirstGroupName] = useState('');
  const [contextMenu, setContextMenu] = useState(null);
  const [expandedNodes, setExpandedNodes] = useState(new Set());
  const [searchText, setSearchText] = useState('');
  const [activeTab, setActiveTab] = useState('regular'); // 'regular' | 'custom'
  const [regularExpandedNodes, setRegularExpandedNodes] = useState(new Set());
  const [selectedRegularGroup, setSelectedRegularGroup] = useState(null);

  // 워치 그룹 API
  const { data: watchGroups, isLoading: groupsLoading, refetch: refetchGroups } = useWatchGroups();
  const createGroupMutation = useCreateWatchGroup();
  const updateGroupMutation = useUpdateWatchGroup();
  const deleteGroupMutation = useDeleteWatchGroup();
  const moveGroupMutation = useMoveWatchGroup();
  const updateIconMutation = useUpdateWatchGroupIcon();

  // 일반 그룹 (R_GROUP_T) 트리 조회
  const { data: regularGroups, isLoading: regularLoading } = useGroupTree();

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

  // 그룹이 없으면 첫 그룹 등록 모달
  useEffect(() => {
    if (!groupsLoading && watchGroups && watchGroups.length === 0) {
      setShowFirstGroupModal(true);
    }
  }, [groupsLoading, watchGroups]);

  // 모든 노드 확장 (초기 로드)
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

  // 검색 필터링
  const filteredGroups = useMemo(() => {
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

  // 그룹 선택
  const handleSelectGroup = useCallback((group) => {
    setSelectedWatchGroup(group);
    setSelectedRegularGroup(null);
    onGroupSelect?.(group);
  }, [setSelectedWatchGroup, onGroupSelect]);

  // 일반 그룹 선택
  const handleSelectRegularGroup = useCallback((group) => {
    setSelectedRegularGroup(group);
    setSelectedWatchGroup(null);
    onGroupSelect?.({ groupId: group.GROUP_ID, groupName: group.GROUP_NAME, type: 'regular' });
  }, [setSelectedWatchGroup, onGroupSelect]);

  // 페이지 재진입 시 리셋 (_refresh state 감지)
  const refreshKey = location.state?._refresh;
  const autoSelectedRef = useRef(false);
  useEffect(() => {
    if (!refreshKey) return;
    autoSelectedRef.current = false;
    setActiveTab('regular');
    setSelectedWatchGroup(null);
    setSelectedRegularGroup(null);
    onGroupSelect?.(null);
  }, [refreshKey]);

  // 일반 그룹 첫 번째 항목 자동 선택
  useEffect(() => {
    if (autoSelectedRef.current) return;
    if (regularGroups && regularGroups.length > 0 && !selectedRegularGroup && !selectedWatchGroup) {
      autoSelectedRef.current = true;
      handleSelectRegularGroup(regularGroups[0]);
    }
  }, [regularGroups, selectedRegularGroup, selectedWatchGroup, handleSelectRegularGroup]);

  // 일반 그룹 노드 토글
  const handleToggleRegularNode = useCallback((groupId) => {
    setRegularExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  }, []);

  // 탭 전환 → 해당 탭의 첫 번째 항목 자동 선택
  const handleTabChange = useCallback((tab) => {
    if (tab === activeTab) return;
    setActiveTab(tab);
    setSearchText('');
    if (tab === 'custom') {
      setSelectedRegularGroup(null);
      if (watchGroups && watchGroups.length > 0) {
        handleSelectGroup(watchGroups[0]);
      } else {
        onGroupSelect?.(null);
      }
    } else {
      setSelectedWatchGroup(null);
      if (regularGroups && regularGroups.length > 0) {
        handleSelectRegularGroup(regularGroups[0]);
      } else {
        onGroupSelect?.(null);
      }
    }
  }, [activeTab, setSelectedWatchGroup, onGroupSelect, watchGroups, regularGroups, handleSelectGroup, handleSelectRegularGroup]);

  // 첫 그룹 등록
  const handleFirstGroupSubmit = async (e) => {
    e.preventDefault();
    if (!firstGroupName.trim()) { showWarning('그룹명을 입력해주세요.'); return; }
    try {
      await createGroupMutation.mutateAsync({
        groupName: firstGroupName.trim(), intervalSec: 5, devices: [], parentGroupId: null,
      });
      setShowFirstGroupModal(false);
      setFirstGroupName('');
      const { data: groups } = await refetchGroups();
      if (groups && groups.length > 0) handleSelectGroup(groups[0]);
    } catch (error) {
      console.error('그룹 생성 오류:', error);
      showError('그룹 생성에 실패했습니다: ' + error.message);
    }
  };

  // 그룹 저장 (생성/수정)
  const handleSaveGroup = async (data) => {
    try {
      if (editingGroup) {
        await updateGroupMutation.mutateAsync({ watchGroupId: editingGroup.watchGroupId, data });
      } else {
        await createGroupMutation.mutateAsync(data);
      }
      closeGroupModal();
      refetchGroups();
    } catch (error) {
      console.error('그룹 저장 실패:', error);
      showError('그룹 저장에 실패했습니다.');
    }
  };

  // 그룹 삭제
  const handleDeleteGroup = async (group) => {
    const ok = await showConfirm(`"${group.groupName}" 그룹을 삭제하시겠습니까?`);
    if (!ok) return;
    try {
      await deleteGroupMutation.mutateAsync(group.watchGroupId);
      if (selectedWatchGroup?.watchGroupId === group.watchGroupId) setSelectedWatchGroup(null);
      refetchGroups();
    } catch (error) {
      console.error('그룹 삭제 실패:', error);
      showError('그룹 삭제에 실패했습니다.');
    }
  };

  // 컨텍스트 메뉴
  const handleContextMenu = (e, group) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, group });
  };

  const handleEmptyContextMenu = (e) => {
    if (e.target.closest('.group-item')) return;
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, group: null });
  };

  const closeContextMenu = () => setContextMenu(null);

  // 트리 노드 토글
  const handleToggleNode = (groupId) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  // 그룹 추가/하위 추가/아이콘
  const handleAddGroup = () => openGroupModal(null, null);
  const handleAddChildGroup = (parentGroup) => {
    setExpandedNodes((prev) => new Set([...prev, parentGroup.watchGroupId]));
    openGroupModal(null, parentGroup.watchGroupId);
  };
  const handleSetIcon = (group) => showIconModal(group);

  // ==================== 드래그 앤 드롭 ====================

  const isDescendantOf = useCallback((potentialDescendantId, ancestorId, nodes) => {
    const findInChildren = (nodeList, targetId) => {
      for (const node of nodeList) {
        if (node.watchGroupId === targetId) return true;
        if (node.children?.length > 0 && findInChildren(node.children, targetId)) return true;
      }
      return false;
    };
    const findAncestor = (nodeList) => {
      for (const node of nodeList) {
        if (node.watchGroupId === ancestorId) return findInChildren(node.children || [], potentialDescendantId);
        if (node.children?.length > 0) {
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
    document.querySelectorAll('.drag-over, .drag-invalid').forEach(el => el.classList.remove('drag-over', 'drag-invalid'));
    setDraggedWatchGroup(null);
  }, [setDraggedWatchGroup]);

  const handleDragOver = useCallback((e, targetGroup) => {
    if (!draggedWatchGroup || draggedWatchGroup.watchGroupId === targetGroup.watchGroupId) return;
    e.preventDefault();
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
      const countResponse = await watchApi.getDescendantsCount(draggedWatchGroup.watchGroupId);
      const childCount = countResponse.data?.data || 0;
      const message = childCount > 0
        ? `"${draggedWatchGroup.groupName}" 그룹과 하위 ${childCount}개 그룹을 "${targetGroup.groupName}" 아래로 이동하시겠습니까?`
        : `"${draggedWatchGroup.groupName}" 그룹을 "${targetGroup.groupName}" 아래로 이동하시겠습니까?`;
      const ok = await showConfirm(message);
      if (ok) {
        await moveGroupMutation.mutateAsync({ watchGroupId: draggedWatchGroup.watchGroupId, parentGroupId: targetGroup.watchGroupId });
        refetchGroups();
      }
    } catch (error) {
      console.error('그룹 이동 실패:', error);
      showError('그룹 이동에 실패했습니다.');
    }
    setDraggedWatchGroup(null);
  }, [draggedWatchGroup, watchGroups, isDescendantOf, moveGroupMutation, refetchGroups, setDraggedWatchGroup, showConfirm, showError]);

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
        const ok = await showConfirm(message);
        if (ok) {
          await moveGroupMutation.mutateAsync({ watchGroupId: draggedWatchGroup.watchGroupId, parentGroupId: null });
          refetchGroups();
        }
      } catch (error) {
        console.error('그룹 이동 실패:', error);
        showError('그룹 이동에 실패했습니다.');
      }
    }
    setDraggedWatchGroup(null);
  }, [draggedWatchGroup, moveGroupMutation, refetchGroups, setDraggedWatchGroup, showConfirm, showError]);

  const handleContainerDragOver = useCallback((e) => {
    if (e.target.closest('.group-item')) return;
    e.preventDefault();
  }, []);

  // 미니 사이드바용 플랫 그룹 목록
  const flattenedGroups = useMemo(() => {
    if (!watchGroups) return [];
    const result = [];
    const flatten = (groups) => {
      groups.forEach((g) => {
        result.push(g);
        if (g.children) flatten(g.children);
      });
    };
    flatten(watchGroups);
    return result;
  }, [watchGroups]);

  const renderGroupIcon = (group) => {
    const iconName = group.iconName;
    if (iconName) {
      if (iconName.startsWith('fa-')) return <i className={`fa-solid ${iconName}`} />;
      if (iconName.startsWith('bi-')) return <i className={iconName} />;
      return <span className="material-icons">{iconName}</span>;
    }
    return <i className="bi bi-speedometer2"></i>;
  };

  // ==================== 렌더링 ====================

  return (
    <>
      <aside className={`watch-sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
        <div className="sidebar-header-fixed">
          {!sidebarCollapsed && (
            <h2>
              <i className={titleIcon}></i>
              {title}
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
              className={`ws-tab-btn ${activeTab === 'regular' ? 'active' : ''}`}
              onClick={() => handleTabChange('regular')}
            >
              일반 그룹
            </button>
            <button
              className={`ws-tab-btn ${activeTab === 'custom' ? 'active' : ''}`}
              onClick={() => handleTabChange('custom')}
            >
              커스텀 그룹
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
            ) : filteredGroups && filteredGroups.length > 0 ? (
              <div className="gm-tree">
                <ul>
                  {filteredGroups.map((group) => (
                    <WatchGroupNode
                      key={group.watchGroupId}
                      group={group}
                      depth={0}
                      selectedGroup={selectedWatchGroup}
                      expandedNodes={expandedNodes}
                      searchText={searchText}
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
                      selectedGroupId={selectedRegularGroup?.GROUP_ID}
                      expandedNodes={regularExpandedNodes}
                      searchText={searchText}
                      onSelect={handleSelectRegularGroup}
                      onToggle={handleToggleRegularNode}
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
                <button type="submit" className="btn btn-primary" disabled={createGroupMutation.isPending}>
                  등록
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
