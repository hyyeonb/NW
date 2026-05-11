import { useEffect, useCallback } from 'react';
import { useAlertStore } from '../stores/alertStore';
import { ToastItem } from '../features/alert-toast/parts';
import '../styles/alertToast.css';

const AUTO_CLOSE_DELAY = 8000;

export default function AlertToast() {
  const { toasts, removeToast, isMuted, toggleMute } = useAlertStore();

  useEffect(() => {
    if (toasts.length === 0) return;
    const timers = toasts.map((toast) =>
      setTimeout(() => removeToast(toast.alertId), AUTO_CLOSE_DELAY)
    );
    return () => timers.forEach(clearTimeout);
  }, [toasts, removeToast]);

  const handleClose = useCallback(
    (alertId) => removeToast(alertId),
    [removeToast]
  );

  if (toasts.length === 0) return null;

  return (
    <div className="alert-toast-container">
      <button
        className="alert-mute-btn"
        onClick={toggleMute}
        title={isMuted ? '알림음 켜기' : '알림음 끄기'}
      >
        {isMuted ? '🔇' : '🔊'}
      </button>
      {toasts.map((toast) => (
        <ToastItem key={toast.alertId} toast={toast} onClose={handleClose} />
      ))}
    </div>
  );
}
