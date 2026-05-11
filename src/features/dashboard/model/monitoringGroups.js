// Dashboard 사용자 정의 위젯의 모니터링 요소 그룹 정의 + 평면 역참조 맵.

export const MONITORING_GROUPS = {
  CPU_MEM: {
    id: 'CPU_MEM',
    name: 'CPU/Memory',
    icon: 'bi-cpu',
    color: '#3b82f6',
    elements: [
      { id: 'CPU', name: 'CPU 사용률', icon: 'bi-cpu', color: '#3b82f6' },
      { id: 'MEMORY', name: 'Memory 사용률', icon: 'bi-memory', color: '#8b5cf6' },
    ]
  },
  FILE: {
    id: 'FILE',
    name: 'File System',
    icon: 'bi-folder',
    color: '#ef4444',
    elements: [
      { id: 'FILESYSTEM', name: '파일시스템 사용률', icon: 'bi-hdd', color: '#ef4444' },
      { id: 'DISK_READ', name: 'Disk Read', icon: 'bi-arrow-down-circle', color: '#f97316' },
      { id: 'DISK_WRITE', name: 'Disk Write', icon: 'bi-arrow-up-circle', color: '#fb923c' },
    ]
  },
  PROCESS: {
    id: 'PROCESS',
    name: 'Process',
    icon: 'bi-list-task',
    color: '#10b981',
    elements: [
      { id: 'PROCESS_COUNT', name: '프로세스 수', icon: 'bi-hash', color: '#10b981' },
      { id: 'PROCESS_CPU', name: '프로세스 CPU', icon: 'bi-cpu', color: '#22c55e' },
      { id: 'PROCESS_MEM', name: '프로세스 Memory', icon: 'bi-memory', color: '#4ade80' },
    ]
  },
  TRAFFIC: {
    id: 'TRAFFIC',
    name: 'Traffic',
    icon: 'bi-arrow-left-right',
    color: '#06b6d4',
    elements: [
      { id: 'TRAFFIC_IN_BPS', name: 'Traffic IN (bps)', icon: 'bi-arrow-down', color: '#06b6d4' },
      { id: 'TRAFFIC_IN_BYTE', name: 'Traffic IN (byte)', icon: 'bi-arrow-down-circle', color: '#3b82f6' },
      { id: 'TRAFFIC_IN_PKT', name: 'Traffic IN (pkt)', icon: 'bi-arrow-down-square', color: '#0891b2' },
      { id: 'TRAFFIC_IN_ERR', name: 'Traffic IN (err)', icon: 'bi-x-circle', color: '#0e7490' },
      { id: 'TRAFFIC_OUT_BPS', name: 'Traffic OUT (bps)', icon: 'bi-arrow-up', color: '#22d3ee' },
      { id: 'TRAFFIC_OUT_BYTE', name: 'Traffic OUT (byte)', icon: 'bi-arrow-up-circle', color: '#a5f3fc' },
      { id: 'TRAFFIC_OUT_PKT', name: 'Traffic OUT (pkt)', icon: 'bi-arrow-up-square', color: '#67e8f9' },
      { id: 'TRAFFIC_OUT_ERR', name: 'Traffic OUT (err)', icon: 'bi-x-circle-fill', color: '#f59e0b' },
    ]
  },
  ICMP: {
    id: 'ICMP',
    name: 'ICMP',
    icon: 'bi-wifi',
    color: '#6366f1',
    elements: [
      { id: 'ICMP_MIN', name: 'ICMP Min', icon: 'bi-dash-lg', color: '#6366f1' },
      { id: 'ICMP_MAX', name: 'ICMP Max', icon: 'bi-arrow-bar-up', color: '#818cf8' },
      { id: 'ICMP_AVG', name: 'ICMP Avg', icon: 'bi-bar-chart', color: '#a5b4fc' },
      { id: 'ICMP_LOSS', name: 'ICMP Loss', icon: 'bi-exclamation-triangle', color: '#c7d2fe' },
    ]
  },
};

// 평면 역참조 맵 (id → element meta)
export const MONITORING_ELEMENTS = Object.values(MONITORING_GROUPS).reduce((acc, group) => {
  group.elements.forEach(element => { acc[element.id] = element; });
  return acc;
}, {});
