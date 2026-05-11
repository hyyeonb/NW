/* eslint-disable max-lines, max-lines-per-function, complexity, max-depth, max-params */
import IpInput from '../../../components/IpInput';
import SlotPortGrid, { SlotPortLegend } from '../../../components/SlotPortGrid';
import PortTrafficChart from '../../../components/PortTrafficChart';
import EnvironmentBox from './EnvironmentBox';

export default function DeviceInfoTab(props) {
  const {
    deviceLoading,
    device,
    deviceId,
    hasEditChanges,
    handleSaveDevice,
    editSaving,
    handleOpenSettingsSidebar,
    editFormData,
    setEditFormData,
    deviceMetrics,
    cpuMemData,
    trafficRawData,
    portsData,
    chartPortsSet,
    handlePortContextMenu,
    handleToggleChartPort,
    trafficChartSettings,
    trafficLoading,
    switchLayout,
  } = props;

  return (
    <div id="device-info-tab" className="detail-tab-content active">
      {deviceLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px', color: '#94a3b8' }}>
          <i className="bi bi-arrow-repeat spinning" style={{ fontSize: '24px', marginRight: '8px' }}></i> 로딩 중...
        </div>
      ) : device ? (
        <div className="two-column-layout">
          {/* 좌측: 장비정보, CPU/MEM */}
          <div className="left-column">
            {/* 장비 정보 */}
            <div className="info-box">
              <div className="info-box-header">
                <span><i className="bi bi-hdd-network"></i> 장비 정보</span>
                {hasEditChanges ? (
                  <button className="settings-gear-btn save-active" onClick={handleSaveDevice} disabled={editSaving} title="변경사항 저장">
                    {editSaving ? <i className="bi bi-arrow-repeat spinning"></i> : <i className="bi bi-check-lg"></i>}
                  </button>
                ) : (
                  <button className="settings-gear-btn" onClick={handleOpenSettingsSidebar} title="장비 설정">
                    <i className="bi bi-gear"></i>
                  </button>
                )}
              </div>
              <div className="info-box-body">
                <div className="info-row">
                  <span className="label">장비명</span>
                  <input type="text" className="edit-input" value={editFormData.DEVICE_NAME || ''} onChange={(e) => setEditFormData({...editFormData, DEVICE_NAME: e.target.value})} />
                </div>
                <div className="info-row">
                  <span className="label">IP</span>
                  <IpInput
                    value={editFormData.DEVICE_IP || ''}
                    onChange={(val) => setEditFormData({...editFormData, DEVICE_IP: val})}
                  />
                </div>
                <div className="info-row">
                  <span className="label">시스템명</span>
                  <span className="value">{device.DEVICE_SYSTEM_NAME || '-'}</span>
                </div>
                <div className="info-row">
                  <span className="label">시스템 설명</span>
                  <span className="value sys-descr-value">{device.DEVICE_DESC || device.sysDescr || '-'}</span>
                </div>
                <div className="info-row">
                  <span className="label">벤더</span>
                  <span className="value" style={{flex: '0 0 auto', marginRight: '16px'}}>{device.VENDOR_NAME || '-'}</span>
                  <span className="label" style={{flex: '0 0 auto', marginRight: '8px'}}>모델</span>
                  <span className="value">{device.MODEL_NAME || '-'}</span>
                </div>
              </div>
            </div>

            {/* 리소스 사용률 - 콤팩트 바 */}
            {(deviceMetrics.length === 0 || deviceMetrics.includes('CPU') || deviceMetrics.includes('MEM')) && (
            <div className="info-box compact-box">
              <div className="info-box-header"><i className="bi bi-cpu"></i> 리소스 사용률</div>
              <div className="info-box-body">
                <div className="resource-bar-row">
                  <span className="resource-label cpu">CPU</span>
                  <div className="resource-track">
                    <div className="resource-fill cpu" style={{ width: `${Math.min(100, cpuMemData?.CPU_USAGE || 0)}%` }}></div>
                  </div>
                  <span className="resource-value">
                    {cpuMemData?.CPU_USAGE != null ? Number(cpuMemData.CPU_USAGE).toFixed(1) : '-'}%
                  </span>
                </div>
                <div className="resource-bar-row">
                  <span className="resource-label mem">MEM</span>
                  <div className="resource-track">
                    <div className="resource-fill mem" style={{ width: `${Math.min(100, cpuMemData?.MEM_USAGE || 0)}%` }}></div>
                  </div>
                  <span className="resource-value">
                    {cpuMemData?.MEM_USAGE != null ? Number(cpuMemData.MEM_USAGE).toFixed(1) : '-'}%
                  </span>
                </div>
              </div>
            </div>
            )}

            {/* 트래픽 요약 */}
            {trafficRawData && (
            <div className="info-box compact-box traffic-summary-box">
              <div className="info-box-header"><i className="bi bi-graph-up-arrow"></i> 트래픽 요약 (bps)</div>
              <div className="info-box-body">
                {(() => {
                  const rows = Array.isArray(trafficRawData) ? trafficRawData : (trafficRawData.data || []);
                  const timeAgg = new Map();
                  rows.forEach(r => {
                    const t = r.COLLECTED_AT ?? r.collectedAt;
                    if (!t) return;
                    const inB = Number(r.IN_HIGH_BPS ?? r.IN_BPS ?? 0);
                    const outB = Number(r.OUT_HIGH_BPS ?? r.OUT_BPS ?? 0);
                    const cur = timeAgg.get(t) || { in: 0, out: 0 };
                    cur.in += inB;
                    cur.out += outB;
                    timeAgg.set(t, cur);
                  });
                  const sorted = [...timeAgg.entries()].sort((a, b) => String(a[0]).localeCompare(String(b[0])));
                  const inArr = sorted.map(e => e[1].in);
                  const outArr = sorted.map(e => e[1].out);
                  const fmt = (bps) => {
                    if (!bps || bps < 1) return { v: '0', u: 'bps' };
                    if (bps >= 1e9) return { v: (bps / 1e9).toFixed(2), u: 'Gbps' };
                    if (bps >= 1e6) return { v: (bps / 1e6).toFixed(2), u: 'Mbps' };
                    if (bps >= 1e3) return { v: (bps / 1e3).toFixed(2), u: 'Kbps' };
                    return { v: String(Math.round(bps)), u: 'bps' };
                  };
                  const stat = (arr) => {
                    const cur = arr.length ? arr[arr.length - 1] : 0;
                    const avg = arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0;
                    const mx = arr.length ? Math.max(...arr) : 0;
                    return { cur, avg, mx };
                  };
                  const inS = stat(inArr);
                  const outS = stat(outArr);
                  const trend = (cur, avg) => {
                    if (!avg || !cur) return 'flat';
                    const d = (cur - avg) / avg;
                    if (d > 0.05) return 'up';
                    if (d < -0.05) return 'down';
                    return 'flat';
                  };
                  const Card = ({ dir, cur, avg, mx, trendDir }) => {
                    const f = fmt(cur);
                    const avgF = fmt(avg);
                    const mxF = fmt(mx);
                    return (
                      <div className={`traffic-card ${dir}`}>
                        <div className="traffic-card-head">
                          <span className="traffic-dir">
                            <i className={`bi ${dir === 'in' ? 'bi-arrow-down-circle-fill' : 'bi-arrow-up-circle-fill'}`}></i>
                            {dir.toUpperCase()}
                          </span>
                          <span className={`traffic-trend ${trendDir}`}>
                            <i className={`bi ${trendDir === 'up' ? 'bi-caret-up-fill' : trendDir === 'down' ? 'bi-caret-down-fill' : 'bi-dash'}`}></i>
                          </span>
                        </div>
                        <div className="traffic-now">
                          <span className="num">{f.v}</span>
                          <span className="unit">{f.u}</span>
                        </div>
                        <div className="traffic-minmax">
                          <span>평균 <strong>{avgF.v}{avgF.u !== 'bps' ? avgF.u.charAt(0) : ''}</strong></span>
                          <span className="sep">·</span>
                          <span>최대 <strong>{mxF.v}{mxF.u !== 'bps' ? mxF.u.charAt(0) : ''}</strong></span>
                        </div>
                      </div>
                    );
                  };
                  return (
                    <>
                      <Card dir="in" {...inS} trendDir={trend(inS.cur, inS.avg)} />
                      <Card dir="out" {...outS} trendDir={trend(outS.cur, outS.avg)} />
                    </>
                  );
                })()}
              </div>
            </div>
            )}

            {/* 온습도 (메트릭에 포함된 경우) */}
            {(deviceMetrics.includes('TEMPERATURE') || deviceMetrics.includes('HUMIDITY')) && (
              <EnvironmentBox deviceId={device?.DEVICE_ID || deviceId} metrics={deviceMetrics} />
            )}
          </div>

          {/* 우측: 포트현황, 트래픽차트 */}
          <div className="right-column">
            {/* 포트 현황 - 슬롯 그리드 or 기존 스위치 모양 (장비 타입별) */}
            <div className="info-box">
              <div className="info-box-header">
                <i className="bi bi-ethernet"></i> 포트 현황
                {portsData && portsData.length > 0 && (
                  <SlotPortLegend />
                )}
                <span className="port-badge">
                  <span className="up">{portsData?.filter(p => p.IF_OPER_STATUS === 1).length || 0} UP</span>
                  <span className="sep">/</span>
                  <span className="down">{portsData?.filter(p => p.IF_OPER_STATUS !== 1).length || 0} DOWN</span>
                </span>
              </div>
              <div className="info-box-body">
                {/* 슬롯 그리드 뷰 (전송장비+일반장비 모두) */}
                {portsData && portsData.length > 0 ? (
                  <SlotPortGrid
                    deviceId={deviceId}
                    portsData={portsData}
                    trafficRawData={trafficRawData}
                    selectedPorts={chartPortsSet}
                    onPortContextMenu={handlePortContextMenu}
                    defaultBottom={
                      <div className="spg-default-traffic">
                        <div className="spg-default-traffic-header">
                          <i className="bi bi-graph-up-arrow"></i>
                          <span>포트별 트래픽</span>
                          <span className="spg-default-traffic-sub">UP 포트 {chartPortsSet.size}개</span>
                        </div>
                        <PortTrafficChart
                          rawData={trafficRawData}
                          chartPortsSet={chartPortsSet}
                          portsData={portsData}
                          settings={trafficChartSettings}
                          loading={trafficLoading}
                        />
                      </div>
                    }
                  />
                ) : switchLayout ? (
                  <div className="switch-chassis">
                    <div className="switch-main-ports">
                      {switchLayout.mainGroups.map((group, gIdx) => (
                        <div key={`main-${gIdx}`} className="port-group">
                          <div className="port-group-label">
                            {group.interfaceType === 'fastethernet' ? 'FastEthernet ' :
                             group.interfaceType === 'gigabit' ? 'GigabitEthernet ' :
                             group.interfaceType === 'linux-nic' ? 'Network Interface ' : 'Ethernet '}{group.slot !== 'eth' ? group.slot : ''}
                          </div>
                          <div className="port-panel">
                            <div className="port-row">
                              {group.ports.filter(p => p.parsed.portNum % 2 === 1).map(port => (
                                <div
                                  key={port.IF_INDEX}
                                  className={`port-jack ${port.IF_OPER_STATUS === 1 ? 'up' : 'down'}${chartPortsSet.has(port.IF_INDEX) ? ' chart-selected' : ''}`}
                                  title={`${port.parsed.originalName}\n상태: ${port.IF_OPER_STATUS === 1 ? 'UP' : 'DOWN'}\n속도: ${port.IF_HIGH_SPEED || port.IF_SPEED || '-'}\n클릭하여 차트에 추가/제거`}
                                  onClick={() => handleToggleChartPort(port)}
                                  onContextMenu={(e) => handlePortContextMenu(e, port)}
                                >
                                  <span className="port-num">{port.parsed.portNum}</span>
                                  <div className="port-connector"><div className="port-led"></div></div>
                                  {chartPortsSet.has(port.IF_INDEX) && <span className="chart-icon"></span>}
                                </div>
                              ))}
                            </div>
                            <div className="port-row">
                              {group.ports.filter(p => p.parsed.portNum % 2 === 0).map(port => (
                                <div
                                  key={port.IF_INDEX}
                                  className={`port-jack ${port.IF_OPER_STATUS === 1 ? 'up' : 'down'}${chartPortsSet.has(port.IF_INDEX) ? ' chart-selected' : ''}`}
                                  title={`${port.parsed.originalName}\n상태: ${port.IF_OPER_STATUS === 1 ? 'UP' : 'DOWN'}\n속도: ${port.IF_HIGH_SPEED || port.IF_SPEED || '-'}\n클릭하여 차트에 추가/제거`}
                                  onClick={() => handleToggleChartPort(port)}
                                  onContextMenu={(e) => handlePortContextMenu(e, port)}
                                >
                                  <span className="port-num">{port.parsed.portNum}</span>
                                  <div className="port-connector"><div className="port-led"></div></div>
                                  {chartPortsSet.has(port.IF_INDEX) && <span className="chart-icon"></span>}
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    {switchLayout.uplinkGroups.length > 0 && (
                      <div className="switch-uplink-ports">
                        <div className="uplink-divider"></div>
                        {switchLayout.uplinkGroups.map((group, gIdx) => (
                          <div key={`uplink-${gIdx}`} className="port-group uplink">
                            <div className="port-group-label">
                              {group.interfaceType === 'gigabit' ? 'GigabitEthernet ' :
                               group.interfaceType === 'tengigabit' ? 'TenGigabitEthernet ' :
                               group.interfaceType === 'management' ? 'Management' : 'Uplink '}{group.slot !== 'mgmt' ? group.slot : ''}
                            </div>
                            <div className="port-panel uplink-panel">
                              {group.ports.map(port => (
                                <div
                                  key={port.IF_INDEX}
                                  className={`port-jack uplink-jack ${port.IF_OPER_STATUS === 1 ? 'up' : 'down'}${chartPortsSet.has(port.IF_INDEX) ? ' chart-selected' : ''}`}
                                  title={`${port.parsed.originalName}\n상태: ${port.IF_OPER_STATUS === 1 ? 'UP' : 'DOWN'}\n속도: ${port.IF_HIGH_SPEED || port.IF_SPEED || '-'}\n클릭하여 차트에 추가/제거`}
                                  onClick={() => handleToggleChartPort(port)}
                                  onContextMenu={(e) => handlePortContextMenu(e, port)}
                                >
                                  <span className="port-num">{port.parsed.portNum}</span>
                                  <div className="port-connector sfp"><div className="port-led"></div></div>
                                  {chartPortsSet.has(port.IF_INDEX) && <span className="chart-icon"></span>}
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="no-port">포트 정보 없음</div>
                )}
              </div>
            </div>

          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px', color: '#94a3b8' }}>
          장비 정보가 없습니다.
        </div>
      )}
    </div>
  );
}
