import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { authApi } from '../api';

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      setUser: (user) =>
        set({ user, isAuthenticated: !!user, error: null }),

      fetchCurrentUser: async () => {
        set({ isLoading: true, error: null });
        try {
          const response = await authApi.getCurrentUser();
          const userData = response.data?.data || response.data;
          set({
            user: userData,
            isAuthenticated: true,
            isLoading: false,
          });
          return userData;
        } catch (error) {
          set({
            user: null,
            isAuthenticated: false,
            isLoading: false,
            error: error.response?.data?.message || '사용자 정보 조회 실패',
          });
          throw error;
        }
      },

      logout: async () => {
        try {
          await authApi.logout();
        } finally {
          set({ user: null, isAuthenticated: false, error: null });
        }
      },

      // 소셜 로그인 URL로 리다이렉트
      socialLogin: (provider) => {
        try {
          const response = authApi.getSocialLoginUrl(provider);
          window.location.href = response.data.url;
        } catch (error) {
          console.error('Social login error:', error);
          set({ error: '소셜 로그인 URL 생성 실패' });
          throw error;
        }
      },

      // OAuth 콜백 처리 (Authorization Code 방식)
      handleOAuthCallback: async (provider, code, redirectUri, state) => {
        set({ isLoading: true, error: null });
        try {
          const response = await authApi.socialLoginWithCode({
            SOCIAL_TYPE: provider.toUpperCase(),
            CODE: code,
            REDIRECT_URI: redirectUri,
            STATE: state,
          });

          const loginData = response.data?.data || response.data;
          set({
            user: loginData,
            isAuthenticated: true,
            isLoading: false,
          });
          return loginData;
        } catch (error) {
          set({
            user: null,
            isAuthenticated: false,
            isLoading: false,
            error: error.response?.data?.message || '소셜 로그인 실패',
          });
          throw error;
        }
      },

      // 세션 유효성 검증
      validateSession: async () => {
        try {
          const response = await authApi.validateSession();
          const isValid = response.data?.data;
          if (!isValid) {
            set({ user: null, isAuthenticated: false });
          }
          return isValid;
        } catch {
          set({ user: null, isAuthenticated: false });
          return false;
        }
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ user: state.user, isAuthenticated: state.isAuthenticated }),
    }
  )
);
