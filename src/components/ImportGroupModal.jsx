import { useState, useMemo } from 'react';
import { useGroupTree } from '../hooks/useGroups';
import { useLinkedGroupIds, useImportFromGroups } from '../hooks/useWatch';
import { useAlert } from './CustomAlert';
import ImportGroupNode from '../features/import-group-modal/parts';


// 트리에서 모든 GROUP_ID 수집
function collectAllGroupIds(groups) {
  const ids = [];
  const collect = (list) => {
    list?.forEach(g => {
      ids.push(g.GROUP_ID);
      if (g.children) collect(g.children);
    });
  };
  collect(groups);
  return ids;
}

export default function ImportGroupModal({ isOpen, onClose }) {
  const { warning: showWarning, error: showError } = useAlert();
  const [checkedIds, setCheckedIds] = useState(new Set());

  const { data: groupTree, isLoading: treeLoading } = useGroupTree();
  const { data: linkedIds = [], isLoading: linkedLoading } = useLinkedGroupIds();
  const importMutation = useImportFromGroups();

  // 선택 가능한 (미연동) 그룹 ID 목록
  const selectableIds = useMemo(() => {
    if (!groupTree) return [];
    return collectAllGroupIds(groupTree).filter(id => !linkedIds.includes(id));
  }, [groupTree, linkedIds]);

  const handleToggle = (groupId) => {
    setCheckedIds(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    setCheckedIds(new Set(selectableIds));
  };

  const handleDeselectAll = () => {
    setCheckedIds(new Set());
  };

  const handleImport = async () => {
    if (checkedIds.size === 0) {
      showWarning('가져올 그룹을 선택해주세요.');
      return;
    }

    try {
      await importMutation.mutateAsync(Array.from(checkedIds));
      setCheckedIds(new Set());
      onClose();
    } catch (error) {
      console.error('그룹 가져오기 실패:', error);
      showError('그룹 가져오기에 실패했습니다.');
    }
  };

  if (!isOpen) return null;

  const isLoading = treeLoading || linkedLoading;

  return (
    <div className="watch-modal-overlay" onClick={onClose}>
      <div className="watch-modal import-modal" onClick={(e) => e.stopPropagation()}>
        <div className="watch-modal-header">
          <h3>
            <i className="bi bi-box-arrow-in-down"></i>
            장비 그룹 가져오기
          </h3>
          <button className="modal-close" onClick={onClose}>
            <i className="bi bi-x-lg"></i>
          </button>
        </div>

        <div className="watch-modal-body">
          <p className="import-desc">
            장비 관리에서 생성한 그룹을 관제 사이드바로 가져옵니다.
            이미 연동된 그룹은 선택할 수 없습니다.
          </p>

          <div className="import-toolbar">
            <button className="import-toolbar-btn" onClick={handleSelectAll} disabled={selectableIds.length === 0}>
              전체 선택
            </button>
            <button className="import-toolbar-btn" onClick={handleDeselectAll} disabled={checkedIds.size === 0}>
              전체 해제
            </button>
            <span className="import-toolbar-count">
              {checkedIds.size}개 선택
            </span>
          </div>

          <div className="import-tree-box">
            {isLoading ? (
              <div className="watch-loading">
                <div className="spinner"></div>
                <p>그룹 목록 로딩 중...</p>
              </div>
            ) : groupTree && groupTree.length > 0 ? (
              groupTree.map(group => (
                <ImportGroupNode
                  key={group.GROUP_ID}
                  group={group}
                  depth={0}
                  checkedIds={checkedIds}
                  linkedIds={linkedIds}
                  onToggle={handleToggle}
                />
              ))
            ) : (
              <div className="import-empty-state">
                <i className="bi bi-inbox"></i>
                <p>등록된 장비 그룹이 없습니다.</p>
              </div>
            )}
          </div>
        </div>

        <div className="watch-modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            취소
          </button>
          <button
            className="btn btn-primary"
            onClick={handleImport}
            disabled={checkedIds.size === 0 || importMutation.isPending}
          >
            {importMutation.isPending ? '가져오는 중...' : `가져오기 (${checkedIds.size})`}
          </button>
        </div>
      </div>
    </div>
  );
}
