import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactECharts from 'echarts-for-react';

/**
 * ECharts 래퍼
 * - ResizeObserver로 wrapper 실제 픽셀 크기 측정 → ReactECharts에 직접 전달
 *   (height:100% 체인 의존 제거 → canvas 크기 불일치 원천 차단)
 * - tooltip 기본값 자동 주입: appendToBody=true + z-index 9999
 * - 기존 option.tooltip 설정은 유지 (사용자 지정 우선)
 */
export default function SafeECharts({ ref: outerRef, style, ...restProps }) {
  const wrapperRef = useRef(null);
  const innerRef = useRef(null);
  const [size, setSize] = useState(null);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      if (width > 0 && height > 0) setSize({ width, height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const setRef = useCallback((el) => {
    innerRef.current = el;
    if (typeof outerRef === 'function') outerRef(el);
    else if (outerRef) outerRef.current = el;
  }, [outerRef]);

  const enhancedOption = useMemo(() => enhanceTooltip(restProps.option), [restProps.option]);

  // SVG 렌더러 + 고DPI 강제 — 라이트 모드에서 작은 텍스트 흐림 방지
  const opts = useMemo(() => ({
    renderer: 'svg',
    devicePixelRatio: typeof window !== 'undefined' ? Math.max(window.devicePixelRatio || 1, 2) : 2,
    ...(restProps.opts || {}),
  }), [restProps.opts]);

  return (
    <div ref={wrapperRef} style={{ width: '100%', height: '100%', ...style }}>
      {size && (
        <ReactECharts
          {...restProps}
          ref={setRef}
          option={enhancedOption}
          opts={opts}
          style={{ width: size.width, height: size.height }}
        />
      )}
    </div>
  );
}

function enhanceTooltip(option) {
  if (!option || typeof option !== 'object') return option;

  const injectDefaults = (t = {}) => {
    const extra = t.extraCssText ? `${t.extraCssText}; z-index: 9999;` : 'z-index: 9999;';
    return {
      appendToBody: true,
      confine: false,
      ...t,
      extraCssText: extra,
    };
  };

  const tooltip = option.tooltip;
  let next;
  if (Array.isArray(tooltip)) {
    next = tooltip.map(injectDefaults);
  } else {
    next = injectDefaults(tooltip || {});
  }

  return { ...option, tooltip: next };
}
