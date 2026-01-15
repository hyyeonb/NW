import { Link, useLocation } from 'react-router-dom';
import { useState, useRef, useEffect } from 'react';
import { useAuthStore } from '../stores';

export default function Header() {
  const location = useLocation();
  const { user, logout } = useAuthStore();
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

  const menuItems = [
    {
      label: '대시보드',
      children: [
        { label: '실시간 현황', path: '/dashboard/realtime' },
        { label: '통계 분석', path: '/dashboard/statistics' },
        { label: '리포트', path: '/dashboard/reports' },
      ],
    },
    { label: '모니터링', path: '/dashboard' },
    {
      label: '종합분석',
      children: [
        { label: '그룹 관리', path: '/mgmt/groups' },
        { label: '자산 관리', path: '/mgmt/assets' },
        { label: '신규자산관리', path: '/mgmt/new-assets' },
        { label: '시스템 관리', path: '/mgmt/system' },
        { label: '사용자 관리', path: '/mgmt/users' },
      ],
    },
    { label: '게시판', path: '/board' },
    { label: '설정', path: '/settings' },
  ];

  const handleLogout = async () => {
    await logout();
    window.location.href = '/login';
  };

  return (
    <header className="top-nav-bar">
      <div className="nav-container">
        {/* Logo */}
        <div className="logo-section">
          <Link to="/dashboard" className="logo-link">
            <div className="logo-text">
              <span className="logo-main">Project</span>
              <span className="logo-sub">Management System</span>
            </div>
          </Link>
        </div>

        {/* Menu */}
        <nav className="menu-section">
          <ul>
            {menuItems.map((item, index) => (
              <li key={index} className={item.children ? 'dropdown' : ''}>
                {item.path ? (
                  <Link
                    to={item.path}
                    className={location.pathname === item.path ? 'active' : ''}
                  >
                    {item.label}
                  </Link>
                ) : (
                  <a href="#">{item.label}</a>
                )}

                {/* Dropdown Menu */}
                {item.children && (
                  <ul className="dropdown-menu">
                    {item.children.map((child, childIndex) => (
                      <li key={childIndex}>
                        <Link
                          to={child.path}
                          className={location.pathname === child.path ? 'active' : ''}
                        >
                          {child.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </nav>

        {/* Profile */}
        <div className="profile-section" ref={profileRef}>
          <div
            className="profile-trigger"
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}
          >
{user?.PROFILE_IMAGE ? (
              <img
                id="user-profile-pic"
                src={user.PROFILE_IMAGE}
                alt="사용자 프로필"
                className="profile-pic"
              />
            ) : (
              <div
                className="profile-pic"
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  fontWeight: '600',
                  fontSize: '14px',
                }}
              >
                {user?.NAME?.charAt(0) || 'U'}
              </div>
            )}
            <span id="username-display" className="username">
              {user?.NAME || '로딩중...'}
            </span>
            <svg
              style={{
                width: '12px',
                height: '12px',
                marginLeft: '6px',
                transition: 'transform 0.2s',
                transform: showProfileMenu ? 'rotate(180deg)' : 'rotate(0deg)'
              }}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </div>

          {/* Profile Dropdown Menu */}
          {showProfileMenu && (
            <div
              className="profile-dropdown"
              style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                marginTop: '8px',
                background: 'rgba(30, 41, 59, 0.98)',
                border: '1px solid rgba(71, 85, 105, 0.5)',
                borderRadius: '12px',
                boxShadow: '0 10px 40px rgba(0, 0, 0, 0.3)',
                minWidth: '180px',
                padding: '8px 0',
                zIndex: 1000,
              }}
            >
              <div
                style={{
                  padding: '12px 16px',
                  borderBottom: '1px solid rgba(71, 85, 105, 0.3)',
                  color: '#94a3b8',
                  fontSize: '12px',
                }}
              >
                {user?.EMAIL || '사용자'}
              </div>
              <button
                onClick={handleLogout}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  background: 'none',
                  border: 'none',
                  color: '#f87171',
                  fontSize: '14px',
                  textAlign: 'left',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(248, 113, 113, 0.1)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                  <polyline points="16 17 21 12 16 7"></polyline>
                  <line x1="21" y1="12" x2="9" y2="12"></line>
                </svg>
                로그아웃
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
