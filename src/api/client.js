import axios from 'axios';

const apiClient = axios.create({
  baseURL: '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
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
  (error) => {
    // 401 Unauthorized 처리
    if (error.response?.status === 401) {
      // 중복 리다이렉트 방지
      if (!isRedirecting) {
        isRedirecting = true;

        // 로컬 스토리지의 인증 정보 초기화
        try {
          const authStorage = localStorage.getItem('auth-storage');
          if (authStorage) {
            const parsed = JSON.parse(authStorage);
            parsed.state = {
              user: null,
              isAuthenticated: false,
            };
            localStorage.setItem('auth-storage', JSON.stringify(parsed));
          }
        } catch (e) {
          // 파싱 실패 시 전체 삭제
          localStorage.removeItem('auth-storage');
        }

        // 현재 경로가 로그인 페이지가 아닌 경우에만 리다이렉트
        if (!window.location.pathname.startsWith('/login')) {
          // 현재 경로 저장 (로그인 후 돌아오기 위해)
          const currentPath = window.location.pathname;
          if (currentPath !== '/' && currentPath !== '/main') {
            sessionStorage.setItem('redirectAfterLogin', currentPath);
          }
          window.location.href = '/login';
        }

        // 잠시 후 플래그 리셋 (페이지 이동이 안 됐을 경우를 대비)
        setTimeout(() => {
          isRedirecting = false;
        }, 3000);
      }
    }

    return Promise.reject(error);
  }
);

export default apiClient;
