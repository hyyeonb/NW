import { useState, useRef, useEffect, memo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore, useThemeStore, usePermissionStore } from '../stores';

// 메뉴 구조 — pageCode 추가
const MENU_ITEMS = [
  {
    icon: 'bi-speedometer2',
    label: '대시보드',
    children: [
      { label: '통합 대시보드', path: '/dashboard', icon: 'bi-grid-1x2', pageCode: 'dashboard' },
      { label: '토폴로지', path: '/topology', icon: 'bi-diagram-3', pageCode: 'topology' },
      { label: '사용자 토폴로지', path: '/user-topology', icon: 'bi-person-workspace', pageCode: 'user_topology' },
    ],
  },
  {
    icon: 'bi-activity',
    label: '성능감시',
    children: [
      { label: '실시간 성능감시', path: '/watch/realtime', icon: 'bi-speedometer', pageCode: 'watch_realtime' },
      { label: '성능 통계', path: '/perf/stats', icon: 'bi-bar-chart-line', pageCode: 'perf_stats' },
    ],
  },
  {
    icon: 'bi-exclamation-triangle',
    label: '장애감시',
    children: [
      { label: '실시간 장애감시', path: '/fault/realtime', icon: 'bi-broadcast', pageCode: 'fault_realtime' },
      { label: '장애이력', path: '/fault/history', icon: 'bi-clock-history', pageCode: 'fault_history' },
      { label: '장애통계', path: '/fault/stats', icon: 'bi-bar-chart-line', pageCode: 'fault_stats' },
    ],
  },
  {
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
    icon: 'bi-clock-history',
    label: '이력 관리',
    children: [
      { label: '로그인 이력', path: '/history/login', icon: 'bi-box-arrow-in-right', pageCode: 'login_history' },
      { label: 'SSH 접속 이력', path: '/history/ssh-sessions', icon: 'bi-terminal', pageCode: 'ssh_sessions' },
    ],
  },
  {
    icon: 'bi-tools',
    label: '네트워크 도구',
    children: [
      { label: 'Traceroute', path: '/tools/traceroute', icon: 'bi-signpost-split', pageCode: 'traceroute' },
    ],
  },
  {
    icon: 'bi-clipboard2-data',
    label: '게시판',
    children: [
      { label: '자료실', path: '/board/files', icon: 'bi-folder2-open', pageCode: 'board_files' },
      { label: '공지사항', path: '/board/notices', icon: 'bi-megaphone', pageCode: 'board_notices' },
    ],
  },
  {
    icon: 'bi-gear-fill',
    label: '설정',
    children: [
      { label: '테마 설정', icon: 'bi-palette', isThemeToggle: true },
      { label: '계정 설정', path: '/settings/account', icon: 'bi-person-gear' },
      { label: '알림 설정', path: '/settings/notifications', icon: 'bi-bell' },
      { label: '사용자 관리', path: '/settings/admin', icon: 'bi-shield-lock', pageCode: 'system_admin' },
      { label: '임계치 관리', path: '/settings/threshold', icon: 'bi-speedometer2', pageCode: 'system_admin' },
      { label: '수집 서버 관리', path: '/settings/middleware', icon: 'bi-hdd-network', pageCode: 'system_admin' },
    ],
  },
];

