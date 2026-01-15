import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams, useLocation, Link } from 'react-router-dom';
import { useAuthStore } from '../stores';
import { authApi } from '../api';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { isAuthenticated, isLoading, error, socialLogin, handleOAuthCallback, localLogin, clearError } = useAuthStore();
  const callbackProcessed = useRef(false);

  // 로컬 로그인 폼 상태
  const [loginMode, setLoginMode] = useState('local'); // 'local' | 'social'
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [suggestedProvider, setSuggestedProvider] = useState(null); // 추천 소셜 로그인

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

  // 회원가입에서 이메일 중복으로 리다이렉트된 경우
  useEffect(() => {
    const socialType = location.state?.suggestedSocialType;
    if (socialType) {
      if (socialType === 'LOCAL') {
        setLoginMode('local');
      } else {
        setLoginMode('social');
        setSuggestedProvider(socialType.toLowerCase());
      }
    }
  }, [location.state]);

  const handleSocialLogin = (provider) => {
    navigate(`/social-login/${provider}`);
  };

  const handleLocalLogin = async (e) => {
    e.preventDefault();
    try {
      await localLogin(loginId, password);
      const redirectPath = getRedirectPath();
      navigate(redirectPath, { replace: true });
    } catch (err) {
      console.error('Local login error:', err);
    }
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

          {/* Login Mode Toggle */}
          <div className="login-mode-toggle">
            <button
              className={`toggle-btn ${loginMode === 'local' ? 'active' : ''}`}
              onClick={() => setLoginMode('local')}
            >
              일반 로그인
            </button>
            <button
              className={`toggle-btn ${loginMode === 'social' ? 'active' : ''}`}
              onClick={() => setLoginMode('social')}
            >
              소셜 로그인
            </button>
          </div>

          {loginMode === 'local' ? (
            <>
              {/* Local Login Form */}
              <form className="login-form" onSubmit={handleLocalLogin}>
                <div className="form-group">
                  <input
                    type="text"
                    placeholder="아이디"
                    value={loginId}
                    onChange={(e) => setLoginId(e.target.value)}
                    disabled={isLoading}
                    required
                  />
                </div>
                <div className="form-group">
                  <input
                    type="password"
                    placeholder="비밀번호"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isLoading}
                    required
                  />
                </div>
                <button type="submit" className="btn-login" disabled={isLoading}>
                  {isLoading ? '로그인 중...' : '로그인'}
                </button>
              </form>

              {/* Links */}
              <div className="login-links">
                <Link to="/signup">회원가입</Link>
                <span className="divider">|</span>
                <Link to="/find-account">아이디/비밀번호 찾기</Link>
              </div>
            </>
          ) : (
            <>
              {/* 추천 소셜 로그인 메시지 */}
              {suggestedProvider && (
                <div className={`suggested-login-message ${suggestedProvider}`}>
                  이미 가입된 이메일입니다.<br />
                  아래 {suggestedProvider.toUpperCase()} 로그인을 이용해주세요.
                </div>
              )}

              {/* Social Login Buttons */}
              <div className="login-buttons">
                <button
                  className={`btn-social btn-kakao ${suggestedProvider === 'kakao' ? 'suggested' : ''}`}
                  onClick={() => handleSocialLogin('kakao')}
                  disabled={isLoading}
                >
                  <span className="btn-icon">💬</span>
                  <span className="btn-text">카카오 로그인</span>
                  <span className="btn-arrow">→</span>
                </button>

                <button
                  className={`btn-social btn-naver ${suggestedProvider === 'naver' ? 'suggested' : ''}`}
                  onClick={() => handleSocialLogin('naver')}
                  disabled={isLoading}
                >
                  <span className="btn-icon">N</span>
                  <span className="btn-text">네이버 로그인</span>
                  <span className="btn-arrow">→</span>
                </button>

                <button
                  className={`btn-social btn-google ${suggestedProvider === 'google' ? 'suggested' : ''}`}
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
            </>
          )}
        </div>

        {/* Footer */}
        <p className="login-footer">© 2025 Infomap. All rights reserved.</p>
      </div>
    </div>
  );
}
