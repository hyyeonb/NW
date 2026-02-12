import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { useBoardPosts, useBoardPost, useCreatePost, useUpdatePost, useDeletePost } from '../hooks';
import { boardApi } from '../api';
import { useAuthStore } from '../stores';
import { DataTable } from '../components';
import '../styles/board.css';

// ===== 커스텀 모달 컴포넌트 =====
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

const CATEGORIES = [
  { value: '', label: '전체' },
  { value: '일반', label: '일반' },
  { value: '매뉴얼', label: '매뉴얼' },
  { value: '기타', label: '기타' },
];

function formatDate(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

function formatFileSize(bytes) {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export default function FileBoard() {
  const { user } = useAuthStore();

  // 뷰 모드: list | detail | create | edit
  const [viewMode, setViewMode] = useState('list');
  const [selectedPostId, setSelectedPostId] = useState(null);

  // 목록 상태
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortField, setSortField] = useState('POST_ID');
  const [sortOrder, setSortOrder] = useState('desc');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [filterCategory, setFilterCategory] = useState('');

  // 폼 상태
  const [formData, setFormData] = useState({
    category: '일반',
    title: '',
    content: '',
    isPublic: 'Y',
  });
  const [newFiles, setNewFiles] = useState([]);
  const [deleteAttachIds, setDeleteAttachIds] = useState([]);
  const fileInputRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);

  // 모달 상태: { type: 'success'|'error'|'warning'|'confirm', message, onConfirm? }
  const [modal, setModal] = useState(null);
  const showModal = useCallback((type, message, onConfirm) => {
    setModal({ type, message, onConfirm });
  }, []);
  const closeModal = useCallback(() => {
    setModal(null);
  }, []);
  const handleModalConfirm = useCallback(() => {
    if (modal?.onConfirm) modal.onConfirm();
    setModal(null);
  }, [modal]);

  // 데이터 조회
  const userId = user?.USER_ID;
  const { data: postsData, isLoading } = useBoardPosts(page, pageSize, sortField, sortOrder, searchKeyword, filterCategory, userId);
  const { data: postDetail, isLoading: detailLoading } = useBoardPost(selectedPostId, userId);

  // Mutations
  const createMutation = useCreatePost();
  const updateMutation = useUpdatePost();
  const deleteMutation = useDeletePost();

  const posts = postsData?.content || [];
  const totalElements = postsData?.totalElements || 0;

  // 목록 컬럼
  const columns = useMemo(() => [
    {
      key: 'postId',
      label: '번호',
      width: '70px',
      align: 'center',
      hideable: true,
      render: (value, row, index) => (page - 1) * pageSize + index + 1,
    },
    {
      key: 'category',
      label: '카테고리',
      width: '100px',
      align: 'center',
      sortable: true,
      hideable: true,
      render: (value) => (
        <span className={`board-category-badge ${value}`}>{value || '-'}</span>
      ),
    },
    {
      key: 'title',
      label: '제목',
      sortable: true,
      render: (value, row) => (
        <span className="board-title-cell">
          {value}
          {row.attachCount > 0 && (
            <i className="bi bi-paperclip attach-icon" title={`첨부파일 ${row.attachCount}개`}></i>
          )}
        </span>
      ),
    },
    {
      key: 'viewCnt',
      label: '조회수',
      width: '80px',
      align: 'center',
      sortable: true,
      hideable: true,
    },
    {
      key: 'createdAt',
      label: '작성일',
      width: '120px',
      align: 'center',
      sortable: true,
      hideable: true,
      render: (value) => formatDate(value),
    },
  ], [totalElements, page, pageSize]);

  // 정렬 핸들러
  const handleSort = useCallback((field) => {
    if (sortField === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
    setPage(1);
  }, [sortField]);

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
    setFilterCategory('');
    setPage(1);
  }, []);

  // 상세보기
  const handleRowClick = useCallback((row) => {
    setSelectedPostId(row.postId);
    setViewMode('detail');
  }, []);

  // 목록으로 돌아가기
  const handleBackToList = useCallback(() => {
    setViewMode('list');
    setSelectedPostId(null);
  }, []);

  // 글쓰기
  const handleOpenCreate = useCallback(() => {
    setFormData({ category: '일반', title: '', content: '', isPublic: 'Y' });
    setNewFiles([]);
    setDeleteAttachIds([]);
    setViewMode('create');
  }, []);

  // 수정 모드
  const handleOpenEdit = useCallback(() => {
    if (!postDetail) return;
    setFormData({
      category: postDetail.category || '일반',
      title: postDetail.title || '',
      content: postDetail.content || '',
      isPublic: postDetail.isPublic || 'Y',
    });
    setNewFiles([]);
    setDeleteAttachIds([]);
    setViewMode('edit');
  }, [postDetail]);

  // 폼 필드 변경
  const handleFormChange = useCallback((field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  }, []);

  // 파일 추가 (50MB 제한)
  const MAX_FILE_SIZE = 50 * 1024 * 1024;
  const handleFileAdd = useCallback((fileList) => {
    const files = Array.from(fileList);
    const oversize = files.filter(f => f.size > MAX_FILE_SIZE);
    if (oversize.length > 0) {
      const names = oversize.map(f => f.name).join(', ');
      showModal('warning', `파일 용량이 50MB를 초과합니다.\n${names}`);
      const valid = files.filter(f => f.size <= MAX_FILE_SIZE);
      if (valid.length > 0) setNewFiles(prev => [...prev, ...valid]);
      return;
    }
    setNewFiles(prev => [...prev, ...files]);
  }, [showModal]);

  const handleFileRemove = useCallback((index) => {
    setNewFiles(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleToggleDeleteAttach = useCallback((attachId) => {
    setDeleteAttachIds(prev =>
      prev.includes(attachId) ? prev.filter(id => id !== attachId) : [...prev, attachId]
    );
  }, []);

  // 드래그 앤 드롭
  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) {
      handleFileAdd(e.dataTransfer.files);
    }
  }, [handleFileAdd]);

  // 저장 (등록/수정)
  const handleSave = useCallback(async () => {
    if (!formData.title.trim()) {
      showModal('warning', '제목을 입력해주세요.');
      return;
    }

    try {
      if (viewMode === 'create') {
        await createMutation.mutateAsync({
          postData: formData,
          files: newFiles,
          userId: user?.USER_ID,
        });
        showModal('success', '게시글이 등록되었습니다.');
        handleBackToList();
      } else if (viewMode === 'edit') {
        const updateData = {
          ...formData,
          deleteAttachIds: deleteAttachIds.length > 0 ? deleteAttachIds : undefined,
        };
        await updateMutation.mutateAsync({
          postId: selectedPostId,
          postData: updateData,
          files: newFiles,
        });
        showModal('success', '게시글이 수정되었습니다.');
        setViewMode('detail');
        setNewFiles([]);
        setDeleteAttachIds([]);
      }
    } catch (error) {
      console.error('저장 실패:', error);
      showModal('error', '저장에 실패했습니다.');
    }
  }, [viewMode, formData, newFiles, deleteAttachIds, selectedPostId, user, createMutation, updateMutation, handleBackToList, showModal]);

  // 삭제
  const handleDelete = useCallback(() => {
    showModal('confirm', '게시글을 삭제하시겠습니까?', async () => {
      try {
        await deleteMutation.mutateAsync(selectedPostId);
        showModal('success', '삭제되었습니다.');
        handleBackToList();
      } catch (error) {
        console.error('삭제 실패:', error);
        showModal('error', '삭제에 실패했습니다.');
      }
    });
  }, [selectedPostId, deleteMutation, handleBackToList, showModal]);

  // 첨부파일 다운로드
  const handleDownload = useCallback(async (attach) => {
    try {
      const response = await boardApi.downloadAttach(attach.attachId);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', attach.orgFileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('다운로드 실패:', error);
      showModal('error', '파일 다운로드에 실패했습니다.');
    }
  }, [showModal]);

  // ===== 목록 뷰 =====
  const renderListView = () => (
    <>
      <div className="board-toolbar">
        <div className="board-toolbar-left">
          <select
            className="board-category-filter"
            value={filterCategory}
            onChange={(e) => { setFilterCategory(e.target.value); setPage(1); }}
          >
            {CATEGORIES.map(c => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
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
          {(searchKeyword || filterCategory) && (
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
          rowKey="postId"
          loading={isLoading}
          loadingText="게시글을 불러오는 중..."
          emptyText="등록된 게시글이 없습니다"
          emptyIcon="bi-clipboard-x"
          sort={{ field: sortField, order: sortOrder }}
          onSort={handleSort}
          onRowClick={handleRowClick}
          stickyHeader
          maxHeight="100%"
          tableId="file-board-table"
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
          <i className="bi bi-exclamation-circle"></i> 게시글을 찾을 수 없습니다.
        </div>
      );
    }

    return (
      <div className="board-detail">
        {/* 헤더 카드 */}
        <div className="board-detail-card board-detail-header-card">
          <div className="board-detail-meta">
            <span className={`board-category-badge ${postDetail.category}`}>{postDetail.category || '일반'}</span>
            {postDetail.isPublic === 'N' && (
              <span className="board-private-badge"><i className="bi bi-lock-fill"></i> 비공개</span>
            )}
          </div>
          <h2 className="board-detail-title">{postDetail.title}</h2>
          <div className="board-detail-info">
            <span><i className="bi bi-calendar3"></i> {formatDate(postDetail.createdAt)}</span>
            {postDetail.updatedAt && postDetail.updatedAt !== postDetail.createdAt && (
              <span><i className="bi bi-pencil"></i> 수정: {formatDate(postDetail.updatedAt)}</span>
            )}
            <span><i className="bi bi-eye"></i> 조회 {postDetail.viewCnt}</span>
          </div>
        </div>

        {/* 본문 카드 */}
        <div className="board-detail-card board-detail-body-card">
          <div className="board-detail-content">{postDetail.content}</div>
        </div>

        {/* 첨부파일 카드 */}
        {postDetail.attachments && postDetail.attachments.length > 0 && (
          <div className="board-detail-card board-detail-attach-card">
            <h4><i className="bi bi-paperclip"></i> 첨부파일 ({postDetail.attachments.length})</h4>
            <ul className="board-attach-list">
              {postDetail.attachments.map((attach) => (
                <li key={attach.attachId} className="board-attach-item">
                  <div className="attach-info">
                    <i className="bi bi-file-earmark"></i>
                    <span className="attach-name">{attach.orgFileName}</span>
                    <span className="attach-size">{formatFileSize(attach.fileSize)}</span>
                  </div>
                  <button className="attach-download-btn" onClick={() => handleDownload(attach)}>
                    <i className="bi bi-download"></i> 다운로드
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

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
    const existingAttachments = isEdit ? (postDetail?.attachments || []) : [];

    return (
      <div className="board-form">
        <div className="board-form-card">
          <h3 className="board-form-title">
            <i className={`bi ${isEdit ? 'bi-pencil' : 'bi-pencil-square'}`}></i>
            {isEdit ? ' 게시글 수정' : ' 새 게시글 작성'}
          </h3>

          <div className="board-form-row">
            <div className="board-form-group">
              <label>카테고리</label>
              <select
                value={formData.category}
                onChange={(e) => handleFormChange('category', e.target.value)}
              >
                {CATEGORIES.filter(c => c.value).map(c => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
            <div className="board-form-group inline">
              <label>공개여부</label>
              <div
                className={`board-toggle ${formData.isPublic === 'Y' ? 'active' : ''}`}
                onClick={() => handleFormChange('isPublic', formData.isPublic === 'Y' ? 'N' : 'Y')}
              >
                <div className="board-toggle-slider"></div>
                <span>{formData.isPublic === 'Y' ? '공개' : '비공개'}</span>
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
            <label>내용</label>
            <textarea
              value={formData.content}
              onChange={(e) => handleFormChange('content', e.target.value)}
              placeholder="내용을 입력하세요"
              rows={12}
            />
          </div>
        </div>

        {/* 첨부파일 카드 */}
        <div className="board-form-card">
          <h4 className="board-form-section-title"><i className="bi bi-paperclip"></i> 첨부파일</h4>

          {/* 기존 첨부파일 (수정 모드) */}
          {isEdit && existingAttachments.length > 0 && (
            <div className="board-form-group">
              <label>기존 첨부파일</label>
              <ul className="board-existing-files">
                {existingAttachments.map((attach) => (
                  <li
                    key={attach.attachId}
                    className={`existing-file-item ${deleteAttachIds.includes(attach.attachId) ? 'marked-delete' : ''}`}
                  >
                    <label className="file-check-label">
                      <input
                        type="checkbox"
                        checked={deleteAttachIds.includes(attach.attachId)}
                        onChange={() => handleToggleDeleteAttach(attach.attachId)}
                      />
                      <i className="bi bi-file-earmark"></i>
                      <span className="file-name">{attach.orgFileName}</span>
                      <span className="file-size">{formatFileSize(attach.fileSize)}</span>
                      {deleteAttachIds.includes(attach.attachId) && (
                        <span className="delete-label">삭제 예정</span>
                      )}
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div
            className={`board-file-drop ${isDragging ? 'dragging' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <i className="bi bi-cloud-arrow-up"></i>
            <p>파일을 드래그하거나 클릭하여 첨부</p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            style={{ display: 'none' }}
            onChange={(e) => {
              handleFileAdd(e.target.files);
              e.target.value = '';
            }}
          />
          {newFiles.length > 0 && (
            <ul className="board-new-files">
              {newFiles.map((file, index) => (
                <li key={index} className="new-file-item">
                  <i className="bi bi-file-earmark-plus"></i>
                  <span className="file-name">{file.name}</span>
                  <span className="file-size">{formatFileSize(file.size)}</span>
                  <button className="file-remove-btn" onClick={() => handleFileRemove(index)}>
                    <i className="bi bi-x-lg"></i>
                  </button>
                </li>
              ))}
            </ul>
          )}
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
            <i className="bi bi-folder2-open"></i>
            자료실
          </h1>
          <span className="page-subtitle">자료를 공유하고 관리합니다</span>
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
