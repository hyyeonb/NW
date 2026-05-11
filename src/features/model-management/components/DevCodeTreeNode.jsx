import { useState } from 'react';

// 장비군 트리 노드 — ModelManagement 페이지 좌측 트리.
function DevCodeTreeNode({ nodes, onSelect, selectedId, depth = 0 }) {
  const [expanded, setExpanded] = useState({});

  const toggleExpand = (id, e) => {
    e.stopPropagation();
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
  };

  if (!nodes || nodes.length === 0) return null;

  return (
    <div className="dev-code-tree" style={{ paddingLeft: depth > 0 ? '16px' : '0' }}>
      {nodes.map(node => (
        <div key={node.DEV_CODE_ID}>
          <div
            className={`dev-code-option ${selectedId === node.DEV_CODE_ID ? 'selected' : ''}`}
            onClick={() => onSelect(node)}
          >
            {node.children?.length > 0 && (
              <i
                className={`bi ${expanded[node.DEV_CODE_ID] ? 'bi-chevron-down' : 'bi-chevron-right'} expand-icon`}
                onClick={(e) => toggleExpand(node.DEV_CODE_ID, e)}
              ></i>
            )}
            {!node.children?.length && <span className="expand-spacer"></span>}
            <i className="bi bi-folder2"></i>
            <span>{node.CODE_NM}</span>
          </div>
          {node.children?.length > 0 && expanded[node.DEV_CODE_ID] && (
            <DevCodeTreeNode
              nodes={node.children}
              onSelect={onSelect}
              selectedId={selectedId}
              depth={depth + 1}
            />
          )}
        </div>
      ))}
    </div>
  );
}

export default DevCodeTreeNode;
