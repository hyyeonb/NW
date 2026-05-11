// PerformanceTest 페이지 상수.

export const PERIOD_OPTIONS = [
  { label: '5분', minutes: 5 },
  { label: '30분', minutes: 30 },
  { label: '1시간', minutes: 60 },
  { label: '24시간', minutes: 1440 },
  { label: '커스텀', minutes: null },
];

export const DIST_RANGES = [
  { label: '0~20%', min: 0, max: 20, color: '#10b981' },
  { label: '20~50%', min: 20, max: 50, color: '#3b82f6' },
  { label: '50~80%', min: 50, max: 80, color: '#f59e0b' },
  { label: '80~100%', min: 80, max: 100, color: '#ef4444' },
];
