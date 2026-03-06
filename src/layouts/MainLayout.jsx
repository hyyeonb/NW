import { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from '../components/Sidebar';

export default function MainLayout() {
  const location = useLocation();

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
      <main className={`app-main ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
        <Outlet />
      </main>
    </div>
  );
}
