import { useEffect } from 'react';
import { useAlertStore } from '../stores/alertStore';

function formatDateTime(dateStr) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch { return dateStr; }
}

export default function UrgentNoticePopup() {
  const urgentNotice = useAlertStore((s) => s.urgentNotice);
  const clearUrgentNotice = useAlertStore((s) => s.clearUrgentNotice);

  // ESC 키로 닫기
  useEffect(() => {
    if (!urgentNotice) return;
    const handleKey = (e) => {
      if (e.key === 'Escape') clearUrgentNotice();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [urgentNotice, clearUrgentNotice]);

  if (!urgentNotice) return null;

  return (
    <div
      onClick={clearUrgentNotice}
      style={{
        position: 'fixed', inset: 0, zIndex: 99999,
        background: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '480px', maxWidth: '90vw', maxHeight: '80vh',
          background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
          border: '1px solid rgba(239, 68, 68, 0.4)',
          borderRadius: '16px', overflow: 'hidden',
          boxShadow: '0 0 40px rgba(239, 68, 68, 0.2), 0 20px 60px rgba(0, 0, 0, 0.5)',
          animation: 'urgentPopupIn 0.3s ease-out',
        }}
      >
        {/* 상단 경고 바 */}
        <div style={{
          background: 'linear-gradient(90deg, #ef4444, #dc2626)',
          padding: '12px 20px',
          display: 'flex', alignItems: 'center', gap: '10px',
        }}>
          <i className="bi bi-exclamation-triangle-fill" style={{ fontSize: '18px', color: '#fff' }}></i>
          <span style={{ fontSize: '15px', fontWeight: 700, color: '#fff', letterSpacing: '1px' }}>
            긴급 공지사항
          </span>
        </div>

        {/* 본문 */}
        <div style={{ padding: '24px 24px 16px' }}>
          <h3 style={{
            fontSize: '17px', fontWeight: 700, color: '#f1f5f9',
            margin: '0 0 12px', lineHeight: 1.4,
          }}>
            {urgentNotice.title}
          </h3>

          <div style={{
            fontSize: '13px', color: '#cbd5e1', lineHeight: 1.7,
            whiteSpace: 'pre-wrap', maxHeight: '300px', overflowY: 'auto',
            padding: '16px',
            background: 'rgba(255, 255, 255, 0.03)',
            borderRadius: '8px',
            border: '1px solid rgba(255, 255, 255, 0.06)',
          }}>
            {urgentNotice.content}
          </div>

          {/* 작성 정보 */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '12px',
            marginTop: '16px', fontSize: '11px', color: '#64748b',
          }}>
            {urgentNotice.userName && (
              <span><i className="bi bi-person"></i> {urgentNotice.userName}</span>
            )}
            {urgentNotice.createdAt && (
              <span><i className="bi bi-clock"></i> {formatDateTime(urgentNotice.createdAt)}</span>
            )}
          </div>
        </div>

        {/* 하단 버튼 */}
        <div style={{
          padding: '12px 24px 20px',
          display: 'flex', justifyContent: 'flex-end',
        }}>
          <button
            onClick={clearUrgentNotice}
            style={{
              padding: '8px 24px', borderRadius: '8px',
              background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#ef4444', fontSize: '13px', fontWeight: 600,
              cursor: 'pointer', transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => { e.target.style.background = 'rgba(239, 68, 68, 0.25)'; }}
            onMouseLeave={(e) => { e.target.style.background = 'rgba(239, 68, 68, 0.15)'; }}
          >
            확인
          </button>
        </div>
      </div>

      <style>{`
        @keyframes urgentPopupIn {
          from { opacity: 0; transform: scale(0.9) translateY(-20px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
  );
}
