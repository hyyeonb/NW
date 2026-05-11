// EmailNotificationSettings 도메인 상수.

export const DELIVERY_MODES = [
  { value: 'IMMEDIATE', label: '즉시' },
  { value: 'DIGEST', label: '요약' },
  { value: 'OFF', label: 'OFF' },
];

export const DIGEST_INTERVAL_OPTIONS = [
  { value: 5, label: '5분' },
  { value: 10, label: '10분' },
  { value: 30, label: '30분' },
];

// 통합 장애 유형 (fixedSeverity가 있으면 해당 등급만 활성).
export const ALL_ALERT_TYPES = [
  { alertType: 'ICMP', label: 'ICMP (Ping)', icon: 'bi-wifi-off', fixedSeverity: 'CRITICAL' },
  { alertType: 'SNMP', label: 'SNMP', icon: 'bi-hdd-network', fixedSeverity: 'MAJOR' },
  { alertType: 'PORT', label: 'Port DOWN', icon: 'bi-ethernet', fixedSeverity: 'MAJOR' },
  { alertType: 'CPU_MEM', label: 'CPU/Memory', icon: 'bi-cpu', fixedSeverity: null },
  { alertType: 'TRAFFIC', label: 'Traffic', icon: 'bi-bar-chart-line', fixedSeverity: null },
  { alertType: 'TEMPERATURE', label: 'Temperature', icon: 'bi-thermometer-half', fixedSeverity: null },
  { alertType: 'HUMIDITY', label: 'Humidity', icon: 'bi-droplet', fixedSeverity: null },
];

export const CONNECTIVITY_TYPES = ALL_ALERT_TYPES.filter(t => t.fixedSeverity);
export const PERFORMANCE_TYPES = ALL_ALERT_TYPES.filter(t => !t.fixedSeverity);

export const SEVERITIES = ['CRITICAL', 'MAJOR', 'MINOR', 'WARNING'];

export const SEVERITY_COLORS = {
  CRITICAL: '#ef4444',
  MAJOR: '#f97316',
  MINOR: '#f59e0b',
  WARNING: '#3b82f6',
};
