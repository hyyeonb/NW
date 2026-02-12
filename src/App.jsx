import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from './stores';
import MainLayout from './layouts/MainLayout';
import { Login, Signup, Dashboard, SignupSuccess, FindAccount, SocialLoginLanding, Main, GroupManagement, AssetManagement, AssetConfig, AssetConfigDetail, NewAssetManagement, ModelManagement, NetworkTopology, RealtimeFault, FaultHistory, RealtimePerformance, FileBoard, NoticeBoard } from './pages';
import AlertToast from './components/AlertToast';
import GlobalTooltip from './components/GlobalTooltip';
import { useAlertWebSocket } from './hooks';

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
        <AuthProvider>
          <AlertWebSocketProvider>
            {/* 전역 Toast 알림 */}
            <AlertToast />
            {/* 전역 말줄임 툴팁 */}
            <GlobalTooltip />
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
              <Route path="mgmt/groups" element={<GroupManagement />} />
              <Route path="mgmt/assets" element={<AssetManagement />} />
              <Route path="mgmt/asset-config" element={<AssetConfig />} />
              <Route path="mgmt/asset-config/:deviceId" element={<AssetConfigDetail />} />
              <Route path="mgmt/new-assets" element={<NewAssetManagement />} />
              <Route path="mgmt/models" element={<ModelManagement />} />
              <Route path="fault/realtime" element={<RealtimeFault />} />
              <Route path="fault/history" element={<FaultHistory />} />
              <Route path="watch/realtime" element={<RealtimePerformance />} />
              <Route path="board/files" element={<FileBoard />} />
              <Route path="board/notices" element={<NoticeBoard />} />
            </Route>

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
          </AlertWebSocketProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
