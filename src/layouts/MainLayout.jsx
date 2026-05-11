import { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import { usePageTracking } from '../hooks/usePageTracking';
import DailySummaryModal from '../components/DailySummaryModal';
import { getPageCategory } from '../shared/config/routeCategory';

export default function MainLayout() {
  const location = useLocation();
  usePageTracking();

  // LOGOUT_AT은 명시적 로그아웃 또는 Redis 세션 만료(SessionExpiredListener)에서만 기록
  // beforeunload beacon은 새로고침/탭 이동에도 발생하여 세션을 잘못 종료시키므로 제거

  // localStorage에서 초기 상태 로드
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebarCollapsed');
    return saved ? JSON.parse(saved) : false;
  });

  // 상태 변경 시 localStorage에 저장
  useEffect(() => {
    localStorage.setItem('sidebarCollapsed', JSON.stringify(sidebarCollapsed));
  }, [sidebarCollapsed]);

  const handleToggle = () => {
    setSidebarCollapsed((prev) => !prev);
  };

  return (
    <div className="app-layout">
      <Sidebar collapsed={sidebarCollapsed} onToggle={handleToggle} />
      <main className={`app-main ${sidebarCollapsed ? 'sidebar-collapsed' : ''} ${getPageCategory(location.pathname)}`}>
        <Outlet key={location.state?._refresh ?? location.key} />
        <DailySummaryModal />
      </main>
    </div>
  );
}
