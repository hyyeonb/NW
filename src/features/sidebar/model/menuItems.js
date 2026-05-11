// Sidebar 메뉴 항목 정의 (pageCode와 path 포함).

export const MENU_ITEMS = [
  {
    colorClass: 'c-blue',
    icon: 'bi-speedometer2',
    label: '대시보드',
    children: [
      { label: '통합 대시보드', path: '/dashboard', icon: 'bi-grid-1x2', pageCode: 'dashboard' },
      { label: '토폴로지', path: '/topology', icon: 'bi-diagram-3', pageCode: 'topology' },
    ],
  },
  {
    colorClass: 'c-emerald',
    icon: 'bi-activity',
    label: '성능감시',
    children: [
      { label: '실시간 성능감시', path: '/watch/realtime', icon: 'bi-speedometer', pageCode: 'watch_realtime' },
      { label: '성능 통계', path: '/perf/stats', icon: 'bi-bar-chart-line', pageCode: 'perf_stats' },
      { label: '성능 감시', path: '/perf/explorer', icon: 'bi-graph-up', pageCode: 'perf_stats' },
    ],
  },
  {
    colorClass: 'c-red',
    icon: 'bi-exclamation-triangle',
    label: '장애감시',
    children: [
      { label: '실시간 장애감시', path: '/fault/realtime', icon: 'bi-broadcast', pageCode: 'fault_realtime' },
      { label: '장애이력', path: '/fault/history', icon: 'bi-clock-history', pageCode: 'fault_history' },
      { label: '장애통계', path: '/fault/stats', icon: 'bi-bar-chart-line', pageCode: 'fault_stats' },
    ],
  },
  {
    colorClass: 'c-violet',
    icon: 'bi-gear',
    label: '종합분석',
    children: [
      { label: '그룹 관리', path: '/mgmt/groups', icon: 'bi-folder', pageCode: 'group_mgmt' },
      { label: '자산 관리', path: '/mgmt/assets', icon: 'bi-hdd-network', pageCode: 'asset_mgmt' },
      { label: '자산 Config 관리', path: '/mgmt/asset-config', icon: 'bi-sliders', pageCode: 'asset_config' },
      { label: '신규 자산 관리', path: '/mgmt/new-assets', icon: 'bi-plus-circle', pageCode: 'new_asset_mgmt' },
      { label: '모델 관리', path: '/mgmt/models', icon: 'bi-cpu', pageCode: 'model_mgmt' },
    ],
  },
  {
    colorClass: 'c-amber',
    icon: 'bi-clock-history',
    label: '이력 관리',
    children: [
      { label: '로그인 이력', path: '/history/login', icon: 'bi-box-arrow-in-right', pageCode: 'login_history' },
      { label: 'SSH 접속 이력', path: '/history/ssh-sessions', icon: 'bi-terminal', pageCode: 'ssh_sessions' },
    ],
  },
  {
    colorClass: 'c-cyan',
    icon: 'bi-tools',
    label: '네트워크 도구',
    children: [
      { label: 'Traceroute', path: '/tools/traceroute', icon: 'bi-signpost-split', pageCode: 'traceroute' },
    ],
  },
  {
    colorClass: 'c-pink',
    icon: 'bi-clipboard2-data',
    label: '게시판',
    children: [
      { label: '자료실', path: '/board/files', icon: 'bi-folder2-open', pageCode: 'board_files' },
      { label: '공지사항', path: '/board/notices', icon: 'bi-megaphone', pageCode: 'board_notices' },
    ],
  },
  {
    colorClass: 'c-slate',
    icon: 'bi-gear-fill',
    label: '설정',
    children: [
      { label: '테마 설정', icon: 'bi-palette', isThemeToggle: true },
      { label: '계정 설정', path: '/settings/account', icon: 'bi-person-gear' },
      { label: '알림 설정', path: '/settings/notifications', icon: 'bi-bell' },
      { label: '사용자 관리', path: '/settings/admin', icon: 'bi-shield-lock', pageCode: 'system_admin' },
      { label: '임계치 관리', path: '/settings/threshold', icon: 'bi-speedometer2', pageCode: 'system_admin' },
      { label: '수집 서버 관리', path: '/settings/middleware', icon: 'bi-hdd-rack', pageCode: 'system_admin' },
    ],
  },
];
