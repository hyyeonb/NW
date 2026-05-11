/* eslint-disable react-refresh/only-export-components */
// ImportGroupModal sub-component: ImportGroupNode 트리 + 노드 collection 헬퍼.

import { useState } from 'react';

function ImportGroupNode({ group, depth, checkedIds, linkedIds, onToggle }) {
  const [expanded, setExpanded] = useState(depth < 2);
  const hasChildren = group.children?.length > 0;
  const isLinked = linkedIds.includes(group.GROUP_ID);
  const isChecked = checkedIds.has(group.GROUP_ID);

  return (
    <>
      <div
        className={`import-row ${isLinked ? 'is-linked' : ''}`}
        style={{ paddingLeft: `${depth * 20 + 12}px` }}
        onClick={() => !isLinked && onToggle(group.GROUP_ID)}
      >
        {hasChildren ? (
          <span
            className={`import-row-toggle ${expanded ? 'open' : ''}`}
            onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M4.5 2.5L8 6L4.5 9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </span>
        ) : (
          <span className="import-row-toggle-space" />
        )}
        <input
          type="checkbox"
          className="import-row-checkbox"
          checked={isChecked || isLinked}
          disabled={isLinked}
          onChange={() => !isLinked && onToggle(group.GROUP_ID)}
          onClick={(e) => e.stopPropagation()}
        />
        {(() => {
          const iconName = group.ICON_NAME;
          if (iconName) {
            if (iconName.startsWith('fa-')) return <i className={`fa-solid ${iconName} group-icon custom-icon`} />;
            if (iconName.startsWith('bi-')) return <i className={`${iconName} group-icon custom-icon`} />;
            return <span className="material-icons group-icon custom-icon">{iconName}</span>;
          }
          return <i className="bi bi-folder2 group-icon default-icon" />;
        })()}
        <span className="import-row-name">{group.GROUP_NAME}</span>
        {isLinked && <span className="import-row-badge">연동됨</span>}
      </div>
      {expanded && hasChildren && group.children.map(child => (
        <ImportGroupNode
          key={child.GROUP_ID}
          group={child}
          depth={depth + 1}
          checkedIds={checkedIds}
          linkedIds={linkedIds}
          onToggle={onToggle}
        />
      ))}
    </>
  );
}

export default ImportGroupNode;
