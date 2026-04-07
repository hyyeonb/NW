import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { GroupTree, DataTable, PortTrafficChart } from '../components';
import SshTerminalModal from '../components/SshTerminalModal';
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
  useDeviceTrafficRaw,
  useDeviceErrorLevels,
} from '../hooks';
import { devicesApi } from '../api/devices';
import { faultApi } from '../api/fault';
import { historyApi } from '../api/history';
import { useAlert } from '../components/CustomAlert';
import { isValidIPv4 } from '../utils/validation';

export default function AssetManagement() {
  const { alert: showAlert, success: showSuccess, error: showError, warning: showWarning, confirm: showConfirm } = useAlert();
  const [urlParams, setUrlParams] = useSearchParams();
  const { selectedGroup } = useGroupStore();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedDevices, setSelectedDevices] = useState([]);
  const [detailDevice, setDetailDevice] = useState(null);
  const [activeTab, setActiveTab] = useState('device-info');
  const [deviceMetrics, setDeviceMetrics] = useState([]);  // 장비의 수집 메트릭 목록

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

  // SSH 터미널 모달 상태
  const [sshTerminalDevice, setSshTerminalDevice] = useState(null);
  const [sshTerminalInfo, setSshTerminalInfo] = useState(null);
  const [sshAlertDevice, setSshAlertDevice] = useState(null);

  // 장비 설정 사이드바 상태
  const [showSettingsSidebar, setShowSettingsSidebar] = useState(false);
  const [sshConfig, setSshConfig] = useState({
    CONNECT_AS: 'SSH',
    SSH_USER: '',
    SSH_PASS: '',
    SSH_PORT: 22
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

  // 장비 테이블 정렬 상태 (기본: ID 오름차순)
  const [deviceSortField, setDeviceSortField] = useState('DEVICE_ID');
  const [deviceSortOrder, setDeviceSortOrder] = useState('asc');

  // 포트 테이블 정렬 상태 (기본: Index 오름차순)
  const [portSortField, setPortSortField] = useState('IF_INDEX');
  const [portSortOrder, setPortSortOrder] = useState('asc');

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
  const focusErrorIdRef = useRef(null); // URL에서 전달된 포커스 대상 에러

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

  // 검색 상태
  const [searchDeviceName, setSearchDeviceName] = useState('');
  const [searchDeviceIp, setSearchDeviceIp] = useState('');
  const [searchDevCode, setSearchDevCode] = useState('');

  // 장비 코드 목록
  const [devCodes, setDevCodes] = useState([]);

  // 차트 표시할 포트 Set (세션 기반 - IF_INDEX 저장)
  const [chartPortsSet, setChartPortsSet] = useState(new Set());

  // 포트 우클릭 컨텍스트 메뉴
  const [portContextMenu, setPortContextMenu] = useState({ visible: false, x: 0, y: 0, port: null });
  // 포트 상태 체크 결과
  const [portCheckResult, setPortCheckResult] = useState({ visible: false, loading: false, data: null, portName: '' });

  // 트래픽 차트 설정 상태
  const [showTrafficSettings, setShowTrafficSettings] = useState(false);
  const [trafficChartSettings, setTrafficChartSettings] = useState({
    counterType: '64bit',
    trafficUnit: 'bit',
    showError: false,
    showDiscard: false,
  });
  const trafficSettingsRef = useRef(null);

  // CPU/MEM 데이터 상태
  const [cpuMemData, setCpuMemData] = useState(null);

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

  // ESC 키로 모달 닫기 (가장 위 모달부터 순차 닫기)
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key !== 'Escape') return;
      if (showFaultAckModal) { setShowFaultAckModal(false); return; }
      if (sshAlertDevice) { setSshAlertDevice(null); return; }
      if (showSnmpModal) { setShowSnmpModal(false); return; }
      if (showMoveGroupModal) { setShowMoveGroupModal(false); setTargetGroup(null); return; }
      if (showSettingsSidebar) { setShowSettingsSidebar(false); return; }
      if (detailDevice) { setDetailDevice(null); return; }
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [showFaultAckModal, sshAlertDevice, showSnmpModal, showMoveGroupModal, showSettingsSidebar, detailDevice]);

  // 장비 코드 목록 로드 + URL category 파라미터 처리
  useEffect(() => {
    const loadDevCodes = async () => {
      try {
        const response = await devicesApi.getDevCodeTree();
        const codes = response.data?.data || [];
        setDevCodes(codes);

        // URL에 category 파라미터가 있으면 해당 장비코드로 필터 설정
        const categoryParam = urlParams.get('category');
        if (categoryParam && codes.length > 0) {
          const matched = codes.find(c => c.CODE_NM === categoryParam);
          if (matched) {
            setSearchDevCode(String(matched.DEV_CODE_ID));
          }
          // 파라미터 소비 후 URL에서 제거
          urlParams.delete('category');
          setUrlParams(urlParams, { replace: true });
        }
      } catch (error) {
        console.error('장비 코드 조회 실패:', error);
      }
    };
    loadDevCodes();
  }, []);

  // URL 파라미터로 장비/탭/에러 자동 선택 (장애 페이지에서 이동 시)
  useEffect(() => {
    const deviceIdParam = urlParams.get('deviceId');
    const tabParam = urlParams.get('tab');
    const errorIdParam = urlParams.get('errorId');

    if (deviceIdParam) {
      (async () => {
        try {
          const res = await devicesApi.getDevice(parseInt(deviceIdParam));
          const device = res.data?.data;
          if (device) {
            handleRowClick(device);
            if (tabParam) setActiveTab(tabParam);

            if (errorIdParam) {
              focusErrorIdRef.current = errorIdParam;

              // hist_* 이력인 경우 해당 페이지 계산
              if (errorIdParam.startsWith('hist_')) {
                const histId = errorIdParam.replace('hist_', '');
                try {
                  const posRes = await faultApi.getHistoryPosition(histId, device.DEVICE_ID, faultPageSize);
                  const targetPage = posRes.data?.data?.page || 1;
                  setFaultPage(targetPage);
                } catch { /* 실패 시 1페이지 유지 */ }
              }
            }
          }
        } catch (e) {
          console.error('장비 자동 선택 실패:', e);
        }
      })();
      // 파라미터 소비 후 URL에서 제거
      urlParams.delete('deviceId');
      urlParams.delete('tab');
      urlParams.delete('errorId');
      setUrlParams(urlParams, { replace: true });
    }
  }, []);

  // 그룹 변경 시 페이지 및 검색 초기화
  useEffect(() => {
    setPage(1);
    setSelectedDevices([]);
    setSearchDeviceName('');
    setSearchDeviceIp('');
    setSearchDevCode('');
  }, [selectedGroup?.GROUP_ID]);

  // 검색 파라미터 (useMemo로 불필요한 객체 생성 방지)
  const searchParams = useMemo(() => ({
    deviceName: searchDeviceName.trim(),
    deviceIp: searchDeviceIp.trim(),
    devCodeId: searchDevCode || undefined,
  }), [searchDeviceName, searchDeviceIp, searchDevCode]);

  // 검색 초기화 함수
  const handleSearchReset = () => {
    setSearchDeviceName('');
    setSearchDeviceIp('');
    setSearchDevCode('');
    setPage(1);
  };

  // 서버 측 페이지네이션 + 정렬 + 검색 사용 (LIMIT OFFSET + ORDER BY + WHERE)
  const { data: devicesData, isLoading } = useDevicesByGroupPaged(
    selectedGroup?.GROUP_ID, page, pageSize, deviceSortField, deviceSortOrder, searchParams
  );
  const { data: portsDataRaw, isLoading: portsLoading } = useDevicePorts(detailDevice?.DEVICE_ID);
  const { data: allPortsDataRaw, isLoading: allPortsLoading } = useDevicePorts(detailDevice?.DEVICE_ID, 'all');
  const { data: deviceScope, isLoading: scopeLoading } = useDeviceScope(detailDevice?.DEVICE_ID);
  const { data: trafficRawData, isLoading: trafficLoading } = useDeviceTrafficRaw(detailDevice?.DEVICE_ID, 60);

  // 장비별 활성 장애 등급 조회
  const { deviceErrorMap } = useDeviceErrorLevels();

  // SSH 데이터 조회
  useEffect(() => {
    if (!detailDevice?.DEVICE_ID) {
      setSshConfig({ CONNECT_AS: 'SSH', SSH_USER: '', SSH_PASS: '', SSH_PORT: 22 });
      return;
    }
    const fetchSsh = async () => {
      try {
        const response = await devicesApi.getDeviceSsh(detailDevice.DEVICE_ID);
        const data = response.data?.data;
        if (data) {
          setSshConfig({
            CONNECT_AS: data.CONNECT_AS || 'SSH',
            SSH_USER: data.SSH_USER || '',
            SSH_PASS: data.SSH_PASS || '',
            SSH_PORT: data.SSH_PORT || 22
          });
        }
      } catch {
        setSshConfig({ CONNECT_AS: 'SSH', SSH_USER: '', SSH_PASS: '', SSH_PORT: 22 });
      }
    };
    fetchSsh();
  }, [detailDevice?.DEVICE_ID]);

  // CPU/MEM 데이터 조회
  useEffect(() => {
    if (!detailDevice?.DEVICE_ID) {
      setCpuMemData(null);
      return;
    }
    const fetchCpuMem = async () => {
      try {
        const response = await devicesApi.getDeviceCpuMem(detailDevice.DEVICE_ID);
        const data = response.data?.data || null;
        // 수집 시각이 2분 이내가 아니면 스테일 데이터 → null 처리
        if (data?.COLLECTED_AT) {
          const collectedAt = new Date(data.COLLECTED_AT);
          const now = new Date();
          const diffMs = now.getTime() - collectedAt.getTime();
          if (diffMs > 2 * 60 * 1000) {
            setCpuMemData(null);
            return;
          }
        }
        setCpuMemData(data);
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

  // 장애 건수 조회 (장비 상세 열릴 때 바로)
  useEffect(() => {
    if (!detailDevice?.DEVICE_ID) {
      setFaultTotal(0);
      return;
    }
    const fetchFaultCount = async () => {
      try {
        const [errRes, histRes] = await Promise.all([
          faultApi.getErrors({ deviceId: detailDevice.DEVICE_ID }),
          faultApi.getHistory({ page: 1, size: 1, deviceId: detailDevice.DEVICE_ID }),
        ]);
        const activeList = errRes.data?.data?.list || [];
        const activeCount = Array.isArray(activeList)
          ? activeList.filter(e => e.DEVICE_ID === detailDevice.DEVICE_ID).length
          : 0;
        const histTotal = histRes.data?.data?.totalElements || 0;
        setFaultTotal(activeCount + histTotal);
      } catch {
        setFaultTotal(0);
      }
    };
    fetchFaultCount();
  }, [detailDevice?.DEVICE_ID]);

  // 장애 데이터 조회 (장애 탭 활성화 시)
  useEffect(() => {
    if (!detailDevice?.DEVICE_ID || activeTab !== 'fault-info') {
      return;
    }
    const fetchFaults = async () => {
      setFaultLoading(true);
      try {
        // 현재 활성 장애
        const errRes = await faultApi.getErrors({ deviceId: detailDevice.DEVICE_ID });
        const activeList = errRes.data?.data?.list || [];
        const deviceActiveErrors = Array.isArray(activeList)
          ? activeList.filter(e => e.DEVICE_ID === detailDevice.DEVICE_ID)
          : [];

        // 장애 이력
        const histRes = await faultApi.getHistory({
          page: faultPage,
          size: faultPageSize,
          sortKey: faultSortField,
          sortDirection: faultSortOrder,
          deviceId: detailDevice.DEVICE_ID,
        });
        const histData = histRes.data?.data || {};
        const histList = histData.content || [];

        // 활성 장애 + 이력 합치기
        const activeFormatted = deviceActiveErrors.map((e, i) => ({
          ...e,
          _isActive: true,
          _faultRowId: `active_${e.ERROR_ID || i}`,
        }));
        const histFormatted = histList.map((e, i) => ({
          ...e,
          _faultRowId: `hist_${e.ERROR_HISTORY_ID || i}`,
        }));

        const allFaults = [...activeFormatted, ...histFormatted];
        setFaultData(allFaults);
        setFaultTotal(deviceActiveErrors.length + (histData.totalElements || 0));

        // URL에서 전달된 focusErrorId가 있으면 해당 행 하이라이트 + 스크롤
        if (focusErrorIdRef.current) {
          const faultRowId = focusErrorIdRef.current;
          focusErrorIdRef.current = null;
          setTimeout(() => {
            const targetRow = document.querySelector(`[data-fault-row="${faultRowId}"]`);
            if (targetRow) {
              targetRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
              targetRow.classList.add('fault-focus-row');
            }
          }, 500);
        }
      } catch (error) {
        console.error('장애 데이터 조회 실패:', error);
        setFaultData([]);
      } finally {
        setFaultLoading(false);
      }
    };
    fetchFaults();
  }, [detailDevice?.DEVICE_ID, activeTab, faultPage, faultPageSize, faultSortField, faultSortOrder]);

  // 변경이력 데이터 조회
  useEffect(() => {
    if (!detailDevice?.DEVICE_ID || activeTab !== 'change-history') return;
    const fetchChangeHistory = async () => {
      setChangeHistoryLoading(true);
      try {
        const res = await devicesApi.getDeviceChangeHistory(detailDevice.DEVICE_ID, changeHistoryPage, 20);
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
  }, [detailDevice?.DEVICE_ID, activeTab, changeHistoryPage]);

  // SSH이력 데이터 조회
  useEffect(() => {
    if (!detailDevice?.DEVICE_ID || activeTab !== 'ssh-history') return;
    const fetchSshHistory = async () => {
      setSshHistoryLoading(true);
      try {
        const res = await devicesApi.getDeviceSshHistory(detailDevice.DEVICE_ID, sshHistoryPage, 20);
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
  }, [detailDevice?.DEVICE_ID, activeTab, sshHistoryPage]);

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

  // 포트 우클릭 메뉴
  const handlePortContextMenu = (e, port) => {
    e.preventDefault();
    setPortContextMenu({ visible: true, x: e.clientX, y: e.clientY, port });
  };

  const closePortContextMenu = () => setPortContextMenu(prev => ({ ...prev, visible: false }));

  // 포트 상태 실시간 체크
  const handlePortCheck = async (port) => {
    closePortContextMenu();
    setPortCheckResult({ visible: true, loading: true, data: null, portName: port.IF_NAME || port.IF_DESCR || `ifIndex ${port.IF_INDEX}` });
    try {
      const res = await devicesApi.checkPortStatus(detailDevice.DEVICE_ID, port.IF_INDEX);
      setPortCheckResult(prev => ({ ...prev, loading: false, data: res.data?.data }));
    } catch (err) {
      setPortCheckResult(prev => ({ ...prev, loading: false, data: { success: false, message: err.message } }));
    }
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
      showError('수집 설정 업데이트에 실패했습니다.');
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

  // 장비 설정 사이드바 열기
  const handleOpenSettingsSidebar = () => {
    if (detailDevice) {
      const snmp = {
        SNMP_VERSION: detailDevice.SNMP_VERSION || 2,
        SNMP_PORT: detailDevice.SNMP_PORT || 161,
        SNMP_COMMUNITY: detailDevice.SNMP_COMMUNITY || 'public',
        SNMP_USER: detailDevice.SNMP_USER || '',
        SNMP_AUTH_PROTOCOL: detailDevice.SNMP_AUTH_PROTOCOL || 'MD5',
        SNMP_AUTH_PASSWORD: detailDevice.SNMP_AUTH_PASSWORD || '',
        SNMP_PRIV_PROTOCOL: detailDevice.SNMP_PRIV_PROTOCOL || 'DES',
        SNMP_PRIV_PASSWORD: detailDevice.SNMP_PRIV_PASSWORD || ''
      };
      setSnmpConfig(snmp);
      setOriginalSnmpConfig(JSON.stringify(snmp));
      setOriginalSshConfig(JSON.stringify(sshConfig));
    }
    // 수집 서버 초기값
    setSelectedMiddlewareId(detailDevice?.MIDDLEWARE_ID || null);
    setOriginalMiddlewareId(detailDevice?.MIDDLEWARE_ID || null);

    // 수집 서버 목록 로드
    devicesApi.getMiddlewares().then(res => {
      setMiddlewares(res.data?.data || []);
    }).catch(() => setMiddlewares([]));

    setShowSettingsSidebar(true);

    // 장비별 임계치 로드
    if (detailDevice) {
      setThresholdLoading(true);
      (async () => {
        try {
          const { adminApi } = await import('../api/admin');
          const [thrRes, metricsRes] = await Promise.all([
            adminApi.getDeviceThreshold(detailDevice.DEVICE_ID),
            devicesApi.getDeviceMetrics(detailDevice.DEVICE_ID),
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
            const init = filtered.map(t => ({ ...t, DEVICE_ID: String(detailDevice.DEVICE_ID) }));
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
    if (!detailDevice) return;
    setSidebarSaving(true);
    try {
      // SNMP 설정 + 수집 서버 저장 (장비 정보 업데이트)
      await updateDeviceMutation.mutateAsync({
        deviceId: detailDevice.DEVICE_ID,
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
      // SSH 설정 저장
      if (sshConfig.SSH_USER) {
        await devicesApi.saveDeviceSsh(detailDevice.DEVICE_ID, sshConfig);
      }
      // 임계치 검증 + 저장
      if (deviceThresholds.length > 0) {
        for (const t of deviceThresholds) {
          const max = t.MAX_VALUE || 100;
          const unit = t.TYPE === 'TEMPERATURE' ? '°C' : t.TYPE === 'HUMIDITY' ? '%RH' : '%';
          const vals = [t.CRITICAL, t.MAJOR, t.MINOR, t.WARNING];
          for (const v of vals) {
            if (v < 0) { showWarning(`${t.TYPE}: 임계치 값은 0 미만일 수 없습니다.`); setSidebarSaving(false); return; }
            if (v > max) { showWarning(`${t.TYPE}: 임계치 값은 최대 ${max}${unit}을(를) 초과할 수 없습니다.`); setSidebarSaving(false); return; }
          }
          if (t.CRITICAL < t.MAJOR || t.MAJOR < t.MINOR || t.MINOR < t.WARNING) {
            showWarning(`${t.TYPE}: Critical > Major > Minor > Warning 순서여야 합니다.`); setSidebarSaving(false); return;
          }
        }
        const { adminApi } = await import('../api/admin');
        await adminApi.upsertDeviceThresholds(String(detailDevice.DEVICE_ID), deviceThresholds);
      }
      setShowSettingsSidebar(false);
    } catch (error) {
      console.error('설정 저장 실패:', error);
      showError('설정 저장에 실패했습니다: ' + (error.response?.data?.message || error.message));
    } finally {
      setSidebarSaving(false);
    }
  };

  // SSH 터미널 열기
  const handleOpenSshTerminal = useCallback(async (device, e) => {
    e.stopPropagation();
    try {
      const response = await devicesApi.getDeviceSsh(device.DEVICE_ID);
      const data = response.data?.data;
      if (!data?.SSH_USER) {
        setSshAlertDevice(device);
        return;
      }
      setSshTerminalInfo({
        SSH_USER: data.SSH_USER,
        SSH_PASS: data.SSH_PASS || '',
        SSH_PORT: data.SSH_PORT || 22,
      });
      setSshTerminalDevice(device);
    } catch {
      showError('SSH 접속 정보를 불러오지 못했습니다.');
    }
  }, []);

  // 변경사항 체크
  const hasEditChanges = useMemo(() => {
    if (!detailDevice) return false;
    return (
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
      editFormData.SNMP_PRIV_PASSWORD !== (detailDevice.SNMP_PRIV_PASSWORD || '')
    );
  }, [detailDevice, editFormData]);

  // 장비 수정 저장
  const handleSaveDevice = async () => {
    if (!detailDevice || !hasEditChanges) return;
    if (editFormData.DEVICE_IP && !isValidIPv4(editFormData.DEVICE_IP)) {
      showWarning('유효한 IP 주소 형식이 아닙니다. (예: 192.168.1.1)');
      return;
    }
    setEditSaving(true);
    try {
      await updateDeviceMutation.mutateAsync({
        deviceId: detailDevice.DEVICE_ID,
        data: editFormData
      });
      showSuccess('장비 정보가 저장되었습니다.');
      // detailDevice를 저장된 값으로 갱신 → hasEditChanges = false → 기어 아이콘 복원
      const updated = { ...detailDevice, ...editFormData };
      setDetailDevice(updated);
    } catch (error) {
      console.error('장비 수정 오류:', error);
      showError('장비 수정에 실패했습니다: ' + (error.response?.data?.message || error.message));
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
        deviceId: port.DEVICE_ID || detailDevice?.DEVICE_ID,
        ifIndex: ifIndex,
        data: { [field]: newValue }
      });
    } catch (error) {
      console.error('포트 업데이트 오류:', error);
      showError('포트 정보 업데이트에 실패했습니다.');
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
    const portSource = allPortsDataRaw?.length ? allPortsDataRaw : portsDataRaw;
    if (!portSource?.length) return [];
    return [...portSource].sort((a, b) => {
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
  }, [allPortsDataRaw, portsDataRaw, portSortField, portSortOrder]);

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
    const ok = await showConfirm(`${selectedDevices.length}개의 장비를 삭제하시겠습니까?`);
    if (!ok) return;
    try {
      await deleteDevicesMutation.mutateAsync(selectedDevices);
      setSelectedDevices([]);
    } catch (error) {
      console.error('Delete error:', error);
      showError('삭제 중 오류가 발생했습니다.');
    }
  };

  // 그룹 이동 핸들러
  const handleMoveToGroup = async () => {
    if (!targetGroup) {
      showWarning('이동할 그룹을 선택해주세요.');
      return;
    }
    if (targetGroup.GROUP_ID === selectedGroup?.GROUP_ID) {
      showWarning('현재 그룹과 동일한 그룹입니다.');
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
      showSuccess(`${selectedDevices.length}개의 장비가 "${targetGroup.GROUP_NAME}" 그룹으로 이동되었습니다.`);
      setSelectedDevices([]);
      setShowMoveGroupModal(false);
      setTargetGroup(null);
    } catch (error) {
      console.error('Move error:', error);
      showError('그룹 이동 중 오류가 발생했습니다.');
    }
  };

  const handleRowClick = (device) => {
    setDetailDevice(device);
    setActiveTab('device-info');
    // 장비 조회 활동 로그
    historyApi.recordPageView('asset_mgmt', '/mgmt/assets', {
      targetType: 'DEVICE',
      targetName: `${device.DEVICE_NAME || ''}(${device.DEVICE_IP || ''})`,
      detail: `장비 조회 - ${device.DEVICE_NAME || ''}(${device.DEVICE_IP || ''})`,
    });
    // 장비 메트릭 로드
    devicesApi.getDeviceMetrics(device.DEVICE_ID)
      .then(r => setDeviceMetrics(r.data?.data || r.data || []))
      .catch(() => setDeviceMetrics([]));
    setFaultData([]);
    setFaultTotal(0);
    setFaultPage(1);
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

  // 장애 탭 컬럼 정의
  const faultColumns = useMemo(() => [
    {
      key: 'ERROR_LEVEL',
      label: '등급',
      width: '70px',
      sortable: true,
      align: 'center',
      hideable: true,
      render: (value) => (
        <span className={`severity-badge ${getFaultLevelClass(value)}`}>
          {getFaultLevelLabel(value)}
        </span>
      ),
    },
    {
      key: 'ERROR_FLAG',
      label: '상태',
      width: '80px',
      sortable: true,
      align: 'center',
      hideable: true,
      render: (value, row) => (
        <span className={`status-badge ${row._isActive ? (value === 1 ? 'acknowledged' : 'active') : 'cleared'}`}>
          {row._isActive ? (value === 1 ? '인지' : '발생') : '해소'}
        </span>
      ),
    },
    {
      key: 'ERROR_MESSAGE',
      label: '장애 내용',
      sortable: true,
      className: 'cell-truncate',
    },
    {
      key: 'OCCUR_AT',
      label: '발생 시간',
      width: '155px',
      sortable: true,
      className: 'cell-date',
      hideable: true,
      render: (value) => formatFaultDate(value),
    },
    {
      key: 'CLEAR_AT',
      label: '해소 시간',
      width: '155px',
      sortable: true,
      className: 'cell-date',
      hideable: true,
      render: (value, row) => row._isActive ? <span style={{ color: '#ef4444', fontWeight: 500 }}>진행 중</span> : formatFaultDate(value),
    },
    {
      key: 'duration',
      label: '소요 시간',
      width: '110px',
      hideable: true,
      render: (_, row) => calcDuration(row.OCCUR_AT, row.CLEAR_AT),
    },
    {
      key: 'actions',
      label: '인지',
      width: '70px',
      align: 'center',
      render: (_, row) => row._isActive ? (
        <button
          className="action-btn"
          title="인지처리"
          onClick={(e) => handleFaultAckClick(row, e)}
          disabled={row.ERROR_FLAG === 1}
        >
          <i className="bi bi-check-lg"></i>
        </button>
      ) : null,
    },
  ], []);

  const handleFaultSort = (key) => {
    if (faultSortField === key) {
      setFaultSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setFaultSortField(key);
      setFaultSortOrder('desc');
    }
    setFaultPage(1);
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
      // 장애 데이터 새로고침 (useEffect 트리거)
      setFaultSortOrder(prev => prev);
      // 직접 재조회
      setFaultLoading(true);
      const errRes = await faultApi.getErrors({ deviceId: detailDevice.DEVICE_ID });
      const activeList = errRes.data?.data?.list || [];
      const deviceActiveErrors = Array.isArray(activeList)
        ? activeList.filter(e => e.DEVICE_ID === detailDevice.DEVICE_ID)
        : [];
      const histRes = await faultApi.getHistory({
        page: faultPage, size: faultPageSize,
        sortKey: faultSortField, sortDirection: faultSortOrder,
        deviceId: detailDevice.DEVICE_ID,
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
      showError('인지 처리에 실패했습니다.');
      setFaultLoading(false);
    }
  };

  // 포트 테이블 컬럼 정의
  const portColumns = useMemo(() => [
    {
      key: 'IF_INDEX',
      label: 'Index',
      width: '70px',
      sortable: true,
      align: 'center',
      hideable: false,
    },
    {
      key: 'IF_NAME',
      label: '이름',
      width: '120px',
      sortable: true,
      render: (value) => value || '-',
      hideable: false,
    },
    {
      key: 'IF_DESCR',
      label: '설명',
      width: '130px',
      sortable: true,
      className: 'cell-truncate',
      hideable: true,
      render: (value) => value || '-',
    },
    {
      key: 'IF_DESCRIPTION',
      label: 'Description',
      width: '130px',
      sortable: true,
      className: 'cell-truncate',
      hideable: true,
      render: (value) => value || '-',
    },
    {
      key: 'IF_TYPE',
      label: '타입',
      width: '100px',
      sortable: true,
      hideable: true,
      filterable: true,
      filterLabel: (val) => getPortTypeText(val),
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
      hideable: true,
      defaultHidden: true,
      render: (value) => value || '-',
    },
    {
      key: 'IF_HIGH_SPEED',
      label: '속도',
      width: '100px',
      sortable: true,
      className: 'port-speed',
      hideable: true,
      render: (value, row) => formatSpeed(row),
    },
    {
      key: 'IF_MAC_ADDRESS',
      label: 'MAC',
      width: '140px',
      sortable: true,
      className: 'port-mac',
      hideable: true,
      render: (value) => value || '-',
    },
    {
      key: 'IF_LAST_CHANGE',
      label: 'Last Change',
      width: '130px',
      sortable: true,
      hideable: true,
      defaultHidden: true,
      render: (value) => value != null ? Number(value).toLocaleString() : '-',
    },
    {
      key: 'IF_IP_ADDRESS',
      label: 'IP',
      width: '130px',
      sortable: true,
      className: 'cell-ip',
      hideable: true,
      render: (value) => value || '-',
    },
    {
      key: 'IF_IP_NETMASK',
      label: 'Netmask',
      width: '130px',
      sortable: true,
      hideable: true,
      defaultHidden: true,
      render: (value) => value || '-',
    },
    {
      key: 'IF_ADMIN_STATUS',
      label: 'Admin',
      width: '70px',
      sortable: true,
      align: 'center',
      hideable: true,
      filterable: true,
      filterLabel: (val) => val === 1 ? 'Up' : 'Down',
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
      hideable: true,
      filterable: true,
      filterLabel: (val) => val === 1 ? 'Up' : 'Down',
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
      hideable: true,
      render: (value, row) => {
        const isOn = value === 1 || value === true;
        return (
          <span
            className={`flag-toggle ${isOn ? 'active' : ''}`}
            onClick={(e) => { e.stopPropagation(); handleTogglePortFlag(row, 'IF_OPER_FLAG'); }}
            title={isOn ? '감시 중 (클릭하여 해제)' : '미감시 (클릭하여 활성화)'}
          >
            <span className="toggle-track"><span className="toggle-thumb" /></span>
          </span>
        );
      },
    },
    {
      key: 'IF_PERF_FLAG',
      label: '성능 감시',
      width: '90px',
      sortable: true,
      align: 'center',
      hideable: true,
      render: (value, row) => {
        const isOn = value === 1 || value === true;
        return (
          <span
            className={`flag-toggle ${isOn ? 'active' : ''}`}
            onClick={(e) => { e.stopPropagation(); handleTogglePortFlag(row, 'IF_PERF_FLAG'); }}
            title={isOn ? '감시 중 (클릭하여 해제)' : '미감시 (클릭하여 활성화)'}
          >
            <span className="toggle-track"><span className="toggle-thumb" /></span>
          </span>
        );
      },
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
      hideable: true,
      render: (value) => (
        <span style={{ color: 'var(--theme-text-tertiary, #94a3b8)', fontSize: '12px' }}>{value || '-'}</span>
      ),
    },
    {
      key: 'DEVICE_SYSTEM_NAME',
      label: '시스템명',
      width: '150px',
      sortable: true,
      className: 'cell-truncate',
      hideable: true,
    },
    {
      key: 'DEVICE_IP',
      label: 'IP',
      width: '130px',
      sortable: true,
      className: 'cell-ip',
      hideable: true,
    },
    {
      key: 'MODEL_NAME',
      label: '모델',
      width: '120px',
      sortable: true,
      className: 'cell-truncate',
      hideable: true,
    },
    {
      key: 'VENDOR_NAME',
      label: '벤더',
      width: '100px',
      sortable: true,
      className: 'cell-truncate',
      hideable: true,
      defaultHidden: true,
    },
    {
      key: 'PORT_COUNT',
      label: '포트수',
      width: '80px',
      sortable: true,
      align: 'center',
      hideable: true,
      render: (value) => value != null ? <span className="port-badge">{value}</span> : '-',
    },
    {
      key: 'CREATE_AT',
      label: '등록일',
      width: '100px',
      sortable: true,
      className: 'cell-date',
      hideable: true,
      render: (value) => formatDate(value),
    },
    {
      key: 'SSH',
      label: 'SSH',
      width: '70px',
      align: 'center',
      hideable: true,
      render: (_, row) => (
        <button
          className="action-btn"
          title="SSH 접속"
          onClick={(e) => handleOpenSshTerminal(row, e)}
          style={{ color: '#38bdf8', fontSize: '16px', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px' }}
        >
          <i className="bi bi-terminal" />
        </button>
      ),
    },
    {
      key: 'STATUS',
      label: '상태',
      width: '60px',
      align: 'center',
      hideable: true,
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
  ], [deviceErrorMap, handleOpenSshTerminal]);

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
          <p style={{ color: 'var(--theme-text-tertiary, #94a3b8)' }}>로딩 중...</p>
        ) : (
          <div id="device-list-section" style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, minWidth: 0, overflow: 'hidden' }}>
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

            {/* 검색 필터 바 + 테이블 통합 */}
            <div className="table-panel">
              <div className="filter-bar">
                <div className="filter-group">
                  <label>장비코드</label>
                  <select
                    className="filter-select"
                    value={searchDevCode}
                    onChange={(e) => setSearchDevCode(e.target.value)}
                  >
                    <option value="">전체</option>
                    {devCodes.map((code) => (
                      <option key={code.DEV_CODE_ID} value={code.DEV_CODE_ID}>
                        {code.CODE_NM}
                      </option>
                    ))}
                  </select>
                </div>
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
              tableId="asset-devices"
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
              maxHeight="calc(100vh - 370px)"
              exportConfig={{
                fileName: '장비목록',
                excludeColumns: ['STATUS'],
                fetchAllData: async () => {
                  const res = await devicesApi.getDevicesByGroupPaged(
                    selectedGroup?.GROUP_ID, 1, 999999, 'DEVICE_ID', 'asc', true
                  );
                  const d = res.data?.data;
                  return Array.isArray(d) ? d : (d?.content || []);
                },
              }}
            />
            </div>
          </div>
        )}
        </main>
      </div>

      {/* 장비 상세 보기 모달 */}
      {detailDevice && (
        <div id="device-detail-modal" className="modal" style={{ display: 'flex' }} onClick={() => setDetailDevice(null)}>
          <div className="modal-content device-detail-modal" style={{ position: 'relative', overflow: 'hidden' }} onClick={(e) => e.stopPropagation()}>
            <span className="close-btn" onClick={() => setDetailDevice(null)}>&times;</span>

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
                                      type="number" min={0} max={t.MAX_VALUE || 100}
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
                          <span className="value">{detailDevice.DEVICE_SYSTEM_NAME || '-'}</span>
                        </div>
                        <div className="info-row">
                          <span className="label">시스템 설명</span>
                          <span className="value sys-descr-value">{detailDevice.DEVICE_DESC || detailDevice.sysDescr || '-'}</span>
                        </div>
                        <div className="info-row">
                          <span className="label">벤더</span>
                          <span className="value" style={{flex: '0 0 auto', marginRight: '16px'}}>{detailDevice.VENDOR_NAME || '-'}</span>
                          <span className="label" style={{flex: '0 0 auto', marginRight: '8px'}}>모델</span>
                          <span className="value">{detailDevice.MODEL_NAME || '-'}</span>
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
                    )}

                    {/* 온습도 (메트릭에 포함된 경우) */}
                    {(deviceMetrics.includes('TEMPERATURE') || deviceMetrics.includes('HUMIDITY')) && (
                      <EnvironmentBox deviceId={detailDevice?.DEVICE_ID} metrics={deviceMetrics} />
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
                                          onContextMenu={(e) => handlePortContextMenu(e, port)}
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
                                          onContextMenu={(e) => handlePortContextMenu(e, port)}
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
                                          onContextMenu={(e) => handlePortContextMenu(e, port)}
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
                            : 'OPER UP 포트 (포트 클릭으로 선택)'}
                        </span>
                        {trafficLoading && <i className="bi bi-arrow-repeat spinning" style={{marginLeft:'8px',fontSize:'11px',color:'#64748b'}}></i>}
                        <div className="global-settings-wrapper" ref={trafficSettingsRef}>
                          <button
                            className="btn btn-icon"
                            onClick={() => setShowTrafficSettings(prev => !prev)}
                            title="차트 설정"
                          >
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
              </div>
            )}

            {/* 포트 정보 탭 */}
            {activeTab === 'port-info' && (
              <div id="port-info-tab" className="detail-tab-content active">
                <DataTable
                  tableId="asset-ports"
                  columns={portColumns}
                  data={sortedPorts}
                  rowKey="IF_INDEX"
                  loading={portsLoading || allPortsLoading}
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
                  tableId="asset-faults"
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
                  exportConfig={{
                    fileName: `장애조회_${detailDevice?.DEVICE_NAME || ''}`,
                    excludeColumns: ['_isActive', 'actions'],
                    fetchAllData: async () => {
                      const [errRes, histRes] = await Promise.all([
                        faultApi.getErrors({ deviceId: detailDevice.DEVICE_ID }),
                        faultApi.getHistory({ page: 1, size: 999999, deviceId: detailDevice.DEVICE_ID, sortKey: faultSortField, sortDirection: faultSortOrder }),
                      ]);
                      const activeList = errRes.data?.data?.list || [];
                      const deviceActive = Array.isArray(activeList) ? activeList.filter(e => e.DEVICE_ID === detailDevice.DEVICE_ID) : [];
                      const histList = histRes.data?.data?.content || [];
                      return [...deviceActive.map(e => ({ ...e, _isActive: true })), ...histList];
                    },
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
                          <p><strong>장비:</strong> {detailDevice?.DEVICE_NAME} ({detailDevice?.DEVICE_IP})</p>
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
                        <button className="btn btn-secondary" onClick={() => setShowFaultAckModal(false)}>
                          취소
                        </button>
                        <button className="btn btn-primary" onClick={handleFaultAcknowledge}>
                          인지 처리
                        </button>
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
        }} onClick={() => { setShowMoveGroupModal(false); setTargetGroup(null); }}>
          <div className="modal-content" style={{
            maxWidth: '450px',
            width: '90%',
            background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.95) 0%, rgba(15, 23, 42, 0.98) 100%)',
            borderRadius: '16px',
            padding: '24px',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
            position: 'relative'
          }} onClick={(e) => e.stopPropagation()}>
            <span
              onClick={() => { setShowMoveGroupModal(false); setTargetGroup(null); }}
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                fontSize: '24px',
                color: 'var(--theme-text-tertiary, #94a3b8)',
                cursor: 'pointer',
                lineHeight: 1
              }}
            >&times;</span>
            <h3 style={{ marginBottom: '16px', color: 'var(--theme-text-primary, #f1f5f9)', fontSize: '18px' }}>
              <i className="bi bi-folder-symlink" style={{ marginRight: '8px' }}></i>
              그룹 이동
            </h3>
            <p style={{ color: 'var(--theme-text-tertiary, #94a3b8)', marginBottom: '16px', fontSize: '14px' }}>
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
                <i className="bi bi-folder2" style={{ color: 'var(--theme-accent-light, #60a5fa)' }}></i>
                <span style={{ color: 'var(--theme-text-secondary, #e2e8f0)', fontSize: '14px' }}>
                  선택: <strong>{targetGroup.GROUP_NAME}</strong>
                </span>
              </div>
            )}

            {/* 그룹 트리 */}
            <div style={{
              maxHeight: '300px',
              overflowY: 'auto',
              border: '1px solid var(--theme-border-default, rgba(255,255,255,0.1))',
              borderRadius: '8px',
              background: 'var(--theme-bg-panel, rgba(15, 23, 42, 0.6))',
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
        <div className="modal" style={{ display: 'flex' }} onClick={() => setShowSnmpModal(false)}>
          <div className="modal-content" style={{ maxWidth: '500px' }} onClick={(e) => e.stopPropagation()}>
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
                <h4 style={{ marginBottom: '12px', color: 'var(--theme-text-tertiary, #94a3b8)', fontSize: '14px' }}>SNMPv3 설정</h4>
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
                      type="text"
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
                      type="text"
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

      {/* SSH 접속 정보 미설정 안내 모달 */}
      {sshAlertDevice && (
        <div className="modal-overlay" onClick={() => setSshAlertDevice(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '420px', padding: 0 }}>
            <div style={{ padding: '32px 28px 20px', textAlign: 'center' }}>
              <div style={{
                width: 56, height: 56, borderRadius: '50%',
                background: 'rgba(251, 191, 36, 0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 16px',
              }}>
                <i className="bi bi-terminal" style={{ fontSize: 28, color: '#fbbf24' }} />
              </div>
              <h3 style={{ margin: '0 0 8px', fontSize: 17, color: 'var(--theme-text-secondary, #e2e8f0)' }}>
                SSH 접속 정보 없음
              </h3>
              <p style={{ margin: 0, color: 'var(--theme-text-tertiary, #94a3b8)', fontSize: 14, lineHeight: 1.6 }}>
                <strong style={{ color: 'var(--theme-text-secondary, #cbd5e1)' }}>{sshAlertDevice.DEVICE_NAME}</strong> ({sshAlertDevice.DEVICE_IP})의<br />
                SSH 접속 정보가 설정되지 않았습니다.
              </p>
              <p style={{ margin: '8px 0 0', color: 'var(--theme-text-muted, #64748b)', fontSize: 13 }}>
                장비 상세 &gt; 설정에서 SSH 정보를 입력해주세요.
              </p>
            </div>
            <div style={{ padding: '12px 28px 24px', display: 'flex', gap: 8, justifyContent: 'center' }}>
              <button className="btn btn-secondary" onClick={() => setSshAlertDevice(null)}>
                닫기
              </button>
              <button className="btn btn-primary" onClick={() => {
                setSshAlertDevice(null);
                setDetailDevice(sshAlertDevice);
                setShowSettingsSidebar(true);
              }}>
                <i className="bi bi-gear" style={{ marginRight: 4 }} />
                설정으로 이동
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SSH 터미널 모달 */}
      {sshTerminalDevice && sshTerminalInfo && (
        <SshTerminalModal
          device={sshTerminalDevice}
          sshInfo={sshTerminalInfo}
          onClose={() => {
            setSshTerminalDevice(null);
            setSshTerminalInfo(null);
          }}
        />
      )}

      {/* 포트 우클릭 컨텍스트 메뉴 */}
      {portContextMenu.visible && (
        <>
          <div className="port-ctx-backdrop" onClick={closePortContextMenu} />
          <div
            className="port-ctx-menu"
            style={{ top: portContextMenu.y, left: portContextMenu.x }}
          >
            <button className="port-ctx-item" onClick={() => handlePortCheck(portContextMenu.port)}>
              <i className="bi bi-activity" />
              포트 체크
            </button>
          </div>
        </>
      )}

      {/* 포트 상태 체크 결과 */}
      {portCheckResult.visible && (
        <div className="port-check-backdrop" onClick={() => setPortCheckResult(prev => ({ ...prev, visible: false }))}>
          <div className="port-check-card" onClick={e => e.stopPropagation()}>
            <div className="port-check-header">
              <span><i className="bi bi-ethernet" /> {portCheckResult.portName}</span>
              <button onClick={() => setPortCheckResult(prev => ({ ...prev, visible: false }))}>
                <i className="bi bi-x" />
              </button>
            </div>
            {portCheckResult.loading ? (
              <div className="port-check-loading">
                <div className="port-check-spinner" />
                SNMP 조회 중...
              </div>
            ) : portCheckResult.data ? (
              portCheckResult.data.success ? (
                <div className="port-check-body">
                  <div className="port-check-row">
                    <span className="port-check-label">Admin Status</span>
                    <span className={`port-check-badge ${portCheckResult.data.adminStatus === 1 ? 'up' : 'down'}`}>
                      {portCheckResult.data.adminStatusText}
                    </span>
                  </div>
                  <div className="port-check-row">
                    <span className="port-check-label">Oper Status</span>
                    <span className={`port-check-badge ${portCheckResult.data.operStatus === 1 ? 'up' : 'down'}`}>
                      {portCheckResult.data.operStatusText}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="port-check-error">
                  <i className="bi bi-exclamation-triangle" /> {portCheckResult.data.message || 'SNMP 조회 실패'}
                </div>
              )
            ) : null}
          </div>
        </div>
      )}

    </div>
  );
}

/* ===== 온습도 박스 (장비 정보 탭 내부, CPU/MEM 대체) ===== */
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
