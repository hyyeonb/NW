/* eslint-disable max-lines-per-function */
import { useEffect } from 'react';
import { useGroupTree } from '../../../hooks/useGroups';
import { useGroupStore } from '../../../stores/groupStore';
import GroupNode from './GroupNode';

function GroupSidebar({ isEditMode, onGroupSelect }) {
  const { data: groupTree, isLoading, error } = useGroupTree();
  const { setGroupTree, expandedNodes, expandAll } = useGroupStore();

  // 그룹 트리 로드 시 store에 저장 및 최상위 그룹들 확장
  useEffect(() => {
    if (groupTree && groupTree.length > 0) {
      setGroupTree(groupTree);
      // 최초 로드시에만 확장 (expandedNodes가 비어있을 때)
      if (expandedNodes.size === 0) {
        expandAll();
      }
    }
  }, [groupTree, setGroupTree, expandAll, expandedNodes.size]);

  const handleExpandAll = () => {
    expandAll();
  };

  const handleCollapseAll = () => {
    useGroupStore.setState({ expandedNodes: new Set() });
  };

  return (
    <aside className="topology-sidebar topology-group-sidebar">
      <div className="topology-sidebar-header">
        <h3>그룹</h3>
        <div className="topology-sidebar-actions">
          <button
            className="topology-sidebar-btn"
            onClick={handleExpandAll}
            title="모두 펼치기"
          >
            <i className="bi bi-arrows-expand"></i>
          </button>
          <button
            className="topology-sidebar-btn"
            onClick={handleCollapseAll}
            title="모두 접기"
          >
            <i className="bi bi-arrows-collapse"></i>
          </button>
        </div>
      </div>

      <div className="topology-sidebar-content">
        {isLoading ? (
          <div className="topology-loading-state">
            <i className="bi bi-arrow-repeat spinning"></i>
            <span>로딩 중...</span>
          </div>
        ) : error ? (
          <div className="topology-error-state">
            <i className="bi bi-exclamation-triangle"></i>
            <span>불러올 수 없습니다.</span>
          </div>
        ) : groupTree && groupTree.length > 0 ? (
          <ul className="topology-tree">
            {groupTree
              .filter(g => g.GROUP_NAME !== '미등록 장비')
              .sort((a, b) => a.GROUP_NAME.localeCompare(b.GROUP_NAME))
              .map((group) => (
                <GroupNode
                  key={group.GROUP_ID}
                  group={group}
                  depth={0}
                  isEditMode={isEditMode}
                  onGroupSelect={onGroupSelect}
                />
              ))}
          </ul>
        ) : (
          <div className="topology-empty-state">
            <i className="bi bi-folder-x"></i>
            <span>그룹 없음</span>
          </div>
        )}
      </div>
    </aside>
  );
}

// 장비 리스트 사이드바 컴포넌트

export default GroupSidebar;
