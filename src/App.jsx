import React, { useEffect, useState, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from './stores';
import MainLayout from './layouts/MainLayout';
import { Login, Signup, SignupSuccess, FindAccount, SocialLoginLanding } from './pages';
import AlertToast from './components/AlertToast';
import UrgentNoticePopup from './components/UrgentNoticePopup';
import GlobalTooltip from './components/GlobalTooltip';
import PermissionGuard from './components/PermissionGuard';
import { useAlertWebSocket } from './hooks';

// 무거운 보호 페이지 — lazy import
const Dashboard = lazy(() => import('./pages/Dashboard'));
const NetworkTopology = lazy(() => import('./pages/NetworkTopology'));
const UserTopology = lazy(() => import('./pages/UserTopology'));
const AssetManagement = lazy(() => import('./pages/AssetManagement'));
const PerformanceTest = lazy(() => import('./pages/PerformanceTest'));
const RealtimePerformance = lazy(() => import('./pages/RealtimePerformance'));
const FaultStats = lazy(() => import('./pages/FaultStats'));
const GroupManagement = lazy(() => import('./pages/GroupManagement'));
const AssetConfig = lazy(() => import('./pages/AssetConfig'));
const AssetConfigDetail = lazy(() => import('./pages/AssetConfigDetail'));
const NewAssetManagement = lazy(() => import('./pages/NewAssetManagement'));
const ModelManagement = lazy(() => import('./pages/ModelManagement'));
const RealtimeFault = lazy(() => import('./pages/RealtimeFault'));
const FaultHistory = lazy(() => import('./pages/FaultHistory'));
const FileBoard = lazy(() => import('./pages/FileBoard'));
const NoticeBoard = lazy(() => import('./pages/NoticeBoard'));
const SshSessionHistory = lazy(() => import('./pages/SshSessionHistory'));
const LoginHistory = lazy(() => import('./pages/LoginHistory'));
const Traceroute = lazy(() => import('./pages/Traceroute'));
const SystemAdmin = lazy(() => import('./pages/SystemAdmin'));
const ThresholdManagement = lazy(() => import('./pages/ThresholdManagement'));
const AdminStyleTest = lazy(() => import('./pages/AdminStyleTest'));
const AccountSettings = lazy(() => import('./pages/AccountSettings'));
const NotificationSettings = lazy(() => import('./pages/NotificationSettings'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 1,
    },
  },
});

function FullScreenLoader({ message }) {
  return (
    <div className="login-page">
      <div className="background-animation">
        <div className="floating-shape shape-1"></div>
        <div className="floating-shape shape-2"></div>
        <div className="floating-shape shape-3"></div>
      </div>
      <div className="login-transition-overlay">
        <div className="login-transition-content">
          <img src="/logo-single.svg" alt="" className="login-transition-logo" />
          <div className="login-transition-spinner" />
          <p className="login-transition-text">{message}</p>
        </div>
      </div>
    </div>
  );
}

