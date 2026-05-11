import { useEffect, useRef, useCallback, useState, useMemo, memo } from 'react';
import { createPortal } from 'react-dom';
import { useGroupTree } from '../hooks/useGroups';
import { useGroupStore } from '../stores/groupStore';
import { GroupNode, ContextMenu } from '../features/group-tree/parts';

// ==================== 기본 노드 ====================
export default function GroupTree({
  onEditGroup, onAddGroup, onDeleteGroup, onSetIcon, onMoveGroup,
  enableContextMenu = true, autoSelectFirst = true,
  onSelectGroup, customSelectedGroup, disabledGroupIds = [],
  compact = false,
}) {
  const hasContextMenuHandlers = Boolean(onEditGroup || onAddGroup || onDeleteGroup || onSetIcon);
  const { data: groupTree, isLoading, error, refetch } = useGroupTree();
  const {
    setGroupTree, expandAll, setSelectedGroup,
    contextMenu, showContextMenu, hideContextMenu,
    draggedGroup, setDraggedGroup,
  } = useGroupStore();
  const containerRef = useRef(null);

  const [searchText, setSearchText] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // 검색 디바운스 (300ms)
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchText), 300);
    return () => clearTimeout(timer);
  }, [searchText]);

  // 검색 필터링
  const filteredGroupTree = useMemo(() => {
    if (!groupTree || !debouncedSearch.trim()) return groupTree;
    const searchLower = debouncedSearch.toLowerCase().trim();
    const matchesSearch = (node) => node.GROUP_NAME?.toLowerCase().includes(searchLower);
    const filterNodes = (nodes) => {
      if (!nodes) return [];
      return nodes.map(node => {
        const filteredChildren = filterNodes(node.children);
        if (matchesSearch(node) || filteredChildren.length > 0) return { ...node, children: filteredChildren };
        return null;
      }).filter(Boolean);
    };
    return filterNodes(groupTree);
  }, [groupTree, debouncedSearch]);

  // 트리 데이터 설정 및 모든 노드 확장
  useEffect(() => {
    if (groupTree && groupTree.length > 0) {
      setGroupTree(groupTree);
      expandAll();
      if (autoSelectFirst) {
        const firstVisible = [...groupTree]
          .filter(g => g.GROUP_NAME !== '미등록 장비')
          .sort((a, b) => a.GROUP_NAME.localeCompare(b.GROUP_NAME))[0];
        if (firstVisible) setSelectedGroup(firstVisible);
      }
    }
  }, [groupTree, setGroupTree, expandAll, setSelectedGroup, autoSelectFirst]);

  const handleContextMenu = useCallback((x, y, group) => {
    if (hasContextMenuHandlers) showContextMenu(x, y, group);
  }, [showContextMenu, hasContextMenuHandlers]);

  const handleContainerContextMenu = (e) => {
    if (!hasContextMenuHandlers) return;
    if (e.target === containerRef.current || e.target.tagName === 'UL' || e.target.tagName === 'P') {
      e.preventDefault();
      showContextMenu(e.clientX, e.clientY, null);
    }
  };

  const handleDragStart = useCallback((e, group) => {
    setDraggedGroup(group);
    e.currentTarget.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
  }, [setDraggedGroup]);

  const handleDragEnd = useCallback((e) => {
    e.currentTarget.classList.remove('dragging');
    document.querySelectorAll('.drag-over, .drag-invalid').forEach(el => {
      el.classList.remove('drag-over', 'drag-invalid');
    });
    setDraggedGroup(null);
  }, [setDraggedGroup]);

  const isDescendantOf = useCallback((potentialDescendantId, ancestorId, nodes) => {
    const findInChildren = (nodeList, targetId) => {
      for (const node of nodeList) {
        if (node.GROUP_ID === targetId) return true;
        if (node.children?.length > 0 && findInChildren(node.children, targetId)) return true;
      }
      return false;
    };
    const findAncestor = (nodeList) => {
      for (const node of nodeList) {
        if (node.GROUP_ID === ancestorId) return findInChildren(node.children || [], potentialDescendantId);
        if (node.children?.length > 0) {
          const result = findAncestor(node.children);
          if (result !== null) return result;
        }
      }
      return false;
    };
    return findAncestor(nodes);
  }, []);

  const handleDragOver = useCallback((e, targetGroup) => {
    if (!draggedGroup || draggedGroup.GROUP_ID === targetGroup.GROUP_ID) return;
    e.preventDefault();
    if (isDescendantOf(targetGroup.GROUP_ID, draggedGroup.GROUP_ID, groupTree)) {
      e.currentTarget.classList.add('drag-invalid');
      e.currentTarget.classList.remove('drag-over');
    } else {
      e.currentTarget.classList.add('drag-over');
      e.currentTarget.classList.remove('drag-invalid');
    }
  }, [draggedGroup, groupTree, isDescendantOf]);

  const handleDragLeave = useCallback((e) => {
    e.currentTarget.classList.remove('drag-over', 'drag-invalid');
  }, []);

  const handleDrop = useCallback((e, targetGroup) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.remove('drag-over', 'drag-invalid');
    if (!draggedGroup || draggedGroup.GROUP_ID === targetGroup.GROUP_ID) return;
    if (isDescendantOf(targetGroup.GROUP_ID, draggedGroup.GROUP_ID, groupTree)) return;
    if (onMoveGroup) onMoveGroup(draggedGroup.GROUP_ID, targetGroup.GROUP_ID);
    setDraggedGroup(null);
  }, [draggedGroup, groupTree, isDescendantOf, onMoveGroup, setDraggedGroup]);

  const handleContainerDrop = (e) => {
    if (e.target === containerRef.current || e.target.tagName === 'UL' || e.target.tagName === 'P') {
      e.preventDefault();
      e.stopPropagation();
      if (draggedGroup && onMoveGroup) onMoveGroup(draggedGroup.GROUP_ID, null);
      setDraggedGroup(null);
    }
  };

  const handleContainerDragOver = (e) => {
    if (e.target === containerRef.current || e.target.tagName === 'UL' || e.target.tagName === 'P') {
      e.preventDefault();
    }
  };

  useEffect(() => {
    window.reloadGroupTree = refetch;
    return () => { delete window.reloadGroupTree; };
  }, [refetch]);

  // ==================== 트리 렌더링 ====================

  const treeContent = (
    <div
      ref={containerRef}
      id={compact ? undefined : "group-tree"}
      className="gm-tree"
      onContextMenu={compact ? undefined : handleContainerContextMenu}
      onDragOver={compact ? undefined : handleContainerDragOver}
      onDrop={compact ? undefined : handleContainerDrop}
    >
      {isLoading ? (
        <p>그룹 목록을 불러오는 중...</p>
      ) : error ? (
        <p style={{ color: '#f87171' }}>그룹 목록을 불러오는 중 오류가 발생했습니다.</p>
      ) : filteredGroupTree && filteredGroupTree.length > 0 ? (
        <ul>
          {filteredGroupTree
            .filter(g => g.GROUP_NAME !== '미등록 장비')
            .sort((a, b) => a.GROUP_NAME.localeCompare(b.GROUP_NAME))
            .map((node) => (
              <GroupNode
                key={node.GROUP_ID}
                group={node}
                depth={node.DEPTH || 0}
                onContextMenu={handleContextMenu}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onSelectGroup={onSelectGroup}
                customSelectedGroup={customSelectedGroup}
                disabledGroupIds={disabledGroupIds}
              />
            ))}
        </ul>
      ) : searchText.trim() ? (
        <p>"{searchText}" 검색 결과가 없습니다.</p>
      ) : (
        <p>등록된 그룹이 없습니다.{!compact && <><br />우클릭하여 그룹을 추가하세요.</>}</p>
      )}
    </div>
  );

  if (compact) return treeContent;

  return (
    <aside className="page-sidebar" id="group-tree-sidebar">
      <h1>그룹 목록</h1>
      <div className="sidebar-header-fixed">
        <div className="group-search-box">
          <i className="bi bi-search search-icon"></i>
          <input
            type="text"
            className="group-search-input"
            placeholder="그룹 검색..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
          />
          {searchText && (
            <button className="search-clear-btn" onClick={() => setSearchText('')} title="검색어 지우기">
              <i className="bi bi-x"></i>
            </button>
          )}
        </div>
      </div>
      <div className="sidebar-content">
        {treeContent}
      </div>

      {contextMenu && (
        contextMenu.group ? (
          <ContextMenu
            x={contextMenu.x} y={contextMenu.y} group={contextMenu.group}
            onClose={hideContextMenu}
            onEditGroup={onEditGroup} onAddGroup={onAddGroup}
            onDeleteGroup={onDeleteGroup} onSetIcon={onSetIcon}
          />
        ) : (
          <div className="context-menu show" style={{ left: contextMenu.x, top: contextMenu.y }}>
            <div className="context-menu-item" onClick={() => { onAddGroup(null); hideContextMenu(); }}>
              <span className="icon">➕</span><span>그룹 추가</span>
            </div>
          </div>
        )
      )}
    </aside>
  );
}
