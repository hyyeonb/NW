/* eslint-disable react-refresh/only-export-components */
// SystemAdmin: 페이지 그룹 상수 + 트리 평탄화 + 트리 라인 렌더 컴포넌트.

export const PAGE_GROUPS = [
  { key: 'dashboard', label: '대시보드', icon: 'bi-speedometer2' },
  { key: 'perf', label: '성능감시', icon: 'bi-activity' },
  { key: 'fault', label: '장애감시', icon: 'bi-exclamation-triangle' },
  { key: 'mgmt', label: '종합분석', icon: 'bi-gear' },
  { key: 'history', label: '이력 관리', icon: 'bi-clock-history' },
  { key: 'tools', label: '네트워크 도구', icon: 'bi-tools' },
  { key: 'board', label: '게시판', icon: 'bi-clipboard2-data' },
  { key: 'system', label: '시스템', icon: 'bi-shield-lock' },
];

// 그룹 트리 → 플랫 리스트 (각 항목에 depth/isLast/hasChildren/lines).
export function flattenGroups(groups, depth = 0, parentLines = []) {
  const result = [];
  if (!groups) return result;
  for (let i = 0; i < groups.length; i++) {
    const g = groups[i];
    const isLast = i === groups.length - 1;
    const hasChildren = g.children?.length > 0;
    const lines = [...parentLines];
    result.push({ ...g, depth, isLast, hasChildren, lines });
    if (hasChildren) {
      result.push(...flattenGroups(g.children, depth + 1, [...lines, !isLast]));
    }
  }
  return result;
}

export function GroupIcon({ iconName, defaultIcon }) {
  if (iconName) {
    if (iconName.startsWith('fa-')) return <i className={`fa-solid ${iconName} sa-tree-icon sa-tree-icon-custom`}></i>;
    if (iconName.startsWith('bi-')) return <i className={`bi ${iconName} sa-tree-icon sa-tree-icon-custom`}></i>;
    return <span className={`material-icons sa-tree-icon sa-tree-icon-custom`}>{iconName}</span>;
  }
  return <i className={`bi ${defaultIcon || 'bi-folder2'} sa-tree-icon`}></i>;
}

export function TreeIndent({ depth, isLast, lines }) {
  if (depth === 0) return null;
  const segments = [];
  for (let i = 0; i < depth - 1; i++) {
    segments.push(
      <span key={`line-${i}`} className="sa-tree-line">{lines[i] ? '│' : ' '}</span>
    );
  }
  segments.push(<span key="branch" className="sa-tree-branch">{isLast ? '└' : '├'}</span>);
  return <span className="sa-tree-indent">{segments}</span>;
}
