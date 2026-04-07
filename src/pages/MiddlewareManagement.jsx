import { useState, useEffect } from 'react';
import {
  useMiddlewares,
  useCreateMiddleware,
  useUpdateMiddleware,
  useDeleteMiddleware,
  useHealthCheckMiddleware,
} from '../hooks/useAdmin';
import { useAlert } from '../components/CustomAlert';
import { historyApi } from '../api/history';
import '../styles/MiddlewareManagement.css';

const STATUS_LABEL = {
  ACTIVE: 'ACTIVE',
  DOWN: 'DOWN',
  MAINTENANCE: 'MAINTENANCE',
};

const STATUS_CLASS = {
  ACTIVE: 'mw-status-active',
  DOWN: 'mw-status-down',
  MAINTENANCE: 'mw-status-maintenance',
};

const EMPTY_FORM = {
  middlewareName: '',
  middlewareUrl: '',
  apiKey: '',
  priority: 0,
  description: '',
};

function formatDatetime(value) {
  if (!value) return '-';
  try {
    return new Date(value).toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return value;
  }
}

function maskApiKey(key) {
  if (!key) return '-';
  if (key.length <= 8) return key;
  return key.slice(0, 8) + '-****-****-****-************';
}

export default function MiddlewareManagement() {
  const { data: middlewares = [], isLoading } = useMiddlewares();
  const createMut = useCreateMiddleware();
  const updateMut = useUpdateMiddleware();
  const deleteMut = useDeleteMiddleware();
  const healthCheckMut = useHealthCheckMiddleware();

  const { confirm, success, error } = useAlert();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null); // null = add mode
  const [form, setForm] = useState(EMPTY_FORM);
  const [revealedKeys, setRevealedKeys] = useState({}); // middlewareId -> boolean
  const [checkingIds, setCheckingIds] = useState(new Set());

  useEffect(() => {
    historyApi.recordPageView('system_admin', '/settings/admin', {
      subPage: 'middleware',
    });
  }, []);

  // ── Modal helpers ──
  const openAddModal = () => {
    setEditingItem(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  };

  const openEditModal = (item) => {
    setEditingItem(item);
    setForm({
      middlewareName: item.MIDDLEWARE_NAME || item.middlewareName || '',
      middlewareUrl: item.MIDDLEWARE_URL || item.middlewareUrl || '',
      apiKey: item.API_KEY || item.apiKey || '',
      priority: item.PRIORITY ?? item.priority ?? 0,
      description: item.DESCRIPTION || item.description || '',
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingItem(null);
    setForm(EMPTY_FORM);
  };

  const handleFormChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleGenerateApiKey = () => {
    const uuid = crypto.randomUUID();
    setForm((prev) => ({ ...prev, apiKey: uuid }));
  };

  // ── Submit ──
  const handleSubmit = async () => {
    if (!form.middlewareName.trim()) {
      error('수집 서버 이름을 입력해주세요.');
      return;
    }
    if (!form.middlewareUrl.trim()) {
      error('URL을 입력해주세요.');
      return;
    }
    if (!form.apiKey.trim()) {
      error('API Key를 입력해주세요.');
      return;
    }

    const payload = {
      MIDDLEWARE_NAME: form.middlewareName.trim(),
      MIDDLEWARE_URL: form.middlewareUrl.trim(),
      API_KEY: form.apiKey.trim(),
      PRIORITY: Number(form.priority) || 0,
      DESCRIPTION: form.description.trim(),
    };

    try {
      if (editingItem) {
        const id = editingItem.MIDDLEWARE_ID || editingItem.middlewareId;
        await updateMut.mutateAsync({ id, data: payload });
        success('수집 서버 정보가 수정되었습니다.');
      } else {
        await createMut.mutateAsync(payload);
        success('수집 서버가 등록되었습니다.');
      }
      closeModal();
    } catch (err) {
      error(err.response?.data?.message || '저장에 실패했습니다.');
    }
  };

  // ── Delete ──
  const handleDelete = async (item) => {
    const name = item.MIDDLEWARE_NAME || item.middlewareName || '수집 서버';
    const confirmed = await confirm(`"${name}"을(를) 삭제하시겠습니까?\n연결된 장비가 있을 경우 삭제할 수 없습니다.`);
    if (!confirmed) return;

    const id = item.MIDDLEWARE_ID || item.middlewareId;
    try {
      await deleteMut.mutateAsync(id);
      success('수집 서버가 삭제되었습니다.');
    } catch (err) {
      if (err.response?.status === 409) {
        error('이 수집 서버에 연결된 장비가 있어 삭제할 수 없습니다.');
      } else {
        error(err.response?.data?.message || '삭제에 실패했습니다.');
      }
    }
  };

  // ── Health Check ──
  const handleHealthCheck = async (item) => {
    const id = item.MIDDLEWARE_ID || item.middlewareId;
    setCheckingIds((prev) => new Set(prev).add(id));
    try {
      await healthCheckMut.mutateAsync(id);
      success('헬스체크가 완료되었습니다.');
    } catch (err) {
      error(err.response?.data?.message || '헬스체크에 실패했습니다.');
    } finally {
      setCheckingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  // ── API Key toggle ──
  const toggleRevealKey = (id) => {
    setRevealedKeys((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const isSaving = createMut.isPending || updateMut.isPending;

  return (
    <div className="mw-page">
      {/* Page Header */}
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">
            <i className="bi bi-hdd-rack" />
            수집 서버 관리
          </h1>
          <span className="page-subtitle">Go Middleware 수집 서버를 등록하고 관리합니다</span>
        </div>
        <div className="page-header-right">
          <button className="mw-btn mw-btn-primary" onClick={openAddModal}>
            <i className="bi bi-plus-lg" />
            수집 서버 추가
          </button>
        </div>
      </div>

      {/* Card Grid */}
      {isLoading ? (
        <div className="mw-loading">
          <div className="mw-loading-spinner" />
          <span>로딩 중...</span>
        </div>
      ) : middlewares.length === 0 ? (
        <div className="mw-empty-state">
          <i className="bi bi-hdd-rack" />
          <p>등록된 수집 서버가 없습니다</p>
          <button className="mw-btn mw-btn-ghost" onClick={openAddModal}>
            <i className="bi bi-plus-lg" />
            첫 번째 수집 서버 추가
          </button>
        </div>
      ) : (
        <div className="mw-card-grid">
          {middlewares.map((item) => {
            const id = item.MIDDLEWARE_ID || item.middlewareId;
            const name = item.MIDDLEWARE_NAME || item.middlewareName || '-';
            const url = item.MIDDLEWARE_URL || item.middlewareUrl || '-';
            const apiKey = item.API_KEY || item.apiKey || '';
            const status = item.STATUS || item.status || 'ACTIVE';
            const priority = item.PRIORITY ?? item.priority ?? 0;
            const deviceCount = item.DEVICE_COUNT ?? item.deviceCount ?? 0;
            const lastHeartbeat = item.LAST_HEARTBEAT || item.lastHeartbeat;
            const description = item.DESCRIPTION || item.description || '';
            const isChecking = checkingIds.has(id);
            const keyRevealed = !!revealedKeys[id];

            return (
              <div key={id} className="mw-card">
                {/* Card Header */}
                <div className="mw-card-header">
                  <div className="mw-card-title">
                    <h3>{name}</h3>
                    <span className="mw-priority-badge">우선순위 {priority}</span>
                  </div>
                  <span className={`mw-status-badge ${STATUS_CLASS[status] || 'mw-status-down'}`}>
                    {STATUS_LABEL[status] || status}
                  </span>
                </div>

                {/* Card Body */}
                <div className="mw-card-body">
                  <div className="mw-info-row">
                    <span className="mw-info-label">URL</span>
                    <span className="mw-info-value">{url}</span>
                  </div>

                  <div className="mw-info-row">
                    <span className="mw-info-label">API Key</span>
                    <div className="mw-api-key-row">
                      <span className="mw-api-key">
                        {keyRevealed ? apiKey || '-' : maskApiKey(apiKey)}
                      </span>
                      {apiKey && (
                        <button
                          className="mw-btn-eye"
                          onClick={() => toggleRevealKey(id)}
                          title={keyRevealed ? '숨기기' : '보기'}
                        >
                          <i className={`bi ${keyRevealed ? 'bi-eye-slash' : 'bi-eye'}`} />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="mw-info-row">
                    <span className="mw-info-label">마지막 헬스체크</span>
                    <span className="mw-info-value">{formatDatetime(lastHeartbeat)}</span>
                  </div>

                  {description && (
                    <div className="mw-info-row">
                      <span className="mw-info-label">설명</span>
                      <span className="mw-info-value">{description}</span>
                    </div>
                  )}
                </div>

                {/* Stats Row */}
                <div className="mw-stats-row">
                  <div className="mw-stat">
                    <i className="bi bi-hdd-network" />
                    <span>장비</span>
                    <span className="mw-stat-value">{deviceCount}대</span>
                  </div>
                </div>

                {/* Card Actions */}
                <div className="mw-card-actions">
                  <button
                    className="mw-btn mw-btn-health"
                    onClick={() => handleHealthCheck(item)}
                    disabled={isChecking}
                  >
                    {isChecking ? (
                      <>
                        <span className="mw-spinner" />
                        확인 중...
                      </>
                    ) : (
                      <>
                        <i className="bi bi-heart-pulse" />
                        헬스체크
                      </>
                    )}
                  </button>
                  <button
                    className="mw-btn mw-btn-ghost"
                    onClick={() => openEditModal(item)}
                  >
                    <i className="bi bi-pencil" />
                    수정
                  </button>
                  <button
                    className="mw-btn mw-btn-danger"
                    onClick={() => handleDelete(item)}
                    disabled={deleteMut.isPending}
                  >
                    <i className="bi bi-trash" />
                    삭제
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <div className="mw-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}>
          <div className="mw-modal">
            <div className="mw-modal-header">
              <h2>
                <i className={`bi ${editingItem ? 'bi-pencil-square' : 'bi-plus-circle'}`} />
                {editingItem ? '수집 서버 수정' : '수집 서버 추가'}
              </h2>
              <button className="mw-modal-close" onClick={closeModal}>
                <i className="bi bi-x-lg" />
              </button>
            </div>

            <div className="mw-modal-body">
              <div className="mw-form-group">
                <label className="mw-form-label">
                  이름<span className="mw-required">*</span>
                </label>
                <input
                  type="text"
                  className="mw-form-input"
                  placeholder="기본 수집기"
                  value={form.middlewareName}
                  onChange={(e) => handleFormChange('middlewareName', e.target.value)}
                />
              </div>

              <div className="mw-form-group">
                <label className="mw-form-label">
                  URL<span className="mw-required">*</span>
                </label>
                <input
                  type="text"
                  className="mw-form-input"
                  placeholder="http://192.168.x.x:18081"
                  value={form.middlewareUrl}
                  onChange={(e) => handleFormChange('middlewareUrl', e.target.value)}
                />
              </div>

              <div className="mw-form-group">
                <label className="mw-form-label">
                  API Key<span className="mw-required">*</span>
                </label>
                <div className="mw-apikey-row">
                  <input
                    type="text"
                    className="mw-form-input"
                    placeholder="UUID 형식 키를 입력하거나 자동생성 버튼을 클릭하세요"
                    value={form.apiKey}
                    onChange={(e) => handleFormChange('apiKey', e.target.value)}
                  />
                  <button
                    type="button"
                    className="mw-btn-generate"
                    onClick={handleGenerateApiKey}
                  >
                    자동생성
                  </button>
                </div>
              </div>

              <div className="mw-form-group">
                <label className="mw-form-label">우선순위</label>
                <input
                  type="number"
                  className="mw-form-input"
                  placeholder="0"
                  min="0"
                  value={form.priority}
                  onChange={(e) => handleFormChange('priority', e.target.value)}
                />
              </div>

              <div className="mw-form-group">
                <label className="mw-form-label">설명</label>
                <textarea
                  className="mw-form-textarea"
                  placeholder="수집 서버에 대한 설명을 입력하세요 (선택)"
                  value={form.description}
                  onChange={(e) => handleFormChange('description', e.target.value)}
                />
              </div>
            </div>

            <div className="mw-modal-footer">
              <button className="mw-btn mw-btn-ghost" onClick={closeModal} disabled={isSaving}>
                취소
              </button>
              <button className="mw-btn mw-btn-primary" onClick={handleSubmit} disabled={isSaving}>
                {isSaving ? (
                  <>
                    <span className="mw-spinner" />
                    저장 중...
                  </>
                ) : (
                  <>
                    <i className="bi bi-check2" />
                    {editingItem ? '수정' : '등록'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