function AuthProvider({ children }) {
  const { isAuthenticated, isLoginTransitioning, clearLoginTransition, fetchCurrentUser, validateSession } = useAuthStore();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const checkSession = async () => {
      if (isAuthenticated) {
        try {
          const isValid = await validateSession();
          if (isValid) {
            await fetchCurrentUser();
          }
        } catch (error) {
          console.error('Session validation failed:', error);
        }
      }
      setIsChecking(false);
    };

    checkSession();

    // 5분마다 세션 유효성 체크 (30분 만료 대비)
    const interval = setInterval(async () => {
      if (useAuthStore.getState().isAuthenticated) {
        try {
          await validateSession();
        } catch (e) {
          // 401 → axios interceptor가 로그아웃 처리
        }
      }
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (isLoginTransitioning) {
      const timer = setTimeout(() => {
        clearLoginTransition();
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [isLoginTransitioning, clearLoginTransition]);

  if (isChecking) {
    return <FullScreenLoader message="세션 확인 중..." />;
  }

  if (isLoginTransitioning) {
    return <FullScreenLoader message="로그인 성공" />;
  }

  return children;
}

function AlertWebSocketProvider({ children }) {
  const { isAuthenticated } = useAuthStore();
  useAlertWebSocket({ autoConnect: isAuthenticated });
  return children;
}

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught:', error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--theme-bg-primary, #0f0f23)', color: 'var(--theme-text-primary)', gap: '16px' }}>
          <i className="bi bi-exclamation-triangle" style={{ fontSize: '48px', color: '#ef4444' }}></i>
          <h2 style={{ margin: 0 }}>페이지 로드 중 오류가 발생했습니다</h2>
          <p style={{ color: '#94a3b8', margin: 0 }}>{this.state.error?.message}</p>
          <button onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload(); }}
            style={{ padding: '10px 24px', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff', cursor: 'pointer', fontSize: '14px' }}>
            새로고침
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuthStore();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  return children;
}

function PublicRoute({ children }) {
  const { isAuthenticated } = useAuthStore();
  const location = useLocation();

  if (isAuthenticated) {
    const from = location.state?.from || '/dashboard';
    return <Navigate to={from} replace />;
  }

  return children;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ErrorBoundary>
        <AuthProvider>
          <AlertWebSocketProvider>
            <AlertToast />
            <UrgentNoticePopup />
            <GlobalTooltip />
            <Suspense fallback={
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--theme-bg-primary, #0f0f23)' }}>
                <div className="login-transition-spinner" />
              </div>
            }>
            <Routes>
            {/* Public Routes */}
            <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
            <Route path="/signup" element={<PublicRoute><Signup /></PublicRoute>} />
            <Route path="/find-account" element={<PublicRoute><FindAccount /></PublicRoute>} />
            <Route path="/social-login/:provider" element={<PublicRoute><SocialLoginLanding /></PublicRoute>} />
            <Route path="/signup-success" element={<ProtectedRoute><SignupSuccess /></ProtectedRoute>} />

            {/* Protected Routes */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <MainLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<PermissionGuard pageCode="dashboard"><Dashboard /></PermissionGuard>} />
              <Route path="topology" element={<PermissionGuard pageCode="topology"><NetworkTopology /></PermissionGuard>} />
              <Route path="user-topology" element={<PermissionGuard pageCode="user_topology"><UserTopology /></PermissionGuard>} />
              <Route path="mgmt/groups" element={<PermissionGuard pageCode="group_mgmt"><GroupManagement /></PermissionGuard>} />
              <Route path="mgmt/assets" element={<PermissionGuard pageCode="asset_mgmt"><AssetManagement /></PermissionGuard>} />
              <Route path="mgmt/asset-config" element={<PermissionGuard pageCode="asset_config"><AssetConfig /></PermissionGuard>} />
              <Route path="mgmt/asset-config/:deviceId" element={<PermissionGuard pageCode="asset_config"><AssetConfigDetail /></PermissionGuard>} />
              <Route path="mgmt/new-assets" element={<PermissionGuard pageCode="new_asset_mgmt"><NewAssetManagement /></PermissionGuard>} />
              <Route path="mgmt/models" element={<PermissionGuard pageCode="model_mgmt"><ModelManagement /></PermissionGuard>} />
              <Route path="history/login" element={<PermissionGuard pageCode="login_history"><LoginHistory /></PermissionGuard>} />
              <Route path="history/ssh-sessions" element={<PermissionGuard pageCode="ssh_sessions"><SshSessionHistory /></PermissionGuard>} />
              {/* Redirect old SSH path */}
              <Route path="mgmt/ssh-sessions" element={<Navigate to="/history/ssh-sessions" replace />} />
              <Route path="fault/realtime" element={<PermissionGuard pageCode="fault_realtime"><RealtimeFault /></PermissionGuard>} />
              <Route path="fault/history" element={<PermissionGuard pageCode="fault_history"><FaultHistory /></PermissionGuard>} />
              <Route path="fault/stats" element={<PermissionGuard pageCode="fault_stats"><FaultStats /></PermissionGuard>} />
              <Route path="watch/realtime" element={<PermissionGuard pageCode="watch_realtime"><RealtimePerformance /></PermissionGuard>} />
              <Route path="board/files" element={<PermissionGuard pageCode="board_files"><FileBoard /></PermissionGuard>} />
              <Route path="board/notices" element={<PermissionGuard pageCode="board_notices"><NoticeBoard /></PermissionGuard>} />
              <Route path="perf/stats" element={<PermissionGuard pageCode="perf_stats"><PerformanceTest /></PermissionGuard>} />
              <Route path="tools/traceroute" element={<PermissionGuard pageCode="traceroute"><Traceroute /></PermissionGuard>} />
              <Route path="settings/admin" element={<PermissionGuard pageCode="system_admin"><SystemAdmin /></PermissionGuard>} />
              <Route path="settings/threshold" element={<PermissionGuard pageCode="system_admin"><ThresholdManagement /></PermissionGuard>} />
              <Route path="settings/admin/style-test" element={<AdminStyleTest />} />
              <Route path="settings/account" element={<AccountSettings />} />
              <Route path="settings/notifications" element={<NotificationSettings />} />
            </Route>

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
          </Suspense>
          </AlertWebSocketProvider>
        </AuthProvider>
        </ErrorBoundary>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
