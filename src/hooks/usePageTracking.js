import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { historyApi } from '../api/history';
import { useAuthStore } from '../stores/authStore';

// 경로 → pageCode 매핑
const PATH_TO_PAGE_CODE = {
  '/dashboard': 'dashboard',
  '/topology': 'topology',
  '/user-topology': 'user_topology',
  '/mgmt/groups': 'group_mgmt',
  '/mgmt/assets': 'asset_mgmt',
  '/mgmt/asset-config': 'asset_config',
  '/mgmt/new-assets': 'new_asset_mgmt',
  '/mgmt/models': 'model_mgmt',
  '/history/ssh-sessions': 'ssh_sessions',
  '/history/login': 'login_history',
  '/fault/realtime': 'fault_realtime',
  '/fault/history': 'fault_history',
  '/fault/stats': 'fault_stats',
  '/watch/realtime': 'watch_realtime',
  '/board/files': 'board_files',
  '/board/notices': 'board_notices',
  '/perf/stats': 'perf_stats',
  '/tools/traceroute': 'traceroute',
  '/settings/admin': 'system_admin',
};

export function usePageTracking() {
  const location = useLocation();
  const prevPathRef = useRef(null);
  const { isAuthenticated } = useAuthStore();

  useEffect(() => {
    if (!isAuthenticated) return;

    const path = location.pathname;
    if (path === prevPathRef.current) return;
    prevPathRef.current = path;

    const pageCode = PATH_TO_PAGE_CODE[path] || '';
    historyApi.recordPageView(pageCode, path);
  }, [location.pathname, isAuthenticated]);
}
