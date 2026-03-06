import axios from 'axios';

const apiClient = axios.create({
  baseURL: '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
  // Spring Boot 호환: 배열 파라미터를 groupIds=1&groupIds=2 형태로 직렬화
  paramsSerializer: {
    serialize: (params) => {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (Array.isArray(value)) {
          value.forEach(v => searchParams.append(key, v));
        } else if (value !== undefined && value !== null) {
          searchParams.append(key, value);
        }
      });
      return searchParams.toString();
    },
  },
});

// 401 처리 중복 방지 플래그
let isRedirecting = false;

// 요청 인터셉터
apiClient.interceptors.request.use(
  (config) => {
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 응답 인터셉터
apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    const config = error.config;

    // GET 요청에 한해 네트워크 오류 및 5xx 재시도 (최대 2회, 지수 백오프)
    if (config && config.method === 'get') {
      config.__retryCount = config.__retryCount || 0;
      const shouldRetry = !error.response || error.response.status >= 500;
      if (shouldRetry && config.__retryCount < 2) {
        config.__retryCount++;
        await new Promise((r) => setTimeout(r, config.__retryCount * 1000));
        return apiClient(config);
      }
    }

    // 401 Unauthorized 처리
    if (error.response?.status === 401) {
      // 중복 리다이렉트 방지
      if (!isRedirecting) {
        isRedirecting = true;

        // Zustand authStore 직접 상태 초기화 (React 외부에서도 동작)
        try {
          const { useAuthStore } = await import('../stores/authStore');
          useAuthStore.getState().setUser(null);
        } catch {
          // fallback: 수동 localStorage 초기화
          try {
            const authStorage = localStorage.getItem('auth-storage');
            if (authStorage) {
              const parsed = JSON.parse(authStorage);
              parsed.state = { user: null, isAuthenticated: false };
              localStorage.setItem('auth-storage', JSON.stringify(parsed));
            }
          } catch {
            localStorage.removeItem('auth-storage');
          }
        }

        // 현재 경로가 로그인 페이지가 아닌 경우에만 리다이렉트
        if (!window.location.pathname.startsWith('/login')) {
          const currentPath = window.location.pathname;
          if (currentPath !== '/' && currentPath !== '/dashboard') {
            sessionStorage.setItem('redirectAfterLogin', currentPath);
          }
          window.location.href = '/login';
        }

        // 플래그 리셋
        setTimeout(() => {
          isRedirecting = false;
        }, 3000);
      }
    }

    // 403 Forbidden 처리 (권한 부족)
    if (error.response?.status === 403) {
      console.warn('[API] 403 Forbidden:', error.config?.url);
    }

    // 에러 메시지에서 Java 예외 원문 필터링 (백엔드에서 노출된 경우 방어)
    if (error.response?.data?.message) {
      const msg = error.response.data.message;
      if (/java\.|Cannot invoke|NullPointer|ClassCast|StackOverflow|OutOfMemory|\.intValue\(\)|\.toString\(\)/.test(msg)) {
        error.response.data.message = '서버 오류가 발생했습니다.';
      }
    }

    return Promise.reject(error);
  }
);

export default apiClient;
