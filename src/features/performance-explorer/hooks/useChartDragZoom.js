import { useState, useEffect, useCallback } from 'react';

// 단일 ECharts 인스턴스에 x축 drag-to-zoom + drag overlay rect 부착.
// ZRender 이벤트로 ECharts 내부 stopPropagation 우회.
const attachDragZoom = (inst, key, dom, setDragOverlay) => {
  if (inst._peDragHandlersAttached) return;
  inst._peDragHandlersAttached = true;

  const zr = inst.getZr();
  let startPx = null;
  let startData = null;
  let dragging = false;

  const xFromEvent = (e) => {
    const rect = dom.getBoundingClientRect();
    return e.clientX - rect.left;
  };

  zr.on('mousedown', (params) => {
    const e = params.event;
    if (e.button !== 0) return;
    const x = xFromEvent(e);
    const dataX = inst.convertFromPixel({ xAxisIndex: 0 }, x);
    if (dataX == null || isNaN(dataX)) return;
    startPx = x;
    startData = dataX;
    dragging = true;
    inst.dispatchAction({ type: 'hideTip' });
    setDragOverlay({ key, left: x, width: 0 });
  });

  zr.on('mousemove', (params) => {
    if (!dragging || startPx == null) return;
    const e = params.event;
    const rect = dom.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const left = Math.min(startPx, x);
    const width = Math.abs(x - startPx);
    setDragOverlay({ key, left, width });
    inst.dispatchAction({ type: 'hideTip' });
  });

  const finalize = (clientX) => {
    if (!dragging || startPx == null) return;
    const rect = dom.getBoundingClientRect();
    const x = clientX != null
      ? Math.max(0, Math.min(rect.width, clientX - rect.left))
      : startPx;
    const dataX = inst.convertFromPixel({ xAxisIndex: 0 }, x);
    setDragOverlay(null);
    if (dataX != null && !isNaN(dataX) && Math.abs(x - startPx) > 4) {
      const from = Math.min(startData, dataX);
      const to = Math.max(startData, dataX);
      inst.dispatchAction({ type: 'dataZoom', startValue: from, endValue: to });
    }
    startPx = null;
    startData = null;
    dragging = false;
  };

  zr.on('mouseup', (params) => finalize(params.event?.clientX));
  const onWinUp = (e) => finalize(e.clientX);
  window.addEventListener('mouseup', onWinUp);
  inst._peCleanup = () => window.removeEventListener('mouseup', onWinUp);
};

// chartRefs: [{ ref, key }, ...]
// rangeKey: 차트 마운트 트리거용 의존성 (modalAppliedRange 등)
// returns { dragOverlay, handleReset }
export function useChartDragZoom(chartRefs, rangeKey) {
  const [dragOverlay, setDragOverlay] = useState(null);

  useEffect(() => {
    const t = setTimeout(() => {
      chartRefs.forEach(({ ref, key }) => {
        const inst = ref.current?.getEchartsInstance?.();
        if (!inst) return;
        attachDragZoom(inst, key, inst.getDom(), setDragOverlay);
      });
    }, 80);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeKey]);

  const handleReset = useCallback(() => {
    chartRefs.forEach(({ ref }) => {
      const inst = ref.current?.getEchartsInstance?.();
      if (!inst) return;
      inst.dispatchAction({ type: 'dataZoom', start: 0, end: 100 });
      inst.dispatchAction({ type: 'brush', areas: [] });
    });
  }, [chartRefs]);

  return { dragOverlay, handleReset };
}
