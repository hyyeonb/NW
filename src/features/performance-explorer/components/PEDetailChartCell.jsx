import SafeECharts from '../../../components/SafeECharts';

// 모달 4분할 그리드의 단일 차트 셀.
// dragOverlay는 모달이 useChartDragZoom hook으로 받아온 것을 그대로 prop으로 전달.
export default function PEDetailChartCell({
  cellKey, icon, label, chartRef, option, dragOverlay, loading, children,
}) {
  return (
    <div className="pe-detail-cell">
      <div className="pe-detail-cell-title">
        <span><i className={`bi ${icon}`} /> {label}</span>
        {children}
      </div>
      <div className="pe-detail-chart-wrap">
        <SafeECharts
          ref={chartRef}
          option={option}
          notMerge={true}
          style={{ height: '100%', width: '100%' }}
        />
        {dragOverlay?.key === cellKey && (
          <div
            className="pe-drag-overlay"
            style={{ left: dragOverlay.left, width: dragOverlay.width }}
          />
        )}
        {loading && (
          <div className="pe-chart-loading">
            <div className="pe-chart-loading-spinner" />
            <span>로딩</span>
          </div>
        )}
      </div>
    </div>
  );
}
