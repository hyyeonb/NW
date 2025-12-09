import { useState, useEffect, useCallback, useMemo } from 'react';
import GroupTree from '../components/GroupTree';
import IconSelectorModal from '../components/IconSelectorModal';
import { useGroupStore } from '../stores';
import {
  useCreateGroup,
  useUpdateGroup,
  useDeleteGroup,
  useMoveGroup,
  useDescendantsCount,
  useGroupTree,
} from '../hooks';
import { groupsApi } from '../api';

export default function GroupManagement() {
  const { selectedGroup, setSelectedGroup, iconModalGroup, showIconModal, selectGroupById } = useGroupStore();

  // 그룹 트리 데이터
  const { data: groupTree, isLoading: isTreeLoading } = useGroupTree();

  // 첫 그룹 등록 모달 상태
  const [showFirstGroupModal, setShowFirstGroupModal] = useState(false);
  const [firstGroupForm, setFirstGroupForm] = useState({ GROUP_NAME: '', ADDRESS: '', PHONE: '' });

  // 뷰 상태
  const [viewMode, setViewMode] = useState('info'); // 'info' | 'edit' | 'add'
  const [parentIdForAdd, setParentIdForAdd] = useState(null);

  // 폼 데이터
  const [formData, setFormData] = useState({
    GROUP_NAME: '',
    ADDRESS: '',
    PHONE: '',
  });

  // 하위 그룹 페이지네이션
  const [allChildGroups, setAllChildGroups] = useState([]);
  const [childGroupsCurrentPage, setChildGroupsCurrentPage] = useState(1);
  const [childGroupsItemsPerPage, setChildGroupsItemsPerPage] = useState(10);

  // 하위 그룹 테이블 정렬 상태 (기본: GROUP_ID 오름차순)
  const [groupSortField, setGroupSortField] = useState('GROUP_ID');
  const [groupSortOrder, setGroupSortOrder] = useState('asc');

  // Mutations
  const createGroupMutation = useCreateGroup();
  const updateGroupMutation = useUpdateGroup();
  const deleteGroupMutation = useDeleteGroup();
  const moveGroupMutation = useMoveGroup();

  // 선택된 그룹의 하위 그룹 개수
  const { data: descendantsCount } = useDescendantsCount(selectedGroup?.GROUP_ID);

  // 모든 하위 그룹 수집 (재귀)
  const getAllChildren = useCallback((group) => {
    let result = [];
    if (group.children && group.children.length > 0) {
      group.children.forEach((child) => {
        result.push(child);
        result = result.concat(getAllChildren(child));
      });
    }
    return result;
  }, []);

  // selectedGroup 변경 시 처리
  useEffect(() => {
    if (selectedGroup) {
      setViewMode('info');
      const children = getAllChildren(selectedGroup);
      setAllChildGroups(children);
      setChildGroupsCurrentPage(1);
    } else {
      setAllChildGroups([]);
    }
  }, [selectedGroup, getAllChildren]);

  // 그룹이 없으면 첫 그룹 등록 모달 표시
  useEffect(() => {
    if (!isTreeLoading && groupTree && groupTree.length === 0) {
      setShowFirstGroupModal(true);
    }
  }, [groupTree, isTreeLoading]);

  // 첫 그룹 등록 핸들러
  const handleFirstGroupSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await createGroupMutation.mutateAsync({
        GROUP_NAME: firstGroupForm.GROUP_NAME,
        ADDRESS: firstGroupForm.ADDRESS,
        PHONE: firstGroupForm.PHONE,
        PARENT_GROUP_ID: null,
      });
      setShowFirstGroupModal(false);
      setFirstGroupForm({ GROUP_NAME: '', ADDRESS: '', PHONE: '' });

      // 트리 새로고침
      if (window.reloadGroupTree) {
        await window.reloadGroupTree();
      }

      // 새로 생성된 그룹 선택
      const newGroupId = response.data?.data?.GROUP_ID;
      if (newGroupId) {
        selectGroupById(newGroupId);
      }
    } catch (error) {
      console.error('그룹 생성 오류:', error);
      alert('그룹 생성에 실패했습니다: ' + error.message);
    }
  };

  // 하위 그룹 정렬 로직
  const sortedChildGroups = useMemo(() => {
    if (!allChildGroups.length) return [];
    return [...allChildGroups].sort((a, b) => {
      let aVal = a[groupSortField];
      let bVal = b[groupSortField];

      // null/undefined 처리
      if (aVal == null) aVal = '';
      if (bVal == null) bVal = '';

      // 숫자 타입 처리 (GROUP_ID)
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return groupSortOrder === 'asc' ? aVal - bVal : bVal - aVal;
      }

      // 날짜 처리 (CREATE_AT)
      if (groupSortField === 'CREATE_AT') {
        const dateA = new Date(aVal);
        const dateB = new Date(bVal);
        return groupSortOrder === 'asc' ? dateA - dateB : dateB - dateA;
      }

      // 문자열 비교
      const strA = String(aVal).toLowerCase();
      const strB = String(bVal).toLowerCase();
      if (groupSortOrder === 'asc') {
        return strA.localeCompare(strB, 'ko');
      }
      return strB.localeCompare(strA, 'ko');
    });
  }, [allChildGroups, groupSortField, groupSortOrder]);

  // 페이지네이션 계산
  const totalPages = useMemo(
    () => Math.ceil(sortedChildGroups.length / childGroupsItemsPerPage),
    [sortedChildGroups.length, childGroupsItemsPerPage]
  );

  const pagedChildGroups = useMemo(() => {
    const startIndex = (childGroupsCurrentPage - 1) * childGroupsItemsPerPage;
    const endIndex = startIndex + childGroupsItemsPerPage;
    return sortedChildGroups.slice(startIndex, endIndex);
  }, [sortedChildGroups, childGroupsCurrentPage, childGroupsItemsPerPage]);

  // 하위 그룹 테이블 정렬 핸들러
  const handleGroupSort = (field) => {
    if (groupSortField === field) {
      setGroupSortOrder(groupSortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setGroupSortField(field);
      setGroupSortOrder('asc');
    }
  };

  // 정렬 아이콘 렌더링 함수
  const renderSortIcon = (field) => {
    if (groupSortField !== field) {
      return <i className="bi bi-chevron-expand sort-icon inactive"></i>;
    }
    return groupSortOrder === 'asc'
      ? <i className="bi bi-chevron-up sort-icon active"></i>
      : <i className="bi bi-chevron-down sort-icon active"></i>;
  };

  // 하위 그룹 테이블 행 클릭
  const handleChildGroupClick = (groupId) => {
    selectGroupById(groupId);
  };

  // 페이지네이션 컨트롤
  const handlePrevPage = () => {
    if (childGroupsCurrentPage > 1) {
      setChildGroupsCurrentPage((prev) => prev - 1);
    }
  };

  const handleNextPage = () => {
    if (childGroupsCurrentPage < totalPages) {
      setChildGroupsCurrentPage((prev) => prev + 1);
    }
  };

  const handleItemsPerPageChange = (e) => {
    setChildGroupsItemsPerPage(parseInt(e.target.value));
    setChildGroupsCurrentPage(1);
  };

  // 수정 폼 표시 (컨텍스트 메뉴에서 호출)
  const handleEditGroup = (group) => {
    if (!group) return;
    setFormData({
      GROUP_NAME: group.GROUP_NAME || '',
      ADDRESS: group.ADDRESS || '',
      PHONE: group.PHONE || '',
    });
    setViewMode('edit');
  };

  // 추가 폼 표시 (컨텍스트 메뉴에서 호출)
  const handleAddGroup = (parentId) => {
    setParentIdForAdd(parentId);
    setFormData({ GROUP_NAME: '', ADDRESS: '', PHONE: '' });
    setViewMode('add');
  };

  // 그룹 삭제 (컨텍스트 메뉴에서 호출)
  const handleDeleteGroup = async (group) => {
    if (!group) return;

    try {
      // 하위 그룹 개수 확인
      const countResponse = await groupsApi.getDescendantsCount(group.GROUP_ID);
      const childCount = countResponse.data?.data || 0;

      let message = '';
      if (childCount > 0) {
        // 하위 그룹 목록 조회
        const descendantsResponse = await groupsApi.getChildGroups(group.GROUP_ID);
        const descendants = descendantsResponse.data?.data || [];
        const descendantNames = descendants.map((g) => `• ${g.GROUP_NAME}`).join('\n');

        message = `"${group.GROUP_NAME}" 그룹과 하위 ${childCount}개의 그룹이 모두 삭제됩니다.\n\n삭제될 하위 그룹:\n${descendantNames}\n\n이 작업은 되돌릴 수 없습니다. 정말 삭제하시겠습니까?`;
      } else {
        message = `"${group.GROUP_NAME}" 그룹을 삭제합니다.\n\n이 작업은 되돌릴 수 없습니다. 정말 삭제하시겠습니까?`;
      }

      if (!confirm(message)) return;

      await deleteGroupMutation.mutateAsync(group.GROUP_ID);
      alert('그룹이 성공적으로 삭제되었습니다.');
      setViewMode('info');
      setSelectedGroup(null);

      // 트리 새로고침
      if (window.reloadGroupTree) {
        window.reloadGroupTree();
      }
    } catch (error) {
      console.error('그룹 삭제 오류:', error);
      alert('그룹 삭제에 실패했습니다: ' + error.message);
    }
  };

  // 아이콘 설정 (컨텍스트 메뉴에서 호출)
  const handleSetIcon = (group) => {
    showIconModal(group);
  };

  // 그룹 이동 (드래그 앤 드롭)
  const handleMoveGroup = async (draggedGroupId, targetGroupId) => {
    try {
      // 이동할 그룹의 하위 그룹 개수 확인
      const countResponse = await groupsApi.getDescendantsCount(draggedGroupId);
      const childCount = countResponse.data?.data || 0;

      // 이동할 그룹 정보 가져오기
      const groupResponse = await groupsApi.getGroup(draggedGroupId);
      const group = groupResponse.data?.data;

      // 대상 그룹 정보 가져오기
      let targetGroupName = '최상위';
      if (targetGroupId) {
        const targetResponse = await groupsApi.getGroup(targetGroupId);
        targetGroupName = targetResponse.data?.data?.GROUP_NAME || '최상위';
      }

      // 이동 확인 모달
      let message = `"${group.GROUP_NAME}" 그룹을 "${targetGroupName}"(으)로 이동합니다.`;
      if (childCount > 0) {
        message += `\n\n하위 ${childCount}개의 그룹도 함께 이동됩니다.`;
      }

      if (!confirm(message)) {
        // 드래그 취소 시 트리 복원
        if (window.reloadGroupTree) {
          window.reloadGroupTree();
        }
        return;
      }

      await moveGroupMutation.mutateAsync({ groupId: draggedGroupId, parentGroupId: targetGroupId });
      alert('그룹이 성공적으로 이동되었습니다.');

      // 트리 새로고침
      if (window.reloadGroupTree) {
        window.reloadGroupTree();
      }
    } catch (error) {
      console.error('그룹 이동 오류:', error);
      alert('그룹 이동에 실패했습니다: ' + error.message);
      // 실패 시에도 트리 재정렬
      if (window.reloadGroupTree) {
        window.reloadGroupTree();
      }
    }
  };

  // 수정 폼 제출
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!selectedGroup) return;

    try {
      await updateGroupMutation.mutateAsync({
        groupId: selectedGroup.GROUP_ID,
        data: {
          GROUP_NAME: formData.GROUP_NAME,
          ADDRESS: formData.ADDRESS,
          PHONE: formData.PHONE,
        },
      });
      alert('그룹이 성공적으로 수정되었습니다.');

      // 트리 새로고침 후 해당 그룹 다시 선택
      if (window.reloadGroupTree) {
        await window.reloadGroupTree();
      }
      selectGroupById(selectedGroup.GROUP_ID);
      setViewMode('info');
    } catch (error) {
      console.error('그룹 저장 오류:', error);
      alert('그룹 저장에 실패했습니다: ' + error.message);
    }
  };

  // 추가 폼 제출
  const handleAddSubmit = async (e) => {
    e.preventDefault();

    try {
      const response = await createGroupMutation.mutateAsync({
        GROUP_NAME: formData.GROUP_NAME,
        ADDRESS: formData.ADDRESS,
        PHONE: formData.PHONE,
        PARENT_GROUP_ID: parentIdForAdd,
      });

      alert('그룹이 성공적으로 추가되었습니다.');

      // 트리 새로고침
      if (window.reloadGroupTree) {
        await window.reloadGroupTree();
      }

      // 새로 생성된 그룹 선택
      const newGroupId = response.data?.data?.GROUP_ID;
      if (newGroupId) {
        selectGroupById(newGroupId);
      }
      setViewMode('info');
    } catch (error) {
      console.error('그룹 추가 오류:', error);
      alert('그룹 추가에 실패했습니다: ' + error.message);
    }
  };

  // 취소 버튼
  const handleCancel = () => {
    if (selectedGroup) {
      setViewMode('info');
    } else {
      setViewMode('info');
    }
  };

  // 날짜 포맷
  const formatDate = (dateString) => {
    if (!dateString) return '-';
    try {
      return new Date(dateString).toLocaleDateString('ko-KR');
    } catch {
      return '-';
    }
  };

  return (
    <div className="page-container">
      <GroupTree
        onEditGroup={handleEditGroup}
        onAddGroup={handleAddGroup}
        onDeleteGroup={handleDeleteGroup}
        onSetIcon={handleSetIcon}
        onMoveGroup={handleMoveGroup}
      />

      <main className="page-main-content">
        <h2 id="form-title">
          {viewMode === 'edit'
            ? '그룹 수정'
            : viewMode === 'add'
            ? parentIdForAdd
              ? '하위 그룹 추가'
              : '그룹 추가'
            : '그룹 정보'}
        </h2>

        {/* 웰컴 메시지 - 선택된 그룹이 없을 때 */}
        {!selectedGroup && viewMode === 'info' && (
          <p id="welcome-message">그룹을 선택하여 정보를 확인하세요.</p>
        )}

        {/* 그룹 정보 표시 */}
        {selectedGroup && viewMode === 'info' && (
          <div id="group-info" className="group-info" style={{ display: 'block' }}>
            <h3 style={{ color: '#ffffff', fontSize: '18px', marginBottom: '15px' }}>
              그룹 상세 정보
            </h3>
            <div className="info-inline">
              <span className="info-item-inline">
                <span className="info-label-inline">그룹명</span>
                <span id="group-name-display" className="info-value-inline">
                  {selectedGroup.GROUP_NAME}
                </span>
              </span>
              <span className="info-divider">|</span>
              <span className="info-item-inline">
                <span className="info-label-inline">주소</span>
                <span id="group-address-display" className="info-value-inline">
                  {selectedGroup.ADDRESS || '-'}
                </span>
              </span>
              <span className="info-divider">|</span>
              <span className="info-item-inline">
                <span className="info-label-inline">연락처</span>
                <span id="group-phone-display" className="info-value-inline">
                  {selectedGroup.PHONE || '-'}
                </span>
              </span>
            </div>

            {/* 하위 그룹 테이블 */}
            <div id="child-groups-section" style={{ marginTop: '30px' }}>
              <h3 style={{ color: '#ffffff', fontSize: '18px', marginBottom: '15px' }}>
                하위 그룹 목록
              </h3>
              <div className="table-wrapper">
                <table id="child-groups-table" className="child-groups-table">
                  <thead>
                    <tr>
                      <th className="sortable" onClick={() => handleGroupSort('GROUP_NAME')}>
                        그룹 이름 {renderSortIcon('GROUP_NAME')}
                      </th>
                      <th className="sortable" onClick={() => handleGroupSort('ADDRESS')}>
                        주소 {renderSortIcon('ADDRESS')}
                      </th>
                      <th className="sortable" onClick={() => handleGroupSort('PHONE')}>
                        전화번호 {renderSortIcon('PHONE')}
                      </th>
                      <th className="sortable" onClick={() => handleGroupSort('CREATE_AT')}>
                        등록일자 {renderSortIcon('CREATE_AT')}
                      </th>
                    </tr>
                  </thead>
                  <tbody id="child-groups-tbody">
                    {pagedChildGroups.length === 0 ? (
                      <tr>
                        <td colSpan="4" className="no-children-message">
                          하위 그룹이 없습니다.
                        </td>
                      </tr>
                    ) : (
                      pagedChildGroups.map((child) => (
                        <tr
                          key={child.GROUP_ID}
                          style={{ cursor: 'pointer' }}
                          data-group-id={child.GROUP_ID}
                          onClick={() => handleChildGroupClick(child.GROUP_ID)}
                        >
                          <td>{child.GROUP_NAME}</td>
                          <td>{child.ADDRESS || '-'}</td>
                          <td>{child.PHONE || '-'}</td>
                          <td>{formatDate(child.CREATE_AT)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* 페이지네이션 컨트롤 */}
              <div className="pagination-controls">
                <div className="items-per-page">
                  <label htmlFor="child-groups-items-per-page">개수:</label>
                  <select
                    id="child-groups-items-per-page"
                    value={childGroupsItemsPerPage}
                    onChange={handleItemsPerPageChange}
                  >
                    <option value="10">10</option>
                    <option value="20">20</option>
                    <option value="50">50</option>
                  </select>
                </div>
                <div id="child-groups-pagination" className="pagination">
                  {totalPages > 1 && (
                    <>
                      <button onClick={handlePrevPage} disabled={childGroupsCurrentPage === 1}>
                        이전
                      </button>
                      <span>
                        {childGroupsCurrentPage} / {totalPages}
                      </span>
                      <button
                        onClick={handleNextPage}
                        disabled={childGroupsCurrentPage === totalPages}
                      >
                        다음
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 수정 폼 */}
        {viewMode === 'edit' && (
          <form
            id="group-edit-form"
            className="group-form"
            style={{ display: 'block' }}
            onSubmit={handleEditSubmit}
          >
            <input type="hidden" id="group-id-input" value={selectedGroup?.GROUP_ID || ''} />
            <div>
              <label htmlFor="group-name-input">그룹 이름:</label>
              <input
                type="text"
                id="group-name-input"
                className="form-input"
                placeholder="그룹 이름을 입력하세요"
                value={formData.GROUP_NAME}
                onChange={(e) => setFormData({ ...formData, GROUP_NAME: e.target.value })}
                required
              />
            </div>
            <div>
              <label htmlFor="group-address-input">주소:</label>
              <input
                type="text"
                id="group-address-input"
                className="form-input"
                placeholder="주소를 입력하세요"
                value={formData.ADDRESS}
                onChange={(e) => setFormData({ ...formData, ADDRESS: e.target.value })}
              />
            </div>
            <div>
              <label htmlFor="group-phone-input">연락처:</label>
              <input
                type="text"
                id="group-phone-input"
                className="form-input"
                placeholder="연락처를 입력하세요"
                value={formData.PHONE}
                onChange={(e) => setFormData({ ...formData, PHONE: e.target.value })}
              />
            </div>
            <div className="form-actions">
              <button
                type="submit"
                className="btn btn-primary"
                disabled={updateGroupMutation.isPending}
              >
                저장
              </button>
              <button type="button" id="cancel-edit-btn" className="btn btn-secondary" onClick={handleCancel}>
                취소
              </button>
            </div>
          </form>
        )}

        {/* 추가 폼 */}
        {viewMode === 'add' && (
          <form
            id="group-add-form"
            className="group-form"
            style={{ display: 'block' }}
            onSubmit={handleAddSubmit}
          >
            <input type="hidden" id="parent-id-input" value={parentIdForAdd || ''} />
            <div>
              <label htmlFor="group-name-add-input">그룹 이름:</label>
              <input
                type="text"
                id="group-name-add-input"
                className="form-input"
                placeholder="그룹 이름을 입력하세요"
                value={formData.GROUP_NAME}
                onChange={(e) => setFormData({ ...formData, GROUP_NAME: e.target.value })}
                required
                autoFocus
              />
            </div>
            <div>
              <label htmlFor="group-address-add-input">주소:</label>
              <input
                type="text"
                id="group-address-add-input"
                className="form-input"
                placeholder="주소를 입력하세요"
                value={formData.ADDRESS}
                onChange={(e) => setFormData({ ...formData, ADDRESS: e.target.value })}
              />
            </div>
            <div>
              <label htmlFor="group-phone-add-input">연락처:</label>
              <input
                type="text"
                id="group-phone-add-input"
                className="form-input"
                placeholder="연락처를 입력하세요"
                value={formData.PHONE}
                onChange={(e) => setFormData({ ...formData, PHONE: e.target.value })}
              />
            </div>
            <div className="form-actions">
              <button
                type="submit"
                className="btn btn-primary"
                disabled={createGroupMutation.isPending}
              >
                추가
              </button>
              <button type="button" id="cancel-add-btn" className="btn btn-secondary" onClick={handleCancel}>
                취소
              </button>
            </div>
          </form>
        )}
      </main>

      {/* 아이콘 선택 모달 */}
      {iconModalGroup && <IconSelectorModal />}

      {/* 첫 그룹 등록 모달 */}
      {showFirstGroupModal && (
        <div className="modal" style={{ display: 'flex' }}>
          <div className="modal-content first-group-modal">
            <h3 className="modal-title">
              <i className="bi bi-folder-plus"></i> 첫 번째 그룹 등록
            </h3>
            <p style={{ color: '#94a3b8', marginBottom: '20px', fontSize: '14px' }}>
              등록된 그룹이 없습니다. 첫 번째 그룹을 등록해주세요.
            </p>
            <form onSubmit={handleFirstGroupSubmit}>
              <div className="form-group">
                <label>그룹명 *</label>
                <input
                  type="text"
                  value={firstGroupForm.GROUP_NAME}
                  onChange={(e) => setFirstGroupForm({ ...firstGroupForm, GROUP_NAME: e.target.value })}
                  placeholder="그룹명을 입력하세요"
                  required
                  autoFocus
                />
              </div>
              <div className="form-group">
                <label>주소</label>
                <input
                  type="text"
                  value={firstGroupForm.ADDRESS}
                  onChange={(e) => setFirstGroupForm({ ...firstGroupForm, ADDRESS: e.target.value })}
                  placeholder="주소를 입력하세요"
                />
              </div>
              <div className="form-group">
                <label>연락처</label>
                <input
                  type="text"
                  value={firstGroupForm.PHONE}
                  onChange={(e) => setFirstGroupForm({ ...firstGroupForm, PHONE: e.target.value })}
                  placeholder="연락처를 입력하세요"
                />
              </div>
              <div className="modal-footer">
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={createGroupMutation.isPending}
                >
                  등록
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
