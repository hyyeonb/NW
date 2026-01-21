import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const THEME_KEY = 'nms-theme';

/**
 * 테마 스토어
 * - 다크/라이트 모드 토글
 * - localStorage 영속성
 * - 시스템 설정 감지
 */
export const useThemeStore = create(
  persist(
    (set, get) => ({
      // 테마: 'dark' | 'light' | 'system'
      theme: 'dark',

      // 실제 적용되는 테마 (system일 경우 계산됨)
      resolvedTheme: 'dark',

      // 테마 설정
      setTheme: (theme) => {
        const resolved = theme === 'system'
          ? getSystemTheme()
          : theme;

        set({ theme, resolvedTheme: resolved });
        applyTheme(resolved);
      },

      // 다크/라이트 토글
      toggleTheme: () => {
        const current = get().resolvedTheme;
        const newTheme = current === 'dark' ? 'light' : 'dark';
        set({ theme: newTheme, resolvedTheme: newTheme });
        applyTheme(newTheme);
      },

      // 초기화 (앱 시작 시 호출)
      initTheme: () => {
        const { theme } = get();
        const resolved = theme === 'system'
          ? getSystemTheme()
          : theme;

        set({ resolvedTheme: resolved });
        applyTheme(resolved);

        // 시스템 테마 변경 감지
        if (theme === 'system') {
          watchSystemTheme((newTheme) => {
            set({ resolvedTheme: newTheme });
            applyTheme(newTheme);
          });
        }
      },
    }),
    {
      name: THEME_KEY,
      partialize: (state) => ({ theme: state.theme }),
    }
  )
);

/**
 * 시스템 테마 감지
 */
function getSystemTheme() {
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

/**
 * 시스템 테마 변경 감지
 */
function watchSystemTheme(callback) {
  if (typeof window === 'undefined') return;

  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  const handler = (e) => callback(e.matches ? 'dark' : 'light');

  mediaQuery.addEventListener('change', handler);
  return () => mediaQuery.removeEventListener('change', handler);
}

/**
 * HTML에 테마 적용
 */
function applyTheme(theme) {
  if (typeof document === 'undefined') return;

  // 전환 애니메이션을 위해 잠시 클래스 추가
  document.documentElement.classList.add('theme-transitioning');
  document.documentElement.setAttribute('data-theme', theme);

  // 메타 테마 컬러 업데이트 (모바일 브라우저용)
  const metaThemeColor = document.querySelector('meta[name="theme-color"]');
  if (metaThemeColor) {
    metaThemeColor.setAttribute('content', theme === 'dark' ? '#0a0a0f' : '#f8fafc');
  }

  // 전환 완료 후 클래스 제거
  setTimeout(() => {
    document.documentElement.classList.remove('theme-transitioning');
  }, 300);
}
