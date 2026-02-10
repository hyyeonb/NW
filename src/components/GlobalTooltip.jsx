import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';

/**
 * 글로벌 커스텀 툴팁 컴포넌트
 * - document 레벨 이벤트 위임으로 모든 말줄임(...) 텍스트 감지
 * - 300ms 딜레이 후 툴팁 표시
 * - portal 기반 렌더링 (z-index 이슈 방지)
 * - 화면 경계 자동 보정
 */
export default function GlobalTooltip() {
  const [tooltip, setTooltip] = useState({ visible: false, text: '', x: 0, y: 0, above: true });
  const timerRef = useRef(null);
  const currentTargetRef = useRef(null);

  // 말줄임 된 요소 찾기 (최대 5단계 부모 탐색)
  const findTruncatedElement = useCallback((target) => {
    let el = target;
    for (let i = 0; i < 5 && el && el !== document.body; i++) {
      if (el.nodeType === 1) {
        const cw = el.clientWidth;
        if (cw > 0 && el.scrollWidth > cw + 1) {
          const style = getComputedStyle(el);
          if (
            style.textOverflow === 'ellipsis' ||
            (style.overflow === 'hidden' && style.whiteSpace === 'nowrap')
          ) {
            return el;
          }
        }
      }
      el = el.parentElement;
    }
    return null;
  }, []);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const hideTooltip = useCallback(() => {
    clearTimer();
    currentTargetRef.current = null;
    setTooltip(prev => prev.visible ? { ...prev, visible: false } : prev);
  }, [clearTimer]);

  const handleMouseOver = useCallback((e) => {
    const el = findTruncatedElement(e.target);

    // 같은 요소면 무시
    if (el === currentTargetRef.current) return;

    clearTimer();

    if (!el) {
      if (currentTargetRef.current) hideTooltip();
      return;
    }

    const text = el.textContent?.trim();
    if (!text) return;

    currentTargetRef.current = el;
    const rect = el.getBoundingClientRect();

    // 상단 공간이 부족하면 아래에 표시
    const above = rect.top > 50;

    timerRef.current = setTimeout(() => {
      setTooltip({
        visible: true,
        text,
        x: rect.left + rect.width / 2,
        y: above ? rect.top - 6 : rect.bottom + 6,
        above,
      });
    }, 300);
  }, [findTruncatedElement, clearTimer, hideTooltip]);

  const handleMouseOut = useCallback((e) => {
    if (!currentTargetRef.current) return;

    // 현재 추적 중인 요소 내부로 이동하는 경우 무시
    const related = e.relatedTarget;
    if (related && currentTargetRef.current.contains(related)) return;

    hideTooltip();
  }, [hideTooltip]);

  useEffect(() => {
    document.addEventListener('mouseover', handleMouseOver, true);
    document.addEventListener('mouseout', handleMouseOut, true);

    // 스크롤 시 툴팁 숨김 (capture로 모든 스크롤 이벤트 감지)
    const handleScroll = () => hideTooltip();
    window.addEventListener('scroll', handleScroll, true);

    return () => {
      document.removeEventListener('mouseover', handleMouseOver, true);
      document.removeEventListener('mouseout', handleMouseOut, true);
      window.removeEventListener('scroll', handleScroll, true);
      clearTimer();
    };
  }, [handleMouseOver, handleMouseOut, hideTooltip, clearTimer]);

  if (!tooltip.visible) return null;

  return createPortal(
    <div
      className="global-tooltip"
      style={{
        position: 'fixed',
        left: tooltip.x,
        top: tooltip.y,
        transform: tooltip.above
          ? 'translate(-50%, -100%)'
          : 'translate(-50%, 0)',
        zIndex: 99999,
      }}
    >
      {tooltip.text}
    </div>,
    document.body
  );
}
