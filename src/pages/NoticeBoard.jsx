import { useState, useCallback, useMemo, useEffect } from 'react';
import { useNoticePosts, useNoticePost, useCreateNotice, useUpdateNotice, useDeleteNotice } from '../hooks';
import { useAuthStore } from '../stores';
import { useAlertStore } from '../stores/alertStore';
import { DataTable } from '../components';
import '../styles/board.css';

// ===== 커스텀 모달 =====
const MODAL_CONFIG = {
  success: { icon: 'bi-check-circle-fill', label: '완료' },
  error:   { icon: 'bi-x-circle-fill',     label: '오류' },
  warning: { icon: 'bi-exclamation-triangle-fill', label: '알림' },
  confirm: { icon: 'bi-question-circle-fill',      label: '확인' },
};

function BoardModal({ modal, onClose, onConfirm }) {
  const config = MODAL_CONFIG[modal.type] || MODAL_CONFIG.warning;
  const isConfirm = modal.type === 'confirm';

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Enter' && !isConfirm) onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose, isConfirm]);

  return (
    <div className="board-modal-overlay" onClick={onClose}>
      <div className={`board-modal-dialog board-modal-${modal.type}`} onClick={(e) => e.stopPropagation()}>
        <div className="board-modal-icon-area">
          <div className={`board-modal-icon-circle board-modal-icon-${modal.type}`}>
            <i className={`bi ${config.icon}`}></i>
          </div>
        </div>
        <div className="board-modal-body">
          <h4 className="board-modal-title">{config.label}</h4>
          <p className="board-modal-message">{modal.message}</p>
        </div>
        <div className="board-modal-actions">
          {isConfirm ? (
            <>
              <button className="board-modal-btn board-modal-btn-cancel" onClick={onClose}>취소</button>
              <button className="board-modal-btn board-modal-btn-danger" onClick={onConfirm}>삭제</button>
            </>
          ) : (
            <button className="board-modal-btn board-modal-btn-ok" onClick={onClose}>확인</button>
          )}
        </div>
      </div>
    </div>
  );
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

export default function NoticeBoard() {
  const { user } = useAuthStore();

  // 뷰 모드: list | detail | create | edit
  const [viewMode, setViewMode] = useState('list');
  const [selectedNoticeId, setSelectedNoticeId] = useState(null);

  // 목록 상태
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [filterType, setFilterType] = useState(''); // '' | 'urgent' | 'pinned' | 'normal'

  // 폼 상태
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    isUrgent: 'N',
    isPinned: 'N',
  });

  // 모달
  const [modal, setModal] = useState(null);
  const showModal = useCallback((type, message, onConfirm) => {
    setModal({ type, message, onConfirm });
  }, []);
  const closeModal = useCallback(() => setModal(null), []);
  const handleModalConfirm = useCallback(() => {
    if (modal?.onConfirm) modal.onConfirm();
    setModal(null);
  }, [modal]);

  // 데이터 조회
  const { data: postsData, isLoading } = useNoticePosts(page, pageSize, searchKeyword);
  const { data: postDetail, isLoading: detailLoading } = useNoticePost(selectedNoticeId);

  // Mutations
  const createMutation = useCreateNotice();
  const updateMutation = useUpdateNotice();
  const deleteMutation = useDeleteNotice();
  const setUrgentNotice = useAlertStore((s) => s.setUrgentNotice);

  const allPosts = postsData?.content || [];
  const totalElements = postsData?.totalElements || 0;

  // 프론트 필터링
  const posts = useMemo(() => {
    if (!filterType) return allPosts;
    return allPosts.filter((p) => {
      if (filterType === 'urgent') return p.isUrgent === 'Y';
      if (filterType === 'pinned') return p.isPinned === 'Y';
      if (filterType === 'normal') return p.isUrgent !== 'Y' && p.isPinned !== 'Y';
      return true;
    });
  }, [allPosts, filterType]);

  // 목록 컬럼
  const columns = useMemo(() => [
    {
      key: 'noticeId',
      label: '번호',
      width: '70px',
      align: 'center',
      hideable: true,
      render: (value, row, index) => {
        if (row.isPinned === 'Y') return <i className="bi bi-pin-fill" style={{ color: '#f59e0b' }} title="상단고정"></i>;
        return (page - 1) * pageSize + index + 1;
      },
    },
    {
      key: 'title',
      label: '제목',
      render: (value, row) => (
        <span className="board-title-cell" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {row.isUrgent === 'Y' && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: '3px',
              padding: '1px 6px', borderRadius: '3px', fontSize: '10px', fontWeight: 700,
              background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)',
              flexShrink: 0,
            }}>긴급</span>
          )}
          {value}
        </span>
      ),
    },
    {
      key: 'userName',
      label: '작성자',
      width: '100px',
      align: 'center',
      hideable: true,
    },
    {
      key: 'viewCnt',
      label: '조회수',
      width: '80px',
      align: 'center',
      hideable: true,
    },
    {
      key: 'createdAt',
      label: '작성일',
      width: '120px',
      align: 'center',
      hideable: true,
      render: (value) => formatDate(value),
    },
  ], [page, pageSize]);

  // 검색
  const handleSearch = useCallback(() => {
    setSearchKeyword(searchInput.trim());
    setPage(1);
  }, [searchInput]);

  const handleSearchKeyDown = useCallback((e) => {
    if (e.key === 'Enter') handleSearch();
  }, [handleSearch]);

  const handleSearchReset = useCallback(() => {
    setSearchInput('');
    setSearchKeyword('');
    setFilterType('');
    setPage(1);
  }, []);

  // 상세보기
  const handleRowClick = useCallback((row) => {
    setSelectedNoticeId(row.noticeId);
    setViewMode('detail');
  }, []);

  // 목록으로
  const handleBackToList = useCallback(() => {
    setViewMode('list');
    setSelectedNoticeId(null);
  }, []);

  // 글쓰기
  const handleOpenCreate = useCallback(() => {
    setFormData({ title: '', content: '', isUrgent: 'N', isPinned: 'N' });
    setViewMode('create');
  }, []);

  // 수정 모드
  const handleOpenEdit = useCallback(() => {
    if (!postDetail) return;
    setFormData({
      title: postDetail.title || '',
      content: postDetail.content || '',
      isUrgent: postDetail.isUrgent || 'N',
      isPinned: postDetail.isPinned || 'N',
    });
    setViewMode('edit');
  }, [postDetail]);

  // 폼 변경
  const handleFormChange = useCallback((field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  }, []);

  // 저장
  const handleSave = useCallback(async () => {
    if (!formData.title.trim()) {
      showModal('warning', '제목을 입력해주세요.');
      return;
    }
    if (!formData.content.trim()) {
      showModal('warning', '내용을 입력해주세요.');
      return;
    }

    try {
      if (viewMode === 'create') {
        const res = await createMutation.mutateAsync({
          ...formData,
          userId: user?.USER_ID,
        });
        // 긴급공지면 팝업 표시
        if (formData.isUrgent === 'Y') {
          const created = res.data?.data || {};
          setUrgentNotice({
            title: created.title || formData.title,
            content: created.content || formData.content,
            userName: created.userName || user?.USER_NAME,
            createdAt: created.createdAt,
          });
        } else {
          showModal('success', '공지사항이 등록되었습니다.');
        }
        handleBackToList();
      } else if (viewMode === 'edit') {
        await updateMutation.mutateAsync({
          noticeId: selectedNoticeId,
          postData: formData,
        });
        showModal('success', '공지사항이 수정되었습니다.');
        setViewMode('detail');
      }
    } catch (error) {
      console.error('저장 실패:', error);
      showModal('error', '저장에 실패했습니다.');
    }
  }, [viewMode, formData, selectedNoticeId, user, createMutation, updateMutation, handleBackToList, showModal, setUrgentNotice]);

  // 삭제
  const handleDelete = useCallback(() => {
    showModal('confirm', '공지사항을 삭제하시겠습니까?', async () => {
      try {
        await deleteMutation.mutateAsync(selectedNoticeId);
        showModal('success', '삭제되었습니다.');
        handleBackToList();
      } catch (error) {
        console.error('삭제 실패:', error);
        showModal('error', '삭제에 실패했습니다.');
      }
    });
  }, [selectedNoticeId, deleteMutation, handleBackToList, showModal]);

  // ===== 목록 뷰 =====
  const renderListView = () => (
    <>
      <div className="board-toolbar">
        <div className="board-toolbar-left">
          <select
            className="board-category-filter"
            value={filterType}
            onChange={(e) => { setFilterType(e.target.value); setPage(1); }}
          >
            <option value="">전체</option>
            <option value="urgent">긴급</option>
            <option value="pinned">상단고정</option>
            <option value="normal">일반</option>
          </select>
          <div className="board-search-box">
            <i className="bi bi-search search-icon"></i>
            <input
              type="text"
              placeholder="제목 또는 내용 검색"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={handleSearchKeyDown}
            />
            {searchInput && (
              <button className="board-search-clear" onClick={() => setSearchInput('')}>
                <i className="bi bi-x"></i>
              </button>
            )}
          </div>
          {(searchKeyword || filterType) && (
            <button className="board-reset-btn" onClick={handleSearchReset}>
              <i className="bi bi-arrow-counterclockwise"></i> 초기화
            </button>
          )}
        </div>
        <div className="board-toolbar-right">
          <button className="board-write-btn" onClick={handleOpenCreate}>
            <i className="bi bi-pencil-square"></i> 글쓰기
          </button>
        </div>
      </div>

      <div className="board-table-wrap">
        <DataTable
          columns={columns}
          data={posts}
          rowKey="noticeId"
          loading={isLoading}
          loadingText="공지사항을 불러오는 중..."
          emptyText="등록된 공지사항이 없습니다"
          emptyIcon="bi-megaphone"
          onRowClick={handleRowClick}
          stickyHeader
          maxHeight="100%"
          tableId="notice-board-table"
          pagination={{
            pageSize,
            currentPage: page,
            totalItems: totalElements,
            onPageChange: setPage,
            onPageSizeChange: (size) => { setPageSize(size); setPage(1); },
            pageSizeOptions: [10, 20, 50],
            showPageSizeSelector: true,
          }}
        />
      </div>
    </>
  );

  // ===== 상세 뷰 =====
  const renderDetailView = () => {
    if (detailLoading) {
      return (
        <div className="board-loading">
          <i className="bi bi-arrow-repeat spinning"></i> 불러오는 중...
        </div>
      );
    }
    if (!postDetail) {
      return (
        <div className="board-loading">
          <i className="bi bi-exclamation-circle"></i> 공지사항을 찾을 수 없습니다.
        </div>
      );
    }

    return (
      <div className="board-detail">
        {/* 헤더 카드 */}
        <div className="board-detail-card board-detail-header-card">
          <div className="board-detail-meta">
            {postDetail.isUrgent === 'Y' && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: '4px',
                padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 700,
                background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)',
              }}>
                <i className="bi bi-exclamation-triangle-fill"></i> 긴급
              </span>
            )}
            {postDetail.isPinned === 'Y' && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: '4px',
                padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600,
                background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.3)',
              }}>
                <i className="bi bi-pin-fill"></i> 상단고정
              </span>
            )}
          </div>
          <h2 className="board-detail-title">{postDetail.title}</h2>
          <div className="board-detail-info">
            <span><i className="bi bi-person"></i> {postDetail.userName}</span>
            <span><i className="bi bi-calendar3"></i> {formatDate(postDetail.createdAt)}</span>
            {postDetail.updatedAt && postDetail.updatedAt !== postDetail.createdAt && (
              <span><i className="bi bi-pencil"></i> 수정: {formatDate(postDetail.updatedAt)}</span>
            )}
            <span><i className="bi bi-eye"></i> 조회 {postDetail.viewCnt}</span>
          </div>
        </div>

        {/* 본문 카드 */}
        <div className="board-detail-card board-detail-body-card">
          <div className="board-detail-content" style={{ whiteSpace: 'pre-wrap' }}>{postDetail.content}</div>
        </div>

        {/* 액션 버튼 */}
        <div className="board-detail-actions">
          <button className="btn-board-secondary" onClick={handleBackToList}>
            <i className="bi bi-list-ul"></i> 목록
          </button>
          <div className="board-detail-actions-right">
            <button className="btn-board-primary" onClick={handleOpenEdit}>
              <i className="bi bi-pencil"></i> 수정
            </button>
            <button className="btn-board-danger" onClick={handleDelete}>
              <i className="bi bi-trash"></i> 삭제
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ===== 작성/수정 폼 =====
  const renderFormView = () => {
    const isEdit = viewMode === 'edit';

    return (
      <div className="board-form">
        <div className="board-form-card">
          <h3 className="board-form-title">
            <i className={`bi ${isEdit ? 'bi-pencil' : 'bi-pencil-square'}`}></i>
            {isEdit ? ' 공지사항 수정' : ' 새 공지사항 작성'}
          </h3>

          <div className="board-form-row">
            <div className="board-form-group inline">
              <label>긴급</label>
              <div
                className={`board-toggle ${formData.isUrgent === 'Y' ? 'active urgent' : ''}`}
                onClick={() => handleFormChange('isUrgent', formData.isUrgent === 'Y' ? 'N' : 'Y')}
              >
                <div className="board-toggle-slider"></div>
                <span>{formData.isUrgent === 'Y' ? '긴급' : '일반'}</span>
              </div>
            </div>
            <div className="board-form-group inline">
              <label>상단고정</label>
              <div
                className={`board-toggle ${formData.isPinned === 'Y' ? 'active pinned' : ''}`}
                onClick={() => handleFormChange('isPinned', formData.isPinned === 'Y' ? 'N' : 'Y')}
              >
                <div className="board-toggle-slider"></div>
                <span>{formData.isPinned === 'Y' ? '고정' : '해제'}</span>
              </div>
            </div>
          </div>

          <div className="board-form-group">
            <label>제목 <span className="required">*</span></label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => handleFormChange('title', e.target.value)}
              placeholder="제목을 입력하세요"
            />
          </div>

          <div className="board-form-group">
            <label>내용 <span className="required">*</span></label>
            <textarea
              value={formData.content}
              onChange={(e) => handleFormChange('content', e.target.value)}
              placeholder="내용을 입력하세요"
              rows={12}
            />
          </div>
        </div>

        {/* 액션 버튼 */}
        <div className="board-form-actions">
          <button
            className="btn-board-secondary"
            onClick={isEdit ? () => setViewMode('detail') : handleBackToList}
          >
            취소
          </button>
          <button
            className="btn-board-primary"
            onClick={handleSave}
            disabled={createMutation.isPending || updateMutation.isPending}
          >
            {createMutation.isPending || updateMutation.isPending ? '저장 중...' : (isEdit ? '수정' : '등록')}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="board-container">
      {/* 페이지 헤더 */}
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">
            <i className="bi bi-megaphone"></i>
            공지사항
          </h1>
          <span className="page-subtitle">공지사항을 확인합니다</span>
        </div>
      </div>

      {/* 메인 패널 */}
      <div className="board-panels-wrapper">
        <div className="board-main-panel">
          {viewMode === 'list' && renderListView()}
          {viewMode === 'detail' && renderDetailView()}
          {(viewMode === 'create' || viewMode === 'edit') && renderFormView()}
        </div>
      </div>

      {/* 커스텀 모달 */}
      {modal && (
        <BoardModal
          modal={modal}
          onClose={closeModal}
          onConfirm={handleModalConfirm}
        />
      )}
    </div>
  );
}
