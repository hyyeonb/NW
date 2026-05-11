import { useState, useCallback, createContext, useContext } from 'react';
import '../styles/custom-alert.css';
import AlertModal from '../features/custom-alert/AlertModal';

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
