// DailySummaryModal 도메인 상수.

export const DEBUG_DATE = null;

export const LEVEL_META = {
  C: { label: 'CR 긴급', short: 'CR', color: '#ef4444' },
  M: { label: 'MJ 중대', short: 'MJ', color: '#f97316' },
  N: { label: 'MN 경미', short: 'MN', color: '#eab308' },
  W: { label: 'WR 경고', short: 'WR', color: '#3b82f6' },
};

export const LEVEL_ORDER = ['C', 'M', 'N', 'W'];

export const OPEN_EVENT = 'nms:daily-summary:open';
