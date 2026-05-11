import React, { useEffect, useState, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from './stores/authStore';
import MainLayout from './layouts/MainLayout';
import { Login, Signup, SignupSuccess, FindAccount, SocialLoginLanding } from './pages';
import AlertToast from './components/AlertToast';
import { AlertProvider } from './components/CustomAlert';
import UrgentNoticePopup from './components/UrgentNoticePopup';
import GlobalTooltip from './components/GlobalTooltip';
import { AuthProvider, AlertWebSocketProvider, ErrorBoundary, ProtectedRoute, PublicRoute } from './app/providers/AppProviders';
import PermissionGuard from './components/PermissionGuard';
import { useAlertWebSocket } from './hooks/useAlertWebSocket';

// 배포 후 chunk 404 방지: import 실패 시 자동 새로고침
function lazyRetry(importFn) {
  return lazy(() => importFn().catch(() => {
    const reloaded = sessionStorage.getItem('chunk_reload');
    if (!reloaded) {
      sessionStorage.setItem('chunk_reload', '1');
      window.location.reload();
      return new Promise(() => {}); // reload 중 빈 Promise
    }
    sessionStorage.removeItem('chunk_reload');
    return importFn(); // 2번째도 실패하면 에러 표시
  }));
}

// 무거운 보호 페이지 — lazy import
const Dashboard = lazyRetry(() => import('./pages/Dashboard'));
const NetworkTopology = lazyRetry(() => import('./pages/NetworkTopology'));
const UserTopology = lazyRetry(() => import('./pages/UserTopology'));
const AssetManagement = lazyRetry(() => import('./pages/AssetManagement'));
const PerformanceTest = lazyRetry(() => import('./pages/PerformanceTest'));
const PerformanceExplorer = lazyRetry(() => import('./pages/PerformanceExplorer'));
const RealtimePerformance = lazyRetry(() => import('./pages/RealtimePerformance'));
const FaultStats = lazyRetry(() => import('./pages/FaultStats'));
const GroupManagement = lazyRetry(() => import('./pages/GroupManagement'));
const AssetConfig = lazyRetry(() => import('./pages/AssetConfig'));
const AssetConfigDetail = lazyRetry(() => import('./pages/AssetConfigDetail'));
const NewAssetManagement = lazyRetry(() => import('./pages/NewAssetManagement'));
const ModelManagement = lazyRetry(() => import('./pages/ModelManagement'));
const RealtimeFault = lazyRetry(() => import('./pages/RealtimeFault'));
const FaultHistory = lazyRetry(() => import('./pages/FaultHistory'));
const FileBoard = lazyRetry(() => import('./pages/FileBoard'));
const NoticeBoard = lazyRetry(() => import('./pages/NoticeBoard'));
const SshSessionHistory = lazyRetry(() => import('./pages/SshSessionHistory'));
const LoginHistory = lazyRetry(() => import('./pages/LoginHistory'));
const Traceroute = lazyRetry(() => import('./pages/Traceroute'));
const SystemAdmin = lazyRetry(() => import('./pages/SystemAdmin'));
const ThresholdManagement = lazyRetry(() => import('./pages/ThresholdManagement'));
const TreeDesignPreview = lazyRetry(() => import('./pages/TreeDesignPreview'));
const AccountSettings = lazyRetry(() => import('./pages/AccountSettings'));
const NotificationSettings = lazyRetry(() => import('./pages/NotificationSettings'));
const MiddlewareManagement = lazyRetry(() => import('./pages/MiddlewareManagement'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 1,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ErrorBoundary>
        <AuthProvider>
          <AlertWebSocketProvider>
            <AlertProvider>
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
              <Route path="perf/explorer" element={<PermissionGuard pageCode="perf_stats"><PerformanceExplorer /></PermissionGuard>} />
              <Route path="tools/traceroute" element={<PermissionGuard pageCode="traceroute"><Traceroute /></PermissionGuard>} />
              <Route path="settings/admin" element={<PermissionGuard pageCode="system_admin"><SystemAdmin /></PermissionGuard>} />
              <Route path="settings/threshold" element={<PermissionGuard pageCode="system_admin"><ThresholdManagement /></PermissionGuard>} />
              <Route path="preview/tree-design" element={<TreeDesignPreview />} />
              <Route path="settings/account" element={<AccountSettings />} />
              <Route path="settings/notifications" element={<NotificationSettings />} />
              <Route path="settings/middleware" element={<PermissionGuard pageCode="system_admin"><MiddlewareManagement /></PermissionGuard>} />
            </Route>

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
          </Suspense>
          </AlertProvider>
          </AlertWebSocketProvider>
        </AuthProvider>
        </ErrorBoundary>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
