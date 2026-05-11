import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import '../styles/login.css';

const providerInfo = {
  kakao: {
    name: '카카오',
    color: '#FEE500',
    bgColor: 'rgba(254, 229, 0, 0.1)',
    icon: '💬',
  },
  naver: {
    name: '네이버',
    color: '#03C75A',
    bgColor: 'rgba(3, 199, 90, 0.1)',
    icon: 'N',
  },
  google: {
    name: '구글',
    color: '#4285F4',
    bgColor: 'rgba(66, 133, 244, 0.1)',
    icon: 'G',
  },
};

export default function SocialLoginLanding() {
  const { provider } = useParams();
  const navigate = useNavigate();
  const { socialLogin } = useAuthStore();

  const info = providerInfo[provider] || providerInfo.kakao;

  useEffect(() => {
    // 1.5초 후 소셜 로그인 리다이렉트
    const timer = setTimeout(() => {
      socialLogin(provider);
    }, 1500);

    return () => clearTimeout(timer);
  }, [provider, socialLogin]);

  const handleCancel = () => {
    navigate('/login', { replace: true });
  };

  return (
    <div className="login-page">
      {/* Animated Background */}
      <div className="background-animation">
        <div className="floating-shape shape-1"></div>
        <div className="floating-shape shape-2"></div>
        <div className="floating-shape shape-3"></div>
      </div>

      {/* Landing Container */}
      <div className="login-wrapper">
        <div className="login-container landing-container">
          {/* Provider Icon */}
          <div
            className="provider-icon-wrapper"
            style={{
              background: info.bgColor,
              borderColor: info.color
            }}
          >
            <span
              className="provider-icon"
              style={{ color: info.color }}
            >
              {info.icon}
            </span>
          </div>

          {/* Loading Animation */}
          <div className="loading-spinner" style={{ borderTopColor: info.color }}></div>

          {/* Message */}
          <h1 className="landing-title">{info.name} 로그인</h1>
          <p className="landing-message">
            {info.name} 로그인 페이지로 이동 중입니다...
          </p>

          {/* Cancel Button */}
          <button className="btn-cancel" onClick={handleCancel}>
            취소
          </button>
        </div>

        {/* Footer */}
        <p className="login-footer">© 2025 Infomap. All rights reserved.</p>
      </div>
    </div>
  );
}
