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
    textPrimary: '#1e293b',
    textSecondary: '#475569',
    textTertiary: '#64748b',
    textMuted: '#94a3b8',
    tooltipBg: 'rgba(255, 255, 255, 0.98)',
    tooltipBorder: '#e2e8f0',
    legendText: '#64748b',
    axisLabel: '#94a3b8',
    axisLine: '#e2e8f0',
    splitLine: '#f1f5f9',
    areaOpacity: 0.08,
  },
};

/**
 * 현재 테마에 맞는 차트 색상 반환
 * @param {string} theme - 'dark' | 'light'
 * @returns {object} 차트 테마 색상
 */
export const getChartTheme = (theme = 'dark') => {
  return CHART_THEME[theme] || CHART_THEME.dark;
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
  return {
    backgroundColor: t.tooltipBg,
    borderColor: t.tooltipBorder,
    borderWidth: 1,
    textStyle: { color: t.textPrimary, fontSize: 12 },
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
