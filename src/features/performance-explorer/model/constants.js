// PerformanceExplorer 도메인 상수 — 페이지/모달/카드 모두 공유

export const PERIOD_OPTIONS = [
  { id: '1h',  label: '1H',  minutes: 60 },
  { id: '6h',  label: '6H',  minutes: 360 },
  { id: '24h', label: '24H', minutes: 1440 },
  { id: '7d',  label: '7D',  minutes: 10080 },
  { id: '30d', label: '30D', minutes: 43200 },
  { id: 'custom', label: '커스텀', minutes: null },
];

export const METRICS = [
  { id: 'cpu',     label: 'CPU',     color: '#3b82f6' },
  { id: 'mem',     label: 'MEM',     color: '#8b5cf6' },
  { id: 'traffic', label: 'Traffic', color: '#10b981' },
  { id: 'icmp',    label: 'ICMP',    color: '#f59e0b' },
];

export const PORT_COLORS = [
  '#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444',
  '#06b6d4', '#ec4899', '#84cc16', '#a855f7', '#f97316',
];

export const EMPTY_ARR = Object.freeze([]);
