/* eslint-disable react-refresh/only-export-components */
// NotificationSettings 도메인 상수 + utils + Toggle.

export const ALERT_TYPES = [
  { key: 'NOTIFY_SNMP', label: 'SNMP 장애', desc: 'SNMP 연결 실패', icon: 'bi-hdd-network' },
  { key: 'NOTIFY_ICMP', label: 'ICMP 장애', desc: 'Ping 응답 없음', icon: 'bi-wifi-off' },
  { key: 'NOTIFY_PORT', label: '포트 상태', desc: 'UP/DOWN 변경', icon: 'bi-ethernet' },
  { key: 'NOTIFY_CPU_MEM', label: 'CPU/Memory', desc: '사용률 알림', icon: 'bi-cpu' },
  { key: 'NOTIFY_TRAFFIC', label: 'Traffic', desc: '트래픽 이상', icon: 'bi-bar-chart-line' },
  { key: 'NOTIFY_URGENT', label: '긴급 공지', desc: '관리자 긴급 공지', icon: 'bi-megaphone' },
];

export const SEVERITY_LEVELS = [
  { key: 'NOTIFY_CRITICAL', label: 'Critical', color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
  { key: 'NOTIFY_MAJOR', label: 'Major', color: '#f97316', bg: 'rgba(249,115,22,0.12)' },
  { key: 'NOTIFY_MINOR', label: 'Minor', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  { key: 'NOTIFY_WARNING', label: 'Warning', color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
];

export const SOUND_TYPES = [
  { value: 'SINE', label: 'Sine' },
  { value: 'BEEP', label: 'Beep' },
  { value: 'CHIME', label: 'Chime' },
  { value: 'ALARM', label: 'Alarm' },
];

export const TABS = [
  { key: 'alert', label: '알림', icon: 'bi-bell' },
  { key: 'email', label: '이메일', icon: 'bi-envelope-at' },
];

// 사운드 미리듣기 (Web Audio API).
export function playPreviewSound(type, volume) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    gain.gain.value = (volume || 30) / 100;
    osc.connect(gain);
    gain.connect(ctx.destination);
    const freqMap = { SINE: 440, BEEP: 880, CHIME: 523, ALARM: 660 };
    osc.frequency.value = freqMap[type] || 440;
    osc.type = type === 'ALARM' ? 'sawtooth' : type === 'BEEP' ? 'square' : 'sine';
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
  } catch (e) { /* ignore */ }
}

export function Toggle({ checked, onChange }) {
  return (
    <label className="toggle-switch">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="toggle-switch-slider" />
    </label>
  );
}
