import { createPortal } from 'react-dom';
import { PORT_COLORS } from '../model/constants';

// 모달 상단 우측의 포트 picker — 차트 위에 floating, document.body로 portal.
export default function PEDetailPortPicker({
  pos, pickerRef, availablePorts, effectivePorts, setSelectedPorts,
}) {
  if (!pos) return null;

  const togglePort = (ifIndex) => {
    const next = new Set(effectivePorts);
    if (next.has(ifIndex)) next.delete(ifIndex);
    else next.add(ifIndex);
    setSelectedPorts(next);
  };

  return createPortal(
    <div
      ref={pickerRef}
      className="pe-port-picker pe-port-picker-fixed"
      style={{ top: pos.top, left: pos.left }}
    >
      <div className="pe-port-picker-head">
        <span>포트 선택</span>
        <div className="pe-port-picker-actions">
          <button onClick={() => setSelectedPorts(new Set(availablePorts.map(p => p.ifIndex)))}>전체</button>
          <button onClick={() => setSelectedPorts(new Set())}>해제</button>
        </div>
      </div>
      <div className="pe-port-picker-list">
        {availablePorts.map((p, i) => {
          const checked = effectivePorts.has(p.ifIndex);
          const c = PORT_COLORS[i % PORT_COLORS.length];
          return (
            <label key={p.ifIndex} className={`pe-port-item ${checked ? 'on' : ''}`}>
              <input
                type="checkbox"
                checked={checked}
                onChange={() => togglePort(p.ifIndex)}
              />
              <span className="pe-port-dot" style={{ background: c }} />
              <div className="pe-port-info">
                <div className="pe-port-row1">
                  <span className="pe-port-name">{p.ifName}</span>
                  <span className="pe-port-idx">#{p.ifIndex}</span>
                </div>
              </div>
            </label>
          );
        })}
      </div>
    </div>,
    document.body
  );
}
