import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from './stores';
import MainLayout from './layouts/MainLayout';
import { Login, Signup, Dashboard, SignupSuccess, FindAccount, SocialLoginLanding, Main, GroupManagement, AssetManagement, AssetConfig, AssetConfigDetail, NewAssetManagement, ModelManagement, NetworkTopology, RealtimeFault, FaultHistory } from './pages';
import AlertToast from './components/AlertToast';
import { useAlertWebSocket } from './hooks';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5분
      retry: 1,
    },
  },
});

// 세션 검증 및 인증 상태 관리
function AuthProvider({ children }) {
  const { isAuthenticated, fetchCurrentUser, validateSession } = useAuthStore();
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

  // 세션 체크 중일 때 로딩 표시
  if (isChecking) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
        color: '#e2e8f0'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '40px',
            height: '40px',
            border: '3px solid #334155',
            borderTop: '3px solid #3b82f6',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 16px'
          }} />
          <p>세션 확인 중...</p>
          <style>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      </div>
    );
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
              <Route index element={<Navigate to="/main" replace />} />
              <Route path="main" element={<Main />} />
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
            </Route>

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/main" replace />} />
          </Routes>
          </AlertWebSocketProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
