/* eslint-disable react-refresh/only-export-components */
// ConnectivityCheckModal 헬퍼: 체크 항목 상수 + state builder + 행 렌더링 컴포넌트.

export const ITEMS = [
  { key: 'ping', label: 'PING', icon: 'bi-wifi' },
  { key: 'snmp', label: 'SNMP', icon: 'bi-diagram-3' },
  { key: 'ssh',  label: 'SSH',  icon: 'bi-terminal' },
];

export const INIT_STATES = [
  { phase: 'pending' },
  { phase: 'pending' },
  { phase: 'pending' },
];

export function buildItemState(key, data) {
  if (key === 'ping') {
    return {
      phase: data.pingSuccess ? 'success' : 'fail',
      msg: data.pingMessage,
      badge: data.pingSuccess ? `${data.pingResponseTimeMs}ms` : null,
      badgeType: data.pingSuccess ? 'success' : 'danger',
    };
  }
  if (key === 'snmp') {
    if (!data.snmpConfigured) return { phase: 'skipped', msg: data.snmpMessage };
    return {
      phase: data.snmpSuccess ? 'success' : 'fail',
      msg: data.snmpMessage,
      badge: data.snmpSuccess && data.sysName ? data.sysName : null,
      badgeType: 'info',
    };
  }
  if (key === 'ssh') {
    if (!data.sshConfigured) return { phase: 'skipped', msg: data.sshMessage };
    return {
      phase: data.sshSuccess ? 'success' : 'fail',
      msg: data.sshMessage,
    };
  }
}

function CheckRow({ label, iconClass, state }) {
  const { phase, msg, badge, badgeType } = state;

  const rowClass = {
    pending:  'cc-row cc-row--pending',
    checking: 'cc-row cc-row--checking',
    success:  'cc-row cc-row--success',
    fail:     'cc-row cc-row--fail',
    skipped:  'cc-row cc-row--skipped',
  }[phase] ?? 'cc-row cc-row--pending';

  const statusContent = {
    pending:  <i className="bi bi-circle cc-row-status-icon" />,
    checking: <span className="cc-spinner" />,
    success:  <i className="bi bi-check-circle-fill cc-row-status-icon" />,
    fail:     <i className="bi bi-x-circle-fill cc-row-status-icon" />,
    skipped:  <i className="bi bi-dash-circle cc-row-status-icon" />,
  }[phase];

  const rowMsg = {
    pending:  '대기 중...',
    checking: '확인 중...',
  }[phase] ?? msg;

  return (
    <div className={rowClass}>
      <div className="cc-row-icon">
        <i className={`bi ${iconClass}`} />
      </div>
      <div className="cc-row-label">{label}</div>
      <div className="cc-row-status">{statusContent}</div>
      <div className="cc-row-msg">
        <span>{rowMsg}</span>
        {badge && phase !== 'checking' && (
          <span className={`cc-badge cc-badge--${badgeType}`}>{badge}</span>
        )}
      </div>
    </div>
  );
}

export { CheckRow };
