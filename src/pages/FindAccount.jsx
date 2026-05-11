import { useState } from 'react';
import { Link } from 'react-router-dom';
import { authApi } from '../api/auth';
import { useThemeStore } from '../stores/themeStore';
import ThemeToggle from '../components/ThemeToggle';
import '../styles/login.css';

export default function FindAccount() {
  const resolvedTheme = useThemeStore((s) => s.resolvedTheme);
  const logoTextSrc = resolvedTheme === 'light' ? '/logo-text-light.svg' : '/logo-text-dark.svg';
  const [mode, setMode] = useState('id'); // 'id' | 'password'
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  // 아이디 찾기 폼
  const [findIdForm, setFindIdForm] = useState({ NAME: '', PHONE: '' });

  // 비밀번호 재설정 폼
  const [resetPwForm, setResetPwForm] = useState({
    LOGIN_ID: '',
    NAME: '',
    PHONE: '',
    NEW_PASSWORD: '',
    NEW_PASSWORD_CONFIRM: '',
  });

  const handleFindIdChange = (e) => {
    const { name, value } = e.target;
    setFindIdForm((prev) => ({ ...prev, [name]: value }));
    setError('');
    setResult(null);
  };

  const handleResetPwChange = (e) => {
    const { name, value } = e.target;
    setResetPwForm((prev) => ({ ...prev, [name]: value }));
    setError('');
    setResult(null);
  };

  const handleFindId = async (e) => {
    e.preventDefault();
    setError('');
    setResult(null);

    if (!findIdForm.NAME.trim() || !findIdForm.PHONE.trim()) {
      setError('이름과 휴대폰 번호를 모두 입력해주세요.');
      return;
    }

    setIsLoading(true);
    try {
      const response = await authApi.findId(findIdForm);
      if (response.data?.code === 200) {
        setResult({ type: 'id', data: response.data.data });
      } else {
        setError(response.data?.message || '아이디를 찾을 수 없습니다.');
      }
    } catch (err) {
      setError(err.response?.data?.message || '아이디를 찾을 수 없습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError('');
    setResult(null);

    if (!resetPwForm.LOGIN_ID.trim() || !resetPwForm.NAME.trim() || !resetPwForm.PHONE.trim()) {
      setError('아이디, 이름, 휴대폰 번호를 모두 입력해주세요.');
      return;
    }

    if (resetPwForm.NEW_PASSWORD.length < 4) {
      setError('새 비밀번호는 4자 이상이어야 합니다.');
      return;
    }

    if (resetPwForm.NEW_PASSWORD !== resetPwForm.NEW_PASSWORD_CONFIRM) {
      setError('새 비밀번호가 일치하지 않습니다.');
      return;
    }

    setIsLoading(true);
    try {
      const response = await authApi.resetPassword(resetPwForm);
      if (response.data?.code === 200) {
        setResult({ type: 'password', data: '비밀번호가 변경되었습니다.' });
      } else {
        setError(response.data?.message || '비밀번호 변경에 실패했습니다.');
      }
    } catch (err) {
      setError(err.response?.data?.message || '일치하는 계정을 찾을 수 없습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleModeChange = (newMode) => {
    setMode(newMode);
    setError('');
    setResult(null);
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

      {/* Container */}
      <div className="login-wrapper">
        <div className="login-container">
          {/* Logo Section */}
          <div className="logo-section">
            <div className="login-logo-wrapper">
              <div className="logo-gradient-aura" aria-hidden="true" />
              <img src="/logo-single.svg" alt="Logo" className="login-logo-icon" />
              <img src={logoTextSrc} alt="Infomap" className="login-logo-text" />
            </div>
            <p className="subtitle">아이디 / 비밀번호 찾기</p>
          </div>

          {/* Mode Toggle */}
          <div className="login-mode-toggle">
            <button
              className={`toggle-btn ${mode === 'id' ? 'active' : ''}`}
              onClick={() => handleModeChange('id')}
            >
              아이디 찾기
            </button>
            <button
              className={`toggle-btn ${mode === 'password' ? 'active' : ''}`}
              onClick={() => handleModeChange('password')}
            >
              비밀번호 재설정
            </button>
          </div>

          {/* Error Message */}
          {error && <div className="error-message">{error}</div>}

          {/* Result Message */}
          {result && (
            <div className="success-message">
              {result.type === 'id' ? (
                <>
                  회원님의 아이디는 <strong>{result.data}</strong> 입니다.
                </>
              ) : (
                result.data
              )}
            </div>
          )}

          {mode === 'id' ? (
            /* Find ID Form */
            <form className="login-form" onSubmit={handleFindId}>
              <div className="form-group">
                <input
                  type="text"
                  name="NAME"
                  placeholder="이름"
                  value={findIdForm.NAME}
                  onChange={handleFindIdChange}
                  disabled={isLoading}
                  required
                />
              </div>
              <div className="form-group">
                <input
                  type="tel"
                  name="PHONE"
                  placeholder="휴대폰 번호"
                  value={findIdForm.PHONE}
                  onChange={handleFindIdChange}
                  disabled={isLoading}
                  required
                />
              </div>
              <button type="submit" className="btn-login" disabled={isLoading}>
                {isLoading ? '조회 중...' : '아이디 찾기'}
              </button>
            </form>
          ) : (
            /* Reset Password Form */
            <form className="login-form" onSubmit={handleResetPassword}>
              <div className="form-group">
                <input
                  type="text"
                  name="LOGIN_ID"
                  placeholder="아이디"
                  value={resetPwForm.LOGIN_ID}
                  onChange={handleResetPwChange}
                  disabled={isLoading}
                  required
                />
              </div>
              <div className="form-group">
                <input
                  type="text"
                  name="NAME"
                  placeholder="이름"
                  value={resetPwForm.NAME}
                  onChange={handleResetPwChange}
                  disabled={isLoading}
                  required
                />
              </div>
              <div className="form-group">
                <input
                  type="tel"
                  name="PHONE"
                  placeholder="휴대폰 번호"
                  value={resetPwForm.PHONE}
                  onChange={handleResetPwChange}
                  disabled={isLoading}
                  required
                />
              </div>
              <div className="form-group">
                <input
                  type="password"
                  name="NEW_PASSWORD"
                  placeholder="새 비밀번호"
                  value={resetPwForm.NEW_PASSWORD}
                  onChange={handleResetPwChange}
                  disabled={isLoading}
                  required
                />
              </div>
              <div className="form-group">
                <input
                  type="password"
                  name="NEW_PASSWORD_CONFIRM"
                  placeholder="새 비밀번호 확인"
                  value={resetPwForm.NEW_PASSWORD_CONFIRM}
                  onChange={handleResetPwChange}
                  disabled={isLoading}
                  required
                />
              </div>
              <button type="submit" className="btn-login" disabled={isLoading}>
                {isLoading ? '처리 중...' : '비밀번호 변경'}
              </button>
            </form>
          )}

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
