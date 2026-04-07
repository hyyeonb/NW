import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import '../styles/custom-alert.css';

const AlertContext = createContext(null);

export function useAlert() {
  const ctx = useContext(AlertContext);
  if (!ctx) throw new Error('useAlert must be used within AlertProvider');
  return ctx;
}

export function AlertProvider({ children }) {
  const [queue, setQueue] = useState([]);

  const showAlert = useCallback((message, { type = 'info', title, onConfirm, onCancel, confirmText, cancelText } = {}) => {
    return new Promise((resolve) => {
      setQueue(prev => [...prev, {
        id: Date.now() + Math.random(),
        message,
        type, // 'info' | 'success' | 'warning' | 'error' | 'confirm'
        title,
        confirmText: confirmText || (type === 'confirm' ? '확인' : '닫기'),
        cancelText: cancelText || '취소',
        onConfirm,
        onCancel,
        resolve,
      }]);
    });
  }, []);

  const alert = useCallback((message, opts = {}) => {
    return showAlert(message, { type: 'info', ...opts });
  }, [showAlert]);

  const success = useCallback((message, opts = {}) => {
    return showAlert(message, { type: 'success', ...opts });
  }, [showAlert]);

  const error = useCallback((message, opts = {}) => {
    return showAlert(message, { type: 'error', ...opts });
  }, [showAlert]);

  const warning = useCallback((message, opts = {}) => {
    return showAlert(message, { type: 'warning', ...opts });
  }, [showAlert]);

  const confirm = useCallback((message, opts = {}) => {
    return showAlert(message, { type: 'confirm', ...opts });
  }, [showAlert]);

  const dismiss = useCallback((id, result) => {
    setQueue(prev => prev.filter(a => a.id !== id));
    return result;
  }, []);

  const current = queue[0] || null;

  return (
    <AlertContext.Provider value={{ alert, success, error, warning, confirm }}>
      {children}
      {current && (
        <AlertModal
          key={current.id}
          data={current}
          onClose={(result) => {
            current.resolve(result);
            dismiss(current.id);
          }}
        />
      )}
    </AlertContext.Provider>
  );
}

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
