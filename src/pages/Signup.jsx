import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useThemeStore } from '../stores/themeStore';
import { authApi } from '../api/auth';
import ThemeToggle from '../components/ThemeToggle';
import '../styles/login.css';

export default function Signup() {
  const navigate = useNavigate();
  const { signup, isLoading, error, clearError } = useAuthStore();
  const resolvedTheme = useThemeStore((s) => s.resolvedTheme);
  const logoTextSrc = resolvedTheme === 'light' ? '/logo-text-light.svg' : '/logo-text-dark.svg';

  const [formData, setFormData] = useState({
    LOGIN_ID: '',
    PASSWORD: '',
    PASSWORD_CONFIRM: '',
    NAME: '',
    EMAIL: '',
    PHONE: '',
  });

  const [idCheckResult, setIdCheckResult] = useState(null); // null | 'available' | 'duplicate'
  const [formError, setFormError] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    // ID 변경 시 중복 체크 결과 초기화
    if (name === 'LOGIN_ID') {
      setIdCheckResult(null);
    }
    setFormError('');
    clearError();
  };

  const handleCheckId = async () => {
    if (!formData.LOGIN_ID.trim()) {
      setFormError('아이디를 입력해주세요.');
      return;
    }

    try {
      const response = await authApi.checkLoginId(formData.LOGIN_ID);
      // data가 true면 사용 가능 (available), false면 중복 (duplicate)
      const isAvailable = response.data?.data;
      setIdCheckResult(isAvailable ? 'available' : 'duplicate');
    } catch (err) {
      setFormError('중복 확인 중 오류가 발생했습니다.');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    // 유효성 검사
    if (!formData.LOGIN_ID.trim()) {
      setFormError('아이디를 입력해주세요.');
      return;
    }

    if (idCheckResult !== 'available') {
      setFormError('아이디 중복 확인을 해주세요.');
      return;
    }

    if (formData.PASSWORD.length < 4) {
      setFormError('비밀번호는 4자 이상이어야 합니다.');
      return;
    }

    if (formData.PASSWORD !== formData.PASSWORD_CONFIRM) {
      setFormError('비밀번호가 일치하지 않습니다.');
      return;
    }

    if (!formData.NAME.trim()) {
      setFormError('이름을 입력해주세요.');
      return;
    }

    if (!formData.PHONE.trim()) {
      setFormError('휴대폰 번호를 입력해주세요.');
      return;
    }

    try {
      await signup({
        LOGIN_ID: formData.LOGIN_ID,
        PASSWORD: formData.PASSWORD,
        NAME: formData.NAME,
        EMAIL: formData.EMAIL,
        PHONE: formData.PHONE,
      });
      navigate('/signup-success', { replace: true });
    } catch (err) {
      console.error('Signup error:', err);

      // 이메일 중복 (409) - 소셜 타입 정보가 있으면 로그인 페이지로 이동
      if (err.response?.status === 409) {
        const socialType = err.response?.data?.socialType;
        if (socialType) {
          navigate('/login', {
            replace: true,
            state: { suggestedSocialType: socialType }
          });
        }
      }
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

      {/* 테마 토글 */}
      <ThemeToggle className="fixed-top-right" />

      {/* Signup Container */}
      <div className="login-wrapper">
        <div className="login-container">
          {/* Logo Section */}
          <div className="logo-section">
            <div className="login-logo-wrapper">
              <div className="logo-gradient-aura" aria-hidden="true" />
              <img src="/logo-single.svg" alt="Logo" className="login-logo-icon" />
              <img src={logoTextSrc} alt="Infomap" className="login-logo-text" />
            </div>
            <p className="subtitle">회원가입</p>
          </div>

          {/* Error Message */}
          {(error || formError) && (
            <div className="error-message">
              {error || formError}
            </div>
          )}

          {/* Signup Form */}
          <form className="login-form" onSubmit={handleSubmit}>
            {/* ID with check button */}
            <div className="form-group with-button">
              <input
                type="text"
                name="LOGIN_ID"
                placeholder="아이디"
                value={formData.LOGIN_ID}
                onChange={handleChange}
                disabled={isLoading}
                required
              />
              <button
                type="button"
                className="btn-check"
                onClick={handleCheckId}
                disabled={isLoading}
              >
                중복확인
              </button>
            </div>
            {idCheckResult && (
              <div className={`id-check-result ${idCheckResult}`}>
                {idCheckResult === 'available' ? '사용 가능한 아이디입니다.' : '이미 사용 중인 아이디입니다.'}
              </div>
            )}

            <div className="form-group">
              <input
                type="password"
                name="PASSWORD"
                placeholder="비밀번호"
                value={formData.PASSWORD}
                onChange={handleChange}
                disabled={isLoading}
                required
              />
            </div>

            <div className="form-group">
              <input
                type="password"
                name="PASSWORD_CONFIRM"
                placeholder="비밀번호 확인"
                value={formData.PASSWORD_CONFIRM}
                onChange={handleChange}
                disabled={isLoading}
                required
              />
            </div>

            <div className="form-group">
              <input
                type="text"
                name="NAME"
                placeholder="이름"
                value={formData.NAME}
                onChange={handleChange}
                disabled={isLoading}
                required
              />
            </div>

            <div className="form-group">
              <input
                type="email"
                name="EMAIL"
                placeholder="이메일 (선택)"
                value={formData.EMAIL}
                onChange={handleChange}
                disabled={isLoading}
              />
            </div>

            <div className="form-group">
              <input
                type="tel"
                name="PHONE"
                placeholder="휴대폰 번호"
                value={formData.PHONE}
                onChange={handleChange}
                disabled={isLoading}
                required
              />
            </div>

            <button type="submit" className="btn-login" disabled={isLoading}>
              {isLoading ? '가입 중...' : '회원가입'}
            </button>
          </form>

          {/* Links */}
          <div className="login-links">
            <Link to="/login">로그인으로 돌아가기</Link>
          </div>
        </div>

        {/* Footer */}
        <p className="login-footer">© 2025 Infomap. All rights reserved.</p>
      </div>
    </div>
  );
}
