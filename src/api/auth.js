import apiClient from './client';

// UUID 생성 (crypto.randomUUID 폴백 - HTTP 환경 지원)
const generateUUID = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // 폴백: Math.random 기반 UUID v4
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

// 소셜 로그인 설정 (실제 환경에서는 환경변수로 관리)
const SOCIAL_CONFIG = {
  kakao: {
    clientId: import.meta.env.VITE_KAKAO_CLIENT_ID || '',
    redirectUri: `${window.location.origin}/login`,
    authUrl: 'https://kauth.kakao.com/oauth/authorize',
  },
  naver: {
    clientId: import.meta.env.VITE_NAVER_CLIENT_ID || '',
    redirectUri: `${window.location.origin}/login`,
    authUrl: 'https://nid.naver.com/oauth2.0/authorize',
  },
  google: {
    clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID || '',
    redirectUri: `${window.location.origin}/login`,
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    scope: 'email profile',
  },
};

// 마지막 로그인 시도한 provider 저장 키
const LAST_PROVIDER_KEY = 'last_social_provider';

export const authApi = {
  // 소셜 로그인 URL 생성 (클라이언트에서 직접 생성)
  getSocialLoginUrl: (provider) => {
    const config = SOCIAL_CONFIG[provider];
    if (!config) throw new Error(`Unknown provider: ${provider}`);

    // 마지막 로그인 시도 provider 저장
    localStorage.setItem(LAST_PROVIDER_KEY, provider);

    const state = generateUUID();
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: 'code',
      state: state,
    });

    if (provider === 'google') {
      params.append('scope', config.scope);
    }

    return { data: { url: `${config.authUrl}?${params.toString()}` } };
  },

  // 마지막 로그인 시도 provider 조회
  getLastProvider: () => localStorage.getItem(LAST_PROVIDER_KEY),

  // 마지막 로그인 시도 provider 삭제
  clearLastProvider: () => localStorage.removeItem(LAST_PROVIDER_KEY),

  // 리다이렉트 URI 조회
  getRedirectUri: () => `${window.location.origin}/login`,

  // 소셜 로그인 (Authorization Code 방식)
  socialLoginWithCode: (data) =>
    apiClient.post('/auth/social/code', data),

  // 소셜 로그인 (Access Token 방식)
  socialLogin: (data) =>
    apiClient.post('/auth/social/login', data),

  // 현재 사용자 정보 조회
  getCurrentUser: () =>
    apiClient.get('/auth/me'),

  // 로그아웃
  logout: () =>
    apiClient.post('/auth/logout'),

  // 세션 유효성 검증
  validateSession: () =>
    apiClient.get('/auth/validate'),

  // ==================== 로컬 인증 ====================

  // 로컬 로그인
  localLogin: (data) =>
    apiClient.post('/auth/login', data),

  // 회원가입
  signup: (data) =>
    apiClient.post('/auth/signup', data),

  // 로그인 ID 중복 체크
  checkLoginId: (loginId) =>
    apiClient.get(`/auth/check-id?loginId=${encodeURIComponent(loginId)}`),

  // 아이디 찾기
  findId: (data) =>
    apiClient.post('/auth/find-id', data),

  // 비밀번호 재설정
  resetPassword: (data) =>
    apiClient.post('/auth/reset-password', data),
};
