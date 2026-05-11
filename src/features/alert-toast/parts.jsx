/* eslint-disable react-refresh/only-export-components */
// AlertToast helpers + sub-component.

const SEVERITY_CONFIG = {
  CRITICAL: {
    label: 'CRITICAL 장애 발생',
    color: '#ef4444',
    bgColor: 'rgba(239, 68, 68, 0.15)',
    borderColor: 'rgba(239, 68, 68, 0.4)',
    icon: '⚠',
  },
  MAJOR: {
    label: 'MAJOR 장애 발생',
    color: '#f97316',
    bgColor: 'rgba(249, 115, 22, 0.15)',
    borderColor: 'rgba(249, 115, 22, 0.4)',
    icon: '⚠',
  },
  MINOR: {
    label: 'MINOR 장애 발생',
    color: '#eab308',
    bgColor: 'rgba(234, 179, 8, 0.15)',
    borderColor: 'rgba(234, 179, 8, 0.4)',
    icon: '⚠',
  },
  WARNING: {
    label: 'WARNING',
    color: '#3b82f6',
    bgColor: 'rgba(59, 130, 246, 0.15)',
    borderColor: 'rgba(59, 130, 246, 0.4)',
    icon: 'ℹ',
  },
  INFO: {
    label: 'INFO',
    color: '#10b981',
    bgColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: 'rgba(16, 185, 129, 0.4)',
    icon: 'ℹ',
  },
};

// 알림 타입 한글명 변환
function getAlertTypeName(type) {
  if (!type) return '알 수 없는 장애';

  const typeMap = {
    PING_FAIL: 'PING 통신 장애',
    PING_CLEAR: 'PING 통신 복구',
    SNMP_FAIL: 'SNMP 통신 장애',
    SNMP_CLEAR: 'SNMP 통신 복구',
    PORT_DOWN: '포트 다운 장애',
    PORT_UP: '포트 복구',
    CPU_THRESHOLD: 'CPU 임계치 초과 장애',
    MEM_THRESHOLD: '메모리 임계치 초과 장애',
    TRAFFIC_THRESHOLD: '트래픽 임계치 초과 장애',
    THRESHOLD_CLEAR: '임계치 장애 해소',
  };

  return typeMap[type] || type;
}

// 시간 포맷팅
function formatTime(dateStr) {
  if (!dateStr) return '';

  try {
    let date;
    if (Array.isArray(dateStr)) {
      // Java LocalDateTime 배열 형식: [2026, 3, 25, 14, 30, 0]
      const [y, M, d, h = 0, m = 0, s = 0] = dateStr;
      date = new Date(y, M - 1, d, h, m, s);
    } else {
      date = new Date(dateStr);
    }
    if (isNaN(date.getTime())) return '';
    return date.toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return '';
  }
}

function ToastItem({ toast, onClose }) {
  const config = SEVERITY_CONFIG[toast.severity] || SEVERITY_CONFIG.INFO;
  const isCleared = toast.isCleared;
  const alertTypeName = getAlertTypeName(toast.alertType);

  return (
    <div
      className={`alert-toast ${isCleared ? 'cleared' : ''}`}
      style={{
        '--toast-color': config.color,
        '--toast-bg': isCleared ? 'rgba(16, 185, 129, 0.15)' : config.bgColor,
        '--toast-border': isCleared ? 'rgba(16, 185, 129, 0.4)' : config.borderColor,
      }}
    >
      {/* 아이콘 영역 */}
      <div className="toast-icon" style={{ backgroundColor: isCleared ? '#10b981' : config.color }}>
        {isCleared ? '✓' : config.icon}
      </div>

      {/* 내용 영역 */}
      <div className="toast-content">
        {/* 헤더 - 심각도 + 시간 */}
        <div className="toast-header">
          <span className="toast-severity" style={{ color: isCleared ? '#10b981' : config.color }}>
            {isCleared ? '✓ 장애 해소' : config.label}
          </span>
          <span className="toast-time">{formatTime(toast.occurredAt)}</span>
        </div>

        {/* 장비명 */}
        <div className="toast-row">
          <span className="toast-label">장비명</span>
          <span className="toast-value">{toast.deviceName || 'Unknown'} ({toast.deviceIp})</span>
        </div>

        {/* 장애명 */}
        <div className="toast-row">
          <span className="toast-label">장애명</span>
          <span className="toast-value toast-alert-type">{alertTypeName}</span>
        </div>

        {/* 임계치 정보 (있는 경우) */}
        {toast.currentValue !== null && toast.currentValue !== undefined && (
          <div className="toast-row">
            <span className="toast-label">현재값</span>
            <span className="toast-value">
              {toast.currentValue}{toast.unit || '%'}
              {toast.thresholdValue && (
                <span className="threshold-info"> / 임계치: {toast.thresholdValue}{toast.unit || '%'}</span>
              )}
            </span>
          </div>
        )}
      </div>

      {/* 닫기 버튼 */}
      <button className="toast-close" onClick={() => onClose(toast.alertId)} aria-label="닫기">
        ×
      </button>

      {/* 진행 바 */}
      <div className="toast-progress" />
    </div>
  );
}

export { SEVERITY_CONFIG, ToastItem, getAlertTypeName, formatTime };
