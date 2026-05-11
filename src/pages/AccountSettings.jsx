import { useState, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAccountInfo, useUpdateProfile, useChangePassword } from '../hooks/useAccount';
import { accountApi } from '../api/account';
import { useAuthStore } from '../stores/authStore';
import '../styles/AccountSettings.css';
import { parseBrowser } from '../shared/lib/userAgent';

function formatDate(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export default function AccountSettings() {
  const { data, isLoading } = useAccountInfo();
  const updateProfile = useUpdateProfile();
  const changePassword = useChangePassword();
  const queryClient = useQueryClient();
  const fetchCurrentUser = useAuthStore((s) => s.fetchCurrentUser);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [profileMsg, setProfileMsg] = useState(null);

  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwMsg, setPwMsg] = useState(null);

  const [avatarUploading, setAvatarUploading] = useState(false);
  const fileInputRef = useRef(null);

  const user = data?.user;
  const loginHistory = data?.loginHistory || [];
  const isLocal = user?.SOCIAL_TYPE === 'LOCAL';

  useEffect(() => {
    if (user) {
      setName(user.NAME || '');
      setEmail(user.EMAIL || '');
      setPhone(user.PHONE || '');
    }
  }, [user]);

  // dirty 감지: 원본 대비 변경 여부
  const profileDirty = user && (
    name !== (user.NAME || '') ||
    email !== (user.EMAIL || '') ||
    phone !== (user.PHONE || '')
  );
  const pwDirty = currentPw.length > 0 || newPw.length > 0 || confirmPw.length > 0;

  const handleProfileSave = async () => {
    setProfileMsg(null);
    try {
      await updateProfile.mutateAsync({ NAME: name, EMAIL: email, PHONE: phone });
      setProfileMsg({ type: 'success', text: '프로필이 수정되었습니다.' });
      fetchCurrentUser();
    } catch (err) {
      setProfileMsg({ type: 'error', text: err.response?.data?.message || '프로필 수정에 실패했습니다.' });
    }
  };

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarUploading(true);
    setProfileMsg(null);
    try {
      await accountApi.uploadProfileImage(file);
      setProfileMsg({ type: 'success', text: '프로필 이미지가 변경되었습니다.' });
      queryClient.invalidateQueries({ queryKey: ['account'] });
      fetchCurrentUser();
    } catch (err) {
      setProfileMsg({ type: 'error', text: err.response?.data?.message || '이미지 업로드에 실패했습니다.' });
    } finally {
      setAvatarUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handlePasswordChange = async () => {
    setPwMsg(null);
    if (!currentPw || !newPw) { setPwMsg({ type: 'error', text: '비밀번호를 입력해주세요.' }); return; }
    if (newPw !== confirmPw) { setPwMsg({ type: 'error', text: '새 비밀번호가 일치하지 않습니다.' }); return; }
    try {
      await changePassword.mutateAsync({ CURRENT_PASSWORD: currentPw, NEW_PASSWORD: newPw });
      setPwMsg({ type: 'success', text: '비밀번호가 변경되었습니다.' });
      setCurrentPw(''); setNewPw(''); setConfirmPw('');
    } catch (err) {
      setPwMsg({ type: 'error', text: err.response?.data?.message || '비밀번호 변경에 실패했습니다.' });
    }
  };

  if (isLoading) {
    return (
      <div className="acct-container">
        <div className="acct-loading"><i className="bi bi-arrow-repeat" /> 로딩 중...</div>
      </div>
    );
  }

  return (
    <div className="acct-container">
      {/* 페이지 헤더 */}
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title"><i className="bi bi-person-gear"></i> 계정 설정</h1>
          <span className="page-subtitle">프로필 정보를 확인하고 수정합니다</span>
        </div>
      </div>

      {/* 패널 래퍼 */}
      <div className="page-panels-wrapper acct-panels">
        <div className="page-main-content acct-content">
          {/* 상단: 프로필 + 비밀번호 (고정, 스크롤 없음) */}
          <div className="acct-top-row">
            <div className="acct-card">
              {/* 상단: 아바타 + 사용자 정보 + 계정 뱃지 */}
              <div className="acct-profile-header">
                <div className="acct-avatar" onClick={() => fileInputRef.current?.click()}>
                  {user?.PROFILE_IMAGE ? (
                    <img src={user.PROFILE_IMAGE} alt="profile" />
                  ) : (
                    <span>{(user?.NAME || '?')[0]}</span>
                  )}
                  <div className="acct-avatar-overlay">
                    <i className={`bi ${avatarUploading ? 'bi-arrow-repeat' : 'bi-camera'}`} />
                  </div>
                </div>
                <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarChange} />
                <div className="acct-profile-info">
                  <div className="acct-profile-name">{user?.NAME || '-'}</div>
                  <div className="acct-profile-id">{user?.LOGIN_ID || user?.EMAIL || '-'}</div>
                  <div className="acct-profile-date">가입일 {formatDate(user?.CREATED_AT)}</div>
                </div>
                <span className={`acct-profile-badge ${(user?.SOCIAL_TYPE || 'local').toLowerCase()}`}>
                  {user?.SOCIAL_TYPE || 'LOCAL'}
                </span>
              </div>

              {profileMsg && (
                <div className={`acct-message ${profileMsg.type}`}>
                  <i className={`bi ${profileMsg.type === 'success' ? 'bi-check-circle' : 'bi-exclamation-circle'}`} />
                  {profileMsg.text}
                </div>
              )}
              <div className="acct-form-grid">
                <div className="acct-form-group">
                  <label>이름 *</label>
                  <input value={name} onChange={(e) => setName(e.target.value)} placeholder="이름" />
                </div>
                <div className="acct-form-group">
                  <label>이메일</label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="이메일" />
                </div>
                <div className="acct-form-group">
                  <label>전화번호</label>
                  <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="전화번호" />
                </div>
                <div className="acct-btn-row" style={{ margin: 0 }}>
                  <button className={`acct-btn-primary ${profileDirty ? 'dirty' : ''}`} onClick={handleProfileSave} disabled={!profileDirty || updateProfile.isPending}>
                    {updateProfile.isPending ? '저장 중...' : '프로필 저장'}
                  </button>
                </div>
              </div>
            </div>

            {/* 비밀번호 변경 (LOCAL만) */}
            {isLocal && (
              <div className="acct-card">
                <h3 className="acct-card-title"><i className="bi bi-key" /> 비밀번호 변경</h3>
                {pwMsg && (
                  <div className={`acct-message ${pwMsg.type}`}>
                    <i className={`bi ${pwMsg.type === 'success' ? 'bi-check-circle' : 'bi-exclamation-circle'}`} />
                    {pwMsg.text}
                  </div>
                )}
                <div className="acct-form-grid">
                  <div className="acct-form-group">
                    <label>현재 비밀번호</label>
                    <input type="password" value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} placeholder="현재 비밀번호" />
                  </div>
                  <div className="acct-form-group" />
                  <div className="acct-form-group">
                    <label>새 비밀번호</label>
                    <input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} placeholder="새 비밀번호" />
                  </div>
                  <div className="acct-form-group">
                    <label>비밀번호 확인</label>
                    <input type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} placeholder="비밀번호 확인" />
                  </div>
                </div>
                <p className="acct-pw-hint">8~64자, 대문자/소문자/숫자/특수문자 중 3종류 이상 포함</p>
                <div className="acct-btn-row">
                  <button className={`acct-btn-primary ${pwDirty ? 'dirty' : ''}`} onClick={handlePasswordChange} disabled={!pwDirty || changePassword.isPending}>
                    {changePassword.isPending ? '변경 중...' : '비밀번호 변경'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 하단: 로그인 이력 (남은 공간 채움, 테이블만 스크롤) */}
          <div className="acct-card acct-history-card">
              <h3 className="acct-card-title"><i className="bi bi-clock-history" /> 최근 로그인 이력</h3>
              <div className="scrollable-list" style={{ maxHeight: 320 }}>
              <table className="acct-history-table">
                <thead>
                  <tr>
                    <th>로그인 유형</th>
                    <th>IP 주소</th>
                    <th>브라우저</th>
                    <th>로그인 시각</th>
                    <th>로그아웃 시각</th>
                  </tr>
                </thead>
                <tbody>
                  {loginHistory.length === 0 ? (
                    <tr><td colSpan={5} style={{ textAlign: 'center', padding: 24, color: '#64748b' }}>로그인 이력이 없습니다.</td></tr>
                  ) : (
                    loginHistory.map((h) => (
                      <tr key={h.HISTORY_ID}>
                        <td><span className={`acct-type-badge ${(h.LOGIN_TYPE || '').toLowerCase()}`}>{h.LOGIN_TYPE}</span></td>
                        <td>{h.IP_ADDRESS || '-'}</td>
                        <td>{parseBrowser(h.USER_AGENT)}</td>
                        <td>{formatDate(h.LOGIN_AT)}</td>
                        <td>{h.LOGOUT_AT ? formatDate(h.LOGOUT_AT) : '활성'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              </div>
          </div>
        </div>
      </div>
    </div>
  );
}
