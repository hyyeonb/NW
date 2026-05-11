// FaultStats 페이지 도메인 상수.

export const PERIOD_OPTIONS = [
  { label: '오늘', days: 0 },
  { label: '7일', days: 7 },
  { label: '30일', days: 30 },
  { label: '90일', days: 90 },
];

export const LEVEL_MAP = {
  C: 'Critical', M: 'Major', N: 'Minor', W: 'Warning', UNKNOWN: '미분류',
};

export const LEVEL_COLORS = {
  C: '#ef4444', M: '#f97316', N: '#eab308', W: '#3b82f6', UNKNOWN: '#94a3b8',
};

export const TYPE_COLORS = {
  PING: '#ef4444',
  SNMP: '#f97316',
  CPU: '#8b5cf6',
  MEMORY: '#3b82f6',
  PORT: '#06b6d4',
  TRAFFIC: '#10b981',
  TEMPERATURE: '#f59e0b',
  HUMIDITY: '#14b8a6',
};

export const DOW_LABELS = ['일', '월', '화', '수', '목', '금', '토'];
