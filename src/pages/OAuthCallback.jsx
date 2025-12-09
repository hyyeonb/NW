import { useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../stores';

export default function OAuthCallback() {
  const navigate = useNavigate();
  const { provider } = useParams();
  const [searchParams] = useSearchParams();
  const { handleOAuthCallback, isLoading, error } = useAuthStore();

  useEffect(() => {
    const code = searchParams.get('code');
    const state = searchParams.get('state');

    if (!code || !provider) {
      navigate('/login');
      return;
    }

    const redirectUri = `${window.location.origin}/login/callback/${provider}`;

    handleOAuthCallback(provider, code, redirectUri, state)
      .then(() => {
        navigate('/main');
      })
      .catch((err) => {
        console.error('OAuth callback error:', err);
        navigate('/login');
      });
  }, [provider, searchParams, handleOAuthCallback, navigate]);

  if (error) {
    return (
      <div className="login-page">
        <div className="background-animation">
          <div className="floating-shape shape-1"></div>
          <div className="floating-shape shape-2"></div>
        </div>
        <div className="login-wrapper">
          <div className="login-container" style={{ textAlign: 'center' }}>
            <div style={{ color: '#fca5a5', marginBottom: '20px' }}>{error}</div>
            <button
              className="btn-social"
              onClick={() => navigate('/login')}
              style={{ justifyContent: 'center' }}
            >
              <span className="btn-text">로그인 페이지로 이동</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="login-page">
      <div className="background-animation">
        <div className="floating-shape shape-1"></div>
        <div className="floating-shape shape-2"></div>
      </div>
      <div className="login-wrapper">
        <div className="login-container" style={{ textAlign: 'center' }}>
          <div className="logo-section">
            <div className="logo-icon" style={{ animation: 'pulseGlow 1s ease-in-out infinite' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="12" cy="12" r="3" />
                <path d="M12 3v2M12 19v2M3 12h2M19 12h2" />
              </svg>
            </div>
          </div>
          <p style={{ color: '#94a3b8', fontSize: '15px' }}>로그인 처리 중...</p>
        </div>
      </div>
    </div>
  );
}
