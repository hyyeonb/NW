/* eslint-disable react-refresh/only-export-components, max-lines-per-function, complexity, max-params, max-depth, no-prototype-builtins, react-hooks/exhaustive-deps, no-empty, no-unused-vars */
// WatchSidebar sub-components: WatchContextMenu, WatchGroupNode, RegularGroupNode.

import { useState, useEffect, useRef, useMemo, memo } from 'react';
import { createPortal } from 'react-dom';

function WatchContextMenu({ x, y, group, onClose, onAdd, onAddChild, onRename, onEditDevices, onDelete, onSetIcon }) {
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

  if (!group) {
    return createPortal(
      <div ref={menuRef} className="watch-context-menu" style={{ left: x, top: y }}>
        <div className="watch-context-menu-item" onClick={() => { onAdd(); onClose(); }}>
          <i className="bi bi-plus-lg"></i>
          <span>그룹 추가</span>
        </div>
      </div>,
      document.body
    );
  }

  return createPortal(
    <div ref={menuRef} className="watch-context-menu" style={{ left: x, top: y }}>
      <div className="watch-context-menu-item" onClick={() => { onSetIcon(group); onClose(); }}>
        <i className="bi bi-palette"></i>
        <span>아이콘 설정</span>
      </div>
      <div className="watch-context-menu-item" onClick={() => { onRename(group); onClose(); }}>
        <i className="bi bi-pencil"></i>
        <span>그룹 이름 변경</span>
      </div>
      <div className="watch-context-menu-item" onClick={() => { onEditDevices(group); onClose(); }}>
        <i className="bi bi-hdd-network"></i>
        <span>관제 장비 설정</span>
      </div>
      <div className="watch-context-menu-item" onClick={() => { onAddChild(group); onClose(); }}>
        <i className="bi bi-plus-lg"></i>
        <span>하위 그룹 추가</span>
      </div>
      <div className="watch-context-menu-divider"></div>
      <div className="watch-context-menu-item danger" onClick={() => { onDelete(group); onClose(); }}>
        <i className="bi bi-trash"></i>
        <span>삭제</span>
      </div>
    </div>,
    document.body
  );
}

// ==================== 트리 노드 ====================

const WatchGroupNode = memo(function WatchGroupNode({
  group, depth = 0, selectedGroup, expandedNodes, searchText,
  onSelect, onToggle, onContextMenu,
  onDragStart, onDragEnd, onDragOver, onDragLeave, onDrop,
}) {
  const hasChildren = group.children && group.children.length > 0;
  const isExpanded = expandedNodes.has(group.watchGroupId);
  const isSelected = selectedGroup?.watchGroupId === group.watchGroupId;
  const childCount = group.children?.length || 0;

  const handleToggle = (e) => {
    e.stopPropagation();
    onToggle(group.watchGroupId);
  };

  const renderIcon = () => {
    const iconName = group.iconName;
    if (iconName) {
      if (iconName.startsWith('fa-')) return <i className={`fa-solid ${iconName} group-icon custom-icon`} />;
      if (iconName.startsWith('bi-')) return <i className={`${iconName} group-icon custom-icon`} />;
      return <span className="material-icons group-icon custom-icon">{iconName}</span>;
    }
    return <i className="bi bi-speedometer2 group-icon custom-icon"></i>;
  };

  const renderName = () => {
    const name = group.groupName;
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
          <div className={`toggle-icon ${isExpanded ? 'expanded' : ''}`} onClick={handleToggle}>
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
          onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); onContextMenu(e, group); }}
          onDragStart={(e) => onDragStart(e, group)}
          onDragEnd={onDragEnd}
          onDragOver={(e) => onDragOver(e, group)}
          onDragLeave={onDragLeave}
          onDrop={(e) => onDrop(e, group)}
        >
          {renderIcon()}
          <span>{renderName()}</span>
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
              searchText={searchText}
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
});

// ==================== 일반 그룹 트리 노드 (읽기 전용) ====================

const RegularGroupNode = memo(function RegularGroupNode({ group, depth = 0, selectedGroupId, expandedNodes, searchText, onSelect, onToggle }) {
  const hasChildren = group.children && group.children.length > 0;
  const isExpanded = expandedNodes.has(group.GROUP_ID);
  const isSelected = selectedGroupId === group.GROUP_ID;
  const childCount = group.children?.length || 0;

  const handleToggle = (e) => {
    e.stopPropagation();
    onToggle(group.GROUP_ID);
  };

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
          <div className={`toggle-icon ${isExpanded ? 'expanded' : ''}`} onClick={handleToggle}>
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
              selectedGroupId={selectedGroupId}
              expandedNodes={expandedNodes}
              searchText={searchText}
              onSelect={onSelect}
              onToggle={onToggle}
            />
          ))}
        </ul>
      )}
    </li>
  );
});

// ==================== WatchSidebar 공통 컴포넌트 ====================


export { WatchContextMenu, WatchGroupNode, RegularGroupNode };
