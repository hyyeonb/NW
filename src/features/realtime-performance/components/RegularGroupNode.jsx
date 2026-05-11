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

export default RegularGroupNode;
