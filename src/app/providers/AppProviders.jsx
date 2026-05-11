/* eslint-disable react-refresh/only-export-components, max-lines-per-function, no-unused-vars, react-hooks/exhaustive-deps */
// App.jsx에서 추출한 provider/route guard 컴포넌트 묶음.

import React, { useState, useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { useAlertWebSocket } from '../../hooks/useAlertWebSocket';

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

export { FullScreenLoader, AuthProvider, AlertWebSocketProvider, ProtectedRoute, PublicRoute };
export { default as ErrorBoundary } from './ErrorBoundary';
