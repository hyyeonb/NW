import { useThemeStore } from '../stores/themeStore';

/**
 * 테마 토글 버튼 (원형 아이콘)
 *
 * 사용:
 *   <ThemeToggle />                  // 기본 floating 버튼
 *   <ThemeToggle className="..." />  // 위치/스타일 커스텀
 */
export default function ThemeToggle({ className = '', title, style }) {
  const resolvedTheme = useThemeStore((s) => s.resolvedTheme);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);
  const isDark = resolvedTheme === 'dark';

  return (
    <button
      type="button"
      className={`theme-toggle-btn ${className}`}
      onClick={toggleTheme}
      title={title || (isDark ? '라이트 모드로 전환' : '다크 모드로 전환')}
      aria-label="테마 전환"
      style={style}
    >
      <i className={`bi ${isDark ? 'bi-sun-fill' : 'bi-moon-stars-fill'}`} />
    </button>
  );
}
