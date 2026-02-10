import { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores';

export default function Sidebar({ collapsed, onToggle }) {
  const location = useLocation();
  const { user, logout } = useAuthStore();
  const [expandedMenus, setExpandedMenus] = useState({});
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const profileRef = useRef(null);

  // 프로필 메뉴 외부 클릭 시 닫기
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

  const menuItems = [
    {
      icon: 'bi-speedometer2',
      label: '대시보드',
      children: [
        { label: '통합 대시보드', path: '/dashboard', icon: 'bi-grid-1x2' },
        { label: '네트워크 토폴로지', path: '/topology', icon: 'bi-diagram-3' },
      ],
    },
    {
      icon: 'bi-exclamation-triangle',
      label: '장애감시',
      children: [
        { label: '실시간 장애감시', path: '/fault/realtime', icon: 'bi-broadcast' },
        { label: '장애이력', path: '/fault/history', icon: 'bi-clock-history' },
      ],
    },
    {
      icon: 'bi-gear',
      label: '종합분석',
      children: [
        { label: '그룹 관리', path: '/mgmt/groups', icon: 'bi-folder' },
        { label: '자산 관리', path: '/mgmt/assets', icon: 'bi-hdd-network' },
        { label: '자산 Config 관리', path: '/mgmt/asset-config', icon: 'bi-sliders' },
        { label: '신규 자산 관리', path: '/mgmt/new-assets', icon: 'bi-plus-circle' },
        { label: '모델 관리', path: '/mgmt/models', icon: 'bi-cpu' },
      ],
    },
    { icon: 'bi-gear-fill', label: '설정', path: '/settings' },
  ];

  const toggleMenu = (index) => {
    setExpandedMenus((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

  // 접힌 상태에서 메뉴 클릭 시 사이드바 열기
  const handleMenuClick = (index, hasChildren) => {
    if (collapsed) {
      onToggle(); // 사이드바 열기
      if (hasChildren) {
        // 약간의 딜레이 후 서브메뉴도 열기
        setTimeout(() => {
          setExpandedMenus((prev) => ({ ...prev, [index]: true }));
        }, 100);
      }
    } else if (hasChildren) {
      toggleMenu(index);
    }
  };

  const isActive = (path) => location.pathname === path;
  const isChildActive = (children) => children?.some((c) => location.pathname === c.path);

  return (
    <aside className={`app-sidebar ${collapsed ? 'collapsed' : ''}`}>
      {/* 토글 버튼 */}
      <button className="sidebar-toggle" onClick={onToggle} title={collapsed ? '메뉴 펼치기' : '메뉴 접기'}>
        <i className={`bi ${collapsed ? 'bi-chevron-right' : 'bi-chevron-left'}`}></i>
      </button>

      {/* 로고 */}
      <div className="sidebar-logo">
        <Link to="/dashboard">
          <img src="/logo-single.svg" alt="Logo" className="logo-single logo-animated" />
          {!collapsed && (
            <img src="/logo-text-dark.svg" alt="InfoMap" className="logo-text" />
          )}
        </Link>
      </div>

      {/* 메뉴 */}
      <nav className="sidebar-menu">
        <ul>
          {menuItems.map((item, index) => (
            <li key={index} className={`menu-item ${item.children ? 'has-children' : ''} ${isChildActive(item.children) ? 'child-active' : ''}`}>
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
                    className={`menu-link ${isChildActive(item.children) ? 'active' : ''}`}
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

                  {/* 서브메뉴 */}
                  {item.children && !collapsed && (
                    <ul className={`submenu ${expandedMenus[index] ? 'expanded' : ''}`}>
                      {item.children.map((child, childIndex) => (
                        <li key={childIndex}>
                          <Link
                            to={child.path}
                            className={`submenu-link ${isActive(child.path) ? 'active' : ''}`}
                          >
                            {child.icon && <i className={`bi ${child.icon}`}></i>}
                            <span>{child.label}</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}

                </>
              )}
            </li>
          ))}
        </ul>
      </nav>

      {/* 사용자 프로필 영역 */}
      <div className="sidebar-profile" ref={profileRef}>
        <div
          className={`profile-trigger ${showProfileMenu ? 'active' : ''}`}
          onClick={() => setShowProfileMenu(!showProfileMenu)}
          title={collapsed ? user?.NAME || '사용자' : ''}
        >
          {user?.PROFILE_IMAGE ? (
            <img
              src={user.PROFILE_IMAGE}
              alt="프로필"
              className="profile-avatar"
            />
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

        {/* 프로필 드롭다운 메뉴 */}
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
}
