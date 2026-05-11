/* eslint-disable react-refresh/only-export-components, max-lines-per-function, complexity, max-params, max-depth, no-unused-vars */
// GroupTree sub-components: GroupNode + ContextMenu.

import { useEffect, useRef, useCallback, useState, useMemo, memo } from 'react';
import { createPortal } from 'react-dom';
import { useGroupStore } from '../../stores/groupStore';

const GroupNode = memo(function GroupNode({ group, depth = 0, onContextMenu, onDragStart, onDragEnd, onDragOver, onDragLeave, onDrop, onSelectGroup, customSelectedGroup, disabledGroupIds }) {
  const { selectedGroup, setSelectedGroup, expandedNodes, toggleNode } = useGroupStore();
  const nodeRef = useRef(null);

  const isExpanded = expandedNodes.has(group.GROUP_ID);
  const isSelected = customSelectedGroup
    ? customSelectedGroup?.GROUP_ID === group.GROUP_ID
    : selectedGroup?.GROUP_ID === group.GROUP_ID;
  const hasChildren = group.children && group.children.length > 0;
  const childCount = group.children?.length || 0;
  const isDisabled = disabledGroupIds?.includes(group.GROUP_ID);

  const renderIcon = () => {
    const iconName = group.ICON_NAME;
    if (iconName) {
      if (iconName.startsWith('fa-')) return <i className={`fa-solid ${iconName} group-icon custom-icon`} />;
      if (iconName.startsWith('bi-')) return <i className={`${iconName} group-icon custom-icon`} />;
      return <span className="material-icons group-icon custom-icon">{iconName}</span>;
    }
    return <i className="bi bi-folder2 group-icon default-icon" />;
  };

  const handleClick = () => {
    if (isDisabled) return;
    if (onSelectGroup) onSelectGroup(group);
    else setSelectedGroup(group);
  };

  const handleContextMenu = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedGroup(group);
    onContextMenu(e.clientX, e.clientY, group);
  };

  const handleToggle = (e) => {
    e.stopPropagation();
    toggleNode(group.GROUP_ID);
  };

  return (
    <li>
      <div className="group-item-wrapper">
        {hasChildren ? (
          <div className={`toggle-icon ${isExpanded ? 'expanded' : ''}`} onClick={handleToggle}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          </div>
        ) : (
          <div className="toggle-icon" style={{ visibility: 'hidden' }}></div>
        )}
        <div
          ref={nodeRef}
          className={`group-item depth-${depth} ${isSelected ? 'selected' : ''} ${isDisabled ? 'disabled' : ''}`}
          data-group-id={group.GROUP_ID}
          draggable={!onSelectGroup}
          onClick={handleClick}
          onContextMenu={onSelectGroup ? undefined : handleContextMenu}
          onDragStart={onSelectGroup ? undefined : (e) => onDragStart(e, group)}
          onDragEnd={onSelectGroup ? undefined : onDragEnd}
          onDragOver={onSelectGroup ? undefined : (e) => onDragOver(e, group)}
          onDragLeave={onSelectGroup ? undefined : onDragLeave}
          onDrop={onSelectGroup ? undefined : (e) => onDrop(e, group)}
          title={isDisabled ? `${group.GROUP_NAME} (현재 그룹)` : group.GROUP_NAME}
          style={isDisabled ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
        >
          {renderIcon()}
          <span>{group.GROUP_NAME}</span>
          {isDisabled && <span style={{ marginLeft: '6px', fontSize: '11px', color: '#94a3b8' }}>(현재)</span>}
          {!isDisabled && childCount > 0 && <span className="child-count">{childCount}</span>}
        </div>
      </div>

      {hasChildren && isExpanded && (
        <ul>
          {group.children.map((child) => (
            <GroupNode
              key={child.GROUP_ID}
              group={child}
              depth={depth + 1}
              onContextMenu={onContextMenu}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              onSelectGroup={onSelectGroup}
              customSelectedGroup={customSelectedGroup}
              disabledGroupIds={disabledGroupIds}
            />
          ))}
        </ul>
      )}
    </li>
  );
});

// ==================== 컨텍스트 메뉴 ====================

function ContextMenu({ x, y, group, onClose, onEditGroup, onAddGroup, onDeleteGroup, onSetIcon }) {
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) onClose();
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

  const menuContent = (
    <div ref={menuRef} className="context-menu show" style={{ left: x, top: y, position: 'fixed', zIndex: 99999 }}>
      <div className="context-menu-item" onClick={() => { onSetIcon(group); onClose(); }}>
        <span className="icon">🎨</span><span>아이콘 설정</span>
      </div>
      <div className="context-menu-item" onClick={() => { onEditGroup(group); onClose(); }}>
        <span className="icon">✏️</span><span>그룹 수정</span>
      </div>
      <div className="context-menu-item" onClick={() => { onAddGroup(group.GROUP_ID); onClose(); }}>
        <span className="icon">➕</span><span>그룹 추가</span>
      </div>
      <div className="context-menu-divider"></div>
      <div className="context-menu-item danger" onClick={() => { onDeleteGroup(group); onClose(); }}>
        <span className="icon">🗑️</span><span>그룹 삭제</span>
      </div>
    </div>
  );

  return createPortal(menuContent, document.body);
}

// ==================== 메인 GroupTree 컴포넌트 ====================


export { GroupNode, ContextMenu };
