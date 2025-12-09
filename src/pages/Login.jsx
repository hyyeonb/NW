import { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores';
import { authApi } from '../api';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { isAuthenticated, isLoading, error, socialLogin, handleOAuthCallback, clearError } = useAuthStore();
  const callbackProcessed = useRef(false);

  // 로그인 후 이동할 경로 결정
  const getRedirectPath = () => {
    // 1. React Router state에서 가져오기
    if (location.state?.from) {
      return location.state.from;
    }
    // 2. sessionStorage에서 가져오기 (API 401 리다이렉트 시 저장됨)
    const savedPath = sessionStorage.getItem('redirectAfterLogin');
    if (savedPath) {
      sessionStorage.removeItem('redirectAfterLogin');
      return savedPath;
    }
    // 3. 기본값
    return '/main';
  };

  // OAuth 콜백 처리 (code 파라미터가 있으면)
  useEffect(() => {
    const code = searchParams.get('code');
    const state = searchParams.get('state');

    if (code && !callbackProcessed.current && !isLoading) {
      callbackProcessed.current = true;
      const provider = authApi.getLastProvider();

      if (provider) {
        const redirectUri = authApi.getRedirectUri();
        handleOAuthCallback(provider, code, redirectUri, state)
          .then(() => {
            authApi.clearLastProvider();
            const redirectPath = getRedirectPath();
            navigate(redirectPath, { replace: true });
          })
          .catch((err) => {
            console.error('OAuth callback error:', err);
            authApi.clearLastProvider();
            // URL에서 code 파라미터 제거
            navigate('/login', { replace: true });
          });
      } else {
        // provider 정보가 없으면 URL 정리
        navigate('/login', { replace: true });
      }
    }
  }, [searchParams, handleOAuthCallback, navigate, isLoading]);

  useEffect(() => {
    if (isAuthenticated && !searchParams.get('code')) {
      const redirectPath = getRedirectPath();
      navigate(redirectPath, { replace: true });
    }
  }, [isAuthenticated, navigate, searchParams]);

  useEffect(() => {
    return () => clearError();
  }, [clearError]);

  const handleSocialLogin = (provider) => {
    socialLogin(provider);
  };

  return (
    <div className="login-page">
      {/* Animated Background */}
      <div className="background-animation">
        <div className="floating-shape shape-1"></div>
        <div className="floating-shape shape-2"></div>
        <div className="floating-shape shape-3"></div>
      </div>

      {/* Login Container */}
      <div className="login-wrapper">
        <div className="login-container">
          {/* Logo Section */}
          <div className="logo-section">
            <div className="login-logo-wrapper">
              <img src="/logo-single.svg" alt="Logo" className="login-logo-icon" />
              <img src="/logo-text-dark.svg" alt="Infomap" className="login-logo-text" />
            </div>
            <p className="subtitle">Network Management System</p>
          </div>

          {/* Error Message */}
          {error && (
            <div style={{
              marginBottom: '20px',
              padding: '12px 16px',
              background: 'rgba(239, 68, 68, 0.2)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '12px',
              color: '#fca5a5',
              fontSize: '14px',
              textAlign: 'center'
            }}>
              {error}
            </div>
          )}

          {/* Login Buttons */}
          <div className="login-buttons">
            <button
              className="btn-social btn-kakao"
              onClick={() => handleSocialLogin('kakao')}
              disabled={isLoading}
            >
              <span className="btn-icon">💬</span>
              <span className="btn-text">카카오 로그인</span>
              <span className="btn-arrow">→</span>
            </button>

            <button
              className="btn-social btn-naver"
              onClick={() => handleSocialLogin('naver')}
              disabled={isLoading}
            >
              <span className="btn-icon">N</span>
              <span className="btn-text">네이버 로그인</span>
              <span className="btn-arrow">→</span>
            </button>

            <button
              className="btn-social btn-google"
              onClick={() => handleSocialLogin('google')}
              disabled={isLoading}
            >
              <span className="btn-icon">G</span>
              <span className="btn-text">구글 로그인</span>
              <span className="btn-arrow">→</span>
            </button>
          </div>

          {/* Loading */}
          {isLoading && (
            <div style={{
              marginTop: '20px',
              textAlign: 'center',
              color: '#94a3b8',
              fontSize: '14px'
            }}>
              로그인 처리 중...
            </div>
          )}
        </div>

        {/* Footer */}
        <p className="login-footer">© 2025 Infomap. All rights reserved.</p>
      </div>
    </div>
  );
}
