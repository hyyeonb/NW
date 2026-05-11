export const SEVERITIES = ['CRITICAL', 'MAJOR', 'MINOR', 'WARNING'];

export const SEV_META = {
  CRITICAL: { label: 'Critical', color: '#ef4444' },
  MAJOR:    { label: 'Major',    color: '#f97316' },
  MINOR:    { label: 'Minor',    color: '#f59e0b' },
  WARNING:  { label: 'Warning',  color: '#3b82f6' },
};

export const TYPES = [
  { key: 'CPU',     label: 'CPU',     icon: 'bi-cpu' },
  { key: 'MEM',     label: 'Memory',  icon: 'bi-memory' },
  { key: 'TRAFFIC', label: 'Traffic', icon: 'bi-bar-chart-line' },
];
