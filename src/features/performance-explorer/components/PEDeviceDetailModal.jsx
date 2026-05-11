import { useChartDragZoom } from '../hooks/useChartDragZoom';
import { useModalControls } from '../hooks/useModalControls';
import PEDetailHeader from './PEDetailHeader';
import PEDetailCustomBar from './PEDetailCustomBar';
import PEDetailChartCell from './PEDetailChartCell';
import PEDetailPortPicker from './PEDetailPortPicker';

const TrafficControls = ({ trafficMode, setTrafficMode, btnRef, onTogglePicker, effectivePorts, availablePorts }) => (
  <div className="pe-detail-cell-controls">
    <div className="pe-segment pe-segment-sm">
      <button className={trafficMode === 'sum' ? 'active' : ''} onClick={() => setTrafficMode('sum')}>합산</button>
      <button className={trafficMode === 'ports' ? 'active' : ''} onClick={() => setTrafficMode('ports')}>포트별</button>
    </div>
    <button ref={btnRef} className="pe-port-picker-btn" onClick={onTogglePicker}>
      <i className="bi bi-ethernet" />
      포트 {effectivePorts.size}/{availablePorts.length}
      <i className="bi bi-chevron-down" />
    </button>
  </div>
);

export default function PEDeviceDetailModal({
  device, ledStatus,
  modalPeriod, modalCustomStart, modalCustomEnd, modalAppliedRange,
  modalTrafficMode, modalAvailablePorts, modalEffectivePorts,
  modalShowPortPicker, modalPortPickerPos, modalPortBtnRef, modalPortPickerRef,
  modalLoading,
  cpuOption, memOption, trafficOption, icmpOption,
  chartCpuRef, chartMemRef, chartTrafficRef, chartIcmpRef,
  onClose,
  setModalPeriod, setModalCustomStart, setModalCustomEnd, setModalAppliedRange,
  setModalTrafficMode, setModalSelectedPorts,
  setModalShowPortPicker, setModalPortPickerPos,
}) {
  const chartRefs = [
    { ref: chartCpuRef, key: 'cpu' },
    { ref: chartMemRef, key: 'mem' },
    { ref: chartTrafficRef, key: 'traffic' },
    { ref: chartIcmpRef, key: 'icmp' },
  ];
  const { dragOverlay, handleReset } = useChartDragZoom(chartRefs, modalAppliedRange);
  const { handlePeriodClick, applyCustom, togglePortPicker } = useModalControls({
    modalCustomStart, modalCustomEnd,
    modalShowPortPicker, modalAvailablePorts,
    modalPortBtnRef,
    setModalPeriod, setModalAppliedRange,
    setModalShowPortPicker, setModalPortPickerPos,
  });

  const cells = [
    { key: 'cpu', icon: 'bi-cpu', label: 'CPU', ref: chartCpuRef, option: cpuOption },
    { key: 'mem', icon: 'bi-memory', label: 'MEM', ref: chartMemRef, option: memOption },
    { key: 'traffic', icon: 'bi-arrow-down-up', label: 'Traffic', ref: chartTrafficRef, option: trafficOption },
    { key: 'icmp', icon: 'bi-broadcast-pin', label: 'ICMP', ref: chartIcmpRef, option: icmpOption },
  ];

  return (
    <div
      className="pe-detail-backdrop"
      onClick={onClose}
      onMouseDown={e => e.stopPropagation()}
      onPointerDown={e => e.stopPropagation()}
    >
      <div className="pe-detail-modal" onClick={e => e.stopPropagation()}>
        <PEDetailHeader
          device={device}
          ledStatus={ledStatus}
          modalPeriod={modalPeriod}
          onPeriodClick={handlePeriodClick}
          onReset={handleReset}
          onClose={onClose}
        />

        {modalPeriod === 'custom' && (
          <PEDetailCustomBar
            customStart={modalCustomStart}
            customEnd={modalCustomEnd}
            setCustomStart={setModalCustomStart}
            setCustomEnd={setModalCustomEnd}
            onApply={applyCustom}
          />
        )}

        <div className="pe-detail-grid">
          {cells.map(c => (
            <PEDetailChartCell
              key={c.key} cellKey={c.key} icon={c.icon} label={c.label}
              chartRef={c.ref} option={c.option}
              dragOverlay={dragOverlay} loading={modalLoading}
            >
              {c.key === 'traffic' && modalAvailablePorts.length > 0 && (
                <TrafficControls
                  trafficMode={modalTrafficMode}
                  setTrafficMode={setModalTrafficMode}
                  btnRef={modalPortBtnRef}
                  onTogglePicker={togglePortPicker}
                  effectivePorts={modalEffectivePorts}
                  availablePorts={modalAvailablePorts}
                />
              )}
            </PEDetailChartCell>
          ))}
        </div>
      </div>

      {modalShowPortPicker && (
        <PEDetailPortPicker
          pos={modalPortPickerPos}
          pickerRef={modalPortPickerRef}
          availablePorts={modalAvailablePorts}
          effectivePorts={modalEffectivePorts}
          setSelectedPorts={setModalSelectedPorts}
        />
      )}
    </div>
  );
}
