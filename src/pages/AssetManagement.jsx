import { useState, useEffect, useMemo, useRef } from 'react';
import { GroupTree, DataTable } from '../components';
import { useGroupStore } from '../stores';
import ReactECharts from 'echarts-for-react';
import {
  useDevicesByGroupPaged,
  useDeleteDevices,
  useUpdateDevice,
  useDevicePorts,
  useUpdatePort,
  useDeviceScope,
  useUpdateDeviceScope,
  useDeviceTraffic,
  useDeviceErrorLevels,
} from '../hooks';
import { devicesApi } from '../api/devices';

export default function AssetManagement() {
  const { selectedGroup } = useGroupStore();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedDevices, setSelectedDevices] = useState([]);
  const [detailDevice, setDetailDevice] = useState(null);
  const [activeTab, setActiveTab] = useState('device-info');

  // 그룹 이동 모달 상태
  const [showMoveGroupModal, setShowMoveGroupModal] = useState(false);
  const [targetGroup, setTargetGroup] = useState(null);

  // SNMP 설정 모달 상태
  const [showSnmpModal, setShowSnmpModal] = useState(false);
  const [snmpConfig, setSnmpConfig] = useState({
    SNMP_VERSION: 2,
    SNMP_PORT: 161,
    SNMP_COMMUNITY: 'public',
    SNMP_USER: '',
    SNMP_AUTH_PROTOCOL: 'MD5',
    SNMP_AUTH_PASSWORD: '',
    SNMP_PRIV_PROTOCOL: 'DES',
    SNMP_PRIV_PASSWORD: ''
  });
  const [snmpCollecting, setSnmpCollecting] = useState(false);

  // SNMP 수집 결과 모달 상태
  const [snmpResultModal, setSnmpResultModal] = useState(null);

  // 장비 인라인 편집 상태
  const [editFormData, setEditFormData] = useState({});

  // 커스텀 툴팁 상태
  const [tooltip, setTooltip] = useState({ visible: false, content: '', x: 0, y: 0 });
  const [editSaving, setEditSaving] = useState(false);

  // 장비 테이블 정렬 상태 (기본: ID 오름차순)
  const [deviceSortField, setDeviceSortField] = useState('DEVICE_ID');
  const [deviceSortOrder, setDeviceSortOrder] = useState('asc');

  // 포트 테이블 정렬 상태 (기본: Index 오름차순)
  const [portSortField, setPortSortField] = useState('IF_INDEX');
  const [portSortOrder, setPortSortOrder] = useState('asc');

  // 검색 상태
  const [searchDeviceName, setSearchDeviceName] = useState('');
  const [searchDeviceIp, setSearchDeviceIp] = useState('');

  // 차트 표시할 포트 Set (세션 기반 - IF_INDEX 저장)
  const [chartPortsSet, setChartPortsSet] = useState(new Set());

  // CPU/MEM 데이터 상태
  const [cpuMemData, setCpuMemData] = useState(null);

  // 그룹 변경 시 페이지 및 검색 초기화
  useEffect(() => {
    setPage(1);
    setSelectedDevices([]);
    setSearchDeviceName('');
    setSearchDeviceIp('');
  }, [selectedGroup?.GROUP_ID]);

  // 검색 파라미터 (useMemo로 불필요한 객체 생성 방지)
  const searchParams = useMemo(() => ({
    deviceName: searchDeviceName.trim(),
    deviceIp: searchDeviceIp.trim()
  }), [searchDeviceName, searchDeviceIp]);

  // 툴팁 핸들러
  const showTooltip = (e, content) => {
    const rect = e.target.getBoundingClientRect();
    setTooltip({
      visible: true,
      content,
      x: rect.left + rect.width / 2,
      y: rect.top - 10
    });
  };
  const hideTooltip = () => setTooltip({ ...tooltip, visible: false });

  // 검색 초기화 함수
  const handleSearchReset = () => {
    setSearchDeviceName('');
    setSearchDeviceIp('');
    setPage(1);
  };

  // 서버 측 페이지네이션 + 정렬 + 검색 사용 (LIMIT OFFSET + ORDER BY + WHERE)
  const { data: devicesData, isLoading } = useDevicesByGroupPaged(
    selectedGroup?.GROUP_ID, page, pageSize, deviceSortField, deviceSortOrder, searchParams
  );
  const { data: portsDataRaw, isLoading: portsLoading } = useDevicePorts(detailDevice?.DEVICE_ID);
  const { data: deviceScope, isLoading: scopeLoading } = useDeviceScope(detailDevice?.DEVICE_ID);
  const { data: trafficData, isLoading: trafficLoading } = useDeviceTraffic(detailDevice?.DEVICE_ID, 60);

  // 장비별 활성 장애 등급 조회
  const { deviceErrorMap } = useDeviceErrorLevels();

  // CPU/MEM 데이터 조회
  useEffect(() => {
    if (!detailDevice?.DEVICE_ID) {
      setCpuMemData(null);
      return;
    }
    const fetchCpuMem = async () => {
      try {
        const response = await devicesApi.getDeviceCpuMem(detailDevice.DEVICE_ID);
        setCpuMemData(response.data?.data || null);
      } catch (error) {
        console.error('CPU/MEM 데이터 조회 실패:', error);
        setCpuMemData(null);
      }
    };
    fetchCpuMem();
    // 30초마다 갱신
    const interval = setInterval(fetchCpuMem, 30000);
    return () => clearInterval(interval);
  }, [detailDevice?.DEVICE_ID]);

  // 가상 인터페이스 필터링 (docker, veth, br-, lo 등 제외)
  const portsData = useMemo(() => {
    if (!portsDataRaw) return [];
    const virtualPatterns = /^(veth|docker|br-|virbr|vnet|tap|tun|dummy)/i;
    return portsDataRaw.filter(port => {
      const ifName = port.IF_NAME || port.IF_DESCR || '';
      return !virtualPatterns.test(ifName);
    });
  }, [portsDataRaw]);

  // 포트 데이터 로드 시 sessionStorage에서 복원 또는 OPER 활성 포트로 초기화
  useEffect(() => {
    if (portsData && portsData.length > 0 && detailDevice?.DEVICE_ID) {
      const storageKey = `chartPorts_${detailDevice.DEVICE_ID}`;
      const saved = sessionStorage.getItem(storageKey);

      if (saved) {
        // sessionStorage에 저장된 값 복원
        try {
          const savedPorts = JSON.parse(saved);
          setChartPortsSet(new Set(savedPorts));
        } catch {
          // 파싱 실패 시 기본값
          const operActivePorts = new Set(
            portsData
              .filter(p => p.IF_OPER_STATUS === 1 || p.IF_OPER_STATUS === 'up')
              .map(p => p.IF_INDEX)
          );
          setChartPortsSet(operActivePorts);
        }
      } else {
        // 저장된 값 없으면 OPER 활성 포트로 초기화
        const operActivePorts = new Set(
          portsData
            .filter(p => p.IF_OPER_STATUS === 1 || p.IF_OPER_STATUS === 'up')
            .map(p => p.IF_INDEX)
        );
        setChartPortsSet(operActivePorts);
      }
    }
  }, [portsData, detailDevice?.DEVICE_ID]);

  // 트래픽 차트 데이터 (세션 기반 chartPortsSet 필터링)
  const trafficChartData = useMemo(() => {
    if (!trafficData || !trafficData.series || trafficData.series.length === 0) {
      return { timeLabels: [], series: [] };
    }

    // 선택된 포트가 없으면 빈 차트
    if (chartPortsSet.size === 0) {
      return { timeLabels: [], series: [] };
    }

    // 선택된 포트만 표시
    const filteredSeries = trafficData.series.filter(item => {
      // series에 ifIndex가 있다고 가정
      if (item.ifIndex !== undefined) {
        return chartPortsSet.has(item.ifIndex);
      }
      // name 기반 매칭 (포트 이름이 series name에 포함되어 있는지)
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

  // 포트 차트 토글 핸들러 (세션 기반)
  const handleToggleChartPort = (port) => {
    setChartPortsSet(prev => {
      const newSet = new Set(prev);
      if (newSet.has(port.IF_INDEX)) {
        newSet.delete(port.IF_INDEX);
      } else {
        newSet.add(port.IF_INDEX);
      }
      // sessionStorage에 저장
      if (detailDevice?.DEVICE_ID) {
        sessionStorage.setItem(`chartPorts_${detailDevice.DEVICE_ID}`, JSON.stringify([...newSet]));
      }
      return newSet;
    });
  };

  // 차트 포트 초기화 (sessionStorage에서 삭제)
  const handleResetChartFlags = () => {
    if (portsData) {
      const operActivePorts = new Set(
        portsData
          .filter(p => p.IF_OPER_STATUS === 1 || p.IF_OPER_STATUS === 'up')
          .map(p => p.IF_INDEX)
      );
      setChartPortsSet(operActivePorts);
      // sessionStorage에서 삭제 (기본값으로 복귀)
      if (detailDevice?.DEVICE_ID) {
        sessionStorage.removeItem(`chartPorts_${detailDevice.DEVICE_ID}`);
      }
    }
  };

  // 포트 파싱 및 스위치 레이아웃 생성
  const switchLayout = useMemo(() => {
    if (!portsData || portsData.length === 0) return null;

    // 포트 이름에서 슬롯/포트 번호 추출
    const parsePortName = (port) => {
      const name = port.IF_NAME || port.IF_DESCR || '';

      // 1. 관리 포트 체크 (mgmt, default, management)
      // portNum은 나중에 순차 번호로 재할당됨
      if (/^(mgmt|default|management)$/i.test(name)) {
        return { interfaceType: 'management', slot: 'mgmt', portNum: 0, originalName: name };
      }

      // 2. Cisco 스타일 포트 파싱
      const ciscoPatterns = [
        /^(FastEthernet|Fa|Fe)(\d+)\/(\d+)$/i,           // FastEthernet0/1
        /^(GigabitEthernet|Gi|Ge)(\d+)\/(\d+)$/i,        // GigabitEthernet0/1
        /^(TenGigabitEthernet|Te|TenGi)(\d+)\/(\d+)$/i,  // TenGigabitEthernet0/1
        /^(Ethernet|Eth|Et)(\d+)\/(\d+)$/i,              // Ethernet0/1
        /^(FastEthernet|Fa|Fe)(\d+)\/(\d+)\/(\d+)$/i,    // FastEthernet1/0/1 (stacked)
        /^(GigabitEthernet|Gi|Ge)(\d+)\/(\d+)\/(\d+)$/i, // GigabitEthernet1/0/1 (stacked)
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

      // 3. Linux NIC 파싱 (eno1, eth0, enp0s3, ens192 등)
      const linuxMatch = name.match(/^(eno|eth|enp|ens|em)(\d+)(s\d+)?$/i);
      if (linuxMatch) {
        const portNum = parseInt(linuxMatch[2]);
        return { interfaceType: 'linux-nic', slot: 'eth', portNum, originalName: name };
      }

      // 4. 파싱 실패 시 IF_INDEX 사용
      return { interfaceType: 'unknown', slot: '0', portNum: port.IF_INDEX, originalName: name };
    };

    // 모든 포트 파싱
    const parsedPorts = portsData.map(port => ({
      ...port,
      parsed: parsePortName(port)
    }));

    // 인터페이스 타입별 그룹화
    const groupByType = {};
    parsedPorts.forEach(port => {
      const key = `${port.parsed.interfaceType}_${port.parsed.slot}`;
      if (!groupByType[key]) {
        groupByType[key] = {
          interfaceType: port.parsed.interfaceType,
          slot: port.parsed.slot,
          ports: []
        };
      }
      groupByType[key].ports.push(port);
    });

    // 각 그룹 내에서 포트 번호순 정렬
    Object.values(groupByType).forEach(group => {
      group.ports.sort((a, b) => a.parsed.portNum - b.parsed.portNum);

      // 관리 포트는 순차 번호로 재할당 (1, 2, 3...)
      if (group.interfaceType === 'management') {
        group.ports.forEach((port, idx) => {
          port.parsed.portNum = idx + 1;
        });
      }
    });

    // 메인 포트 vs 업링크 포트 분류
    const groups = Object.values(groupByType);
    let mainGroups = [];
    let uplinkGroups = [];

    // 관리 포트는 항상 업링크로
    const managementGroups = groups.filter(g => g.interfaceType === 'management');
    const nonMgmtGroups = groups.filter(g => g.interfaceType !== 'management');

    const hasFastEthernet = nonMgmtGroups.some(g => g.interfaceType === 'fastethernet');
    const hasGigabit = nonMgmtGroups.some(g => g.interfaceType === 'gigabit');
    const hasTenGigabit = nonMgmtGroups.some(g => g.interfaceType === 'tengigabit');
    const hasLinuxNic = nonMgmtGroups.some(g => g.interfaceType === 'linux-nic');

    if (hasFastEthernet) {
      // Cisco 스위치: FastEthernet이 메인, Gigabit/TenGigabit이 업링크
      mainGroups = nonMgmtGroups.filter(g => g.interfaceType === 'fastethernet');
      uplinkGroups = nonMgmtGroups.filter(g => g.interfaceType === 'gigabit' || g.interfaceType === 'tengigabit');
    } else if (hasGigabit && hasTenGigabit) {
      // Gigabit이 메인, TenGigabit이 업링크
      mainGroups = nonMgmtGroups.filter(g => g.interfaceType === 'gigabit');
      uplinkGroups = nonMgmtGroups.filter(g => g.interfaceType === 'tengigabit');
    } else if (hasLinuxNic) {
      // Linux 서버: 물리 NIC가 메인
      mainGroups = nonMgmtGroups.filter(g => g.interfaceType === 'linux-nic');
      uplinkGroups = nonMgmtGroups.filter(g => g.interfaceType !== 'linux-nic');
    } else if (hasGigabit) {
      // GigabitEthernet만 있으면 메인으로
      mainGroups = nonMgmtGroups.filter(g => g.interfaceType === 'gigabit');
    } else {
      // 그 외: 포트 수가 많은 그룹이 메인
      const sortedGroups = [...nonMgmtGroups].sort((a, b) => b.ports.length - a.ports.length);
      if (sortedGroups.length > 0) {
        mainGroups = [sortedGroups[0]];
        uplinkGroups = sortedGroups.slice(1);
      }
    }

    // 관리 포트를 업링크에 추가
    uplinkGroups = [...uplinkGroups, ...managementGroups];

    // 슬롯별 정렬
    mainGroups.sort((a, b) => a.slot.localeCompare(b.slot));
    uplinkGroups.sort((a, b) => a.slot.localeCompare(b.slot));

    return { mainGroups, uplinkGroups, totalPorts: portsData.length };
  }, [portsData]);

  const deleteDevicesMutation = useDeleteDevices();
  const updateDeviceMutation = useUpdateDevice();
  const updatePortMutation = useUpdatePort();
  const updateDeviceScopeMutation = useUpdateDeviceScope();

  // 수집 설정 토글 핸들러
  const handleToggleScope = async (field) => {
    if (!deviceScope) return;

    const newValue = !deviceScope[field];

    // SNMP 활성화 시 모달 표시
    if (field === 'COLLECT_SNMP' && newValue === true) {
      // 기존 SNMP 정보가 있으면 미리 채우기
      if (detailDevice) {
        setSnmpConfig({
          SNMP_VERSION: detailDevice.SNMP_VERSION || 2,
          SNMP_PORT: detailDevice.SNMP_PORT || 161,
          SNMP_COMMUNITY: detailDevice.SNMP_COMMUNITY || 'public',
          SNMP_USER: detailDevice.SNMP_USER || '',
          SNMP_AUTH_PROTOCOL: detailDevice.SNMP_AUTH_PROTOCOL || 'MD5',
          SNMP_AUTH_PASSWORD: detailDevice.SNMP_AUTH_PASSWORD || '',
          SNMP_PRIV_PROTOCOL: detailDevice.SNMP_PRIV_PROTOCOL || 'DES',
          SNMP_PRIV_PASSWORD: detailDevice.SNMP_PRIV_PASSWORD || ''
        });
      }
      setShowSnmpModal(true);
      return;
    }

    try {
      await updateDeviceScopeMutation.mutateAsync({
        deviceId: detailDevice.DEVICE_ID,
        data: { [field]: newValue }
      });
    } catch (error) {
      console.error('수집 설정 업데이트 오류:', error);
      alert('수집 설정 업데이트에 실패했습니다.');
    }
  };

  // SNMP 수집 시도 핸들러
  const handleSnmpCollect = async () => {
    if (!detailDevice) return;

    setSnmpCollecting(true);
    try {
      const response = await devicesApi.collectSnmp(detailDevice.DEVICE_ID, snmpConfig);
      const data = response.data?.data || response.data;
      setShowSnmpModal(false);
      setSnmpResultModal({
        success: true,
        title: 'SNMP 수집 성공',
        deviceInfo: {
          deviceName: detailDevice.DEVICE_NAME,
          deviceIp: detailDevice.DEVICE_IP,
          systemName: data?.DEVICE_SYSTEM_NAME || data?.sysName || '-',
          vendorName: data?.VENDOR_NAME || data?.vendorName || '-',
          modelName: data?.MODEL_NAME || data?.modelName || '-',
          deviceDesc: data?.DEVICE_DESC || data?.sysDescr || '-',
          portCount: data?.PORT_COUNT || data?.portCount || 0
        }
      });
    } catch (error) {
      console.error('SNMP 수집 실패:', error);
      setShowSnmpModal(false);
      setSnmpResultModal({
        success: false,
        title: 'SNMP 수집 실패',
        message: 'PING 수집만 유지됩니다.\n' + (error.response?.data?.message || error.message)
      });
    } finally {
      setSnmpCollecting(false);
    }
  };

  // SNMP 결과 모달 닫기
  const handleCloseSnmpResult = () => {
    if (snmpResultModal?.success) {
      window.location.reload();
    }
    setSnmpResultModal(null);
  };

  // 장비 수정 저장 및 모달 닫기
  const handleSaveAndClose = async () => {
    if (!detailDevice) {
      setDetailDevice(null);
      return;
    }

    // 변경사항 체크
    const hasChanges =
      editFormData.DEVICE_NAME !== (detailDevice.DEVICE_NAME || '') ||
      editFormData.DEVICE_IP !== (detailDevice.DEVICE_IP || '') ||
      editFormData.GROUP_ID !== detailDevice.GROUP_ID ||
      editFormData.MODEL_ID !== detailDevice.MODEL_ID ||
      editFormData.SNMP_VERSION !== (detailDevice.SNMP_VERSION || 2) ||
      editFormData.SNMP_PORT !== (detailDevice.SNMP_PORT || 161) ||
      editFormData.SNMP_COMMUNITY !== (detailDevice.SNMP_COMMUNITY || '') ||
      editFormData.SNMP_USER !== (detailDevice.SNMP_USER || '') ||
      editFormData.SNMP_AUTH_PROTOCOL !== (detailDevice.SNMP_AUTH_PROTOCOL || 'MD5') ||
      editFormData.SNMP_AUTH_PASSWORD !== (detailDevice.SNMP_AUTH_PASSWORD || '') ||
      editFormData.SNMP_PRIV_PROTOCOL !== (detailDevice.SNMP_PRIV_PROTOCOL || 'DES') ||
      editFormData.SNMP_PRIV_PASSWORD !== (detailDevice.SNMP_PRIV_PASSWORD || '');

    if (!hasChanges) {
      setDetailDevice(null);
      return;
    }

    setEditSaving(true);
    try {
      await updateDeviceMutation.mutateAsync({
        deviceId: detailDevice.DEVICE_ID,
        data: editFormData
      });
      alert('장비 정보가 저장되었습니다.');
      setDetailDevice(null);
    } catch (error) {
      console.error('장비 수정 오류:', error);
      alert('장비 수정에 실패했습니다: ' + (error.response?.data?.message || error.message));
    } finally {
      setEditSaving(false);
    }
  };

  // 포트 감시 플래그 토글
  const handleTogglePortFlag = async (port, field) => {
    const ifIndex = port.IF_INDEX || port.ifIndex;
    const currentValue = port[field] === true || port[field] === 1;
    const newValue = !currentValue;

    try {
      await updatePortMutation.mutateAsync({
        deviceId: detailDevice.DEVICE_ID,
        ifIndex: ifIndex,
        data: { [field]: newValue }
      });
    } catch (error) {
      console.error('포트 업데이트 오류:', error);
      alert('포트 정보 업데이트에 실패했습니다.');
    }
  };

  // 서버 측 페이지네이션 + 정렬 결과 사용
  const pagedDevices = devicesData?.content || [];
  const totalPages = devicesData?.totalPages || 0;
  const totalElements = devicesData?.totalElements || 0;

  // 장비 테이블 정렬 핸들러 (서버에서 정렬하므로 페이지 리셋)
  const handleDeviceSort = (field) => {
    if (deviceSortField === field) {
      setDeviceSortOrder(deviceSortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setDeviceSortField(field);
      setDeviceSortOrder('asc');
    }
    setPage(1);
  };

  // 포트 테이블 정렬 로직 (모든 포트 - 가상 포함)
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

  // 포트 테이블 정렬 핸들러
  const handlePortSort = (field) => {
    if (portSortField === field) {
      setPortSortOrder(portSortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setPortSortField(field);
      setPortSortOrder('asc');
    }
  };

  // 선택된 장비들의 그룹 ID 목록 (중복 제거)
  const selectedDeviceGroupIds = useMemo(() => {
    const groupIds = pagedDevices
      .filter(d => selectedDevices.includes(d.DEVICE_ID))
      .map(d => d.GROUP_ID)
      .filter(id => id != null);
    return [...new Set(groupIds)];
  }, [pagedDevices, selectedDevices]);

  // 정렬 아이콘 렌더링 함수
  const renderSortIcon = (field, currentSortField, currentSortOrder) => {
    if (currentSortField !== field) {
      return <i className="bi bi-chevron-expand sort-icon inactive"></i>;
    }
    return currentSortOrder === 'asc'
      ? <i className="bi bi-chevron-up sort-icon active"></i>
      : <i className="bi bi-chevron-down sort-icon active"></i>;
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedDevices(pagedDevices.map((d) => d.DEVICE_ID));
    } else {
      setSelectedDevices([]);
    }
  };

  const handleSelectDevice = (deviceId) => {
    setSelectedDevices((prev) =>
      prev.includes(deviceId) ? prev.filter((id) => id !== deviceId) : [...prev, deviceId]
    );
  };

  const handleDeleteSelected = async () => {
    if (!confirm(`${selectedDevices.length}개의 장비를 삭제하시겠습니까?`)) return;
    try {
      await deleteDevicesMutation.mutateAsync(selectedDevices);
      setSelectedDevices([]);
    } catch (error) {
      console.error('Delete error:', error);
      alert('삭제 중 오류가 발생했습니다.');
    }
  };

  // 그룹 이동 핸들러
  const handleMoveToGroup = async () => {
    if (!targetGroup) {
      alert('이동할 그룹을 선택해주세요.');
      return;
    }
    if (targetGroup.GROUP_ID === selectedGroup?.GROUP_ID) {
      alert('현재 그룹과 동일한 그룹입니다.');
      return;
    }

    try {
      // 선택된 장비들을 하나씩 업데이트
      for (const deviceId of selectedDevices) {
        await updateDeviceMutation.mutateAsync({
          deviceId,
          data: { GROUP_ID: targetGroup.GROUP_ID }
        });
      }
      alert(`${selectedDevices.length}개의 장비가 "${targetGroup.GROUP_NAME}" 그룹으로 이동되었습니다.`);
      setSelectedDevices([]);
      setShowMoveGroupModal(false);
      setTargetGroup(null);
    } catch (error) {
      console.error('Move error:', error);
      alert('그룹 이동 중 오류가 발생했습니다.');
    }
  };

  const handleRowClick = (device) => {
    setDetailDevice(device);
    setActiveTab('device-info');
    // 편집 폼 초기화
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
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('ko-KR');
  };

  const getSnmpVersionLabel = (version) => {
    const labels = { 1: 'v1', 2: 'v2c', 3: 'v3' };
    return labels[version] || version;
  };

  // 포트 타입 변환
  const getPortTypeText = (type) => {
    if (!type) return '-';
    const types = {
      6: 'ethernet',
      24: 'loopback',
      53: 'propVirtual',
      117: 'gigabitEthernet',
      131: 'tunnel',
      135: 'l2vlan',
      161: 'ieee8023adLag',
    };
    return types[type] || `type(${type})`;
  };

  // 포트 타입에 따른 배지 클래스
  const getPortTypeBadgeClass = (type) => {
    if (type === 6) return 'ethernet';
    if (type === 117) return 'gigabit';
    if (type === 24) return 'loopback';
    return '';
  };

  // 속도 포맷팅
  const formatSpeed = (port) => {
    if (port.speedText) return port.speedText;

    if (port.IF_HIGH_SPEED && port.IF_HIGH_SPEED > 0) {
      if (port.IF_HIGH_SPEED >= 1000) {
        return `${port.IF_HIGH_SPEED / 1000} Gbps`;
      }
      return `${port.IF_HIGH_SPEED} Mbps`;
    }
    if (port.IF_SPEED && port.IF_SPEED > 0) {
      if (port.IF_SPEED >= 1_000_000_000) {
        return `${Math.floor(port.IF_SPEED / 1_000_000_000)} Gbps`;
      } else if (port.IF_SPEED >= 1_000_000) {
        return `${Math.floor(port.IF_SPEED / 1_000_000)} Mbps`;
      } else if (port.IF_SPEED >= 1_000) {
        return `${Math.floor(port.IF_SPEED / 1_000)} Kbps`;
      }
      return `${port.IF_SPEED} bps`;
    }
    return '-';
  };

  // 포트 테이블 컬럼 정의
  const portColumns = useMemo(() => [
    {
      key: 'IF_INDEX',
      label: 'Index',
      width: '70px',
      sortable: true,
      align: 'center',
    },
    {
      key: 'IF_NAME',
      label: '이름',
      width: '120px',
      sortable: true,
      render: (value) => value || '-',
    },
    {
      key: 'IF_DESCR',
      label: '설명',
      width: '130px',
      sortable: true,
      className: 'cell-truncate',
      render: (value) => value || '-',
    },
    {
      key: 'IF_DESCRIPTION',
      label: 'Description',
      width: '130px',
      sortable: true,
      className: 'cell-truncate',
      render: (value) => value || '-',
    },
    {
      key: 'IF_TYPE',
      label: '타입',
      width: '100px',
      sortable: true,
      render: (value, row) => (
        <span className={`port-type-badge ${getPortTypeBadgeClass(value)}`}>
          {row.ifTypeText || getPortTypeText(value)}
        </span>
      ),
    },
    {
      key: 'IF_MTU',
      label: 'MTU',
      width: '70px',
      sortable: true,
      align: 'center',
      render: (value) => value || '-',
    },
    {
      key: 'IF_HIGH_SPEED',
      label: '속도',
      width: '100px',
      sortable: true,
      className: 'port-speed',
      render: (value, row) => formatSpeed(row),
    },
    {
      key: 'IF_MAC_ADDRESS',
      label: 'MAC',
      width: '140px',
      sortable: true,
      className: 'port-mac',
      render: (value) => value || '-',
    },
    {
      key: 'IF_ADMIN_STATUS',
      label: 'Admin',
      width: '70px',
      sortable: true,
      align: 'center',
      render: (value) => (
        <span className={`status-badge ${value === 1 ? 'up' : 'down'}`}>
          {value === 1 ? 'Up' : 'Down'}
        </span>
      ),
    },
    {
      key: 'IF_OPER_STATUS',
      label: 'Oper',
      width: '70px',
      sortable: true,
      align: 'center',
      render: (value) => (
        <span className={`status-badge ${value === 1 ? 'up' : 'down'}`}>
          {value === 1 ? 'Up' : 'Down'}
        </span>
      ),
    },
    {
      key: 'IF_OPER_FLAG',
      label: 'Oper 감시',
      width: '90px',
      sortable: true,
      align: 'center',
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
      key: 'IF_PERF_FLAG',
      label: '성능 감시',
      width: '90px',
      sortable: true,
      align: 'center',
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

  // 장비 테이블 컬럼 정의
  const deviceColumns = useMemo(() => [
    {
      key: 'DEVICE_NAME',
      label: '이름',
      width: '180px',
      sortable: true,
      className: 'cell-truncate',
    },
    {
      key: 'GROUP_NAME',
      label: '그룹',
      width: '120px',
      sortable: true,
      className: 'cell-truncate',
      render: (value) => (
        <span style={{ color: '#94a3b8', fontSize: '12px' }}>{value || '-'}</span>
      ),
    },
    {
      key: 'DEVICE_SYSTEM_NAME',
      label: '시스템명',
      width: '150px',
      sortable: true,
      className: 'cell-truncate',
    },
    {
      key: 'DEVICE_IP',
      label: 'IP',
      width: '130px',
      sortable: true,
      className: 'cell-ip',
    },
    {
      key: 'MODEL_NAME',
      label: '모델',
      width: '120px',
      sortable: true,
      className: 'cell-truncate',
    },
    {
      key: 'VENDOR_NAME',
      label: '벤더',
      width: '100px',
      sortable: true,
      className: 'cell-truncate',
    },
    {
      key: 'PORT_COUNT',
      label: '포트수',
      width: '80px',
      sortable: true,
      align: 'center',
      render: (value) => value != null ? <span className="port-badge">{value}</span> : '-',
    },
    {
      key: 'CREATE_AT',
      label: '등록일',
      width: '100px',
      sortable: true,
      className: 'cell-date',
      render: (value) => formatDate(value),
    },
    {
      key: 'STATUS',
      label: '상태',
      width: '60px',
      align: 'center',
      render: (_, row) => {
        const errorLevel = deviceErrorMap?.get(row.DEVICE_ID);
        if (!errorLevel) {
          return <span className="status-led status-led-normal" title="정상" />;
        }
        const levelName = errorLevel === 'C' ? 'Critical' :
                          errorLevel === 'M' ? 'Major' :
                          errorLevel === 'N' ? 'Minor' : 'Warning';
        return (
          <span
            className={`status-led status-led-${errorLevel}`}
            title={`장애: ${levelName}`}
          />
        );
      },
    },
  ], [deviceErrorMap]);

  return (
    <div className="asset-management-container">
      {/* 페이지 헤더 */}
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">
            <i className="bi bi-hdd-rack"></i>
            자산 관리
          </h1>
          <span className="page-subtitle">등록된 장비를 조회하고 관리합니다</span>
          {selectedGroup && (
            <span className="selected-group-badge">
              <i className="bi bi-folder2"></i>
              {selectedGroup.GROUP_NAME}
            </span>
          )}
        </div>
      </div>

      {/* 패널 래퍼 - 사이드바와 메인 컨텐츠를 하나로 묶음 */}
      <div className="page-panels-wrapper">
        <GroupTree />
        <main className="page-main-content">
          {!selectedGroup ? (
          <p id="welcome-message">그룹을 선택하여 해당 그룹의 장비 목록을 확인하세요.</p>
        ) : isLoading ? (
          <p style={{ color: '#94a3b8' }}>로딩 중...</p>
        ) : (
          <div id="device-list-section" style={{ display: 'block' }}>
            {selectedDevices.length > 0 && (
              <div style={{ display: 'flex', marginBottom: '12px', gap: '8px' }}>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => setShowMoveGroupModal(true)}
                  style={{ padding: '6px 12px', fontSize: '12px' }}
                >
                  <i className="bi bi-folder-symlink"></i> 그룹 이동 ({selectedDevices.length})
                </button>
                <button
                  className="btn btn-danger btn-sm"
                  onClick={handleDeleteSelected}
                  disabled={deleteDevicesMutation.isPending}
                  style={{ padding: '6px 12px', fontSize: '12px' }}
                >
                  <i className="bi bi-trash"></i> 선택 삭제 ({selectedDevices.length})
                </button>
              </div>
            )}

            {/* 검색 필터 바 */}
            <div className="filter-bar glass-card">
              <div className="filter-group">
                <label>장비명</label>
                <input
                  type="text"
                  className="filter-input"
                  placeholder="장비명"
                  value={searchDeviceName}
                  onChange={(e) => setSearchDeviceName(e.target.value)}
                />
              </div>
              <div className="filter-group">
                <label>IP 주소</label>
                <input
                  type="text"
                  className="filter-input"
                  placeholder="IP"
                  value={searchDeviceIp}
                  onChange={(e) => setSearchDeviceIp(e.target.value)}
                />
              </div>
              <div className="filter-actions">
                <button className="btn btn-icon-only" onClick={handleSearchReset} title="초기화">
                  <i className="bi bi-arrow-counterclockwise"></i>
                </button>
              </div>
            </div>

            <DataTable
              columns={deviceColumns}
              data={pagedDevices}
              rowKey="DEVICE_ID"
              loading={isLoading}
              loadingText="장비 정보를 불러오는 중..."
              emptyText="등록된 장비가 없습니다"
              emptyIcon="bi-hdd-rack"
              sort={{ field: deviceSortField, order: deviceSortOrder }}
              onSort={handleDeviceSort}
              selectable={true}
              selectMode="multi"
              selectedRows={selectedDevices}
              onSelectChange={setSelectedDevices}
              onRowClick={handleRowClick}
              pagination={{
                currentPage: page,
                pageSize: pageSize,
                totalItems: totalElements,
                onPageChange: setPage,
                onPageSizeChange: (newSize) => {
                  setPageSize(newSize);
                  setPage(1);
                },
              }}
              maxHeight="calc(100vh - 420px)"
            />
          </div>
        )}
        </main>
      </div>

      {/* 장비 상세 보기 모달 */}
      {detailDevice && (
        <div id="device-detail-modal" className="modal" style={{ display: 'flex' }}>
          <div className="modal-content device-detail-modal">
            <span className="close-btn" onClick={() => setDetailDevice(null)}>&times;</span>

            {/* 탭 헤더 */}
            <div className="detail-tabs-row">
              <div className="detail-tabs">
                <button className={`detail-tab ${activeTab === 'device-info' ? 'active' : ''}`} onClick={() => setActiveTab('device-info')}>
                  <i className="bi bi-info-circle"></i> 장비 정보
                </button>
                <button className={`detail-tab ${activeTab === 'scope-settings' ? 'active' : ''}`} onClick={() => setActiveTab('scope-settings')}>
                  <i className="bi bi-sliders"></i> 수집 설정
                </button>
                <button className={`detail-tab ${activeTab === 'port-info' ? 'active' : ''}`} onClick={() => setActiveTab('port-info')}>
                  <i className="bi bi-ethernet"></i> 포트 정보
                  {portsDataRaw?.length > 0 && <span className="tab-badge">{portsDataRaw.length}</span>}
                </button>
              </div>
            </div>

            {/* 장비 정보 탭 - 2열 레이아웃 (인라인 편집) */}
            {activeTab === 'device-info' && (
              <div id="device-info-tab" className="detail-tab-content active">
                <div className="two-column-layout">
                  {/* 좌측: 장비정보, SNMP정보, CPU/MEM */}
                  <div className="left-column">
                    {/* 장비 정보 */}
                    <div className="info-box">
                      <div className="info-box-header"><i className="bi bi-hdd-network"></i> 장비 정보</div>
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
                          <span className="label">
                            시스템명
                            {(detailDevice.DEVICE_DESC || detailDevice.sysDescr) && (
                              <span
                                className="sys-descr-icon"
                                onMouseEnter={(e) => showTooltip(e, detailDevice.DEVICE_DESC || detailDevice.sysDescr)}
                                onMouseLeave={hideTooltip}
                              >
                                <i className="bi bi-question-circle"></i>
                              </span>
                            )}
                          </span>
                          <span className="value">{detailDevice.DEVICE_SYSTEM_NAME || '-'}</span>
                        </div>
                        <div className="info-row">
                          <span className="label">벤더</span>
                          <span className="value" style={{flex: '0 0 auto', marginRight: '16px'}}>{detailDevice.VENDOR_NAME || '-'}</span>
                          <span className="label" style={{flex: '0 0 auto', marginRight: '8px'}}>모델</span>
                          <span className="value">{detailDevice.MODEL_NAME || '-'}</span>
                        </div>
                      </div>
                    </div>

                    {/* SNMP 정보 */}
                    <div className="info-box">
                      <div className="info-box-header"><i className="bi bi-diagram-3"></i> SNMP 정보</div>
                      <div className="info-box-body">
                        {/* 버전 | 포트 */}
                        <div className="info-row dual">
                          <span className="label">버전</span>
                          <select className="edit-select compact" value={editFormData.SNMP_VERSION || 2} onChange={(e) => setEditFormData({...editFormData, SNMP_VERSION: parseInt(e.target.value)})}>
                            <option value={1}>v1</option>
                            <option value={2}>v2c</option>
                            <option value={3}>v3</option>
                          </select>
                          <span className="label">포트</span>
                          <input type="number" className="edit-input compact" value={editFormData.SNMP_PORT || 161} onChange={(e) => setEditFormData({...editFormData, SNMP_PORT: parseInt(e.target.value)})} />
                        </div>
                        {/* 커뮤니티 or 사용자 */}
                        <div className="info-row">
                          <span className="label">{String(editFormData.SNMP_VERSION) === '3' ? '사용자' : '커뮤니티'}</span>
                          {String(editFormData.SNMP_VERSION) === '3' ? (
                            <input type="text" className="edit-input" value={editFormData.SNMP_USER || ''} onChange={(e) => setEditFormData({...editFormData, SNMP_USER: e.target.value})} />
                          ) : (
                            <input type="text" className="edit-input" value={editFormData.SNMP_COMMUNITY || ''} onChange={(e) => setEditFormData({...editFormData, SNMP_COMMUNITY: e.target.value})} placeholder="public" />
                          )}
                        </div>
                        {/* v3 전용: 인증 | 인증 PW */}
                        {String(editFormData.SNMP_VERSION) === '3' && (
                          <>
                            <div className="info-row dual">
                              <span className="label">인증</span>
                              <select className="edit-select compact" value={editFormData.SNMP_AUTH_PROTOCOL || 'MD5'} onChange={(e) => setEditFormData({...editFormData, SNMP_AUTH_PROTOCOL: e.target.value})}>
                                <option value="MD5">MD5</option>
                                <option value="SHA">SHA</option>
                                <option value="SHA256">SHA256</option>
                              </select>
                              <span className="label">인증 PW</span>
                              <input type="password" className="edit-input compact" value={editFormData.SNMP_AUTH_PASSWORD || ''} onChange={(e) => setEditFormData({...editFormData, SNMP_AUTH_PASSWORD: e.target.value})} />
                            </div>
                            <div className="info-row dual">
                              <span className="label">암호화</span>
                              <select className="edit-select compact" value={editFormData.SNMP_PRIV_PROTOCOL || 'DES'} onChange={(e) => setEditFormData({...editFormData, SNMP_PRIV_PROTOCOL: e.target.value})}>
                                <option value="DES">DES</option>
                                <option value="AES">AES128</option>
                                <option value="AES256">AES256</option>
                              </select>
                              <span className="label">암호화 PW</span>
                              <input type="password" className="edit-input compact" value={editFormData.SNMP_PRIV_PASSWORD || ''} onChange={(e) => setEditFormData({...editFormData, SNMP_PRIV_PASSWORD: e.target.value})} />
                            </div>
                          </>
                        )}
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
                                type: 'pie',
                                radius: ['55%', '80%'],
                                center: ['50%', '50%'],
                                data: [
                                  { value: cpuMemData?.CPU_USAGE || 0, itemStyle: { color: '#3b82f6' } },
                                  { value: 100 - (cpuMemData?.CPU_USAGE || 0), itemStyle: { color: 'rgba(255,255,255,0.1)' } }
                                ],
                                label: {
                                  show: true,
                                  position: 'center',
                                  formatter: cpuMemData?.CPU_USAGE != null ? `${Number(cpuMemData.CPU_USAGE).toFixed(1)}%` : '-',
                                  fontSize: 18,
                                  fontWeight: 'bold',
                                  color: '#3b82f6'
                                },
                                labelLine: { show: false },
                                silent: true
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
                                type: 'pie',
                                radius: ['55%', '80%'],
                                center: ['50%', '50%'],
                                data: [
                                  { value: cpuMemData?.MEM_USAGE || 0, itemStyle: { color: '#10b981' } },
                                  { value: 100 - (cpuMemData?.MEM_USAGE || 0), itemStyle: { color: 'rgba(255,255,255,0.1)' } }
                                ],
                                label: {
                                  show: true,
                                  position: 'center',
                                  formatter: cpuMemData?.MEM_USAGE != null ? `${Number(cpuMemData.MEM_USAGE).toFixed(1)}%` : '-',
                                  fontSize: 18,
                                  fontWeight: 'bold',
                                  color: '#10b981'
                                },
                                labelLine: { show: false },
                                silent: true
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
                            {/* 메인 포트 영역 */}
                            <div className="switch-main-ports">
                              {switchLayout.mainGroups.map((group, gIdx) => (
                                <div key={`main-${gIdx}`} className="port-group">
                                  <div className="port-group-label">
                                    {group.interfaceType === 'fastethernet' ? 'FastEthernet ' :
                                     group.interfaceType === 'gigabit' ? 'GigabitEthernet ' :
                                     group.interfaceType === 'linux-nic' ? 'Network Interface ' : 'Ethernet '}{group.slot !== 'eth' ? group.slot : ''}
                                  </div>
                                  <div className="port-panel">
                                    {/* 홀수 포트 (위) */}
                                    <div className="port-row">
                                      {group.ports.filter(p => p.parsed.portNum % 2 === 1).map(port => (
                                        <div
                                          key={port.IF_INDEX}
                                          className={`port-jack ${port.IF_OPER_STATUS === 1 ? 'up' : 'down'}${chartPortsSet.has(port.IF_INDEX) ? ' chart-selected' : ''}`}
                                          title={`${port.parsed.originalName}\n상태: ${port.IF_OPER_STATUS === 1 ? 'UP' : 'DOWN'}\n속도: ${port.IF_HIGH_SPEED || port.IF_SPEED || '-'}\n클릭하여 차트에 추가/제거`}
                                          onClick={() => handleToggleChartPort(port)}
                                        >
                                          <span className="port-num">{port.parsed.portNum}</span>
                                          <div className="port-connector">
                                            <div className="port-led"></div>
                                          </div>
                                          {chartPortsSet.has(port.IF_INDEX) && <span className="chart-icon"></span>}
                                        </div>
                                      ))}
                                    </div>
                                    {/* 짝수 포트 (아래) */}
                                    <div className="port-row">
                                      {group.ports.filter(p => p.parsed.portNum % 2 === 0).map(port => (
                                        <div
                                          key={port.IF_INDEX}
                                          className={`port-jack ${port.IF_OPER_STATUS === 1 ? 'up' : 'down'}${chartPortsSet.has(port.IF_INDEX) ? ' chart-selected' : ''}`}
                                          title={`${port.parsed.originalName}\n상태: ${port.IF_OPER_STATUS === 1 ? 'UP' : 'DOWN'}\n속도: ${port.IF_HIGH_SPEED || port.IF_SPEED || '-'}\n클릭하여 차트에 추가/제거`}
                                          onClick={() => handleToggleChartPort(port)}
                                        >
                                          <span className="port-num">{port.parsed.portNum}</span>
                                          <div className="port-connector">
                                            <div className="port-led"></div>
                                          </div>
                                          {chartPortsSet.has(port.IF_INDEX) && <span className="chart-icon"></span>}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>

                            {/* 업링크 포트 영역 */}
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
                                          <div className="port-connector sfp">
                                            <div className="port-led"></div>
                                          </div>
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
                            : 'TOP 5 (포트 클릭으로 선택)'}
                        </span>
                        {chartPortsSet.size > 0 && (
                          <button
                            className="chart-clear-btn"
                            onClick={handleResetChartFlags}
                            title="선택 초기화"
                          >
                            <i className="bi bi-x-circle"></i> 초기화
                          </button>
                        )}
                        {trafficLoading && <i className="bi bi-arrow-repeat spinning" style={{marginLeft:'8px',fontSize:'11px'}}></i>}
                      </div>
                      <div className="info-box-body">
                        <ReactECharts
                          key={`traffic-${Array.from(chartPortsSet).join('-')}`}
                          notMerge={true}
                          option={{
                            tooltip:{trigger:'axis',backgroundColor:'rgba(15,23,42,0.95)',borderColor:'rgba(59,130,246,0.3)',textStyle:{color:'#e2e8f0',fontSize:11},formatter:(params)=>{
                              if(!params||params.length===0)return'';
                              let result=`<div style="font-weight:600;margin-bottom:4px">${params[0].axisValue}</div>`;
                              params.forEach(p=>{
                                const val=p.value||0;
                                const formattedVal=val>=1000000?(val/1000000).toFixed(2)+' Mbps':val>=1000?(val/1000).toFixed(2)+' Kbps':val.toFixed(2)+' bps';
                                result+=`<div style="display:flex;justify-content:space-between;gap:16px"><span>${p.marker}${p.seriesName}</span><span style="font-weight:500">${formattedVal}</span></div>`;
                              });
                              return result;
                            }},
                            legend:{type:'scroll',show:true,bottom:0,left:'center',width:'90%',textStyle:{color:'#94a3b8',fontSize:10},itemWidth:12,itemHeight:8,itemGap:10,pageButtonItemGap:5,pageButtonGap:10,pageIconColor:'#94a3b8',pageIconInactiveColor:'#4a5568',pageTextStyle:{color:'#94a3b8',fontSize:10}},
                            grid:{left:'3%',right:'3%',bottom:'15%',top:'5%',containLabel:true},
                            xAxis:{type:'category',boundaryGap:false,data:trafficChartData.timeLabels||[],axisLabel:{color:'#64748b',fontSize:9},axisLine:{lineStyle:{color:'rgba(255,255,255,0.1)'}},splitLine:{show:false}},
                            yAxis:{type:'value',axisLabel:{color:'#64748b',fontSize:9,formatter:v=>v>=1000000?(v/1000000).toFixed(0)+'M':v>=1000?(v/1000).toFixed(0)+'K':v},axisLine:{show:false},splitLine:{lineStyle:{color:'rgba(255,255,255,0.05)'}}},
                            series:trafficChartData.series&&trafficChartData.series.length>0?trafficChartData.series.map(item=>({name:item.name,type:'line',smooth:true,symbol:'circle',symbolSize:4,showSymbol:false,lineStyle:{width:2},areaStyle:{opacity:0.05},data:item.data})):[{name:'데이터 없음',type:'line',data:[]}]
                          }}
                          style={{height:'100%',width:'100%'}}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 수집 설정 탭 */}
            {activeTab === 'scope-settings' && (
              <div id="scope-settings-tab" className="detail-tab-content active">
                <div className="detail-section-wrapper">
                  <div className="detail-section">
                    <div className="detail-section-header">
                      <i className="bi bi-broadcast"></i>
                      <span>데이터 수집 설정</span>
                    </div>
                    {scopeLoading ? (
                      <div className="scope-loading">
                        <i className="bi bi-arrow-repeat spinning"></i> 설정 정보를 불러오는 중...
                      </div>
                    ) : (
                      <div className="scope-settings-grid">
                        <div className="scope-item">
                          <div className="scope-info">
                            <i className="bi bi-wifi scope-icon ping"></i>
                            <div className="scope-text">
                              <span className="scope-title">PING 수집</span>
                              <span className="scope-desc">ICMP 프로토콜로 장비 상태 모니터링</span>
                            </div>
                          </div>
                          <label className="toggle-switch">
                            <input
                              type="checkbox"
                              checked={deviceScope?.COLLECT_PING || false}
                              onChange={() => handleToggleScope('COLLECT_PING')}
                              disabled={updateDeviceScopeMutation.isPending}
                            />
                            <span className="toggle-slider"></span>
                          </label>
                        </div>

                        <div className="scope-item">
                          <div className="scope-info">
                            <i className="bi bi-diagram-3 scope-icon snmp"></i>
                            <div className="scope-text">
                              <span className="scope-title">SNMP 수집</span>
                              <span className="scope-desc">SNMP 프로토콜로 상세 정보 수집</span>
                            </div>
                          </div>
                          <label className="toggle-switch">
                            <input
                              type="checkbox"
                              checked={deviceScope?.COLLECT_SNMP || false}
                              onChange={() => handleToggleScope('COLLECT_SNMP')}
                              disabled={updateDeviceScopeMutation.isPending}
                            />
                            <span className="toggle-slider"></span>
                          </label>
                        </div>

                        <div className="scope-item">
                          <div className="scope-info">
                            <i className="bi bi-cpu scope-icon agent"></i>
                            <div className="scope-text">
                              <span className="scope-title">AGENT 수집</span>
                              <span className="scope-desc">에이전트를 통한 시스템 정보 수집</span>
                            </div>
                          </div>
                          <label className="toggle-switch">
                            <input
                              type="checkbox"
                              checked={deviceScope?.COLLECT_AGENT || false}
                              onChange={() => handleToggleScope('COLLECT_AGENT')}
                              disabled={updateDeviceScopeMutation.isPending}
                            />
                            <span className="toggle-slider"></span>
                          </label>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
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
              <button className="btn btn-secondary" onClick={() => setDetailDevice(null)} disabled={editSaving}>
                취소
              </button>
              <button id="detail-modal-ok-btn" className="btn btn-primary" onClick={handleSaveAndClose} disabled={editSaving}>
                {editSaving ? <><i className="bi bi-arrow-repeat spinning"></i> 저장 중...</> : <><i className="bi bi-check-lg"></i> 확인</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 그룹 이동 모달 */}
      {showMoveGroupModal && (
        <div className="modal" style={{
          display: 'flex',
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.7)',
          zIndex: 9999,
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <div className="modal-content" style={{
            maxWidth: '450px',
            width: '90%',
            background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.95) 0%, rgba(15, 23, 42, 0.98) 100%)',
            borderRadius: '16px',
            padding: '24px',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
            position: 'relative'
          }}>
            <span
              onClick={() => { setShowMoveGroupModal(false); setTargetGroup(null); }}
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                fontSize: '24px',
                color: '#94a3b8',
                cursor: 'pointer',
                lineHeight: 1
              }}
            >&times;</span>
            <h3 style={{ marginBottom: '16px', color: '#f1f5f9', fontSize: '18px' }}>
              <i className="bi bi-folder-symlink" style={{ marginRight: '8px' }}></i>
              그룹 이동
            </h3>
            <p style={{ color: '#94a3b8', marginBottom: '16px', fontSize: '14px' }}>
              {selectedDevices.length}개의 장비를 이동할 그룹을 선택하세요.
            </p>

            {/* 선택된 그룹 표시 */}
            {targetGroup && (
              <div style={{
                padding: '10px 14px',
                marginBottom: '12px',
                background: 'rgba(59, 130, 246, 0.15)',
                borderRadius: '8px',
                border: '1px solid rgba(59, 130, 246, 0.3)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <i className="bi bi-folder2" style={{ color: '#60a5fa' }}></i>
                <span style={{ color: '#e2e8f0', fontSize: '14px' }}>
                  선택: <strong>{targetGroup.GROUP_NAME}</strong>
                </span>
              </div>
            )}

            {/* 그룹 트리 */}
            <div style={{
              maxHeight: '300px',
              overflowY: 'auto',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '8px',
              background: 'rgba(15, 23, 42, 0.6)',
              marginBottom: '16px'
            }}>
              <GroupTree
                compact={true}
                autoSelectFirst={false}
                onSelectGroup={setTargetGroup}
                customSelectedGroup={targetGroup}
              />
            </div>

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button
                className="btn btn-secondary"
                onClick={() => { setShowMoveGroupModal(false); setTargetGroup(null); }}
                style={{ padding: '8px 16px' }}
              >
                취소
              </button>
              <button
                className="btn btn-primary"
                onClick={handleMoveToGroup}
                disabled={!targetGroup || updateDeviceMutation.isPending}
                style={{ padding: '8px 16px' }}
              >
                {updateDeviceMutation.isPending ? '이동 중...' : '이동'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SNMP 설정 모달 */}
      {showSnmpModal && (
        <div className="modal" style={{ display: 'flex' }}>
          <div className="modal-content" style={{ maxWidth: '500px' }}>
            <span className="close-btn" onClick={() => setShowSnmpModal(false)}>&times;</span>
            <h2 id="modal-title">SNMP 설정</h2>

            <div className="form-grid">
              <div className="form-group">
                <label>SNMP 버전</label>
                <select
                  value={snmpConfig.SNMP_VERSION}
                  onChange={(e) => setSnmpConfig({ ...snmpConfig, SNMP_VERSION: parseInt(e.target.value) })}
                >
                  <option value={1}>v1</option>
                  <option value={2}>v2c</option>
                  <option value={3}>v3</option>
                </select>
              </div>
              <div className="form-group">
                <label>SNMP 포트</label>
                <input
                  type="number"
                  value={snmpConfig.SNMP_PORT}
                  onChange={(e) => setSnmpConfig({ ...snmpConfig, SNMP_PORT: parseInt(e.target.value) })}
                />
              </div>
            </div>

            {snmpConfig.SNMP_VERSION !== 3 ? (
              <div className="form-group" style={{ marginTop: '16px' }}>
                <label>커뮤니티</label>
                <input
                  type="text"
                  value={snmpConfig.SNMP_COMMUNITY}
                  onChange={(e) => setSnmpConfig({ ...snmpConfig, SNMP_COMMUNITY: e.target.value })}
                  placeholder="public"
                />
              </div>
            ) : (
              <div id="snmp-v3-fields" style={{ marginTop: '16px' }}>
                <h4 style={{ marginBottom: '12px', color: '#94a3b8', fontSize: '14px' }}>SNMPv3 설정</h4>
                <div className="form-group" style={{ marginBottom: '12px' }}>
                  <label>사용자명</label>
                  <input
                    type="text"
                    value={snmpConfig.SNMP_USER}
                    onChange={(e) => setSnmpConfig({ ...snmpConfig, SNMP_USER: e.target.value })}
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                  <div className="form-group">
                    <label>인증 프로토콜</label>
                    <select
                      value={snmpConfig.SNMP_AUTH_PROTOCOL}
                      onChange={(e) => setSnmpConfig({ ...snmpConfig, SNMP_AUTH_PROTOCOL: e.target.value })}
                    >
                      <option value="MD5">MD5</option>
                      <option value="SHA">SHA</option>
                      <option value="SHA256">SHA256</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>인증 비밀번호</label>
                    <input
                      type="password"
                      value={snmpConfig.SNMP_AUTH_PASSWORD}
                      onChange={(e) => setSnmpConfig({ ...snmpConfig, SNMP_AUTH_PASSWORD: e.target.value })}
                    />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label>암호화 프로토콜</label>
                    <select
                      value={snmpConfig.SNMP_PRIV_PROTOCOL}
                      onChange={(e) => setSnmpConfig({ ...snmpConfig, SNMP_PRIV_PROTOCOL: e.target.value })}
                    >
                      <option value="DES">DES</option>
                      <option value="AES">AES128</option>
                      <option value="AES256">AES256</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>암호화 비밀번호</label>
                    <input
                      type="password"
                      value={snmpConfig.SNMP_PRIV_PASSWORD}
                      onChange={(e) => setSnmpConfig({ ...snmpConfig, SNMP_PRIV_PASSWORD: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="form-actions">
              <button
                className="btn btn-secondary"
                onClick={() => setShowSnmpModal(false)}
                disabled={snmpCollecting}
              >
                취소
              </button>
              <button
                className="btn btn-primary"
                onClick={handleSnmpCollect}
                disabled={snmpCollecting}
              >
                {snmpCollecting ? (
                  <>
                    <i className="bi bi-arrow-repeat spinning" style={{ marginRight: '8px' }}></i>
                    수집 중...
                  </>
                ) : (
                  'SNMP 정보 등록'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SNMP 수집 결과 모달 */}
      {snmpResultModal && (
        <div className="modal registration-modal" style={{ display: 'flex', zIndex: 10000 }}>
          <div className="modal-content registration-modal-content">
            <span className="close-btn" onClick={handleCloseSnmpResult}>&times;</span>
            <h3>
              {snmpResultModal.success ? 'SNMP 수집 완료' : 'SNMP 수집 실패'}
            </h3>

            {snmpResultModal.success && snmpResultModal.deviceInfo ? (
              <div className="result-section success-section">
                <h4><i className="bi bi-check-circle"></i> 수집 성공</h4>
                <div className="table-wrapper">
                  <table className="result-table">
                    <thead>
                      <tr>
                        <th style={{ minWidth: '120px' }}>장비명</th>
                        <th style={{ minWidth: '130px' }}>IP 주소</th>
                        <th style={{ minWidth: '100px' }}>상태</th>
                        <th style={{ minWidth: '120px' }}>시스템명</th>
                        <th style={{ minWidth: '100px' }}>벤더</th>
                        <th className="desc-column">장비 설명</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="success-row">
                        <td className="device-name">{snmpResultModal.deviceInfo.deviceName}</td>
                        <td className="device-ip">{snmpResultModal.deviceInfo.deviceIp}</td>
                        <td className="status-text">SNMP</td>
                        <td>{snmpResultModal.deviceInfo.systemName}</td>
                        <td>{snmpResultModal.deviceInfo.vendorName}</td>
                        <td className="desc-column" title={snmpResultModal.deviceInfo.deviceDesc}>{snmpResultModal.deviceInfo.deviceDesc}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="result-section failure-section">
                <h4><i className="bi bi-x-circle"></i> 수집 실패</h4>
                <p style={{ color: '#f87171', whiteSpace: 'pre-line', padding: '16px' }}>
                  {snmpResultModal.message}
                </p>
              </div>
            )}

            <div className="modal-actions">
              <button className="btn btn-primary" onClick={handleCloseSnmpResult}>
                확인
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 커스텀 툴팁 */}
      {tooltip.visible && (
        <div
          className="custom-tooltip"
          style={{
            position: 'fixed',
            left: tooltip.x,
            top: tooltip.y,
            transform: 'translate(-50%, -100%)',
            zIndex: 99999
          }}
        >
          {tooltip.content}
        </div>
      )}
    </div>
  );
}
