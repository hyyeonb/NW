import { useEffect } from 'react';

const MODAL_CONFIG = {
  success: { icon: 'bi-check-circle-fill', label: '완료' },
  error:   { icon: 'bi-x-circle-fill',     label: '오류' },
  warning: { icon: 'bi-exclamation-triangle-fill', label: '알림' },
  confirm: { icon: 'bi-question-circle-fill',      label: '확인' },
};

// 게시판 공통 confirm/info modal — FileBoard, NoticeBoard에서 공유.
export default function BoardModal({ modal, onClose, onConfirm }) {
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
