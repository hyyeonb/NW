import React, { useEffect, useState, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from './stores';
import MainLayout from './layouts/MainLayout';
// 가벼운 공개 페이지 — 정적 import
import { Login, Signup, SignupSuccess, FindAccount, SocialLoginLanding } from './pages';
import AlertToast from './components/AlertToast';
import UrgentNoticePopup from './components/UrgentNoticePopup';
import GlobalTooltip from './components/GlobalTooltip';
import { useAlertWebSocket } from './hooks';

// 무거운 보호 페이지 — lazy import (코드 스플리팅)
const Dashboard = lazy(() => import('./pages/Dashboard'));
const NetworkTopology = lazy(() => import('./pages/NetworkTopology'));
const UserTopology = lazy(() => import('./pages/UserTopology'));
const AssetManagement = lazy(() => import('./pages/AssetManagement'));
const PerformanceTest = lazy(() => import('./pages/PerformanceTest'));
const RealtimePerformance = lazy(() => import('./pages/RealtimePerformance'));
const FaultStats = lazy(() => import('./pages/FaultStats'));
// 비교적 가벼운 페이지도 lazy 처리 (라우트 단위 청크)
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
const Traceroute = lazy(() => import('./pages/Traceroute'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5분
      retry: 1,
    },
  },
});

// 전체 화면 로딩 (세션 확인, 로그인 전환)
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

// 세션 검증 및 인증 상태 관리
function AuthProvider({ children }) {
  const { isAuthenticated, isLoginTransitioning, clearLoginTransition, fetchCurrentUser, validateSession } = useAuthStore();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const checkSession = async () => {
      // 로컬 스토리지에 인증 정보가 있으면 서버에서 검증
      if (isAuthenticated) {
        try {
          // 세션 유효성 확인
          const isValid = await validateSession();
          if (isValid) {
            // 유효하면 최신 사용자 정보 가져오기
            await fetchCurrentUser();
          }
        } catch (error) {
          console.error('Session validation failed:', error);
          // 세션 무효 - authStore에서 자동으로 상태 초기화됨
        }
      }
      setIsChecking(false);
    };

    checkSession();
  }, []);

  // 로그인 전환 화면 자동 해제
  useEffect(() => {
    if (isLoginTransitioning) {
      const timer = setTimeout(() => {
        clearLoginTransition();
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [isLoginTransitioning, clearLoginTransition]);

  // 세션 체크 중
  if (isChecking) {
    return <FullScreenLoader message="세션 확인 중..." />;
  }

  // 로그인 성공 전환 중
  if (isLoginTransitioning) {
    return <FullScreenLoader message="로그인 성공" />;
  }

  return children;
}

// Alert WebSocket 연결 (인증된 사용자만)
function AlertWebSocketProvider({ children }) {
  const { isAuthenticated } = useAuthStore();

  // 인증된 경우에만 WebSocket 연결
  useAlertWebSocket({ autoConnect: isAuthenticated });

  return children;
}

// 에러 바운더리 — 컴포넌트 에러 시 앱 전체 크래시 방지
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
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--theme-bg-primary, #0f0f23)', color: '#f8fafc', gap: '16px' }}>
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

// 보호된 라우트 - 인증되지 않으면 로그인 페이지로 리다이렉트
function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuthStore();
  const location = useLocation();

  if (!isAuthenticated) {
    // 현재 경로를 저장하여 로그인 후 돌아올 수 있도록 함
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  return children;
}

// 공개 라우트 - 이미 인증되었으면 메인 페이지로 리다이렉트
function PublicRoute({ children }) {
  const { isAuthenticated } = useAuthStore();
  const location = useLocation();

  if (isAuthenticated) {
    // 로그인 전 페이지가 있으면 그곳으로, 없으면 메인으로
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
            {/* 전역 Toast 알림 */}
            <AlertToast />
            {/* 긴급 공지사항 팝업 */}
            <UrgentNoticePopup />
            {/* 전역 말줄임 툴팁 */}
            <GlobalTooltip />
            <Suspense fallback={
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--theme-bg-primary, #0f0f23)' }}>
                <div className="login-transition-spinner" />
              </div>
            }>
            <Routes>
            {/* Public Routes - 로그인된 사용자는 메인으로 리다이렉트 */}
            <Route
              path="/login"
              element={
                <PublicRoute>
                  <Login />
                </PublicRoute>
              }
            />
            <Route
              path="/signup"
              element={
                <PublicRoute>
                  <Signup />
                </PublicRoute>
              }
            />
            <Route
              path="/find-account"
              element={
                <PublicRoute>
                  <FindAccount />
                </PublicRoute>
              }
            />
            <Route
              path="/social-login/:provider"
              element={
                <PublicRoute>
                  <SocialLoginLanding />
                </PublicRoute>
              }
            />
            <Route
              path="/signup-success"
              element={
                <ProtectedRoute>
                  <SignupSuccess />
                </ProtectedRoute>
              }
            />

            {/* Protected Routes - 인증 필요 */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <MainLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="topology" element={<NetworkTopology />} />
              <Route path="user-topology" element={<UserTopology />} />
              <Route path="mgmt/groups" element={<GroupManagement />} />
              <Route path="mgmt/assets" element={<AssetManagement />} />
              <Route path="mgmt/asset-config" element={<AssetConfig />} />
              <Route path="mgmt/asset-config/:deviceId" element={<AssetConfigDetail />} />
              <Route path="mgmt/new-assets" element={<NewAssetManagement />} />
              <Route path="mgmt/models" element={<ModelManagement />} />
              <Route path="mgmt/ssh-sessions" element={<SshSessionHistory />} />
              <Route path="fault/realtime" element={<RealtimeFault />} />
              <Route path="fault/history" element={<FaultHistory />} />
              <Route path="fault/stats" element={<FaultStats />} />
              <Route path="watch/realtime" element={<RealtimePerformance />} />
              <Route path="board/files" element={<FileBoard />} />
              <Route path="board/notices" element={<NoticeBoard />} />
              <Route path="perf/stats" element={<PerformanceTest />} />
              <Route path="tools/traceroute" element={<Traceroute />} />
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
