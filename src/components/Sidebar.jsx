import { useState, useRef, useEffect, memo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useThemeStore } from '../stores/themeStore';
import { usePermissionStore } from '../stores/permissionStore';
import { MENU_ITEMS } from '../features/sidebar/model/menuItems';

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
            <img
              src={resolvedTheme === 'light' ? '/logo-text-light.svg' : '/logo-text-dark.svg'}
              alt="InfoMap"
              className="logo-text"
            />
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
            <li key={index} className={`menu-item ${item.colorClass || ''} ${visibleChildren.length > 0 ? 'has-children' : ''} ${isChildActive(visibleChildren) ? 'child-active' : ''}`}>
              {item.path ? (
                <a
                  href={item.path}
                  className={`menu-link ${isActive(item.path) ? 'active' : ''}`}
                  title={collapsed ? item.label : ''}
                  onClick={(e) => {
                    e.preventDefault();
                    navigate(item.path, { state: { _refresh: Date.now() }, replace: location.pathname === item.path });
                  }}
                >
                  <div className="icon-box"><i className={`bi ${item.icon}`}></i></div>
                  {!collapsed && <span>{item.label}</span>}
                </a>
              ) : (
                <>
                  <div
                    className={`menu-link ${isChildActive(visibleChildren) ? 'active' : ''}`}
                    onClick={() => handleMenuClick(index, true)}
                    title={collapsed ? item.label : ''}
                  >
                    <div className="icon-box"><i className={`bi ${item.icon}`}></i></div>
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
                            <div className="submenu-link theme-toggle-item">
                              <div className="theme-toggle-segmented" role="group">
                                <button
                                  type="button"
                                  className={`theme-seg ${resolvedTheme === 'light' ? 'active' : ''}`}
                                  onClick={(e) => { e.stopPropagation(); if (resolvedTheme !== 'light') toggleTheme(); }}
                                >
                                  <i className="bi bi-sun-fill"></i>
                                  <span>라이트</span>
                                </button>
                                <button
                                  type="button"
                                  className={`theme-seg ${resolvedTheme === 'dark' ? 'active' : ''}`}
                                  onClick={(e) => { e.stopPropagation(); if (resolvedTheme !== 'dark') toggleTheme(); }}
                                >
                                  <i className="bi bi-moon-fill"></i>
                                  <span>다크</span>
                                </button>
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
