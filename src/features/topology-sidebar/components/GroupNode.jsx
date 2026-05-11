/* eslint-disable max-lines-per-function, complexity, max-depth */
import { useGroupStore } from '../../../stores/groupStore';

function GroupNode({ group, depth = 0, isEditMode, onGroupSelect }) {
  const { selectedGroup, setSelectedGroup, expandedNodes, toggleNode } = useGroupStore();

  const isExpanded = expandedNodes.has(group.GROUP_ID);
  const isSelected = selectedGroup?.GROUP_ID === group.GROUP_ID;
  const hasChildren = group.children && group.children.length > 0;

  const handleToggle = (e) => {
    e.stopPropagation();
    toggleNode(group.GROUP_ID);
  };

  const handleSelect = () => {
    setSelectedGroup(group);
    // 그룹 선택 시 토폴로지도 전환
    if (onGroupSelect) {
      onGroupSelect(group);
    }
  };

  // 그룹 드래그 시작 핸들러
  const handleDragStart = (e) => {
    if (!isEditMode) {
      e.preventDefault();
      return;
    }
    e.dataTransfer.setData('application/json', JSON.stringify({
      ...group,
      _dragType: 'group'
    }));
    e.dataTransfer.effectAllowed = 'copy';
  };

  return (
    <li className="topology-group-node">
      <div className="topology-group-item-wrapper">
        <div
          className={`topology-toggle-icon ${isExpanded ? 'expanded' : ''} ${!hasChildren ? 'invisible' : ''}`}
          onClick={handleToggle}
        >
          <i className="bi bi-chevron-right"></i>
        </div>
        <div
          className={`topology-group-item depth-${depth} ${isSelected ? 'selected' : ''} ${isEditMode ? 'draggable' : ''}`}
          onClick={handleSelect}
          onDoubleClick={handleToggle}
          draggable={isEditMode}
          onDragStart={handleDragStart}
          title={isEditMode ? `드래그하여 토폴로지에 추가: ${group.GROUP_NAME}` : group.GROUP_NAME}
        >
          {isEditMode && <i className="bi bi-grip-vertical drag-handle"></i>}
          {(() => {
            const iconName = group.ICON_NAME;
            if (iconName) {
              if (iconName.startsWith('fa-')) return <i className={`fa-solid ${iconName} group-icon custom-icon`} />;
              if (iconName.startsWith('bi-')) return <i className={`${iconName} group-icon custom-icon`} />;
              return <span className="material-icons group-icon custom-icon">{iconName}</span>;
            }
            return <i className={`bi ${isExpanded ? 'bi-folder2-open' : 'bi-folder2'} group-icon default-icon`} />;
          })()}
          <span className="group-name" title={group.GROUP_NAME}>{group.GROUP_NAME}</span>
          {hasChildren && (
            <span className="group-count">{group.children.length}</span>
          )}
        </div>
      </div>

      {isExpanded && hasChildren && (
        <ul className="topology-children">
          {group.children.map((child) => (
            <GroupNode
              key={child.GROUP_ID}
              group={child}
              depth={depth + 1}
              isEditMode={isEditMode}
              onGroupSelect={onGroupSelect}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

// 그룹 사이드바 컴포넌트

export default GroupNode;
