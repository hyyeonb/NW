import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import ReactECharts from 'echarts-for-react';
import { useDevice, useDevicePorts, useDeviceTrafficRaw, useDeviceScope, useUpdateDeviceScope, useUpdateDevice, useUpdatePort } from '../hooks';
import { devicesApi } from '../api/devices';
import { faultApi } from '../api/fault';
import { DataTable, PortTrafficChart } from '../components';
import '../styles/asset-management.css';

export default function DeviceDetailModal({ deviceId, onClose }) {
  const [activeTab, setActiveTab] = useState('device-info');
  const [cpuMemData, setCpuMemData] = useState(null);
  const [chartPortsSet, setChartPortsSet] = useState(new Set());
  const [portSortField, setPortSortField] = useState('IF_INDEX');
  const [portSortOrder, setPortSortOrder] = useState('asc');
  const [deviceMetrics, setDeviceMetrics] = useState([]);

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

  // 수집 서버(미들웨어) 목록
  const [middlewares, setMiddlewares] = useState([]);
  const [selectedMiddlewareId, setSelectedMiddlewareId] = useState(null);
  const [originalMiddlewareId, setOriginalMiddlewareId] = useState(null);

  // 장비별 임계치 상태
  const [deviceThresholds, setDeviceThresholds] = useState([]);
  const [thresholdLoading, setThresholdLoading] = useState(false);

  // 사이드바 dirty 감지용 원본
  const [originalSnmpConfig, setOriginalSnmpConfig] = useState(null);
  const [originalSshConfig, setOriginalSshConfig] = useState(null);
  const [originalThresholds, setOriginalThresholds] = useState(null);

  // 장비 인라인 편집 상태
  const [editFormData, setEditFormData] = useState({});
  const [editSaving, setEditSaving] = useState(false);

  // 장애 탭 상태
  const [faultData, setFaultData] = useState([]);
  const [faultLoading, setFaultLoading] = useState(false);
  const [faultPage, setFaultPage] = useState(1);
  const [faultPageSize, setFaultPageSize] = useState(20);
  const [faultTotal, setFaultTotal] = useState(0);
  const [faultSortField, setFaultSortField] = useState('OCCUR_AT');
  const [faultSortOrder, setFaultSortOrder] = useState('desc');
  const [showFaultAckModal, setShowFaultAckModal] = useState(false);
  const [faultAckMessage, setFaultAckMessage] = useState('');
  const [selectedFaultError, setSelectedFaultError] = useState(null);

  // 변경이력 탭 상태
  const [changeHistory, setChangeHistory] = useState([]);
  const [changeHistoryLoading, setChangeHistoryLoading] = useState(false);
  const [changeHistoryPage, setChangeHistoryPage] = useState(1);
  const [changeHistoryTotal, setChangeHistoryTotal] = useState(0);

  // SSH이력 탭 상태
  const [sshHistory, setSshHistory] = useState([]);
  const [sshHistoryLoading, setSshHistoryLoading] = useState(false);
  const [sshHistoryPage, setSshHistoryPage] = useState(1);
  const [sshHistoryTotal, setSshHistoryTotal] = useState(0);

  // 트래픽 차트 설정
  const [showTrafficSettings, setShowTrafficSettings] = useState(false);
  const [trafficChartSettings, setTrafficChartSettings] = useState({
    counterType: '64bit', trafficUnit: 'bit', showError: false, showDiscard: false,
  });
  const trafficSettingsRef = useRef(null);

  // 데이터 호출
  const { data: deviceData, isLoading: deviceLoading } = useDevice(deviceId);
  const { data: portsDataRaw, isLoading: portsLoading } = useDevicePorts(deviceId);
  const { data: trafficRawData, isLoading: trafficLoading } = useDeviceTrafficRaw(deviceId, 60);
  const { data: deviceScope, isLoading: scopeLoading } = useDeviceScope(deviceId);

  const device = deviceData?.data || deviceData;

  // mutations
  const updateDeviceScopeMutation = useUpdateDeviceScope();
  const updateDeviceMutation = useUpdateDevice();
  const updatePortMutation = useUpdatePort();

  // 장비 메트릭 로드
  useEffect(() => {
    if (!deviceId) return;
    devicesApi.getDeviceMetrics(deviceId)
      .then(r => setDeviceMetrics(r.data?.data || r.data || []))
      .catch(() => setDeviceMetrics([]));
  }, [deviceId]);

  // 장비 데이터 로드 시 편집 폼 초기화
  useEffect(() => {
    if (device) {
      setEditFormData({
        DEVICE_NAME: device.DEVICE_NAME || '',
        DEVICE_IP: device.DEVICE_IP || '',
        GROUP_ID: device.GROUP_ID || null,
        MODEL_ID: device.MODEL_ID || null,
        SNMP_VERSION: device.SNMP_VERSION || 2,
        SNMP_PORT: device.SNMP_PORT || 161,
        SNMP_COMMUNITY: device.SNMP_COMMUNITY || '',
        SNMP_USER: device.SNMP_USER || '',
        SNMP_AUTH_PROTOCOL: device.SNMP_AUTH_PROTOCOL || 'MD5',
        SNMP_AUTH_PASSWORD: device.SNMP_AUTH_PASSWORD || '',
        SNMP_PRIV_PROTOCOL: device.SNMP_PRIV_PROTOCOL || 'DES',
        SNMP_PRIV_PASSWORD: device.SNMP_PRIV_PASSWORD || ''
      });
    }
  }, [device?.DEVICE_ID]);

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

  // SSH 데이터 조회
  useEffect(() => {
    if (!deviceId) {
      setSshConfig({ CONNECT_AS: 'SSH', SSH_USER: '', SSH_PASS: '', SSH_PORT: 22 });
      return;
    }
    devicesApi.getDeviceSsh(deviceId).then(res => {
      const data = res.data?.data;
      if (data) {
        setSshConfig({
          CONNECT_AS: data.CONNECT_AS || 'SSH',
          SSH_USER: data.SSH_USER || '',
          SSH_PASS: data.SSH_PASS || '',
          SSH_PORT: data.SSH_PORT || 22
        });
      }
    }).catch(() => setSshConfig({ CONNECT_AS: 'SSH', SSH_USER: '', SSH_PASS: '', SSH_PORT: 22 }));
  }, [deviceId]);

  // 장애 건수 조회 (모달 열릴 때 바로)
  useEffect(() => {
    if (!deviceId) { setFaultTotal(0); return; }
    const fetchFaultCount = async () => {
      try {
        const [errRes, histRes] = await Promise.all([
          faultApi.getErrors({ deviceId }),
          faultApi.getHistory({ page: 1, size: 1, deviceId }),
        ]);
        const activeList = errRes.data?.data?.list || [];
        const activeCount = Array.isArray(activeList) ? activeList.filter(e => e.DEVICE_ID == deviceId).length : 0;
        const histTotal = histRes.data?.data?.totalElements || 0;
        setFaultTotal(activeCount + histTotal);
      } catch { setFaultTotal(0); }
    };
    fetchFaultCount();
  }, [deviceId]);

  // 장애 데이터 조회 (장애 탭 활성화 시)
  useEffect(() => {
    if (!deviceId || activeTab !== 'fault-info') return;
    const fetchFaults = async () => {
      setFaultLoading(true);
      try {
        const errRes = await faultApi.getErrors({ deviceId });
        const activeList = errRes.data?.data?.list || [];
        const deviceActiveErrors = Array.isArray(activeList) ? activeList.filter(e => e.DEVICE_ID == deviceId) : [];

        const histRes = await faultApi.getHistory({
          page: faultPage, size: faultPageSize,
          sortKey: faultSortField, sortDirection: faultSortOrder, deviceId,
        });
        const histData = histRes.data?.data || {};
        const histList = histData.content || [];

        const activeFormatted = deviceActiveErrors.map((e, i) => ({
          ...e, _isActive: true, _faultRowId: `active_${e.ERROR_ID || i}`,
        }));
        const histFormatted = histList.map((e, i) => ({
          ...e, _faultRowId: `hist_${e.ERROR_HISTORY_ID || i}`,
        }));

        setFaultData([...activeFormatted, ...histFormatted]);
        setFaultTotal(deviceActiveErrors.length + (histData.totalElements || 0));
      } catch {
        setFaultData([]);
      } finally {
        setFaultLoading(false);
      }
    };
    fetchFaults();
  }, [deviceId, activeTab, faultPage, faultPageSize, faultSortField, faultSortOrder]);

  // 변경이력 데이터 조회
  useEffect(() => {
    if (!deviceId || activeTab !== 'change-history') return;
    const fetchChangeHistory = async () => {
      setChangeHistoryLoading(true);
      try {
        const res = await devicesApi.getDeviceChangeHistory(deviceId, changeHistoryPage, 20);
        const data = res.data?.data || {};
        setChangeHistory(data.content || []);
        setChangeHistoryTotal(data.totalElements || 0);
      } catch {
        setChangeHistory([]);
      } finally {
        setChangeHistoryLoading(false);
      }
    };
    fetchChangeHistory();
  }, [deviceId, activeTab, changeHistoryPage]);

  // SSH이력 데이터 조회
  useEffect(() => {
    if (!deviceId || activeTab !== 'ssh-history') return;
    const fetchSshHistory = async () => {
      setSshHistoryLoading(true);
      try {
        const res = await devicesApi.getDeviceSshHistory(deviceId, sshHistoryPage, 20);
        const data = res.data?.data || {};
        setSshHistory(data.content || []);
        setSshHistoryTotal(data.totalElements || 0);
      } catch {
        setSshHistory([]);
      } finally {
        setSshHistoryLoading(false);
      }
    };
    fetchSshHistory();
  }, [deviceId, activeTab, sshHistoryPage]);

  // 트래픽 설정 드롭다운 외부 클릭 닫기
  useEffect(() => {
    if (!showTrafficSettings) return;
    const handleClickOutside = (e) => {
      if (trafficSettingsRef.current && !trafficSettingsRef.current.contains(e.target)) {
        setShowTrafficSettings(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showTrafficSettings]);

  // ESC 키로 모달 닫기
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key !== 'Escape') return;
      if (showFaultAckModal) { setShowFaultAckModal(false); return; }
      if (showSettingsSidebar) { setShowSettingsSidebar(false); return; }
      onClose();
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [showFaultAckModal, showSettingsSidebar, onClose]);

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

  // 변경사항 체크
  const hasEditChanges = useMemo(() => {
    if (!device) return false;
    return (
      editFormData.DEVICE_NAME !== (device.DEVICE_NAME || '') ||
      editFormData.DEVICE_IP !== (device.DEVICE_IP || '')
    );
  }, [device, editFormData]);

  // 장비 수정 저장
  const handleSaveDevice = async () => {
    if (!device || !hasEditChanges) return;
    setEditSaving(true);
    try {
      await updateDeviceMutation.mutateAsync({
        deviceId: device.DEVICE_ID || deviceId,
        data: editFormData
      });
      alert('장비 정보가 저장되었습니다.');
    } catch (error) {
      console.error('장비 수정 오류:', error);
      alert('장비 수정에 실패했습니다: ' + (error.response?.data?.message || error.message));
    } finally {
      setEditSaving(false);
    }
  };

  // 장비 설정 사이드바 열기
  const handleOpenSettingsSidebar = () => {
    if (device) {
      const snmp = {
        SNMP_VERSION: device.SNMP_VERSION || 2,
        SNMP_PORT: device.SNMP_PORT || 161,
        SNMP_COMMUNITY: device.SNMP_COMMUNITY || 'public',
        SNMP_USER: device.SNMP_USER || '',
        SNMP_AUTH_PROTOCOL: device.SNMP_AUTH_PROTOCOL || 'MD5',
        SNMP_AUTH_PASSWORD: device.SNMP_AUTH_PASSWORD || '',
        SNMP_PRIV_PROTOCOL: device.SNMP_PRIV_PROTOCOL || 'DES',
        SNMP_PRIV_PASSWORD: device.SNMP_PRIV_PASSWORD || ''
      };
      setSnmpConfig(snmp);
      setOriginalSnmpConfig(JSON.stringify(snmp));
      setOriginalSshConfig(JSON.stringify(sshConfig));
    }
    setSelectedMiddlewareId(device?.MIDDLEWARE_ID || null);
    setOriginalMiddlewareId(device?.MIDDLEWARE_ID || null);

    devicesApi.getMiddlewares().then(res => {
      setMiddlewares(res.data?.data || []);
    }).catch(() => setMiddlewares([]));

    setShowSettingsSidebar(true);

    if (device) {
      setThresholdLoading(true);
      (async () => {
        try {
          const { adminApi } = await import('../api/admin');
          const did = device.DEVICE_ID || deviceId;
          const [thrRes, metricsRes] = await Promise.all([
            adminApi.getDeviceThreshold(did),
            devicesApi.getDeviceMetrics(did),
          ]);
          const data = thrRes.data?.data || thrRes.data || [];
          const dMetrics = metricsRes.data?.data || metricsRes.data || [];

          if (data.length > 0) {
            const filtered = data.filter(t => dMetrics.includes(t.TYPE));
            setDeviceThresholds(filtered.map(t => ({ ...t })));
            setOriginalThresholds(JSON.stringify(filtered));
          } else {
            const baseRes = await adminApi.getThresholds();
            const base = baseRes.data?.data || baseRes.data || [];
            const filtered = base.filter(t => dMetrics.includes(t.TYPE));
            const init = filtered.map(t => ({ ...t, DEVICE_ID: String(did) }));
            setDeviceThresholds(init);
            setOriginalThresholds(JSON.stringify(init));
          }
        } catch {
          setDeviceThresholds([]);
        } finally {
          setThresholdLoading(false);
        }
      })();
    }
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
          ...editFormData,
          MIDDLEWARE_ID: selectedMiddlewareId,
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
      if (deviceThresholds.length > 0) {
        const { adminApi } = await import('../api/admin');
        await adminApi.upsertDeviceThresholds(String(did), deviceThresholds);
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

  // 장애 등급 라벨/클래스
  const getFaultLevelLabel = (level) => {
    switch (level) { case 'C': return 'Cr'; case 'M': return 'Mj'; case 'N': return 'Mn'; case 'W': return 'Wr'; default: return level; }
  };
  const getFaultLevelClass = (level) => {
    switch (level) { case 'C': return 'critical'; case 'M': return 'major'; case 'N': return 'minor'; case 'W': return 'warning'; default: return ''; }
  };
  const formatFaultDate = (dateStr) => {
    if (!dateStr) return '-';
    try {
      return new Date(dateStr).toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch { return dateStr; }
  };
  const calcDuration = (occurAt, clearAt) => {
    if (!occurAt) return '-';
    const occur = new Date(occurAt);
    const clear = clearAt ? new Date(clearAt) : new Date();
    const diff = Math.floor((clear - occur) / 1000);
    if (diff < 60) return `${diff}초`;
    if (diff < 3600) return `${Math.floor(diff / 60)}분 ${diff % 60}초`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}시간 ${Math.floor((diff % 3600) / 60)}분`;
    return `${Math.floor(diff / 86400)}일 ${Math.floor((diff % 86400) / 3600)}시간`;
  };

  // 장애 인지 버튼 클릭
  const handleFaultAckClick = (error, e) => {
    e.stopPropagation();
    setSelectedFaultError(error);
    setShowFaultAckModal(true);
  };

  // 장애 인지 처리
  const handleFaultAcknowledge = async () => {
    if (!selectedFaultError) return;
    try {
      await faultApi.acknowledgeError(selectedFaultError.ERROR_ID, faultAckMessage);
      setShowFaultAckModal(false);
      setFaultAckMessage('');
      setSelectedFaultError(null);
      // 장애 데이터 새로고침
      setFaultLoading(true);
      const errRes = await faultApi.getErrors({ deviceId });
      const activeList = errRes.data?.data?.list || [];
      const deviceActiveErrors = Array.isArray(activeList) ? activeList.filter(e => e.DEVICE_ID == deviceId) : [];
      const histRes = await faultApi.getHistory({
        page: faultPage, size: faultPageSize,
        sortKey: faultSortField, sortDirection: faultSortOrder, deviceId,
      });
      const histData = histRes.data?.data || {};
      const histList = histData.content || [];
      const activeFormatted = deviceActiveErrors.map((e, i) => ({
        ...e, _isActive: true, _faultRowId: `active_${e.ERROR_ID || i}`,
      }));
      const histFormatted = histList.map((e, i) => ({
        ...e, _faultRowId: `hist_${e.ERROR_HISTORY_ID || i}`,
      }));
      setFaultData([...activeFormatted, ...histFormatted]);
      setFaultTotal(deviceActiveErrors.length + (histData.totalElements || 0));
      setFaultLoading(false);
    } catch (error) {
      console.error('인지 처리 실패:', error);
      alert('인지 처리에 실패했습니다.');
      setFaultLoading(false);
    }
  };

  const handleFaultSort = (key) => {
    if (faultSortField === key) {
      setFaultSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setFaultSortField(key);
      setFaultSortOrder('desc');
    }
    setFaultPage(1);
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
      return portSortOrder === 'asc' ? strA.localeCompare(strB, 'ko') : strB.localeCompare(strA, 'ko');
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

  // 장애 탭 컬럼 정의
  const faultColumns = useMemo(() => [
    {
      key: 'ERROR_LEVEL', label: '등급', width: '70px', sortable: true, align: 'center', hideable: true,
      render: (value) => <span className={`severity-badge ${getFaultLevelClass(value)}`}>{getFaultLevelLabel(value)}</span>,
    },
    {
      key: 'ERROR_FLAG', label: '상태', width: '80px', sortable: true, align: 'center', hideable: true,
      render: (value, row) => (
        <span className={`status-badge ${row._isActive ? (value === 1 ? 'acknowledged' : 'active') : 'cleared'}`}>
          {row._isActive ? (value === 1 ? '인지' : '발생') : '해소'}
        </span>
      ),
    },
    { key: 'ERROR_MESSAGE', label: '장애 내용', sortable: true, className: 'cell-truncate' },
    {
      key: 'OCCUR_AT', label: '발생 시간', width: '155px', sortable: true, className: 'cell-date', hideable: true,
      render: (value) => formatFaultDate(value),
    },
    {
      key: 'CLEAR_AT', label: '해소 시간', width: '155px', sortable: true, className: 'cell-date', hideable: true,
      render: (value, row) => row._isActive ? <span style={{ color: '#ef4444', fontWeight: 500 }}>진행 중</span> : formatFaultDate(value),
    },
    { key: 'duration', label: '소요 시간', width: '110px', hideable: true, render: (_, row) => calcDuration(row.OCCUR_AT, row.CLEAR_AT) },
    {
      key: 'actions', label: '인지', width: '70px', align: 'center',
      render: (_, row) => row._isActive ? (
        <button className="action-btn" title="인지처리" onClick={(e) => handleFaultAckClick(row, e)} disabled={row.ERROR_FLAG === 1}>
          <i className="bi bi-check-lg"></i>
        </button>
      ) : null,
    },
  ], []);

  // 포트 테이블 컬럼
  const portColumns = useMemo(() => [
    { key: 'IF_INDEX', label: 'Index', width: '70px', sortable: true, align: 'center' },
    { key: 'IF_NAME', label: '이름', width: '120px', sortable: true, render: (v) => v || '-' },
    { key: 'IF_DESCR', label: '설명', width: '130px', sortable: true, className: 'cell-truncate', hideable: true, render: (v) => v || '-' },
    { key: 'IF_DESCRIPTION', label: 'Description', width: '130px', sortable: true, className: 'cell-truncate', hideable: true, render: (v) => v || '-' },
    {
      key: 'IF_TYPE', label: '타입', width: '100px', sortable: true, hideable: true,
      render: (value, row) => (
        <span className={`port-type-badge ${getPortTypeBadgeClass(value)}`}>
          {row.ifTypeText || getPortTypeText(value)}
        </span>
      ),
    },
    { key: 'IF_MTU', label: 'MTU', width: '70px', sortable: true, align: 'center', hideable: true, render: (v) => v || '-' },
    { key: 'IF_HIGH_SPEED', label: '속도', width: '100px', sortable: true, className: 'port-speed', hideable: true, render: (_, row) => formatSpeed(row) },
    { key: 'IF_MAC_ADDRESS', label: 'MAC', width: '140px', sortable: true, className: 'port-mac', hideable: true, render: (v) => v || '-' },
    {
      key: 'IF_ADMIN_STATUS', label: 'Admin', width: '70px', sortable: true, align: 'center', hideable: true,
      render: (v) => <span className={`status-badge ${v === 1 ? 'up' : 'down'}`}>{v === 1 ? 'Up' : 'Down'}</span>,
    },
    {
      key: 'IF_OPER_STATUS', label: 'Oper', width: '70px', sortable: true, align: 'center', hideable: true,
      render: (v) => <span className={`status-badge ${v === 1 ? 'up' : 'down'}`}>{v === 1 ? 'Up' : 'Down'}</span>,
    },
    {
      key: 'IF_OPER_FLAG', label: 'Oper 감시', width: '90px', sortable: true, align: 'center', hideable: true,
      render: (value, row) => {
        const isOn = value === 1 || value === true;
        return (
          <span className={`flag-toggle ${isOn ? 'active' : ''}`} onClick={(e) => { e.stopPropagation(); handleTogglePortFlag(row, 'IF_OPER_FLAG'); }}
            title={isOn ? '감시 중 (클릭하여 해제)' : '미감시 (클릭하여 활성화)'}>
            <span className="toggle-track"><span className="toggle-thumb" /></span>
          </span>
        );
      },
    },
    {
      key: 'IF_PERF_FLAG', label: '성능 감시', width: '90px', sortable: true, align: 'center', hideable: true,
      render: (value, row) => {
        const isOn = value === 1 || value === true;
        return (
          <span className={`flag-toggle ${isOn ? 'active' : ''}`} onClick={(e) => { e.stopPropagation(); handleTogglePortFlag(row, 'IF_PERF_FLAG'); }}
            title={isOn ? '감시 중 (클릭하여 해제)' : '미감시 (클릭하여 활성화)'}>
            <span className="toggle-track"><span className="toggle-thumb" /></span>
          </span>
        );
      },
    },
  ], []);

  return (
    <div id="device-detail-modal" className="modal" style={{ display: 'flex', zIndex: 9999 }} onClick={onClose}>
      <div className="modal-content device-detail-modal" style={{ position: 'relative', overflow: 'hidden' }} onClick={(e) => e.stopPropagation()}>
        <span className="close-btn" onClick={onClose}>&times;</span>

        {/* 장비 설정 사이드바 (모달 내부 오버레이) */}
        <div className={`settings-sidebar-overlay${showSettingsSidebar ? ' open' : ''}`} onClick={() => setShowSettingsSidebar(false)}>
          <div className="settings-sidebar" onClick={(e) => e.stopPropagation()}>
            <div className="settings-sidebar-header">
              <div className="settings-sidebar-title">
                <i className="bi bi-gear"></i> 장비 설정
              </div>
              <span className="settings-sidebar-close" onClick={() => setShowSettingsSidebar(false)}>&times;</span>
            </div>

            <div className="settings-sidebar-body">
              {/* 수집 서버 설정 */}
              <div className="settings-section">
                <div className="settings-section-title">
                  <i className="bi bi-server"></i> 수집 서버
                </div>
                <div className="settings-form">
                  <div className="settings-form-group">
                    <select
                      value={selectedMiddlewareId || ''}
                      onChange={(e) => setSelectedMiddlewareId(e.target.value ? parseInt(e.target.value) : null)}
                    >
                      <option value="">미지정 (수집 안 함)</option>
                      {middlewares.filter(m => m.STATUS === 'ACTIVE').map(m => (
                        <option key={m.MIDDLEWARE_ID} value={m.MIDDLEWARE_ID}>
                          {m.MIDDLEWARE_NAME} ({m.MIDDLEWARE_URL})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

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

              {/* 임계치 설정 */}
              <div className="settings-section">
                <div className="settings-section-title">
                  <i className="bi bi-speedometer2"></i> 임계치 설정
                </div>
                {thresholdLoading ? (
                  <div className="scope-loading"><i className="bi bi-arrow-repeat spinning"></i> 로딩 중...</div>
                ) : (
                  <div className="sthr-list">
                    {deviceThresholds.map((t, idx) => (
                      <div key={t.TYPE} className="sthr-row">
                        <span className="sthr-type">{t.TYPE}</span>
                        <div className="sthr-inputs">
                          {[['CRITICAL', 'critical', 'C'], ['MAJOR', 'major', 'M'], ['MINOR', 'minor', 'N'], ['WARNING', 'warning', 'W']].map(([sev, cls, label]) => (
                            <div key={sev} className="sthr-cell">
                              <span className={`sthr-badge ${cls}`}>{label}</span>
                              <input
                                type="number" min={0} max={100}
                                value={t[sev] ?? ''}
                                onChange={e => {
                                  setDeviceThresholds(prev => {
                                    const next = [...prev];
                                    next[idx] = { ...next[idx], [sev]: parseInt(e.target.value) || 0 };
                                    return next;
                                  });
                                }}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="settings-sidebar-footer">
              <button className="btn btn-secondary" onClick={() => setShowSettingsSidebar(false)} disabled={sidebarSaving}>취소</button>
              <button className={`btn btn-primary ${(JSON.stringify(snmpConfig) !== originalSnmpConfig || JSON.stringify(sshConfig) !== originalSshConfig || JSON.stringify(deviceThresholds) !== originalThresholds || selectedMiddlewareId !== originalMiddlewareId) ? 'dirty' : ''}`} onClick={handleSaveSettings} disabled={sidebarSaving || (JSON.stringify(snmpConfig) === originalSnmpConfig && JSON.stringify(sshConfig) === originalSshConfig && JSON.stringify(deviceThresholds) === originalThresholds && selectedMiddlewareId === originalMiddlewareId)}>
                {sidebarSaving ? <><i className="bi bi-arrow-repeat spinning"></i> 저장 중...</> : <><i className="bi bi-check-lg"></i> 저장</>}
              </button>
            </div>
          </div>
        </div>

        {/* 탭 헤더 (메트릭 기반 동적) */}
        <div className="detail-tabs-row">
          <div className="detail-tabs">
            <button className={`detail-tab ${activeTab === 'device-info' ? 'active' : ''}`} onClick={() => setActiveTab('device-info')}>
              <i className="bi bi-info-circle"></i> 장비 정보
            </button>
            {(deviceMetrics.length === 0 || deviceMetrics.includes('INTERFACE')) && (
              <button className={`detail-tab ${activeTab === 'port-info' ? 'active' : ''}`} onClick={() => setActiveTab('port-info')}>
                <i className="bi bi-ethernet"></i> 포트 정보
                {portsDataRaw?.length > 0 && <span className="tab-badge">{portsDataRaw.length}</span>}
              </button>
            )}
            <button className={`detail-tab ${activeTab === 'fault-info' ? 'active' : ''}`} onClick={() => setActiveTab('fault-info')}>
              <i className="bi bi-exclamation-triangle"></i> 장애
              {faultTotal > 0 && <span className="tab-badge danger">{faultTotal}</span>}
            </button>
            <button className={`detail-tab ${activeTab === 'change-history' ? 'active' : ''}`} onClick={() => setActiveTab('change-history')}>
              <i className="bi bi-clock-history"></i> 변경이력
            </button>
            <button className={`detail-tab ${activeTab === 'ssh-history' ? 'active' : ''}`} onClick={() => setActiveTab('ssh-history')}>
              <i className="bi bi-terminal"></i> SSH이력
            </button>
          </div>
        </div>

        {/* 장비 정보 탭 - 2열 레이아웃 (인라인 편집) */}
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
                        <input type="text" className="edit-input ip" value={editFormData.DEVICE_IP || ''} onChange={(e) => setEditFormData({...editFormData, DEVICE_IP: e.target.value})} />
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

                  {/* CPU / MEM (메트릭에 포함된 경우만) */}
                  {(deviceMetrics.length === 0 || deviceMetrics.includes('CPU') || deviceMetrics.includes('MEM')) && (
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
                  )}

                  {/* 온습도 (메트릭에 포함된 경우) */}
                  {(deviceMetrics.includes('TEMPERATURE') || deviceMetrics.includes('HUMIDITY')) && (
                    <EnvironmentBox deviceId={device?.DEVICE_ID || deviceId} metrics={deviceMetrics} />
                  )}
                </div>

                {/* 우측: 포트현황, 트래픽차트 */}
                <div className="right-column">
                  {/* 포트 현황 - 실제 스위치 모양 */}
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
                        {chartPortsSet.size > 0
                          ? `선택: ${chartPortsSet.size}개 포트`
                          : 'OPER UP 포트 (포트 클릭으로 선택)'}
                      </span>
                      {trafficLoading && <i className="bi bi-arrow-repeat spinning" style={{marginLeft:'8px',fontSize:'11px',color:'#64748b'}}></i>}
                      <div className="global-settings-wrapper" ref={trafficSettingsRef}>
                        <button className="btn btn-icon" onClick={() => setShowTrafficSettings(prev => !prev)} title="차트 설정">
                          <i className="bi bi-sliders"></i>
                        </button>
                        {showTrafficSettings && (
                          <div className="global-settings-dropdown">
                            <div className="option-group-label">트래픽 카운터</div>
                            <label className="option-item">
                              <input type="radio" name="ptcCounter" checked={trafficChartSettings.counterType === '32bit'} onChange={() => setTrafficChartSettings(s => ({...s, counterType: '32bit'}))} />
                              <span>32-bit</span>
                            </label>
                            <label className="option-item">
                              <input type="radio" name="ptcCounter" checked={trafficChartSettings.counterType === '64bit'} onChange={() => setTrafficChartSettings(s => ({...s, counterType: '64bit'}))} />
                              <span>64-bit</span>
                            </label>

                            <div className="option-group-label">표시 단위</div>
                            <label className="option-item">
                              <input type="radio" name="ptcUnit" checked={trafficChartSettings.trafficUnit === 'bit'} onChange={() => setTrafficChartSettings(s => ({...s, trafficUnit: 'bit'}))} />
                              <span>bit (bps)</span>
                            </label>
                            <label className="option-item">
                              <input type="radio" name="ptcUnit" checked={trafficChartSettings.trafficUnit === 'byte'} onChange={() => setTrafficChartSettings(s => ({...s, trafficUnit: 'byte'}))} />
                              <span>byte (B/s)</span>
                            </label>
                            <label className="option-item">
                              <input type="radio" name="ptcUnit" checked={trafficChartSettings.trafficUnit === 'bps'} onChange={() => setTrafficChartSettings(s => ({...s, trafficUnit: 'bps'}))} />
                              <span>사용률 (%)</span>
                            </label>

                            <div className="option-group-label">품질 지표</div>
                            <label className="option-item">
                              <input type="checkbox" checked={trafficChartSettings.showError} onChange={(e) => setTrafficChartSettings(s => ({...s, showError: e.target.checked}))} />
                              <span style={{color:'#ef4444'}}>Error</span>
                            </label>
                            <label className="option-item">
                              <input type="checkbox" checked={trafficChartSettings.showDiscard} onChange={(e) => setTrafficChartSettings(s => ({...s, showDiscard: e.target.checked}))} />
                              <span style={{color:'#f97316'}}>Discard</span>
                            </label>

                            <div className="option-group-label">포트 선택</div>
                            <label className="option-item" style={{cursor:'pointer'}} onClick={handleResetChartFlags}>
                              <i className="bi bi-arrow-counterclockwise" style={{fontSize:12,color:'#94a3b8'}}></i>
                              <span>선택 초기화</span>
                            </label>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="info-box-body">
                      <PortTrafficChart
                        rawData={trafficRawData}
                        chartPortsSet={chartPortsSet}
                        portsData={portsData}
                        settings={trafficChartSettings}
                        loading={trafficLoading}
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
              tableId="modal-ports"
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
              exportConfig={{ fileName: '포트정보' }}
            />
          </div>
        )}

        {/* 장애 탭 */}
        {activeTab === 'fault-info' && (
          <div id="fault-info-tab" className="detail-tab-content active">
            <DataTable
              tableId="modal-faults"
              columns={faultColumns}
              data={faultData}
              rowKey="_faultRowId"
              rowAttrs={(row) => ({ 'data-fault-row': row._faultRowId || '' })}
              loading={faultLoading}
              loadingText="장애 이력을 불러오는 중..."
              emptyText="장애 이력이 없습니다"
              emptyIcon="bi-check-circle"
              sort={{ field: faultSortField, order: faultSortOrder }}
              onSort={handleFaultSort}
              maxHeight="calc(100vh - 380px)"
              rowClassName={(row) => row._isActive ? 'fault-active-row' : ''}
              pagination={{
                currentPage: faultPage,
                pageSize: faultPageSize,
                totalItems: faultTotal,
                onPageChange: setFaultPage,
                onPageSizeChange: (size) => {
                  setFaultPageSize(size);
                  setFaultPage(1);
                },
                pageSizeOptions: [10, 20, 50],
              }}
            />

            {/* 장애 인지 처리 모달 */}
            {showFaultAckModal && (
              <div className="modal-overlay" onClick={() => setShowFaultAckModal(false)}>
                <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                  <div className="modal-header">
                    <h3>장애 인지 처리</h3>
                    <button className="modal-close" onClick={() => setShowFaultAckModal(false)}>
                      <i className="bi bi-x-lg"></i>
                    </button>
                  </div>
                  <div className="modal-body">
                    <div className="ack-info">
                      <p><strong>장비:</strong> {device?.DEVICE_NAME} ({device?.DEVICE_IP})</p>
                      <p><strong>장애:</strong> {selectedFaultError?.ERROR_MESSAGE}</p>
                    </div>
                    <div className="form-group">
                      <label>인지 메시지</label>
                      <textarea
                        value={faultAckMessage}
                        onChange={(e) => setFaultAckMessage(e.target.value)}
                        placeholder="인지 처리 메시지를 입력하세요..."
                        rows={3}
                      />
                    </div>
                  </div>
                  <div className="modal-footer">
                    <button className="btn btn-secondary" onClick={() => setShowFaultAckModal(false)}>취소</button>
                    <button className="btn btn-primary" onClick={handleFaultAcknowledge}>인지 처리</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 변경이력 탭 */}
        {activeTab === 'change-history' && (
          <div id="change-history-tab" className="detail-tab-content active">
            {changeHistoryLoading ? (
              <div className="tab-loading"><i className="bi bi-arrow-repeat spinning"></i> 변경이력을 불러오는 중...</div>
            ) : changeHistory.length === 0 ? (
              <div className="tab-empty"><i className="bi bi-clock-history"></i><span>변경이력이 없습니다</span></div>
            ) : (
              <>
                <div className="history-timeline">
                  {changeHistory.map((log, idx) => (
                    <div key={log.LOG_ID || idx} className="history-item">
                      <div className="history-item-icon">
                        {log.ACTION_TYPE === 'CREATE' && <i className="bi bi-plus-circle text-success"></i>}
                        {log.ACTION_TYPE === 'UPDATE' && <i className="bi bi-pencil-square text-info"></i>}
                        {log.ACTION_TYPE === 'DELETE' && <i className="bi bi-trash text-danger"></i>}
                      </div>
                      <div className="history-item-content">
                        <div className="history-item-header">
                          <span className={`history-action-badge ${log.ACTION_TYPE?.toLowerCase()}`}>
                            {log.ACTION_TYPE === 'CREATE' ? '등록' : log.ACTION_TYPE === 'UPDATE' ? '수정' : log.ACTION_TYPE === 'DELETE' ? '삭제' : log.ACTION_TYPE}
                          </span>
                          <span className="history-target-type">{log.TARGET_TYPE}</span>
                          <span className="history-user">{log.USER_NAME || '시스템'}</span>
                          <span className="history-time">{log.CREATED_AT ? new Date(log.CREATED_AT).toLocaleString('ko-KR') : ''}</span>
                        </div>
                        {log.DETAIL && (
                          <div className="history-item-detail">{log.DETAIL}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                {changeHistoryTotal > 20 && (
                  <div className="history-pagination">
                    <button disabled={changeHistoryPage <= 1} onClick={() => setChangeHistoryPage(p => p - 1)}>
                      <i className="bi bi-chevron-left"></i>
                    </button>
                    <span>{changeHistoryPage} / {Math.ceil(changeHistoryTotal / 20)}</span>
                    <button disabled={changeHistoryPage >= Math.ceil(changeHistoryTotal / 20)} onClick={() => setChangeHistoryPage(p => p + 1)}>
                      <i className="bi bi-chevron-right"></i>
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* SSH이력 탭 */}
        {activeTab === 'ssh-history' && (
          <div id="ssh-history-tab" className="detail-tab-content active">
            {sshHistoryLoading ? (
              <div className="tab-loading"><i className="bi bi-arrow-repeat spinning"></i> SSH이력을 불러오는 중...</div>
            ) : sshHistory.length === 0 ? (
              <div className="tab-empty"><i className="bi bi-terminal"></i><span>SSH 접속 이력이 없습니다</span></div>
            ) : (
              <>
                <div className="ssh-history-list">
                  {sshHistory.map((session, idx) => (
                    <div key={session.sessionId || idx} className="ssh-history-item">
                      <div className="ssh-history-icon">
                        <i className={`bi ${session.disconnectedAt ? 'bi-plug' : 'bi-plug-fill text-success'}`}></i>
                      </div>
                      <div className="ssh-history-content">
                        <div className="ssh-history-header">
                          <span className="ssh-user-badge">{session.sshUser}@{session.host}</span>
                          <span className="ssh-history-user">{session.userName || '알 수 없음'}</span>
                          <span className={`ssh-status-badge ${session.disconnectedAt ? 'closed' : 'active'}`}>
                            {session.disconnectedAt ? '종료' : '접속중'}
                          </span>
                        </div>
                        <div className="ssh-history-times">
                          <span><i className="bi bi-box-arrow-in-right"></i> {session.connectedAt ? new Date(session.connectedAt).toLocaleString('ko-KR') : ''}</span>
                          {session.disconnectedAt && (
                            <span><i className="bi bi-box-arrow-right"></i> {new Date(session.disconnectedAt).toLocaleString('ko-KR')}</span>
                          )}
                          <span className="ssh-remote-addr">접속IP: {session.remoteAddr}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                {sshHistoryTotal > 20 && (
                  <div className="history-pagination">
                    <button disabled={sshHistoryPage <= 1} onClick={() => setSshHistoryPage(p => p - 1)}>
                      <i className="bi bi-chevron-left"></i>
                    </button>
                    <span>{sshHistoryPage} / {Math.ceil(sshHistoryTotal / 20)}</span>
                    <button disabled={sshHistoryPage >= Math.ceil(sshHistoryTotal / 20)} onClick={() => setSshHistoryPage(p => p + 1)}>
                      <i className="bi bi-chevron-right"></i>
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// 온습도 표시 컴포넌트
function EnvironmentBox({ deviceId, metrics }) {
  const [latest, setLatest] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!deviceId) return;
    setLoading(true);
    devicesApi.getEnvironmentLatest(deviceId)
      .then(r => setLatest(r.data?.data || r.data || []))
      .catch(() => setLatest([]))
      .finally(() => setLoading(false));
  }, [deviceId]);

  const temp = latest.find(d => d.METRIC_CODE === 'TEMPERATURE');
  const hum = latest.find(d => d.METRIC_CODE === 'HUMIDITY');

  return (
    <div className="info-box cpu-mem-box">
      <div className="info-box-header"><i className="bi bi-thermometer-half"></i> 온습도</div>
      <div className="info-box-body pie-body">
        {loading ? (
          <div style={{ padding: 20, color: '#94a3b8', textAlign: 'center', width: '100%' }}>
            <i className="bi bi-arrow-repeat spinning" /> 로딩 중...
          </div>
        ) : (
          <>
            {metrics.includes('TEMPERATURE') && (
              <div className="pie-wrapper">
                <div className="env-gauge temp">
                  <i className="bi bi-thermometer-half" />
                  <span className="env-gauge-value">{temp ? `${temp.VALUE}` : '—'}</span>
                  <span className="env-gauge-unit">°C</span>
                </div>
                <span className="pie-name">온도</span>
              </div>
            )}
            {metrics.includes('HUMIDITY') && (
              <div className="pie-wrapper">
                <div className="env-gauge hum">
                  <i className="bi bi-droplet-half" />
                  <span className="env-gauge-value">{hum ? `${hum.VALUE}` : '—'}</span>
                  <span className="env-gauge-unit">%RH</span>
                </div>
                <span className="pie-name">습도</span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
