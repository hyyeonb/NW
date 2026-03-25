import React, { useState, useMemo } from 'react';
import {
  useAdminUsers,
  useAdminUserDetail,
  useAdminPages,
  useUpdatePageAccess,
  useUpdateGroupAccess,
  useUpdateUserStatus,
  useUpdateAllGroupView,
  useReviewUser,
  useCopyPermissions,
} from '../hooks/useAdmin';
import { useGroupTree } from '../hooks/useGroups';
import { useWatchGroups } from '../hooks/useWatch';
import '../styles/SystemAdmin.css';

const PAGE_GROUPS = [
  { key: 'dashboard', label: '대시보드', icon: 'bi-speedometer2' },
  { key: 'perf', label: '성능감시', icon: 'bi-activity' },
  { key: 'fault', label: '장애감시', icon: 'bi-exclamation-triangle' },
  { key: 'mgmt', label: '종합분석', icon: 'bi-gear' },
  { key: 'history', label: '이력 관리', icon: 'bi-clock-history' },
  { key: 'tools', label: '네트워크 도구', icon: 'bi-tools' },
  { key: 'board', label: '게시판', icon: 'bi-clipboard2-data' },
  { key: 'system', label: '시스템', icon: 'bi-shield-lock' },
];

// 그룹 트리를 플랫 리스트로 변환 (트리 라인 정보 포함)
function flattenGroups(groups, depth = 0, parentLines = []) {
  const result = [];
  if (!groups) return result;
  for (let i = 0; i < groups.length; i++) {
    const g = groups[i];
    const isLast = i === groups.length - 1;
    const hasChildren = g.children?.length > 0;
    const lines = [...parentLines]; // 부모 레벨별 세로선 표시 여부
    result.push({ ...g, depth, isLast, hasChildren, lines });
    if (hasChildren) {
      // 다음 레벨로: 현재가 마지막이면 세로선 끊기, 아니면 계속
      result.push(...flattenGroups(g.children, depth + 1, [...lines, !isLast]));
    }
  }
  return result;
}

// 그룹 아이콘 (GroupTree.jsx와 동일한 방식)
function GroupIcon({ iconName, defaultIcon }) {
  if (iconName) {
    if (iconName.startsWith('fa-')) return <i className={`fa-solid ${iconName} sa-tree-icon sa-tree-icon-custom`}></i>;
    if (iconName.startsWith('bi-')) return <i className={`bi ${iconName} sa-tree-icon sa-tree-icon-custom`}></i>;
    return <span className={`material-icons sa-tree-icon sa-tree-icon-custom`}>{iconName}</span>;
  }
  return <i className={`bi ${defaultIcon || 'bi-folder2'} sa-tree-icon`}></i>;
}

// 트리 라인 렌더링 컴포넌트
function TreeIndent({ depth, isLast, lines }) {
  if (depth === 0) return null;
  const segments = [];
  // 부모 레벨 세로선
  for (let i = 0; i < depth - 1; i++) {
    segments.push(
      <span key={`line-${i}`} className="sa-tree-line">
        {lines[i] ? '│' : ' '}
      </span>
    );
  }
  // 현재 레벨 분기선
  segments.push(
    <span key="branch" className="sa-tree-branch">
      {isLast ? '└' : '├'}
    </span>
  );
  return <span className="sa-tree-indent">{segments}</span>;
}

