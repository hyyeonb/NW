import { useState, useEffect, useCallback, useMemo } from 'react';
import { devicesApi } from '../api/devices';
import { groupsApi } from '../api/groups';
import { historyApi } from '../api/history';
import '../styles/traceroute.css';
import IpInput from '../components/IpInput';

export default function Traceroute() {
  // 트리 데이터
  const [groupTree, setGroupTree]     = useState([]);
  const [sshDevices, setSshDevices]   = useState([]);  // 출발지용 (SSH 장비만)
  const [allDevices, setAllDevices]   = useState([]);  // 목적지용 (전체 장비)
  const [treeLoading, setTreeLoading] = useState(true);
  const [treeError, setTreeError]     = useState('');
  const [searchText, setSearchText]   = useState('');
  const [expandedGroups, setExpandedGroups] = useState({});

  // 선택된 장비
  const [sourceDevice, setSourceDevice] = useState(null);
  const [targetDevice, setTargetDevice] = useState(null);
  const [selectMode, setSelectMode]     = useState('source'); // 'source' | 'target'

  // 목적지 모드: 'device' (트리 선택) | 'ip' (직접 입력)
  const [targetMode, setTargetMode] = useState('device');
  const [targetIpInput, setTargetIpInput] = useState('');

  // 설정
  const [maxHops, setMaxHops]     = useState(30);
  const [timeout, setTimeout_]    = useState(1000);

  // 결과
  const [loading, setLoading] = useState(false);
  const [result, setResult]   = useState(null);
  const [error, setError]     = useState('');

  // ── 트리 데이터 로드 ──
  useEffect(() => {
    const loadTree = async () => {
      setTreeLoading(true);
      setTreeError('');
      try {
        // 1) 그룹 트리
        let tree = [];
        try {
          const res = await groupsApi.getGroupTree();
          tree = res.data?.data || res.data || [];
        } catch (e) {
          setTreeError('그룹 트리 로드 실패: ' + (e.response?.data?.message || e.message));
          return;
        }

        // 2) SSH 장비 (출발지용)
        let ssh = [];
        try {
          const res = await devicesApi.getSshEnabledDevices();
          ssh = res.data?.data || res.data || [];
        } catch (e) {
          console.warn('SSH 장비 목록 조회 실패:', e.message);
        }

        // 3) 전체 장비 (목적지용)
        let all = [];
        try {
          const res = await devicesApi.getAllDevices();
          all = res.data?.data || res.data || [];
        } catch (e) {
          console.warn('전체 장비 목록 조회 실패:', e.message);
        }

        setGroupTree(Array.isArray(tree) ? tree : []);
        setSshDevices(Array.isArray(ssh)  ? ssh  : []);
        setAllDevices(Array.isArray(all)  ? all  : []);

        // 최상위 그룹 기본 펼침
        const init = {};
        (Array.isArray(tree) ? tree : []).forEach(g => { init[g.GROUP_ID] = true; });
        setExpandedGroups(init);
      } finally {
        setTreeLoading(false);
      }
    };
    loadTree();
  }, []);

  const toggleGroup = useCallback((groupId) => {
    setExpandedGroups(prev => ({ ...prev, [groupId]: !prev[groupId] }));
  }, []);

  // 현재 모드에 맞는 장비 목록 + 검색 필터
  const currentDevices = selectMode === 'source' ? sshDevices : allDevices;
  const filteredDevices = currentDevices.filter(d =>
    !searchText ||
    d.DEVICE_NAME?.toLowerCase().includes(searchText.toLowerCase()) ||
    d.DEVICE_IP?.includes(searchText)
  );

  // 장비 클릭
  const handleDeviceClick = useCallback((device) => {
    if (selectMode === 'source') {
      setSourceDevice(device);
      setSelectMode('target');   // 자동으로 목적지 선택 모드 전환
      setSearchText('');
    } else {
      if (device.DEVICE_ID === sourceDevice?.DEVICE_ID) return;
      setTargetDevice(device);
      // 목적지 선택 후에는 모드 유지 (사용자가 바꾸고 싶으면 버튼 클릭)
    }
    setResult(null);
    setError('');
  }, [selectMode, sourceDevice]);

  const clearSource = () => { setSourceDevice(null); setSelectMode('source'); setResult(null); };
  const clearTarget = () => { setTargetDevice(null); setResult(null); };

  // 목적지 모드 전환
  const handleTargetModeChange = (mode) => {
    if (mode === targetMode) return;
    setTargetMode(mode);
    setTargetDevice(null);
    setTargetIpInput('');
    setResult(null);
    setError('');
    if (mode === 'ip' && selectMode === 'target') {
      setSelectMode('source');
    }
  };

  const isValidIpv4 = (ip) => /^(\d{1,3}\.){3}\d{1,3}$/.test(ip) &&
    ip.split('.').every(n => { const v = parseInt(n); return v >= 0 && v <= 255; });

  const handleRun = async () => {
    if (targetMode === 'device' && !targetDevice) {
      setError('목적지 장비를 선택하세요.');
      return;
    }
    if (targetMode === 'ip') {
      const trimmed = targetIpInput.trim();
      if (!trimmed) { setError('목적지 IP를 입력하세요.'); return; }
      if (!isValidIpv4(trimmed)) { setError('올바른 IPv4 형식이 아닙니다. (예: 192.168.1.1)'); return; }
    }
    setError('');
    setResult(null);
    setLoading(true);
    const targetIp = targetMode === 'ip' ? targetIpInput.trim() : targetDevice?.DEVICE_IP;
    historyApi.recordPageView('traceroute', '/tools/traceroute', {
      targetType: 'TRACEROUTE',
      targetName: targetIp,
      detail: `Traceroute 실행 - ${sourceDevice ? sourceDevice.DEVICE_NAME + '(' + sourceDevice.DEVICE_IP + ')' : '미들웨어'} → ${targetIp}`,
    });
    try {
      const res = await devicesApi.traceroute(
        sourceDevice?.DEVICE_ID || null,
        targetMode === 'device' ? targetDevice.DEVICE_ID : null,
        maxHops,
        timeout,
        targetMode === 'ip' ? targetIpInput.trim() : null
      );
      if (res.data?.code === 200) {
        setResult(res.data.data);
      } else {
        setError(res.data?.message || 'Traceroute 실패');
      }
    } catch (e) {
      setError(e.response?.data?.message || e.message || '서버 오류');
    } finally {
      setLoading(false);
    }
  };

  // 목적지 도달 이후 홉 제외 (도달 후 * 은 실패가 아님)
  const effectiveHops = useMemo(() => {
    if (!result?.hops) return [];
    const idx = result.hops.findIndex(h => h.ip === result.targetIp);
    return idx >= 0 ? result.hops.slice(0, idx + 1) : result.hops;
  }, [result]);

  const validHops        = effectiveHops.filter(h => h.ip !== '*');
  const timeoutCount     = effectiveHops.length - validHops.length;
  const hasTimeouts      = timeoutCount > 0;
  const targetInHops     = validHops.some(h => h.ip === result?.targetIp);
  const unregisteredHops = validHops.filter(h => !h.device);

  const { avgRtt, maxRtt } = useMemo(() => {
    if (!effectiveHops.length) return { avgRtt: 0, maxRtt: 0 };
    const rtts = effectiveHops
      .filter(h => h.rtts?.length)
      .flatMap(h => h.rtts.map(r => parseFloat(r)))
      .filter(r => !isNaN(r));
    if (!rtts.length) return { avgRtt: 0, maxRtt: 0 };
    return {
      avgRtt: (rtts.reduce((a, b) => a + b, 0) / rtts.length).toFixed(1),
      maxRtt: Math.max(...rtts).toFixed(1)
    };
  }, [effectiveHops]);

  const treeTitle    = selectMode === 'source'
    ? `출발지 장비 (SSH) — ${sshDevices.length}대`
    : targetMode === 'ip'
      ? '출발지 장비 (SSH) — IP 직접 입력 모드'
      : `목적지 장비 (전체) — ${allDevices.length}대`;
  const treeSubtitle = selectMode === 'source'
    ? 'SSH 접속 정보가 등록된 장비만 표시됩니다'
    : targetMode === 'ip'
      ? '목적지 IP를 직접 입력하므로 트리에서 출발지만 선택합니다'
      : '등록된 모든 장비가 표시됩니다';

  return (
    <div className="traceroute-page">
      {/* 헤더 */}
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">
            <i className="bi bi-signpost-split"></i> 네트워크 경로 추적
          </h1>
          <span className="page-subtitle">두 장비 사이의 홉(Hop) 경로를 추적합니다</span>
        </div>
      </div>

      <div className="traceroute-body">
        {/* ── 왼쪽: 장비 트리 ── */}
        <div className="traceroute-tree-panel glass-panel">

          {/* 트리 헤더 (선택 모드 표시) */}
          <div className={`traceroute-tree-header traceroute-tree-header--${selectMode}`}>
            <div className="traceroute-tree-header-top">
              <i className={`bi ${selectMode === 'source' ? 'bi-geo-alt' : 'bi-geo-alt-fill'}`}></i>
              <span>{treeTitle}</span>
            </div>
            <div className="traceroute-tree-header-sub">{treeSubtitle}</div>
          </div>

          {/* 선택 모드 탭 */}
          <div className="traceroute-mode-tabs">
            <button
              className={`traceroute-mode-tab ${selectMode === 'source' ? 'active' : ''}`}
              onClick={() => { setSelectMode('source'); setSearchText(''); }}
            >
              <i className="bi bi-geo-alt"></i> 출발지 선택
              {sourceDevice && <span className="traceroute-tab-check"><i className="bi bi-check-circle-fill"></i></span>}
            </button>
            <button
              className={`traceroute-mode-tab ${selectMode === 'target' ? 'active' : ''}${targetMode === 'ip' ? ' traceroute-mode-tab--disabled' : ''}`}
              onClick={() => { if (targetMode === 'ip') return; setSelectMode('target'); setSearchText(''); }}
              title={targetMode === 'ip' ? 'IP 직접 입력 모드에서는 트리 목적지 선택이 비활성화됩니다' : ''}
            >
              <i className="bi bi-geo-alt-fill"></i> 목적지 선택
              {targetMode === 'ip' && <span style={{fontSize:'0.62rem',color:'#475569',marginLeft:2}}>(IP 입력)</span>}
              {targetDevice && <span className="traceroute-tab-check"><i className="bi bi-check-circle-fill"></i></span>}
            </button>
          </div>

          {/* 검색 */}
          <div className="traceroute-search-wrap">
            <i className="bi bi-search traceroute-search-icon"></i>
            <input
              type="text"
              className="traceroute-search-input"
              placeholder="장비명 또는 IP 검색..."
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
            />
            {searchText && (
              <button className="traceroute-search-clear" onClick={() => setSearchText('')}>
                <i className="bi bi-x"></i>
              </button>
            )}
          </div>

          {/* 트리 */}
          <div className="traceroute-tree-scroll">
            {treeLoading ? (
              <div className="traceroute-tree-loading">
                <span className="traceroute-spinner"></span>
                <span>장비 목록 로딩 중...</span>
              </div>
            ) : treeError ? (
              <div className="traceroute-tree-err">{treeError}</div>
            ) : filteredDevices.length === 0 && searchText ? (
              <div className="traceroute-tree-loading" style={{ color: '#475569' }}>
                <i className="bi bi-search"></i>
                <span>검색 결과 없음</span>
              </div>
            ) : (
              <div className="traceroute-tree">
                {groupTree.map(group => (
                  <TreeGroupNode
                    key={group.GROUP_ID}
                    group={group}
                    filteredDevices={filteredDevices}
                    expandedGroups={expandedGroups}
                    toggleGroup={toggleGroup}
                    onDeviceClick={handleDeviceClick}
                    sourceDevice={sourceDevice}
                    targetDevice={targetDevice}
                    selectMode={selectMode}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── 오른쪽 ── */}
        <div className="traceroute-right">
          {/* 설정 카드 */}
          <div className="tr-config-card">
            {/* Row 1: 출발지 → 목적지 */}
            <div className="tr-route-row">
              {/* 출발지 chip */}
              <div className={`tr-chip tr-chip-source${selectMode === 'source' ? ' tr-chip-active' : ''}`} onClick={() => { setSelectMode('source'); setSearchText(''); }}>
                <i className="bi bi-geo-alt" />
                {sourceDevice ? (
                  <>
                    <span className="tr-chip-name">{sourceDevice.DEVICE_NAME || sourceDevice.name}</span>
                    <span className="tr-chip-ip">{sourceDevice.DEVICE_IP || sourceDevice.ip}</span>
                    <i className="bi bi-x tr-chip-x" onClick={(e) => { e.stopPropagation(); clearSource(); }} />
                  </>
                ) : (
                  <span className="tr-chip-empty">Middleware 서버 (기본)</span>
                )}
              </div>

              <i className="bi bi-arrow-right tr-route-arrow" />

              {/* 목적지 chip */}
              <div className={`tr-chip tr-chip-target${selectMode === 'target' ? ' tr-chip-active' : ''}`}>
                <i className="bi bi-geo-alt-fill" />
                {/* 모드 토글 */}
                <div className="tr-mode-toggle">
                  <button className={targetMode === 'device' ? 'active' : ''} onClick={() => handleTargetModeChange('device')}>장비</button>
                  <button className={targetMode === 'ip' ? 'active' : ''} onClick={() => handleTargetModeChange('ip')}>IP</button>
                </div>
                {targetMode === 'device' ? (
                  targetDevice ? (
                    <>
                      <span className="tr-chip-name">{targetDevice.DEVICE_NAME || targetDevice.name}</span>
                      <span className="tr-chip-ip">{targetDevice.DEVICE_IP || targetDevice.ip}</span>
                      <i className="bi bi-x tr-chip-x" onClick={(e) => { e.stopPropagation(); clearTarget(); }} />
                    </>
                  ) : (
                    <span className="tr-chip-empty" onClick={() => { setSelectMode('target'); setSearchText(''); }}>트리에서 선택 *</span>
                  )
                ) : (
                  <div className="tr-ip-wrap">
                    <IpInput
                      value={targetIpInput}
                      onChange={(v) => { setTargetIpInput(v); setError(''); setResult(null); }}
                      disabled={loading}
                    />
                    {targetIpInput && isValidIpv4(targetIpInput.trim()) && <i className="bi bi-check-circle-fill tr-ip-ok" />}
                    {targetIpInput && !isValidIpv4(targetIpInput.trim()) && targetIpInput.replace(/\./g, '').length > 0 && <i className="bi bi-exclamation-circle tr-ip-err" />}
                  </div>
                )}
              </div>
            </div>

            {/* Row 2: 설정 + 버튼 */}
            <div className="tr-action-row">
              <div className="tr-settings">
                <span className="tr-setting"><label>최대 홉</label><input type="number" min={1} max={64} value={maxHops} onChange={e => setMaxHops(Number(e.target.value))} disabled={loading} /></span>
                <span className="tr-setting"><label>타임아웃</label><input type="number" min={200} max={10000} step={100} value={timeout} onChange={e => setTimeout_(Number(e.target.value))} disabled={loading} /><small>ms</small></span>
              </div>
              <button className="tr-run-btn" onClick={handleRun} disabled={loading || (targetMode === 'device' ? !targetDevice : !targetIpInput.trim())}>
                {loading ? <><span className="traceroute-spinner" /> 추적 중...</> : <><i className="bi bi-play-fill" /> 추적 시작</>}
              </button>
            </div>
          </div>

          {error && (
            <div className="traceroute-error">
              <i className="bi bi-exclamation-triangle"></i> {error}
            </div>
          )}

          {/* 결과 스크롤 래퍼 */}
          <div className="traceroute-result-scroll">
            {result && (
              <div className="traceroute-result-area">
                {/* 요약 통계 */}
                <div className="traceroute-summary-row">
                  <div className="traceroute-summary-card">
                    <span className="traceroute-summary-value">{result.hops?.length || 0}</span>
                    <span className="traceroute-summary-label">총 홉</span>
                  </div>
                  <div className="traceroute-summary-card">
                    <span className="traceroute-summary-value">{avgRtt}ms</span>
                    <span className="traceroute-summary-label">평균 RTT</span>
                  </div>
                  <div className="traceroute-summary-card">
                    <span className="traceroute-summary-value">{maxRtt}ms</span>
                    <span className="traceroute-summary-label">최대 RTT</span>
                  </div>
                  <div className="traceroute-summary-card">
                    <span className={`traceroute-summary-value${unregisteredHops.length > 0 ? ' traceroute-summary-value--warning' : ''}`}>{unregisteredHops.length}</span>
                    <span className="traceroute-summary-label">미등록</span>
                  </div>
                </div>

                <div className="traceroute-flow-panel glass-panel">
                  <div className="traceroute-flow-header">
                    <span className="traceroute-flow-title">
                      <i className="bi bi-diagram-3"></i> 경로 플로우
                    </span>
                    <span className="traceroute-flow-meta">
                      총 <strong>{result.hops?.length || 0}</strong>개 홉
                    </span>
                  </div>
                  <div className="traceroute-flow-scroll">
                    <div className="traceroute-flow-chain">
                      <SourceNode device={result.sourceDevice} />
                      {validHops.map((hop) => (
                        <HopNode key={hop.hopNumber} hop={hop} isTarget={hop.ip === result.targetIp} />
                      ))}
                      {hasTimeouts && <UnknownSectionNode count={timeoutCount} />}
                      {!targetInHops && (
                        <TargetEndNode device={result.targetDevice} ip={result.targetIp} />
                      )}
                    </div>
                  </div>
                </div>

                <div className="traceroute-table-panel glass-panel">
                  <div className="traceroute-table-header">
                    <i className="bi bi-table"></i> 홉 상세 정보
                  </div>
                  <table className="traceroute-table">
                    <thead>
                      <tr>
                        <th>홉</th><th>IP 주소</th><th>장비명</th><th>응답 시간</th><th>상태</th>
                      </tr>
                    </thead>
                    <tbody>
                      {validHops.map((hop, idx) => (
                        <tr key={idx}>
                          <td className="traceroute-td-hop">{hop.hopNumber}</td>
                          <td className="traceroute-td-ip">
                            <span className="traceroute-ip-text">{hop.ip}</span>
                          </td>
                          <td className="traceroute-td-name">
                            {hop.device
                              ? <span className="traceroute-device-name"><i className="bi bi-hdd-network"></i> {hop.device.deviceName}</span>
                              : <span className="traceroute-unregistered">미등록</span>}
                          </td>
                          <td className="traceroute-td-rtt">{hop.rtts?.join(' / ') || '—'}</td>
                          <td>
                            {hop.device
                              ? <span className="traceroute-badge traceroute-badge--registered">등록</span>
                              : <span className="traceroute-badge traceroute-badge--unknown">미등록</span>}
                          </td>
                        </tr>
                      ))}
                      {hasTimeouts && (
                        <tr className="traceroute-row--timeout">
                          <td className="traceroute-td-hop" style={{color:'#334155'}}>—</td>
                          <td className="traceroute-td-ip"><span className="traceroute-timeout-text">* * *</span></td>
                          <td colSpan={2} style={{color:'#475569', fontStyle:'italic', fontSize:'0.78rem'}}>
                            ICMP 응답 없음 — {timeoutCount}개 홉 차단됨
                          </td>
                          <td><span className="traceroute-badge traceroute-badge--timeout">Timeout</span></td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {!result && !loading && (
              <div className="traceroute-empty glass-panel">
                <i className="bi bi-signpost-split traceroute-empty-icon"></i>
                <p className="traceroute-empty-title">경로 추적 대기</p>
                <div className="traceroute-empty-steps">
                  <div className="traceroute-empty-step">
                    <span className="traceroute-step-num">1</span>
                    <span>출발지 / 목적지 설정 후 <strong>추적</strong> 클릭</span>
                  </div>
                  <div className="traceroute-empty-step">
                    <span className="traceroute-step-num">2</span>
                    <span><strong>목적지</strong> 장비 선택 또는 IP 직접 입력</span>
                  </div>
                  <div className="traceroute-empty-step">
                    <span className="traceroute-step-num">3</span>
                    <span><strong>추적 시작</strong> 버튼 클릭</span>
                  </div>
                </div>
                <p className="traceroute-empty-hint">
                  <i className="bi bi-info-circle"></i>
                  출발지 미선택 시 Middleware 서버에서 직접 실행됩니다
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

    </div>
  );
}

// ── 트리 그룹 노드 ──
function TreeGroupNode({ group, filteredDevices, expandedGroups, toggleGroup,
  onDeviceClick, sourceDevice, targetDevice, selectMode }) {

  const groupDevices = filteredDevices.filter(d => d.GROUP_ID === group.GROUP_ID);
  const hasContent   = groupDevices.length > 0 ||
    hasDescendantDevices(group.children, filteredDevices);
  if (!hasContent) return null;

  const isExpanded = expandedGroups[group.GROUP_ID] !== false;

  return (
    <div className="tree-group-node">
      <div className="tree-group-row" onClick={() => toggleGroup(group.GROUP_ID)}>
        <i className={`bi ${isExpanded ? 'bi-chevron-down' : 'bi-chevron-right'} tree-chevron`}></i>
        {(() => {
          const iconName = group.ICON_NAME;
          if (iconName) {
            if (iconName.startsWith('fa-')) return <i className={`fa-solid ${iconName} tree-folder-icon tree-custom-icon`} />;
            if (iconName.startsWith('bi-')) return <i className={`${iconName} tree-folder-icon tree-custom-icon`} />;
            return <span className="material-icons tree-folder-icon tree-custom-icon">{iconName}</span>;
          }
          return <i className={`bi ${isExpanded ? 'bi-folder2-open' : 'bi-folder2'} tree-folder-icon`} />;
        })()}
        <span className="tree-group-name">{group.GROUP_NAME}</span>
        {groupDevices.length > 0 && (
          <span className="tree-device-count">{groupDevices.length}</span>
        )}
      </div>

      {isExpanded && (
        <div className="tree-group-children">
          {group.children?.map(child => (
            <TreeGroupNode
              key={child.GROUP_ID}
              group={child}
              filteredDevices={filteredDevices}
              expandedGroups={expandedGroups}
              toggleGroup={toggleGroup}
              onDeviceClick={onDeviceClick}
              sourceDevice={sourceDevice}
              targetDevice={targetDevice}
              selectMode={selectMode}
            />
          ))}
          {groupDevices.map(device => {
            const isSource = sourceDevice?.DEVICE_ID === device.DEVICE_ID;
            const isTarget = targetDevice?.DEVICE_ID === device.DEVICE_ID;
            return (
              <div
                key={device.DEVICE_ID}
                className={`tree-device-row${isSource ? ' tree-device--source' : ''}${isTarget ? ' tree-device--target' : ''}`}
                onClick={() => onDeviceClick(device)}
                title={`${device.DEVICE_NAME} (${device.DEVICE_IP})`}
              >
                <i className="bi bi-hdd-network tree-device-icon"></i>
                <div className="tree-device-info">
                  <span className="tree-device-name">{device.DEVICE_NAME}</span>
                  <span className="tree-device-ip">{device.DEVICE_IP}</span>
                </div>
                {isSource && <span className="tree-device-tag tree-device-tag--src">출발</span>}
                {isTarget && <span className="tree-device-tag tree-device-tag--dst">목적</span>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function hasDescendantDevices(children, filteredDevices) {
  if (!children?.length) return false;
  return children.some(c =>
    filteredDevices.some(d => d.GROUP_ID === c.GROUP_ID) ||
    hasDescendantDevices(c.children, filteredDevices)
  );
}

// ── 장비 선택 카드 ──
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
