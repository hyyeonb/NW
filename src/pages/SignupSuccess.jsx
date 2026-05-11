import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import '../styles/login.css';

export default function SignupSuccess() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [countdown, setCountdown] = useState(3);

  useEffect(() => {
    // 카운트다운
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          navigate('/dashboard', { replace: true });
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [navigate]);

  const handleGoToMain = () => {
    navigate('/dashboard', { replace: true });
  };

  return (
    <div className="login-page">
      {/* Animated Background */}
      <div className="background-animation">
        <div className="floating-shape shape-1"></div>
        <div className="floating-shape shape-2"></div>
        <div className="floating-shape shape-3"></div>
      </div>

      {/* Success Container */}
      <div className="login-wrapper">
        <div className="login-container success-container">
          {/* Success Icon */}
          <div className="success-icon-wrapper">
            <div className="success-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          </div>

          {/* Success Message */}
          <h1 className="success-title">가입 완료!</h1>
          <p className="success-message">
            {user?.NAME || '회원'}님, 환영합니다.<br />
            회원가입이 성공적으로 완료되었습니다.
          </p>

          {/* Countdown */}
          <p className="success-countdown">
            {countdown}초 후 메인 페이지로 이동합니다.
          </p>

          {/* Button */}
          <button className="btn-login" onClick={handleGoToMain}>
            메인으로 이동
          </button>
        </div>

        {/* Footer */}
        <p className="login-footer">© 2025 Infomap. All rights reserved.</p>
      </div>
    </div>
  );
}
