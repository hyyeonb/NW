/**
 * ECharts 공통 테마 유틸리티
 * 차트에서 하드코딩 색상 대신 이 유틸리티를 사용
 */

const CHART_THEME = {
  dark: {
    textPrimary: '#f8fafc',
    textSecondary: '#e2e8f0',
    textTertiary: '#94a3b8',
    textMuted: '#64748b',
    tooltipBg: 'rgba(15, 15, 35, 0.95)',
    tooltipBorder: 'rgba(255, 255, 255, 0.1)',
    legendText: '#94a3b8',
    axisLabel: '#64748b',
    axisLine: '#334155',
    splitLine: '#1e293b',
    areaOpacity: 0.15,
  },
  light: {
    textPrimary: '#0a0e17',
    textSecondary: '#2d3748',
    textTertiary: '#4a5568',
    textMuted: '#a0aec0',
    tooltipBg: 'rgba(255, 255, 255, 0.98)',
    tooltipBorder: '#e2e8f0',
    legendText: '#6b7280',
    axisLabel: '#9ca3af',
    axisLine: '#edf0f4',        /* 축선 매우 연하게 */
    splitLine: '#f3f5f8',        /* 그리드선 거의 안 보이게 */
    areaOpacity: 0.08,
  },
};

/**
 * 현재 테마에 맞는 차트 색상 반환
 * @param {string} theme - 'dark' | 'light'
 * @returns {object} 차트 테마 색상
 */
export const getChartTheme = (theme = 'dark') => {
  // light-v1, light-v2, light-v3, light-v4 모두 light 테마로 처리
  const key = theme?.startsWith('light') ? 'light' : 'dark';
  return CHART_THEME[key];
};

/**
 * 현재 DOM의 data-theme 속성을 기반으로 차트 테마 반환
 * @returns {object} 차트 테마 색상
 */
export const getCurrentChartTheme = () => {
  const theme = document.documentElement.getAttribute('data-theme') || 'dark';
  return getChartTheme(theme);
};

/**
 * 공통 ECharts 툴팁 설정
 */
export const getTooltipConfig = (theme = 'dark') => {
  const t = getChartTheme(theme);
  const isLight = theme?.startsWith('light');
  return {
    backgroundColor: t.tooltipBg,
    borderColor: t.tooltipBorder,
    borderWidth: 1,
    borderRadius: 10,
    padding: [10, 14],
    textStyle: { color: t.textPrimary, fontSize: 12, fontWeight: 500 },
    extraCssText: isLight
      ? 'box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12), 0 2px 6px rgba(0, 0, 0, 0.06); backdrop-filter: blur(8px);'
      : 'box-shadow: 0 12px 32px rgba(0, 0, 0, 0.5); backdrop-filter: blur(12px);',
  };
};

/**
 * 공통 ECharts 범례 설정
 */
export const getLegendConfig = (theme = 'dark') => {
  const t = getChartTheme(theme);
  return {
    textStyle: { color: t.legendText, fontSize: 11 },
  };
};

/**
 * 공통 ECharts 축 설정
 */
export const getAxisConfig = (theme = 'dark') => {
  const t = getChartTheme(theme);
  return {
    axisLabel: { color: t.axisLabel },
    axisLine: { lineStyle: { color: t.axisLine } },
    splitLine: { lineStyle: { color: t.splitLine } },
  };
};

export default CHART_THEME;
