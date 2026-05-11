// Traceroute 페이지의 노드/카드 sub-component 모음.

function DeviceCard({ label, icon, iconColor, device, onClear, placeholder, hint, active, onClick }) {
  return (
    <div
      className={`traceroute-device-card${active ? ' traceroute-device-card--active' : ''}`}
      onClick={onClick}
    >
      <div className="traceroute-card-label">
        <i className={`bi ${icon}`} style={{ color: iconColor }}></i>
        {label}
      </div>
      {device ? (
        <div className="traceroute-card-selected">
          <div className="traceroute-card-device-name">{device.DEVICE_NAME}</div>
          <div className="traceroute-card-device-ip">{device.DEVICE_IP}</div>
          <button className="traceroute-card-clear"
            onClick={e => { e.stopPropagation(); onClear(); }}>
            <i className="bi bi-x"></i>
          </button>
        </div>
      ) : (
        <div className="traceroute-card-empty">
          <i className="bi bi-mouse2 traceroute-card-empty-icon"></i>
          <span className="traceroute-card-placeholder">{placeholder}</span>
          {hint && <span className="traceroute-card-hint">{hint}</span>}
        </div>
      )}
    </div>
  );
}

// ── 플로우 노드 ──
function SourceNode({ device }) {
  return (
    <div className="traceroute-node traceroute-node--source">
      <div className="traceroute-node-hop-num">출발지</div>
      <div className="traceroute-node-icon"><i className="bi bi-laptop"></i></div>
      {device
        ? <><div className="traceroute-node-name">{device.deviceName}</div>
            <div className="traceroute-node-ip">{device.deviceIp}</div></>
        : <div className="traceroute-node-ip">Middleware</div>}
    </div>
  );
}

// ── * 홉 묶음 노드 ──
function UnknownSectionNode({ count }) {
  return (
    <>
      <div className="traceroute-arrow">
        <div className="traceroute-arrow-line"></div>
        <i className="bi bi-caret-right-fill traceroute-arrow-head"></i>
      </div>
      <div className="traceroute-node traceroute-node--timeout">
        <div className="traceroute-node-hop-num">응답 없음</div>
        <div className="traceroute-node-icon"><i className="bi bi-question-lg"></i></div>
        <div className="traceroute-node-ip">ICMP 차단</div>
        <div className="traceroute-node-rtt">{count}개 홉</div>
      </div>
    </>
  );
}

// ── 목적지 종단 노드 ──
function TargetEndNode({ device, ip }) {
  return (
    <>
      <div className="traceroute-arrow">
        <div className="traceroute-arrow-line"></div>
        <i className="bi bi-caret-right-fill traceroute-arrow-head"></i>
      </div>
      <div className="traceroute-node traceroute-node--target">
        <div className="traceroute-node-hop-num">목적지</div>
        <div className="traceroute-node-icon"><i className="bi bi-flag-fill"></i></div>
        {device
          ? <><div className="traceroute-node-name">{device.deviceName}</div>
               <div className="traceroute-node-ip">{device.deviceIp}</div></>
          : <div className="traceroute-node-ip">{ip}</div>}
      </div>
    </>
  );
}

function HopNode({ hop, isTarget }) {
  const isTimeout    = hop.ip === '*';
  const isRegistered = !!hop.device;
  let cls = 'traceroute-node';
  if (isTimeout)    cls += ' traceroute-node--timeout';
  else if (isTarget)    cls += ' traceroute-node--target';
  else if (isRegistered) cls += ' traceroute-node--registered';
  else               cls += ' traceroute-node--unknown';
  const avgRtt = hop.rtts?.find(r => r !== '*') || '*';
  return (
    <>
      <div className="traceroute-arrow">
        <div className="traceroute-arrow-line"></div>
        <i className="bi bi-caret-right-fill traceroute-arrow-head"></i>
      </div>
      <div className={cls}>
        <div className="traceroute-node-hop-num">Hop {hop.hopNumber}</div>
        <div className="traceroute-node-icon">
          {isTimeout ? <i className="bi bi-question-circle"></i>
            : isRegistered ? <i className="bi bi-hdd-network"></i>
            : <i className="bi bi-router"></i>}
        </div>
        {isRegistered && <div className="traceroute-node-name">{hop.device.deviceName}</div>}
        <div className="traceroute-node-ip">{isTimeout ? '*' : hop.ip}</div>
        <div className="traceroute-node-rtt">{isTimeout ? 'Timeout' : avgRtt}</div>
      </div>
    </>
  );
}

export { DeviceCard, SourceNode, UnknownSectionNode, TargetEndNode, HopNode };
