// Dashboard 그리드 + 위젯 타입 정의 (서버 12칸 기준, 클라이언트 96칸 = 8배 스케일).

export const GRID_COLS = 96;
export const GRID_SCALE = 4;

// 기본 위젯 타입 (API 실패 시 폴백)
export const DEFAULT_WIDGET_TYPES = {
  TOPOLOGY: {
    id: 'TOPOLOGY',
    name: '토폴로지 Map',
    icon: 'bi-diagram-3',
    category: 'network',
    defaultW: 5,
    defaultH: 3,
    defaultConfig: {},
  },
  CPU_MEM_TOPN: {
    id: 'CPU_MEM_TOPN',
    name: 'CPU/MEM TOPN',
    icon: 'bi-cpu',
    category: 'chart',
    defaultW: 3,
    defaultH: 2,
    defaultConfig: {
      group: 'CPU_MEM',
      elements: ['CPU', 'MEMORY'],
      chartType: 'pie',
    },
  },
  TRAFFIC_TOPN: {
    id: 'TRAFFIC_TOPN',
    name: 'Traffic IN/OUT TOPN',
    icon: 'bi-bar-chart',
    category: 'chart',
    defaultW: 3,
    defaultH: 2,
    defaultConfig: {
      group: 'TRAFFIC',
      elements: ['TRAFFIC_IN_BPS', 'TRAFFIC_OUT_BPS'],
      chartType: 'bar',
    },
  },
  ALERT_LIST: {
    id: 'ALERT_LIST',
    name: '알람 리스트',
    icon: 'bi-bell',
    category: 'monitoring',
    defaultW: 5,
    defaultH: 2,
    defaultConfig: {},
  },
  FILESYSTEM_TOPN: {
    id: 'FILESYSTEM_TOPN',
    name: '파일시스템 TOPN',
    icon: 'bi-pie-chart',
    category: 'chart',
    defaultW: 3,
    defaultH: 2,
    defaultConfig: {
      group: 'FILE',
      elements: ['FILESYSTEM'],
      chartType: 'pie',
    },
  },
  TRAFFIC_TREND: {
    id: 'TRAFFIC_TREND',
    name: 'Traffic IN/OUT 추이',
    icon: 'bi-graph-up',
    category: 'chart',
    defaultW: 5,
    defaultH: 2,
    defaultConfig: {
      group: 'TRAFFIC',
      elements: ['TRAFFIC_IN_BPS', 'TRAFFIC_OUT_BPS'],
      chartType: 'line',
    },
  },
  CUSTOM: {
    id: 'CUSTOM',
    name: '사용자 정의',
    icon: 'bi-sliders',
    category: 'custom',
    defaultW: 5,
    defaultH: 2,
    defaultConfig: {},
  },
  REALTIME_ALERT: {
    id: 'REALTIME_ALERT',
    name: '실시간 장애 현황',
    icon: 'bi-exclamation-triangle',
    category: 'monitoring',
    defaultW: 5,
    defaultH: 3,
    defaultConfig: {},
  },
  ALERT_SUMMARY: {
    id: 'ALERT_SUMMARY',
    name: '장애 현황',
    icon: 'bi-bell-fill',
    category: 'monitoring',
    defaultW: 3,
    defaultH: 2,
    defaultConfig: {},
  },
  DEVICE_SUMMARY: {
    id: 'DEVICE_SUMMARY',
    name: '종합 현황',
    icon: 'bi-grid-3x3-gap-fill',
    category: 'monitoring',
    defaultW: 3,
    defaultH: 2,
    defaultConfig: {},
  },
  USER_TOPOLOGY: {
    id: 'USER_TOPOLOGY',
    name: '사용자 토폴로지',
    icon: 'bi-person-workspace',
    category: 'network',
    defaultW: 5,
    defaultH: 3,
    defaultConfig: {},
  },
};

export const CATEGORIES = {
  all: { label: '전체', icon: 'bi-grid-3x3-gap' },
  network: { label: '네트워크', icon: 'bi-diagram-3' },
  monitoring: { label: '모니터링', icon: 'bi-display' },
  chart: { label: '차트', icon: 'bi-bar-chart' },
  custom: { label: '사용자 정의', icon: 'bi-sliders' },
  info: { label: '정보', icon: 'bi-info-circle' },
};


// 초기 위젯 배치
export const initialWidgets = [
  { id: 'w0', type: 'TOPOLOGY', title: '토폴로지 Map', config: DEFAULT_WIDGET_TYPES.TOPOLOGY.defaultConfig },
  { id: 'w1', type: 'CPU_MEM_TOPN', title: 'CPU/MEM TOPN', config: DEFAULT_WIDGET_TYPES.CPU_MEM_TOPN.defaultConfig },
  { id: 'w2', type: 'TRAFFIC_TOPN', title: 'Traffic IN/OUT TOPN', config: DEFAULT_WIDGET_TYPES.TRAFFIC_TOPN.defaultConfig },
  { id: 'w3', type: 'ALERT_LIST', title: '알람 리스트', config: DEFAULT_WIDGET_TYPES.ALERT_LIST.defaultConfig },
  { id: 'w4', type: 'FILESYSTEM_TOPN', title: '파일시스템 TOPN', config: DEFAULT_WIDGET_TYPES.FILESYSTEM_TOPN.defaultConfig },
  { id: 'w5', type: 'TRAFFIC_TREND', title: 'Traffic IN/OUT 추이', config: DEFAULT_WIDGET_TYPES.TRAFFIC_TREND.defaultConfig },
];

// 초기 레이아웃 (96칸 클라이언트 기준, GRID_SCALE=4 적용된 값)
export const initialLayout = [
  { i: 'w0', x: 0,  y: 0,  w: 20, h: 12, minW: 1, minH: 1, maxH: 80 },  // 토폴로지
  { i: 'w1', x: 20, y: 0,  w: 12, h: 8,  minW: 1, minH: 1, maxH: 80 },  // CPU/MEM TOPN
  { i: 'w2', x: 32, y: 0,  w: 12, h: 8,  minW: 1, minH: 1, maxH: 80 },  // Traffic TOPN
  { i: 'w3', x: 0,  y: 12, w: 20, h: 8,  minW: 1, minH: 1, maxH: 80 },  // 알람 리스트
  { i: 'w4', x: 20, y: 8,  w: 12, h: 8,  minW: 1, minH: 1, maxH: 80 },  // 파일시스템 TOPN
  { i: 'w5', x: 32, y: 8,  w: 12, h: 8,  minW: 1, minH: 1, maxH: 80 },  // Traffic 추이
];

