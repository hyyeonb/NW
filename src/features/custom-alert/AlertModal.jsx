import { useEffect } from 'react';

// 공통 알림/확인 모달 — info/success/warning/error/confirm 타입.
function AlertModal({ data, onClose }) {
  const { message, type, title, confirmText, cancelText } = data;

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose(false);
      if (e.key === 'Enter') onClose(true);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const iconMap = {
    info: 'bi-info-circle',
    success: 'bi-check-circle',
    warning: 'bi-exclamation-triangle',
    error: 'bi-x-circle',
    confirm: 'bi-question-circle',
  };

  const defaultTitle = {
    info: '알림',
    success: '성공',
    warning: '주의',
    error: '오류',
    confirm: '확인',
  };

  return (
    <div className="custom-alert-overlay" onClick={() => onClose(false)}>
      <div className={`custom-alert-modal ${type}`} onClick={(e) => e.stopPropagation()}>
        <div className="custom-alert-header">
          <i className={`bi ${iconMap[type]} custom-alert-icon ${type}`}></i>
          <span className="custom-alert-title">{title || defaultTitle[type]}</span>
        </div>
        <div className="custom-alert-body">
          {typeof message === 'string' ? message.split('\n').map((line, i) => (
            <p key={i}>{line}</p>
          )) : message}
        </div>
        <div className="custom-alert-footer">
          {type === 'confirm' && (
            <button className="custom-alert-btn cancel" onClick={() => onClose(false)}>
              {cancelText}
            </button>
          )}
          <button className={`custom-alert-btn primary ${type}`} onClick={() => onClose(true)} autoFocus>
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

export default AlertModal;
