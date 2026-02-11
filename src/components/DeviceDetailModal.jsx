import { useState, useEffect, useMemo, useCallback } from 'react';
import ReactECharts from 'echarts-for-react';
import { useDevice, useDevicePorts, useDeviceTraffic, useDeviceScope, useUpdateDeviceScope, useUpdateDevice, useUpdatePort } from '../hooks';
import { devicesApi } from '../api/devices';
import { DataTable } from '../components';
import '../styles/asset-management.css';

export default function DeviceDetailModal({ deviceId, onClose }) {
  const [activeTab, setActiveTab] = useState('device-info');
  const [cpuMemData, setCpuMemData] = useState(null);
  const [chartPortsSet, setChartPortsSet] = useState(new Set());
  const [portSortField, setPortSortField] = useState('IF_INDEX');
  const [portSortOrder, setPortSortOrder] = useState('asc');

  // 장비 설정 사이드바 상태
  const [showSettingsSidebar, setShowSettingsSidebar] = useState(false);
  const [snmpConfig, setSnmpConfig] = useState({
    SNMP_VERSION: 2, SNMP_PORT: 161, SNMP_COMMUNITY: 'public',
    SNMP_USER: '', SNMP_AUTH_PROTOCOL: 'MD5', SNMP_AUTH_PASSWORD: '',
    SNMP_PRIV_PROTOCOL: 'DES', SNMP_PRIV_PASSWORD: ''
  });
  const [sshConfig, setSshConfig] = useState({
    CONNECT_AS: 'SSH', SSH_USER: '', SSH_PASS: '', SSH_PORT: 22
  });
  const [sidebarSaving, setSidebarSaving] = useState(false);

  // 데이터 호출
  const { data: deviceData, isLoading: deviceLoading } = useDevice(deviceId);
  const { data: portsDataRaw, isLoading: portsLoading } = useDevicePorts(deviceId);
  const { data: trafficData, isLoading: trafficLoading } = useDeviceTraffic(deviceId, 60);
  const { data: deviceScope, isLoading: scopeLoading } = useDeviceScope(deviceId);

  const device = deviceData?.data || deviceData;

  // mutations
  const updateDeviceScopeMutation = useUpdateDeviceScope();
  const updateDeviceMutation = useUpdateDevice();
  const updatePortMutation = useUpdatePort();

  // CPU/MEM 데이터 조회 (30초 자동갱신)
  useEffect(() => {
    if (!deviceId) return;
    const fetchCpuMem = async () => {
      try {
        const response = await devicesApi.getDeviceCpuMem(deviceId);
        setCpuMemData(response.data?.data || null);
      } catch {
        setCpuMemData(null);
      }
    };
    fetchCpuMem();
    const interval = setInterval(fetchCpuMem, 30000);
    return () => clearInterval(interval);
  }, [deviceId]);

  // 가상 인터페이스 필터링
  const portsData = useMemo(() => {
    if (!portsDataRaw) return [];
    const virtualPatterns = /^(veth|docker|br-|virbr|vnet|tap|tun|dummy)/i;
    return portsDataRaw.filter(port => {
      const ifName = port.IF_NAME || port.IF_DESCR || '';
      return !virtualPatterns.test(ifName);
    });
  }, [portsDataRaw]);

  // 포트 로드 시 OPER 활성 포트로 초기화
  useEffect(() => {
    if (portsData && portsData.length > 0 && deviceId) {
      const storageKey = `chartPorts_${deviceId}`;
      const saved = sessionStorage.getItem(storageKey);
      if (saved) {
        try {
          setChartPortsSet(new Set(JSON.parse(saved)));
        } catch {
          setChartPortsSet(new Set(portsData.filter(p => p.IF_OPER_STATUS === 1).map(p => p.IF_INDEX)));
        }
      } else {
        setChartPortsSet(new Set(portsData.filter(p => p.IF_OPER_STATUS === 1).map(p => p.IF_INDEX)));
      }
    }
  }, [portsData, deviceId]);

  // 스위치 레이아웃 생성
  const switchLayout = useMemo(() => {
    if (!portsData || portsData.length === 0) return null;

    const parsePortName = (port) => {
      const name = port.IF_NAME || port.IF_DESCR || '';
      if (/^(mgmt|default|management)$/i.test(name)) {
        return { interfaceType: 'management', slot: 'mgmt', portNum: 0, originalName: name };
      }
      const ciscoPatterns = [
        /^(FastEthernet|Fa|Fe)(\d+)\/(\d+)$/i,
        /^(GigabitEthernet|Gi|Ge)(\d+)\/(\d+)$/i,
        /^(TenGigabitEthernet|Te|TenGi)(\d+)\/(\d+)$/i,
        /^(Ethernet|Eth|Et)(\d+)\/(\d+)$/i,
        /^(FastEthernet|Fa|Fe)(\d+)\/(\d+)\/(\d+)$/i,
        /^(GigabitEthernet|Gi|Ge)(\d+)\/(\d+)\/(\d+)$/i,
      ];
      for (const pattern of ciscoPatterns) {
        const match = name.match(pattern);
        if (match) {
          const type = match[1].toLowerCase();
          let interfaceType = 'ethernet';
          if (type.includes('fast') || type === 'fa' || type === 'fe') interfaceType = 'fastethernet';
          else if (type.includes('tengig') || type === 'te' || type === 'tengi') interfaceType = 'tengigabit';
          else if (type.includes('gig') || type === 'gi' || type === 'ge') interfaceType = 'gigabit';
          const slot = match.length === 5 ? `${match[2]}/${match[3]}` : match[2];
          const portNum = match.length === 5 ? parseInt(match[4]) : parseInt(match[3]);
          return { interfaceType, slot, portNum, originalName: name };
        }
      }
      const linuxMatch = name.match(/^(eno|eth|enp|ens|em)(\d+)(s\d+)?$/i);
      if (linuxMatch) {
        return { interfaceType: 'linux-nic', slot: 'eth', portNum: parseInt(linuxMatch[2]), originalName: name };
      }
      return { interfaceType: 'unknown', slot: '0', portNum: port.IF_INDEX, originalName: name };
    };

    const parsedPorts = portsData.map(port => ({ ...port, parsed: parsePortName(port) }));
    const groupByType = {};
    parsedPorts.forEach(port => {
      const key = `${port.parsed.interfaceType}_${port.parsed.slot}`;
      if (!groupByType[key]) {
        groupByType[key] = { interfaceType: port.parsed.interfaceType, slot: port.parsed.slot, ports: [] };
      }
      groupByType[key].ports.push(port);
    });

    Object.values(groupByType).forEach(group => {
      group.ports.sort((a, b) => a.parsed.portNum - b.parsed.portNum);
      if (group.interfaceType === 'management') {
        group.ports.forEach((port, idx) => { port.parsed.portNum = idx + 1; });
      }
    });

    const groups = Object.values(groupByType);
    let mainGroups = [];
    let uplinkGroups = [];
    const managementGroups = groups.filter(g => g.interfaceType === 'management');
    const nonMgmtGroups = groups.filter(g => g.interfaceType !== 'management');
    const hasFastEthernet = nonMgmtGroups.some(g => g.interfaceType === 'fastethernet');
    const hasGigabit = nonMgmtGroups.some(g => g.interfaceType === 'gigabit');
    const hasTenGigabit = nonMgmtGroups.some(g => g.interfaceType === 'tengigabit');
    const hasLinuxNic = nonMgmtGroups.some(g => g.interfaceType === 'linux-nic');

    if (hasFastEthernet) {
      mainGroups = nonMgmtGroups.filter(g => g.interfaceType === 'fastethernet');
      uplinkGroups = nonMgmtGroups.filter(g => g.interfaceType === 'gigabit' || g.interfaceType === 'tengigabit');
    } else if (hasGigabit && hasTenGigabit) {
      mainGroups = nonMgmtGroups.filter(g => g.interfaceType === 'gigabit');
      uplinkGroups = nonMgmtGroups.filter(g => g.interfaceType === 'tengigabit');
    } else if (hasLinuxNic) {
      mainGroups = nonMgmtGroups.filter(g => g.interfaceType === 'linux-nic');
      uplinkGroups = nonMgmtGroups.filter(g => g.interfaceType !== 'linux-nic');
    } else if (hasGigabit) {
      mainGroups = nonMgmtGroups.filter(g => g.interfaceType === 'gigabit');
    } else {
      const sortedGroups = [...nonMgmtGroups].sort((a, b) => b.ports.length - a.ports.length);
      if (sortedGroups.length > 0) {
        mainGroups = [sortedGroups[0]];
        uplinkGroups = sortedGroups.slice(1);
      }
    }

    uplinkGroups = [...uplinkGroups, ...managementGroups];
    mainGroups.sort((a, b) => a.slot.localeCompare(b.slot));
    uplinkGroups.sort((a, b) => a.slot.localeCompare(b.slot));
    return { mainGroups, uplinkGroups, totalPorts: portsData.length };
  }, [portsData]);

  // 트래픽 차트 데이터
  const trafficChartData = useMemo(() => {
    if (!trafficData || !trafficData.series || trafficData.series.length === 0) {
      return { timeLabels: [], series: [] };
    }
    if (chartPortsSet.size === 0) {
      return { timeLabels: [], series: [] };
    }
    const filteredSeries = trafficData.series.filter(item => {
      if (item.ifIndex !== undefined) return chartPortsSet.has(item.ifIndex);
      return Array.from(chartPortsSet).some(ifIndex => {
        const port = portsData?.find(p => p.IF_INDEX === ifIndex);
        if (port) {
          const portName = port.IF_NAME || port.IF_DESCR || '';
          return item.name && item.name.includes(portName);
        }
        return false;
      });
    });
    return { timeLabels: trafficData.timeLabels, series: filteredSeries };
  }, [trafficData, chartPortsSet, portsData]);

  const handleToggleChartPort = (port) => {
    setChartPortsSet(prev => {
      const newSet = new Set(prev);
      if (newSet.has(port.IF_INDEX)) newSet.delete(port.IF_INDEX);
      else newSet.add(port.IF_INDEX);
      if (deviceId) sessionStorage.setItem(`chartPorts_${deviceId}`, JSON.stringify([...newSet]));
      return newSet;
    });
  };

  const handleResetChartFlags = () => {
    if (portsData) {
      const operActivePorts = new Set(portsData.filter(p => p.IF_OPER_STATUS === 1).map(p => p.IF_INDEX));
      setChartPortsSet(operActivePorts);
      if (deviceId) sessionStorage.removeItem(`chartPorts_${deviceId}`);
    }
  };

  // 수집 설정 토글 핸들러
  const handleToggleScope = async (field) => {
    if (!deviceScope || !device) return;
    const newValue = !deviceScope[field];
    try {
      await updateDeviceScopeMutation.mutateAsync({
        deviceId: device.DEVICE_ID || deviceId,
        data: { [field]: newValue }
      });
    } catch (error) {
      console.error('수집 설정 업데이트 오류:', error);
      alert('수집 설정 업데이트에 실패했습니다.');
    }
  };

  // 장비 설정 사이드바 열기
  const handleOpenSettingsSidebar = () => {
    if (device) {
      setSnmpConfig({
        SNMP_VERSION: device.SNMP_VERSION || 2,
        SNMP_PORT: device.SNMP_PORT || 161,
        SNMP_COMMUNITY: device.SNMP_COMMUNITY || 'public',
        SNMP_USER: device.SNMP_USER || '',
        SNMP_AUTH_PROTOCOL: device.SNMP_AUTH_PROTOCOL || 'MD5',
        SNMP_AUTH_PASSWORD: device.SNMP_AUTH_PASSWORD || '',
        SNMP_PRIV_PROTOCOL: device.SNMP_PRIV_PROTOCOL || 'DES',
        SNMP_PRIV_PASSWORD: device.SNMP_PRIV_PASSWORD || ''
      });
      // SSH 정보 로드
      devicesApi.getDeviceSsh(device.DEVICE_ID || deviceId).then(res => {
        const data = res.data?.data;
        if (data) {
          setSshConfig({
            CONNECT_AS: data.CONNECT_AS || 'SSH',
            SSH_USER: data.SSH_USER || '',
            SSH_PASS: data.SSH_PASS || '',
            SSH_PORT: data.SSH_PORT || 22
          });
        }
      }).catch(() => {});
    }
    setShowSettingsSidebar(true);
  };

  // 장비 설정 사이드바 저장
  const handleSaveSettings = async () => {
    if (!device) return;
    const did = device.DEVICE_ID || deviceId;
    setSidebarSaving(true);
    try {
      await updateDeviceMutation.mutateAsync({
        deviceId: did,
        data: {
          SNMP_VERSION: snmpConfig.SNMP_VERSION,
          SNMP_PORT: snmpConfig.SNMP_PORT,
          SNMP_COMMUNITY: snmpConfig.SNMP_COMMUNITY,
          SNMP_USER: snmpConfig.SNMP_USER,
          SNMP_AUTH_PROTOCOL: snmpConfig.SNMP_AUTH_PROTOCOL,
          SNMP_AUTH_PASSWORD: snmpConfig.SNMP_AUTH_PASSWORD,
          SNMP_PRIV_PROTOCOL: snmpConfig.SNMP_PRIV_PROTOCOL,
          SNMP_PRIV_PASSWORD: snmpConfig.SNMP_PRIV_PASSWORD
        }
      });
      if (sshConfig.SSH_USER) {
        await devicesApi.saveDeviceSsh(did, sshConfig);
      }
      setShowSettingsSidebar(false);
    } catch (error) {
      console.error('설정 저장 실패:', error);
      alert('설정 저장에 실패했습니다: ' + (error.response?.data?.message || error.message));
    } finally {
      setSidebarSaving(false);
    }
  };

  // 포트 플래그 토글
  const handleTogglePortFlag = async (port, field) => {
    const ifIndex = port.IF_INDEX || port.ifIndex;
    const currentValue = port[field] === true || port[field] === 1;
    const newValue = !currentValue;
    try {
      await updatePortMutation.mutateAsync({
        deviceId: device?.DEVICE_ID || deviceId,
        ifIndex: ifIndex,
        data: { [field]: newValue }
      });
    } catch (error) {
      console.error('포트 업데이트 오류:', error);
      alert('포트 정보 업데이트에 실패했습니다.');
    }
  };

  // 속도 포맷팅
  const formatSpeed = (port) => {
    if (port.speedText) return port.speedText;
    if (port.IF_HIGH_SPEED && port.IF_HIGH_SPEED > 0) {
      if (port.IF_HIGH_SPEED >= 1000) return `${port.IF_HIGH_SPEED / 1000} Gbps`;
      return `${port.IF_HIGH_SPEED} Mbps`;
    }
    if (port.IF_SPEED && port.IF_SPEED > 0) {
      if (port.IF_SPEED >= 1_000_000_000) return `${Math.floor(port.IF_SPEED / 1_000_000_000)} Gbps`;
      if (port.IF_SPEED >= 1_000_000) return `${Math.floor(port.IF_SPEED / 1_000_000)} Mbps`;
      if (port.IF_SPEED >= 1_000) return `${Math.floor(port.IF_SPEED / 1_000)} Kbps`;
      return `${port.IF_SPEED} bps`;
    }
    return '-';
  };

  // 포트 타입 텍스트
  const getPortTypeText = (type) => {
    if (!type) return '-';
    const types = { 6: 'ethernet', 24: 'loopback', 53: 'propVirtual', 117: 'gigabitEthernet', 131: 'tunnel', 135: 'l2vlan', 161: 'ieee8023adLag' };
    return types[type] || `type(${type})`;
  };

  const getPortTypeBadgeClass = (type) => {
    if (type === 6) return 'ethernet';
    if (type === 117) return 'gigabit';
    if (type === 24) return 'loopback';
    return '';
  };

  // 포트 정렬
  const sortedPorts = useMemo(() => {
    if (!portsDataRaw?.length) return [];
    return [...portsDataRaw].sort((a, b) => {
      let aVal = a[portSortField];
      let bVal = b[portSortField];
      if (aVal == null) aVal = '';
      if (bVal == null) bVal = '';
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return portSortOrder === 'asc' ? aVal - bVal : bVal - aVal;
      }
      const strA = String(aVal).toLowerCase();
      const strB = String(bVal).toLowerCase();
      if (portSortOrder === 'asc') {
        return strA.localeCompare(strB, 'ko');
      }
      return strB.localeCompare(strA, 'ko');
    });
  }, [portsDataRaw, portSortField, portSortOrder]);

  const handlePortSort = (field) => {
    if (portSortField === field) {
      setPortSortOrder(portSortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setPortSortField(field);
      setPortSortOrder('asc');
    }
  };

  // 포트 테이블 컬럼 (AssetManagement와 동일)
  const portColumns = useMemo(() => [
    { key: 'IF_INDEX', label: 'Index', width: '70px', sortable: true, align: 'center' },
    { key: 'IF_NAME', label: '이름', width: '120px', sortable: true, render: (v) => v || '-' },
    { key: 'IF_DESCR', label: '설명', width: '130px', sortable: true, className: 'cell-truncate', render: (v) => v || '-' },
    { key: 'IF_DESCRIPTION', label: 'Description', width: '130px', sortable: true, className: 'cell-truncate', render: (v) => v || '-' },
    {
      key: 'IF_TYPE', label: '타입', width: '100px', sortable: true,
      render: (value, row) => (
        <span className={`port-type-badge ${getPortTypeBadgeClass(value)}`}>
          {row.ifTypeText || getPortTypeText(value)}
        </span>
      ),
    },
    { key: 'IF_MTU', label: 'MTU', width: '70px', sortable: true, align: 'center', render: (v) => v || '-' },
    { key: 'IF_HIGH_SPEED', label: '속도', width: '100px', sortable: true, className: 'port-speed', render: (_, row) => formatSpeed(row) },
    { key: 'IF_MAC_ADDRESS', label: 'MAC', width: '140px', sortable: true, className: 'port-mac', render: (v) => v || '-' },
    {
      key: 'IF_ADMIN_STATUS', label: 'Admin', width: '70px', sortable: true, align: 'center',
      render: (v) => <span className={`status-badge ${v === 1 ? 'up' : 'down'}`}>{v === 1 ? 'Up' : 'Down'}</span>,
    },
    {
      key: 'IF_OPER_STATUS', label: 'Oper', width: '70px', sortable: true, align: 'center',
      render: (v) => <span className={`status-badge ${v === 1 ? 'up' : 'down'}`}>{v === 1 ? 'Up' : 'Down'}</span>,
    },
    {
      key: 'IF_OPER_FLAG', label: 'Oper 감시', width: '90px', sortable: true, align: 'center',
      render: (value, row) => (
        <span
          className={`flag-badge clickable ${value === 1 || value === true ? 'active' : 'inactive'}`}
          onClick={(e) => { e.stopPropagation(); handleTogglePortFlag(row, 'IF_OPER_FLAG'); }}
          title="클릭하여 토글"
        >
          {value === 1 || value === true ? 'ON' : 'OFF'}
        </span>
      ),
    },
    {
      key: 'IF_PERF_FLAG', label: '성능 감시', width: '90px', sortable: true, align: 'center',
      render: (value, row) => (
        <span
          className={`flag-badge clickable ${value === 1 || value === true ? 'active' : 'inactive'}`}
          onClick={(e) => { e.stopPropagation(); handleTogglePortFlag(row, 'IF_PERF_FLAG'); }}
          title="클릭하여 토글"
        >
          {value === 1 || value === true ? 'ON' : 'OFF'}
        </span>
      ),
    },
  ], []);

  return (
    <div id="device-detail-modal" className="modal" style={{ display: 'flex', zIndex: 9999 }}>
      <div className="modal-content device-detail-modal" style={{ position: 'relative', overflow: 'hidden' }}>
        <span className="close-btn" onClick={onClose}>&times;</span>

        {/* 장비 설정 사이드바 */}
        {showSettingsSidebar && (
          <div className="settings-sidebar-overlay" onClick={() => setShowSettingsSidebar(false)}>
            <div className="settings-sidebar" onClick={(e) => e.stopPropagation()}>
              <div className="settings-sidebar-header">
                <div className="settings-sidebar-title">
                  <i className="bi bi-gear"></i> 장비 설정
                </div>
                <span className="settings-sidebar-close" onClick={() => setShowSettingsSidebar(false)}>&times;</span>
              </div>

              <div className="settings-sidebar-body">
                {/* 관제 범위 설정 */}
                <div className="settings-section">
                  <div className="settings-section-title">
                    <i className="bi bi-broadcast"></i> 관제 범위 설정
                  </div>
                  {scopeLoading ? (
                    <div className="scope-loading">
                      <i className="bi bi-arrow-repeat spinning"></i> 로딩 중...
                    </div>
                  ) : (
                    <div className="settings-scope-list">
                      <div className="settings-scope-item">
                        <div className="scope-item-info">
                          <i className="bi bi-wifi scope-icon ping"></i>
                          <div>
                            <span className="scope-item-title">PING</span>
                            <span className="scope-item-desc">ICMP 상태 모니터링</span>
                          </div>
                        </div>
                        <label className="toggle-switch">
                          <input type="checkbox" checked={deviceScope?.COLLECT_PING || false} onChange={() => handleToggleScope('COLLECT_PING')} disabled={updateDeviceScopeMutation.isPending} />
                          <span className="toggle-slider"></span>
                        </label>
                      </div>
                      <div className="settings-scope-item">
                        <div className="scope-item-info">
                          <i className="bi bi-diagram-3 scope-icon snmp"></i>
                          <div>
                            <span className="scope-item-title">SNMP</span>
                            <span className="scope-item-desc">SNMP 상세 정보 수집</span>
                          </div>
                        </div>
                        <label className="toggle-switch">
                          <input type="checkbox" checked={deviceScope?.COLLECT_SNMP || false} onChange={() => handleToggleScope('COLLECT_SNMP')} disabled={updateDeviceScopeMutation.isPending} />
                          <span className="toggle-slider"></span>
                        </label>
                      </div>
                      <div className="settings-scope-item">
                        <div className="scope-item-info">
                          <i className="bi bi-cpu scope-icon agent"></i>
                          <div>
                            <span className="scope-item-title">AGENT</span>
                            <span className="scope-item-desc">에이전트 시스템 수집</span>
                          </div>
                        </div>
                        <label className="toggle-switch">
                          <input type="checkbox" checked={deviceScope?.COLLECT_AGENT || false} onChange={() => handleToggleScope('COLLECT_AGENT')} disabled={updateDeviceScopeMutation.isPending} />
                          <span className="toggle-slider"></span>
                        </label>
                      </div>
                    </div>
                  )}
                </div>

                {/* SNMP 설정 */}
                <div className="settings-section">
                  <div className="settings-section-title">
                    <i className="bi bi-diagram-3"></i> SNMP 설정
                  </div>
                  <div className="settings-form">
                    <div className="settings-form-row dual">
                      <div className="settings-form-group">
                        <label>버전</label>
                        <select value={snmpConfig.SNMP_VERSION} onChange={(e) => setSnmpConfig({...snmpConfig, SNMP_VERSION: parseInt(e.target.value)})}>
                          <option value={1}>v1</option>
                          <option value={2}>v2c</option>
                          <option value={3}>v3</option>
                        </select>
                      </div>
                      <div className="settings-form-group">
                        <label>포트</label>
                        <input type="number" value={snmpConfig.SNMP_PORT} onChange={(e) => setSnmpConfig({...snmpConfig, SNMP_PORT: parseInt(e.target.value)})} />
                      </div>
                    </div>
                    {String(snmpConfig.SNMP_VERSION) !== '3' ? (
                      <div className="settings-form-group">
                        <label>커뮤니티</label>
                        <input type="text" value={snmpConfig.SNMP_COMMUNITY} onChange={(e) => setSnmpConfig({...snmpConfig, SNMP_COMMUNITY: e.target.value})} placeholder="public" />
                      </div>
                    ) : (
                      <>
                        <div className="settings-form-group">
                          <label>사용자</label>
                          <input type="text" value={snmpConfig.SNMP_USER} onChange={(e) => setSnmpConfig({...snmpConfig, SNMP_USER: e.target.value})} />
                        </div>
                        <div className="settings-form-row dual">
                          <div className="settings-form-group">
                            <label>인증</label>
                            <select value={snmpConfig.SNMP_AUTH_PROTOCOL} onChange={(e) => setSnmpConfig({...snmpConfig, SNMP_AUTH_PROTOCOL: e.target.value})}>
                              <option value="MD5">MD5</option>
                              <option value="SHA">SHA</option>
                              <option value="SHA256">SHA256</option>
                            </select>
                          </div>
                          <div className="settings-form-group">
                            <label>인증 PW</label>
                            <input type="text" value={snmpConfig.SNMP_AUTH_PASSWORD} onChange={(e) => setSnmpConfig({...snmpConfig, SNMP_AUTH_PASSWORD: e.target.value})} />
                          </div>
                        </div>
                        <div className="settings-form-row dual">
                          <div className="settings-form-group">
                            <label>암호화</label>
                            <select value={snmpConfig.SNMP_PRIV_PROTOCOL} onChange={(e) => setSnmpConfig({...snmpConfig, SNMP_PRIV_PROTOCOL: e.target.value})}>
                              <option value="DES">DES</option>
                              <option value="AES">AES128</option>
                              <option value="AES256">AES256</option>
                            </select>
                          </div>
                          <div className="settings-form-group">
                            <label>암호화 PW</label>
                            <input type="text" value={snmpConfig.SNMP_PRIV_PASSWORD} onChange={(e) => setSnmpConfig({...snmpConfig, SNMP_PRIV_PASSWORD: e.target.value})} />
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* SSH/TELNET 접속 정보 */}
                <div className="settings-section">
                  <div className="settings-section-title">
                    <i className="bi bi-terminal"></i> 접속 정보
                  </div>
                  <div className="settings-form">
                    <div className="settings-form-row dual">
                      <div className="settings-form-group">
                        <label>접속 방식</label>
                        <select value={sshConfig.CONNECT_AS} onChange={(e) => setSshConfig({...sshConfig, CONNECT_AS: e.target.value})}>
                          <option value="SSH">SSH</option>
                          <option value="TELNET">TELNET</option>
                        </select>
                      </div>
                      <div className="settings-form-group">
                        <label>포트</label>
                        <input type="number" value={sshConfig.SSH_PORT} onChange={(e) => setSshConfig({...sshConfig, SSH_PORT: parseInt(e.target.value)})} />
                      </div>
                    </div>
                    <div className="settings-form-group">
                      <label>사용자</label>
                      <input type="text" value={sshConfig.SSH_USER} onChange={(e) => setSshConfig({...sshConfig, SSH_USER: e.target.value})} placeholder="root" />
                    </div>
                    <div className="settings-form-group">
                      <label>비밀번호</label>
                      <input type="text" value={sshConfig.SSH_PASS} onChange={(e) => setSshConfig({...sshConfig, SSH_PASS: e.target.value})} />
                    </div>
                  </div>
                </div>
              </div>

              <div className="settings-sidebar-footer">
                <button className="btn btn-secondary" onClick={() => setShowSettingsSidebar(false)} disabled={sidebarSaving}>취소</button>
                <button className="btn btn-primary" onClick={handleSaveSettings} disabled={sidebarSaving}>
                  {sidebarSaving ? <><i className="bi bi-arrow-repeat spinning"></i> 저장 중...</> : <><i className="bi bi-check-lg"></i> 저장</>}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 탭 헤더 */}
        <div className="detail-tabs-row">
          <div className="detail-tabs">
            <button className={`detail-tab ${activeTab === 'device-info' ? 'active' : ''}`} onClick={() => setActiveTab('device-info')}>
              <i className="bi bi-info-circle"></i> 장비 정보
            </button>
            <button className={`detail-tab ${activeTab === 'port-info' ? 'active' : ''}`} onClick={() => setActiveTab('port-info')}>
              <i className="bi bi-ethernet"></i> 포트 정보
              {portsDataRaw?.length > 0 && <span className="tab-badge">{portsDataRaw.length}</span>}
            </button>
          </div>
        </div>

        {/* 장비 정보 탭 */}
        {activeTab === 'device-info' && (
          <div id="device-info-tab" className="detail-tab-content active">
            {deviceLoading ? (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px', color: '#94a3b8' }}>
                <i className="bi bi-arrow-repeat spinning" style={{ fontSize: '24px', marginRight: '8px' }}></i> 로딩 중...
              </div>
            ) : device ? (
              <div className="two-column-layout">
                {/* 좌측: 장비정보, CPU/MEM */}
                <div className="left-column">
                  <div className="info-box">
                    <div className="info-box-header">
                      <span><i className="bi bi-hdd-network"></i> 장비 정보</span>
                      <button className="settings-gear-btn" onClick={handleOpenSettingsSidebar} title="장비 설정">
                        <i className="bi bi-gear"></i>
                      </button>
                    </div>
                    <div className="info-box-body">
                      <div className="info-row">
                        <span className="label">장비명</span>
                        <span className="value">{device.DEVICE_NAME || '-'}</span>
                      </div>
                      <div className="info-row">
                        <span className="label">IP</span>
                        <span className="value" style={{ color: '#38bdf8' }}>{device.DEVICE_IP || '-'}</span>
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
                        <span className="value" style={{ flex: '0 0 auto', marginRight: '16px' }}>{device.VENDOR_NAME || '-'}</span>
                        <span className="label" style={{ flex: '0 0 auto', marginRight: '8px' }}>모델</span>
                        <span className="value">{device.MODEL_NAME || '-'}</span>
                      </div>
                    </div>
                  </div>

                  {/* CPU / MEM */}
                  <div className="info-box cpu-mem-box">
                    <div className="info-box-header"><i className="bi bi-cpu"></i> CPU / MEM</div>
                    <div className="info-box-body pie-body">
                      <div className="pie-wrapper">
                        <ReactECharts
                          option={{
                            series: [{
                              type: 'pie', radius: ['55%', '80%'], center: ['50%', '50%'],
                              data: [
                                { value: cpuMemData?.CPU_USAGE || 0, itemStyle: { color: '#3b82f6' } },
                                { value: 100 - (cpuMemData?.CPU_USAGE || 0), itemStyle: { color: 'rgba(255,255,255,0.1)' } }
                              ],
                              label: {
                                show: true, position: 'center',
                                formatter: cpuMemData?.CPU_USAGE != null ? `${Number(cpuMemData.CPU_USAGE).toFixed(1)}%` : '-',
                                fontSize: 18, fontWeight: 'bold', color: '#3b82f6'
                              },
                              labelLine: { show: false }, silent: true
                            }]
                          }}
                          style={{ height: '120px', width: '120px' }}
                        />
                        <span className="pie-name">CPU</span>
                      </div>
                      <div className="pie-wrapper">
                        <ReactECharts
                          option={{
                            series: [{
                              type: 'pie', radius: ['55%', '80%'], center: ['50%', '50%'],
                              data: [
                                { value: cpuMemData?.MEM_USAGE || 0, itemStyle: { color: '#10b981' } },
                                { value: 100 - (cpuMemData?.MEM_USAGE || 0), itemStyle: { color: 'rgba(255,255,255,0.1)' } }
                              ],
                              label: {
                                show: true, position: 'center',
                                formatter: cpuMemData?.MEM_USAGE != null ? `${Number(cpuMemData.MEM_USAGE).toFixed(1)}%` : '-',
                                fontSize: 18, fontWeight: 'bold', color: '#10b981'
                              },
                              labelLine: { show: false }, silent: true
                            }]
                          }}
                          style={{ height: '120px', width: '120px' }}
                        />
                        <span className="pie-name">MEM</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 우측: 포트현황, 트래픽차트 */}
                <div className="right-column">
                  <div className="info-box">
                    <div className="info-box-header">
                      <i className="bi bi-ethernet"></i> 포트 현황
                      <span className="port-badge">
                        <span className="up">{portsData?.filter(p => p.IF_OPER_STATUS === 1).length || 0} UP</span>
                        <span className="sep">/</span>
                        <span className="down">{portsData?.filter(p => p.IF_OPER_STATUS !== 1).length || 0} DOWN</span>
                      </span>
                    </div>
                    <div className="info-box-body">
                      {switchLayout ? (
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

                  {/* 트래픽 차트 */}
                  <div className="info-box traffic-box">
                    <div className="info-box-header">
                      <i className="bi bi-graph-up-arrow"></i> 포트별 트래픽
                      <span className="time-label">
                        {chartPortsSet.size > 0 ? `선택: ${chartPortsSet.size}개 포트` : 'TOP 5 (포트 클릭으로 선택)'}
                      </span>
                      {chartPortsSet.size > 0 && (
                        <button className="chart-clear-btn" onClick={handleResetChartFlags} title="선택 초기화">
                          <i className="bi bi-x-circle"></i> 초기화
                        </button>
                      )}
                      {trafficLoading && <i className="bi bi-arrow-repeat spinning" style={{ marginLeft: '8px', fontSize: '11px' }}></i>}
                    </div>
                    <div className="info-box-body">
                      <ReactECharts
                        key={`traffic-${Array.from(chartPortsSet).join('-')}`}
                        notMerge={true}
                        option={{
                          tooltip: {
                            trigger: 'axis', backgroundColor: 'rgba(15,23,42,0.95)', borderColor: 'rgba(59,130,246,0.3)',
                            textStyle: { color: '#e2e8f0', fontSize: 11 },
                            formatter: (params) => {
                              if (!params || params.length === 0) return '';
                              let result = `<div style="font-weight:600;margin-bottom:4px">${params[0].axisValue}</div>`;
                              params.forEach(p => {
                                const val = p.value || 0;
                                const formattedVal = val >= 1000000 ? (val / 1000000).toFixed(2) + ' Mbps' : val >= 1000 ? (val / 1000).toFixed(2) + ' Kbps' : val.toFixed(2) + ' bps';
                                result += `<div style="display:flex;justify-content:space-between;gap:16px"><span>${p.marker}${p.seriesName}</span><span style="font-weight:500">${formattedVal}</span></div>`;
                              });
                              return result;
                            },
                          },
                          legend: { type: 'scroll', show: true, bottom: 0, left: 'center', width: '90%', textStyle: { color: '#94a3b8', fontSize: 10 }, itemWidth: 12, itemHeight: 8, itemGap: 10, pageButtonItemGap: 5, pageButtonGap: 10, pageIconColor: '#94a3b8', pageIconInactiveColor: '#4a5568', pageTextStyle: { color: '#94a3b8', fontSize: 10 } },
                          grid: { left: '3%', right: '3%', bottom: '15%', top: '5%', containLabel: true },
                          xAxis: { type: 'category', boundaryGap: false, data: trafficChartData.timeLabels || [], axisLabel: { color: '#64748b', fontSize: 9 }, axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } }, splitLine: { show: false } },
                          yAxis: { type: 'value', axisLabel: { color: '#64748b', fontSize: 9, formatter: v => v >= 1000000 ? (v / 1000000).toFixed(0) + 'M' : v >= 1000 ? (v / 1000).toFixed(0) + 'K' : v }, axisLine: { show: false }, splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } } },
                          series: trafficChartData.series && trafficChartData.series.length > 0
                            ? trafficChartData.series.map(item => ({ name: item.name, type: 'line', smooth: true, symbol: 'circle', symbolSize: 4, showSymbol: false, lineStyle: { width: 2 }, areaStyle: { opacity: 0.05 }, data: item.data }))
                            : [{ name: '데이터 없음', type: 'line', data: [] }]
                        }}
                        style={{ height: '100%', width: '100%' }}
                      />
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
        )}

        {/* 포트 정보 탭 */}
        {activeTab === 'port-info' && (
          <div id="port-info-tab" className="detail-tab-content active">
            <DataTable
              columns={portColumns}
              data={sortedPorts}
              rowKey="IF_INDEX"
              loading={portsLoading}
              loadingText="포트 정보를 불러오는 중..."
              emptyText="등록된 포트가 없습니다"
              emptyIcon="bi-ethernet"
              sort={{ field: portSortField, order: portSortOrder }}
              onSort={handlePortSort}
              maxHeight="calc(100vh - 380px)"
              className="port-data-table"
            />
          </div>
        )}

        <div className="detail-modal-footer">
          <button className="btn btn-primary" onClick={onClose}>
            <i className="bi bi-check-lg"></i> 확인
          </button>
        </div>
      </div>
    </div>
  );
}