export default function SystemAdmin() {
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTab, setFilterTab] = useState('all');
  const [permTab, setPermTab] = useState('page'); // 'page' | 'group'
  const [collapsedGroups, setCollapsedGroups] = useState({});

  const { data: users = [], isLoading: usersLoading } = useAdminUsers();
  const { data: userDetail, isLoading: detailLoading } = useAdminUserDetail(selectedUserId);
  const { data: pages = [] } = useAdminPages();
  const { data: assetGroups = [] } = useGroupTree();
  const { data: watchGroups = [] } = useWatchGroups();

  const updatePageAccess = useUpdatePageAccess();
  const updateGroupAccess = useUpdateGroupAccess();
  const updateUserStatus = useUpdateUserStatus();
  const updateAllGroupView = useUpdateAllGroupView();
  const reviewUser = useReviewUser();
  const copyPermissions = useCopyPermissions();

  const [editingPageAccess, setEditingPageAccess] = useState(null);
  const [editingGroupAccess, setEditingGroupAccess] = useState(null);
  const [copySourceId, setCopySourceId] = useState('');

  const handleSelectUser = (userId) => {
    setSelectedUserId(userId);
    setEditingPageAccess(null);
    setEditingGroupAccess(null);
  };

  // ─── 페이지 권한 ───
  const currentPageAccess = useMemo(() => {
    if (editingPageAccess) return editingPageAccess;
    if (!userDetail?.permissions?.pageAccess) return [];
    return userDetail.permissions.pageAccess;
  }, [editingPageAccess, userDetail]);

  const groupedPageAccess = useMemo(() => {
    const map = {};
    currentPageAccess.forEach((pa) => {
      const group = pa.PAGE_GROUP || 'etc';
      if (!map[group]) map[group] = [];
      map[group].push(pa);
    });
    return PAGE_GROUPS
      .filter((g) => map[g.key]?.length > 0)
      .map((g) => ({ ...g, pages: map[g.key] }));
  }, [currentPageAccess]);

  const toggleGroupCollapse = (groupKey) => {
    setCollapsedGroups((prev) => ({ ...prev, [groupKey]: !prev[groupKey] }));
  };

  const handleGroupToggle = (groupKey, field) => {
    const current = editingPageAccess || [...currentPageAccess];
    const groupPages = current.filter((pa) => pa.PAGE_GROUP === groupKey);
    const allOn = groupPages.every((pa) => pa[field]);
    const updated = current.map((pa) =>
      pa.PAGE_GROUP === groupKey ? { ...pa, [field]: !allOn } : pa
    );
    setEditingPageAccess(updated);
  };

  const getGroupStatus = (groupKey, field) => {
    const groupPages = currentPageAccess.filter((pa) => pa.PAGE_GROUP === groupKey);
    const onCount = groupPages.filter((pa) => pa[field]).length;
    if (onCount === groupPages.length) return 'all';
    if (onCount > 0) return 'some';
    return 'none';
  };

  // system_admin은 VIEW/EDIT 연동 (둘 다 함께 ON/OFF)
  const LINKED_PAGES = ['system_admin'];

  const handleToggleAccess = (pageCode, field) => {
    const current = editingPageAccess || [...currentPageAccess];
    const updated = current.map((pa) => {
      if (pa.PAGE_CODE !== pageCode) return pa;
      const newValue = !pa[field];
      if (LINKED_PAGES.includes(pageCode)) {
        return { ...pa, CAN_VIEW: newValue, CAN_EDIT: newValue };
      }
      return { ...pa, [field]: newValue };
    });
    setEditingPageAccess(updated);
  };

  const handleSavePageAccess = () => {
    if (!selectedUserId || !editingPageAccess) return;
    updatePageAccess.mutate(
      { userId: selectedUserId, accessList: editingPageAccess },
      { onSuccess: () => setEditingPageAccess(null) }
    );
  };

  // ─── 그룹 권한 ───
  const flatAssetGroups = useMemo(() => flattenGroups(assetGroups), [assetGroups]);
  const flatWatchGroups = useMemo(() => {
    if (!watchGroups) return [];
    // useWatchGroups는 camelCase 트리 구조 반환
    // flatten 후 통일된 형식으로 변환
    const flatten = (groups, depth = 0) => {
      const result = [];
      for (const g of groups) {
        result.push({
          GROUP_ID: g.watchGroupId || g.WATCH_GROUP_ID,
          GROUP_NAME: g.groupName || g.GROUP_NAME,
          ICON_NAME: g.iconName || g.ICON_NAME || null,
          DEPTH: depth,
        });
        if (g.children?.length > 0) {
          result.push(...flatten(g.children, depth + 1));
        }
      }
      return result;
    };
    return flatten(watchGroups);
  }, [watchGroups]);

  // 현재 그룹 권한 (편집중이면 편집 상태, 아니면 서버 데이터)
  const currentGroupAccess = useMemo(() => {
    if (editingGroupAccess) return editingGroupAccess;
    if (!userDetail?.permissions?.groupAccess) return [];
    return userDetail.permissions.groupAccess;
  }, [editingGroupAccess, userDetail]);

  // 특정 그룹의 권한 찾기
  const getGrpAccess = (groupType, groupId) => {
    return currentGroupAccess.find(
      (ga) => ga.GROUP_TYPE === groupType && ga.GROUP_ID === groupId
    ) || { CAN_VIEW: false, CAN_EDIT: false };
  };

  const handleToggleGroupAccess = (groupType, groupId, field) => {
    const current = editingGroupAccess || [...currentGroupAccess];
    const idx = current.findIndex(
      (ga) => ga.GROUP_TYPE === groupType && ga.GROUP_ID === groupId
    );

    if (idx >= 0) {
      const updated = [...current];
      updated[idx] = { ...updated[idx], [field]: !updated[idx][field] };
      setEditingGroupAccess(updated);
    } else {
      // 새 항목 추가
      setEditingGroupAccess([
        ...current,
        { GROUP_TYPE: groupType, GROUP_ID: groupId, CAN_VIEW: field === 'CAN_VIEW', CAN_EDIT: field === 'CAN_EDIT' },
      ]);
    }
  };

  // 그룹 타입별 전체 토글
  const handleToggleAllGroups = (groupType, groups, field) => {
    const current = editingGroupAccess || [...currentGroupAccess];
    const typeGroups = groups.map((g) => g.GROUP_ID);
    const allOn = typeGroups.every((gid) => {
      const ga = current.find((a) => a.GROUP_TYPE === groupType && a.GROUP_ID === gid);
      return ga && ga[field];
    });

    let updated = current.filter((a) => a.GROUP_TYPE !== groupType || !typeGroups.includes(a.GROUP_ID));
    for (const gid of typeGroups) {
      const existing = current.find((a) => a.GROUP_TYPE === groupType && a.GROUP_ID === gid);
      updated.push({
        GROUP_TYPE: groupType,
        GROUP_ID: gid,
        CAN_VIEW: field === 'CAN_VIEW' ? !allOn : (existing?.CAN_VIEW || false),
        CAN_EDIT: field === 'CAN_EDIT' ? !allOn : (existing?.CAN_EDIT || false),
      });
    }
    setEditingGroupAccess(updated);
  };

  const getGroupTypeStatus = (groupType, groups, field) => {
    const onCount = groups.filter((g) => {
      const ga = currentGroupAccess.find(
        (a) => a.GROUP_TYPE === groupType && a.GROUP_ID === g.GROUP_ID
      );
      return ga && ga[field];
    }).length;
    if (onCount === groups.length) return 'all';
    if (onCount > 0) return 'some';
    return 'none';
  };

  const handleSaveGroupAccess = () => {
    if (!selectedUserId || !editingGroupAccess) return;
    updateGroupAccess.mutate(
      { userId: selectedUserId, accessList: editingGroupAccess },
      { onSuccess: () => setEditingGroupAccess(null) }
    );
  };

  // ─── 공통 ───
  const filteredUsers = useMemo(() => {
    let list = users;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      list = list.filter(
        (u) =>
          u.NAME?.toLowerCase().includes(term) ||
          u.EMAIL?.toLowerCase().includes(term) ||
          u.LOGIN_ID?.toLowerCase().includes(term)
      );
    }
    if (filterTab === 'new') {
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      list = list.filter((u) => u.CREATED_AT && new Date(u.CREATED_AT) > weekAgo);
    } else if (filterTab === 'unreviewed') {
      list = list.filter((u) => !u.REVIEWED_AT);
    }
    return list;
  }, [users, searchTerm, filterTab]);

  const handleStatusChange = (status) => {
    if (!selectedUserId) return;
    updateUserStatus.mutate({ userId: selectedUserId, status });
  };

  const handleAllGroupViewToggle = () => {
    if (!selectedUserId || !userDetail) return;
    const currentValue = userDetail.permissions?.allGroupView !== false;
    updateAllGroupView.mutate({ userId: selectedUserId, allGroupView: !currentValue });
  };

  const handleReview = () => {
    if (!selectedUserId) return;
    reviewUser.mutate(selectedUserId);
  };

  const handleCopy = () => {
    if (!selectedUserId || !copySourceId) return;
    copyPermissions.mutate(
      { userId: selectedUserId, sourceUserId: Number(copySourceId) },
      { onSuccess: () => { setCopySourceId(''); setEditingPageAccess(null); setEditingGroupAccess(null); } }
    );
  };

  const selectedUser = userDetail?.user;
  const selectedPermissions = userDetail?.permissions;
  const isEditing = permTab === 'page' ? !!editingPageAccess : !!editingGroupAccess;

  return (
    <div className="sa-page">
      <div className="sa-header">
        <h1><i className="bi bi-shield-lock"></i> 사용자 관리</h1>
        <p>사용자 계정 및 권한을 관리합니다.</p>
      </div>

      <div className="sa-layout">
        {/* 좌측: 사용자 목록 */}
        <div className="sa-user-list glass-panel">
          <div className="sa-list-top">
            <h3>사용자 목록</h3>
            <span className="sa-count">{filteredUsers.length}명</span>
          </div>

          <div className="sa-search">
            <i className="bi bi-search"></i>
            <input type="text" placeholder="이름, 이메일, 아이디 검색..."
              value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>

          <div className="sa-tabs">
            {[{ key: 'all', label: '전체' }, { key: 'new', label: '신규' }, { key: 'unreviewed', label: '미확인' }].map((tab) => (
              <button key={tab.key} className={`sa-tab ${filterTab === tab.key ? 'active' : ''}`}
                onClick={() => setFilterTab(tab.key)}>{tab.label}</button>
            ))}
          </div>

          <div className="sa-list-body">
            {usersLoading ? <div className="sa-empty">로딩 중...</div>
            : filteredUsers.length === 0 ? <div className="sa-empty">사용자가 없습니다</div>
            : filteredUsers.map((u) => (
              <div key={u.USER_ID}
                className={`sa-user-item ${selectedUserId === u.USER_ID ? 'selected' : ''}`}
                onClick={() => handleSelectUser(u.USER_ID)}>
                <div className="sa-avatar">
                  {u.PROFILE_IMAGE ? <img src={u.PROFILE_IMAGE} alt="" />
                    : <span>{u.NAME?.charAt(0) || 'U'}</span>}
                </div>
                <div className="sa-user-info">
                  <span className="sa-user-name">
                    {u.NAME || '이름 없음'}
                    {!u.REVIEWED_AT && <span className="sa-new-badge">NEW</span>}
                  </span>
                  <span className="sa-user-email">{u.EMAIL || u.LOGIN_ID || '-'}</span>
                </div>
                <div className="sa-user-badges">
                  {u.STATUS === 'SUSPENDED' && <span className="sa-badge sa-badge-suspended">정지</span>}
                  <span className={`sa-badge sa-badge-${(u.SOCIAL_TYPE || 'LOCAL').toLowerCase()}`}>
                    {u.SOCIAL_TYPE || 'LOCAL'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 우측: 상세 */}
        <div className="sa-detail">
          {!selectedUserId ? (
            <div className="sa-detail-empty glass-panel">
              <i className="bi bi-person-lines-fill"></i>
              <p>좌측에서 사용자를 선택하세요</p>
            </div>
          ) : detailLoading ? (
            <div className="sa-detail-empty glass-panel">
              <div className="login-transition-spinner" />
              <p>로딩 중...</p>
            </div>
          ) : (
            <div className="sa-detail-scroll">
              {/* 사용자 정보 */}
              <div className="sa-info-bar glass-panel">
                <div className="sa-info-row">
                  <div className="sa-info-cell">
                    <span className="sa-info-label">이름</span>
                    <span className="sa-info-value">{selectedUser?.NAME || '-'}</span>
                  </div>
                  <div className="sa-info-cell">
                    <span className="sa-info-label">아이디</span>
                    <span className="sa-info-value">{selectedUser?.LOGIN_ID || '-'}</span>
                  </div>
                  <div className="sa-info-cell">
                    <span className="sa-info-label">이메일</span>
                    <span className="sa-info-value">{selectedUser?.EMAIL || '-'}</span>
                  </div>
                  <div className="sa-info-cell">
                    <span className="sa-info-label">유형</span>
                    <span className="sa-info-value">{selectedUser?.SOCIAL_TYPE || '-'}</span>
                  </div>
                  <div className="sa-info-cell">
                    <span className="sa-info-label">가입일</span>
                    <span className="sa-info-value">
                      {selectedUser?.CREATED_AT ? new Date(selectedUser.CREATED_AT).toLocaleDateString() : '-'}
                    </span>
                  </div>
                  <div className="sa-info-actions">
                    {!selectedUser?.REVIEWED_AT && (
                      <button className="sa-btn sa-btn-primary" onClick={handleReview}>
                        <i className="bi bi-check-circle"></i> 확인
                      </button>
                    )}
                    <select value={selectedUser?.STATUS || 'ACTIVE'}
                      onChange={(e) => handleStatusChange(e.target.value)} className="sa-select">
                      <option value="ACTIVE">활성</option>
                      <option value="SUSPENDED">정지</option>
                      <option value="PENDING">대기</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* 권한 섹션 (탭) */}
              <div className="sa-perm-section glass-panel">
                <div className="sa-perm-header">
                  {/* 탭 */}
                  <div className="sa-perm-tabs">
                    <button className={`sa-perm-tab ${permTab === 'page' ? 'active' : ''}`}
                      onClick={() => setPermTab('page')}>
                      <i className="bi bi-file-earmark-lock"></i> 페이지 권한
                    </button>
                    <button className={`sa-perm-tab ${permTab === 'group' ? 'active' : ''}`}
                      onClick={() => setPermTab('group')}>
                      <i className="bi bi-diagram-3"></i> 그룹 권한
                    </button>
                  </div>

                  <div className="sa-perm-header-right">
                    {/* 그룹 탭일 때: 전체 그룹 조회 토글 */}
                    {permTab === 'group' && (
                      <>
                        <label className="sa-group-toggle">
                          <span>전체 그룹 조회</span>
                          <button
                            className={`sa-switch ${selectedPermissions?.allGroupView !== false ? 'on' : ''}`}
                            onClick={handleAllGroupViewToggle}>
                            <span className="sa-switch-thumb"></span>
                          </button>
                        </label>
                        <div className="sa-perm-divider"></div>
                      </>
                    )}

                    {/* 저장/취소 버튼 */}
                    {isEditing ? (
                      <>
                        <button className="sa-btn sa-btn-ghost"
                          onClick={() => { setEditingPageAccess(null); setEditingGroupAccess(null); }}>취소</button>
                        <button className="sa-btn sa-btn-primary"
                          onClick={permTab === 'page' ? handleSavePageAccess : handleSaveGroupAccess}
                          disabled={permTab === 'page' ? updatePageAccess.isPending : updateGroupAccess.isPending}>
                          {(permTab === 'page' ? updatePageAccess.isPending : updateGroupAccess.isPending) ? '저장 중...' : '저장'}
                        </button>
                      </>
                    ) : (
                      <div className="sa-copy-inline">
                        <select value={copySourceId} onChange={(e) => setCopySourceId(e.target.value)}
                          className="sa-select sa-select-sm">
                          <option value="">권한 복사...</option>
                          {users.filter((u) => u.USER_ID !== selectedUserId).map((u) => (
                            <option key={u.USER_ID} value={u.USER_ID}>
                              {u.NAME} ({u.LOGIN_ID || u.EMAIL || ''})
                            </option>
                          ))}
                        </select>
                        {copySourceId && (
                          <button className="sa-btn sa-btn-primary" onClick={handleCopy}
                            disabled={copyPermissions.isPending}>복사</button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* 탭 콘텐츠 */}
                <div className="sa-table-wrap">
                  {permTab === 'page' ? (
                    /* ─── 페이지 권한 탭 ─── */
                    <table className="sa-table">
                      <thead>
                        <tr>
                          <th>페이지</th>
                          <th style={{ width: 64, textAlign: 'center' }}>조회</th>
                          <th style={{ width: 64, textAlign: 'center' }}>편집</th>
                        </tr>
                      </thead>
                      <tbody>
                        {groupedPageAccess.map((group) => {
                          const collapsed = collapsedGroups[group.key];
                          const viewStatus = getGroupStatus(group.key, 'CAN_VIEW');
                          const editStatus = getGroupStatus(group.key, 'CAN_EDIT');
                          return (
                            <React.Fragment key={group.key}>
                              <tr className="sa-group-row">
                                <td onClick={() => toggleGroupCollapse(group.key)} style={{ cursor: 'pointer' }}>
                                  <i className={`bi bi-chevron-${collapsed ? 'right' : 'down'} sa-group-chevron`}></i>
                                  <i className={`bi ${group.icon}`}></i>
                                  <span>{group.label}</span>
                                  <span className="sa-group-count">{group.pages.length}</span>
                                </td>
                                <td style={{ textAlign: 'center' }}>
                                  <button className={`sa-toggle-icon ${viewStatus === 'all' ? 'on' : ''} ${viewStatus === 'some' ? 'partial' : ''}`}
                                    onClick={() => handleGroupToggle(group.key, 'CAN_VIEW')}>
                                    <i className={`bi ${viewStatus !== 'none' ? 'bi-eye-fill' : 'bi-eye-slash'}`}></i>
                                  </button>
                                </td>
                                <td style={{ textAlign: 'center' }}>
                                  <button className={`sa-toggle-icon ${editStatus === 'all' ? 'on' : ''} ${editStatus === 'some' ? 'partial' : ''}`}
                                    onClick={() => handleGroupToggle(group.key, 'CAN_EDIT')}>
                                    <i className={`bi ${editStatus !== 'none' ? 'bi-pencil-fill' : 'bi-pencil'}`}></i>
                                  </button>
                                </td>
                              </tr>
                              {!collapsed && group.pages.map((pa) => (
                                <tr key={pa.PAGE_CODE} className="sa-page-row">
                                  <td className="sa-page-name">{pa.PAGE_NAME}</td>
                                  <td style={{ textAlign: 'center' }}>
                                    <button className={`sa-toggle-icon ${pa.CAN_VIEW ? 'on' : ''}`}
                                      onClick={() => handleToggleAccess(pa.PAGE_CODE, 'CAN_VIEW')}>
                                      <i className={`bi ${pa.CAN_VIEW ? 'bi-eye-fill' : 'bi-eye-slash'}`}></i>
                                    </button>
                                  </td>
                                  <td style={{ textAlign: 'center' }}>
                                    <button className={`sa-toggle-icon ${pa.CAN_EDIT ? 'on' : ''}`}
                                      onClick={() => handleToggleAccess(pa.PAGE_CODE, 'CAN_EDIT')}>
                                      <i className={`bi ${pa.CAN_EDIT ? 'bi-pencil-fill' : 'bi-pencil'}`}></i>
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  ) : (
                    /* ─── 그룹 권한 탭 ─── */
                    <table className="sa-table">
                      <thead>
                        <tr>
                          <th>그룹</th>
                          <th style={{ width: 64, textAlign: 'center' }}>조회</th>
                          <th style={{ width: 64, textAlign: 'center' }}>편집</th>
                        </tr>
                      </thead>
                      <tbody>
                        {/* 자산 그룹 */}
                        <tr className="sa-group-row">
                          <td onClick={() => toggleGroupCollapse('asset_grp')} style={{ cursor: 'pointer' }}>
                            <i className={`bi bi-chevron-${collapsedGroups['asset_grp'] ? 'right' : 'down'} sa-group-chevron`}></i>
                            <i className="bi bi-hdd-network"></i>
                            <span>자산 그룹</span>
                            <span className="sa-group-count">{flatAssetGroups.length}</span>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <button className={`sa-toggle-icon ${getGroupTypeStatus('ASSET', flatAssetGroups, 'CAN_VIEW') === 'all' ? 'on' : ''} ${getGroupTypeStatus('ASSET', flatAssetGroups, 'CAN_VIEW') === 'some' ? 'partial' : ''}`}
                              onClick={() => handleToggleAllGroups('ASSET', flatAssetGroups, 'CAN_VIEW')}>
                              <i className={`bi ${getGroupTypeStatus('ASSET', flatAssetGroups, 'CAN_VIEW') !== 'none' ? 'bi-eye-fill' : 'bi-eye-slash'}`}></i>
                            </button>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <button className={`sa-toggle-icon ${getGroupTypeStatus('ASSET', flatAssetGroups, 'CAN_EDIT') === 'all' ? 'on' : ''} ${getGroupTypeStatus('ASSET', flatAssetGroups, 'CAN_EDIT') === 'some' ? 'partial' : ''}`}
                              onClick={() => handleToggleAllGroups('ASSET', flatAssetGroups, 'CAN_EDIT')}>
                              <i className={`bi ${getGroupTypeStatus('ASSET', flatAssetGroups, 'CAN_EDIT') !== 'none' ? 'bi-pencil-fill' : 'bi-pencil'}`}></i>
                            </button>
                          </td>
                        </tr>
                        {!collapsedGroups['asset_grp'] && flatAssetGroups.map((g) => {
                          const ga = getGrpAccess('ASSET', g.GROUP_ID);
                          return (
                            <tr key={`asset-${g.GROUP_ID}`} className={`sa-tree-row ${g.hasChildren ? 'sa-tree-parent' : ''}`}>
                              <td className="sa-tree-cell">
                                <TreeIndent depth={g.depth} isLast={g.isLast} lines={g.lines} />
                                <GroupIcon iconName={g.ICON_NAME} />
                                <span>{g.GROUP_NAME}</span>
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                <button className={`sa-toggle-icon ${ga.CAN_VIEW ? 'on' : ''}`}
                                  onClick={() => handleToggleGroupAccess('ASSET', g.GROUP_ID, 'CAN_VIEW')}>
                                  <i className={`bi ${ga.CAN_VIEW ? 'bi-eye-fill' : 'bi-eye-slash'}`}></i>
                                </button>
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                <button className={`sa-toggle-icon ${ga.CAN_EDIT ? 'on' : ''}`}
                                  onClick={() => handleToggleGroupAccess('ASSET', g.GROUP_ID, 'CAN_EDIT')}>
                                  <i className={`bi ${ga.CAN_EDIT ? 'bi-pencil-fill' : 'bi-pencil'}`}></i>
                                </button>
                              </td>
                            </tr>
                          );
                        })}

                        {/* 관제 그룹 */}
                        <tr className="sa-group-row">
                          <td onClick={() => toggleGroupCollapse('watch_grp')} style={{ cursor: 'pointer' }}>
                            <i className={`bi bi-chevron-${collapsedGroups['watch_grp'] ? 'right' : 'down'} sa-group-chevron`}></i>
                            <i className="bi bi-speedometer"></i>
                            <span>관제 그룹</span>
                            <span className="sa-group-count">{flatWatchGroups.length}</span>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <button className={`sa-toggle-icon ${getGroupTypeStatus('WATCH', flatWatchGroups, 'CAN_VIEW') === 'all' ? 'on' : ''} ${getGroupTypeStatus('WATCH', flatWatchGroups, 'CAN_VIEW') === 'some' ? 'partial' : ''}`}
                              onClick={() => handleToggleAllGroups('WATCH', flatWatchGroups, 'CAN_VIEW')}>
                              <i className={`bi ${getGroupTypeStatus('WATCH', flatWatchGroups, 'CAN_VIEW') !== 'none' ? 'bi-eye-fill' : 'bi-eye-slash'}`}></i>
                            </button>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <button className={`sa-toggle-icon ${getGroupTypeStatus('WATCH', flatWatchGroups, 'CAN_EDIT') === 'all' ? 'on' : ''} ${getGroupTypeStatus('WATCH', flatWatchGroups, 'CAN_EDIT') === 'some' ? 'partial' : ''}`}
                              onClick={() => handleToggleAllGroups('WATCH', flatWatchGroups, 'CAN_EDIT')}>
                              <i className={`bi ${getGroupTypeStatus('WATCH', flatWatchGroups, 'CAN_EDIT') !== 'none' ? 'bi-pencil-fill' : 'bi-pencil'}`}></i>
                            </button>
                          </td>
                        </tr>
                        {!collapsedGroups['watch_grp'] && flatWatchGroups.map((g, idx) => {
                          const ga = getGrpAccess('WATCH', g.GROUP_ID);
                          const isLast = idx === flatWatchGroups.length - 1;
                          return (
                            <tr key={`watch-${g.GROUP_ID}`} className="sa-tree-row">
                              <td className="sa-tree-cell">
                                <TreeIndent depth={g.DEPTH} isLast={isLast} lines={[]} />
                                <GroupIcon iconName={g.ICON_NAME} defaultIcon="bi-speedometer2" />
                                <span>{g.GROUP_NAME}</span>
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                <button className={`sa-toggle-icon ${ga.CAN_VIEW ? 'on' : ''}`}
                                  onClick={() => handleToggleGroupAccess('WATCH', g.GROUP_ID, 'CAN_VIEW')}>
                                  <i className={`bi ${ga.CAN_VIEW ? 'bi-eye-fill' : 'bi-eye-slash'}`}></i>
                                </button>
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                <button className={`sa-toggle-icon ${ga.CAN_EDIT ? 'on' : ''}`}
                                  onClick={() => handleToggleGroupAccess('WATCH', g.GROUP_ID, 'CAN_EDIT')}>
                                  <i className={`bi ${ga.CAN_EDIT ? 'bi-pencil-fill' : 'bi-pencil'}`}></i>
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
