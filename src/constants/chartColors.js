/**
 * Chart Color Constants
 * NMS Premium Glassmorphism Design System
 *
 * ECharts cannot use CSS variables directly, so we define
 * JS constants that match our CSS token system.
 * Use getChartColor() for runtime theme-aware resolution.
 */

// Static chart color palette (matches --chart-* CSS tokens)
export const CHART_COLORS = {
  blue: '#3b82f6',
  emerald: '#10b981',
  violet: '#8b5cf6',
  red: '#ef4444',
  orange: '#f97316',
  amber: '#f59e0b',
  cyan: '#06b6d4',
  pink: '#ec4899',
  lime: '#84cc16',
  indigo: '#6366f1',
};

// Ordered sequence for multi-series charts
export const CHART_COLOR_SEQUENCE = [
  CHART_COLORS.blue,
  CHART_COLORS.emerald,
  CHART_COLORS.amber,
  CHART_COLORS.violet,
  CHART_COLORS.red,
  CHART_COLORS.cyan,
  CHART_COLORS.pink,
  CHART_COLORS.lime,
];

// Semantic chart colors
export const CHART_SEMANTIC = {
  cpu: CHART_COLORS.blue,
  memory: CHART_COLORS.emerald,
  traffic: CHART_COLORS.cyan,
  inbound: CHART_COLORS.blue,
  outbound: CHART_COLORS.emerald,
  error: CHART_COLORS.red,
  warning: CHART_COLORS.amber,
  success: CHART_COLORS.emerald,
};

// Status colors for fault/alert displays
export const STATUS_COLORS = {
  critical: '#ef4444',
  major: '#f97316',
  minor: '#f59e0b',
  warning: '#eab308',
  info: '#3b82f6',
  clear: '#22c55e',
};

/**
 * Resolve a CSS variable value at runtime.
 * Useful when you need theme-aware colors in JS (e.g., ECharts).
 *
 * @param {string} varName - CSS variable name (e.g., '--chart-blue')
 * @param {string} fallback - Fallback hex color
 * @returns {string} Resolved color value
 */
export function getCSSVar(varName, fallback = '') {
  return (
    getComputedStyle(document.documentElement)
      .getPropertyValue(varName)
      .trim() || fallback
  );
}

/**
 * Get a chart color that respects the current theme.
 * Falls back to the static CHART_COLORS if CSS var is unavailable.
 *
 * @param {string} name - Color name (e.g., 'blue', 'emerald')
 * @returns {string} Resolved color value
 */
export function getChartColor(name) {
  return getCSSVar(`--chart-${name}`, CHART_COLORS[name] || CHART_COLORS.blue);
}

// Common ECharts theme config (matches glassmorphism design)
export const ECHART_THEME = {
  backgroundColor: 'transparent',
  textStyle: {
    color: '#94a3b8',
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
  },
  title: {
    textStyle: {
      color: '#f0f2f5',
      fontSize: 14,
      fontWeight: 600,
    },
  },
  legend: {
    textStyle: {
      color: '#a0a8b8',
      fontSize: 11,
    },
  },
  tooltip: {
    backgroundColor: 'rgba(11, 13, 19, 0.95)',
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    textStyle: {
      color: '#f0f2f5',
      fontSize: 13,
    },
    extraCssText: 'backdrop-filter: blur(12px); border-radius: 10px; box-shadow: 0 8px 25px rgba(0,0,0,0.5);',
  },
  grid: {
    containLabel: true,
  },
};