export default memo(function Sidebar({ collapsed, onToggle }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { resolvedTheme, toggleTheme, initTheme } = useThemeStore();
  const { canView, isAdmin } = usePermissionStore();
  const [expandedMenus, setExpandedMenus] = useState(() => {
    // 현재 경로가 속한 메뉴를 초기에 열어둠
    const initial = {};
    MENU_ITEMS.forEach((item, idx) => {
      if (item.children?.some(c => window.location.pathname === c.path)) {
        initial[idx] = true;
      }
    });
    return initial;
  });
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const profileRef = useRef(null);

  useEffect(() => {
    initTheme();
  }, [initTheme]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setShowProfileMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    await logout();
    window.location.href = '/login';
  };

  const toggleMenu = (index) => {
    setExpandedMenus((prev) => {
      // 아코디언: 클릭한 메뉴가 이미 열려있으면 닫고, 아니면 해당 메뉴만 열기
      if (prev[index]) {
        return { ...prev, [index]: false };
      }
      // 다른 메뉴 모두 닫고 클릭한 메뉴만 열기
      const next = {};
      next[index] = true;
      return next;
    });
  };

  const handleMenuClick = (index, hasChildren) => {
    if (collapsed) {
      onToggle();
      if (hasChildren) {
        setTimeout(() => {
          setExpandedMenus({ [index]: true });
        }, 100);
      }
    } else if (hasChildren) {
      toggleMenu(index);
    }
  };

  const isActive = (path) => location.pathname === path;
  const isChildActive = (children) => children?.some((c) => location.pathname === c.path);

  // 권한 기반 메뉴 필터링
  const filterChildren = (children) => {
    if (!children) return [];
    return children.filter((child) => {
      // adminOnly 메뉴는 isAdmin일 때만 표시
      if (child.adminOnly && !isAdmin) return false;
      // pageCode가 있으면 canView 체크
      if (child.pageCode && !isAdmin && !canView(child.pageCode)) return false;
      return true;
    });
  };

  return (
    <aside className={`app-sidebar ${collapsed ? 'collapsed' : ''}`}>
      <button className="sidebar-toggle" onClick={onToggle} title={collapsed ? '메뉴 펼치기' : '메뉴 접기'}>
        <i className={`bi ${collapsed ? 'bi-chevron-right' : 'bi-chevron-left'}`}></i>
      </button>

      <div className="sidebar-logo">
        <Link to="/dashboard">
          <img src="/logo-single.svg" alt="Logo" className="logo-single logo-animated" />
          {!collapsed && (
            <img src="/logo-text-dark.svg" alt="InfoMap" className="logo-text" />
          )}
        </Link>
      </div>

      <nav className="sidebar-menu">
        <ul>
          {MENU_ITEMS.map((item, index) => {
            const visibleChildren = filterChildren(item.children);
            // 하위 메뉴가 모두 숨겨지면 상위 메뉴도 숨김
            if (item.children && visibleChildren.length === 0) return null;

            return (
            <li key={index} className={`menu-item ${visibleChildren.length > 0 ? 'has-children' : ''} ${isChildActive(visibleChildren) ? 'child-active' : ''}`}>
              {item.path ? (
                <Link
                  to={item.path}
                  className={`menu-link ${isActive(item.path) ? 'active' : ''}`}
                  title={collapsed ? item.label : ''}
                >
                  <i className={`bi ${item.icon}`}></i>
                  {!collapsed && <span>{item.label}</span>}
                </Link>
              ) : (
                <>
                  <div
                    className={`menu-link ${isChildActive(visibleChildren) ? 'active' : ''}`}
                    onClick={() => handleMenuClick(index, true)}
                    title={collapsed ? item.label : ''}
                  >
                    <i className={`bi ${item.icon}`}></i>
                    {!collapsed && (
                      <>
                        <span>{item.label}</span>
                        <i className={`bi bi-chevron-down submenu-arrow ${expandedMenus[index] ? 'expanded' : ''}`}></i>
                      </>
                    )}
                  </div>

                  {visibleChildren.length > 0 && !collapsed && (
                    <ul className={`submenu ${expandedMenus[index] ? 'expanded' : ''}`}>
                      {visibleChildren.map((child, childIndex) => (
                        <li key={childIndex}>
                          {child.isThemeToggle ? (
                            <div
                              className="submenu-link theme-toggle-item"
                              onClick={toggleTheme}
                            >
                              {child.icon && <i className={`bi ${child.icon}`}></i>}
                              <span>{child.label}</span>
                              <div className="theme-toggle-switch">
                                <i className={`bi ${resolvedTheme === 'dark' ? 'bi-moon-fill' : 'bi-sun-fill'}`}></i>
                                <span className="theme-label">{resolvedTheme === 'dark' ? '다크' : '라이트'}</span>
                              </div>
                            </div>
                          ) : (
                            <a
                              href={child.path}
                              className={`submenu-link ${isActive(child.path) ? 'active' : ''}`}
                              onClick={(e) => {
                                e.preventDefault();
                                if (location.pathname === child.path) {
                                  navigate(child.path, { state: { _refresh: Date.now() }, replace: true });
                                } else {
                                  navigate(child.path);
                                }
                              }}
                            >
                              {child.icon && <i className={`bi ${child.icon}`}></i>}
                              <span>{child.label}</span>
                            </a>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </li>
          );
          })}
        </ul>
      </nav>

      <div className="sidebar-profile" ref={profileRef}>
        <div
          className={`profile-trigger ${showProfileMenu ? 'active' : ''}`}
          onClick={() => setShowProfileMenu(!showProfileMenu)}
          title={collapsed ? user?.NAME || '사용자' : ''}
        >
          {user?.PROFILE_IMAGE ? (
            <img src={user.PROFILE_IMAGE} alt="프로필" className="profile-avatar" />
          ) : (
            <div className="profile-avatar default">
              {user?.NAME?.charAt(0) || 'U'}
            </div>
          )}
          {!collapsed && (
            <div className="profile-info">
              <span className="profile-name" title={user?.NAME || '사용자'}>{user?.NAME || '사용자'}</span>
              <span className="profile-email" title={user?.EMAIL || ''}>{user?.EMAIL || ''}</span>
            </div>
          )}
          {!collapsed && (
            <i className={`bi bi-chevron-up profile-arrow ${showProfileMenu ? 'expanded' : ''}`}></i>
          )}
        </div>

        {showProfileMenu && (
          <div className="profile-dropdown">
            <div className="profile-dropdown-header">
              <div className="profile-avatar-large">
                {user?.PROFILE_IMAGE ? (
                  <img src={user.PROFILE_IMAGE} alt="프로필" />
                ) : (
                  <span>{user?.NAME?.charAt(0) || 'U'}</span>
                )}
              </div>
              <div className="profile-dropdown-info">
                <span className="name" title={user?.NAME || '사용자'}>{user?.NAME || '사용자'}</span>
                <span className="email" title={user?.EMAIL || ''}>{user?.EMAIL || ''}</span>
              </div>
            </div>
            <div className="profile-dropdown-divider"></div>
            <button className="profile-dropdown-item logout" onClick={handleLogout}>
              <i className="bi bi-box-arrow-right"></i>
              <span>로그아웃</span>
            </button>
          </div>
        )}
      </div>
    </aside>
  );
})
