import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import SafeECharts from './SafeECharts';
import { useDevice, useDevicePorts, useDeviceTrafficRaw, useDeviceScope, useUpdateDeviceScope, useUpdateDevice, useUpdatePort } from '../hooks/useDevices';
import { devicesApi } from '../api/devices';
import { faultApi } from '../api/fault';
import { sshSessionApi } from '../api/sshSession';
import apiClient from '../api/client';
import { diffLines } from 'diff';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import DataTable from '../components/DataTable';
import PortTrafficChart from '../components/PortTrafficChart';
import Pagination from '../components/Pagination';
import IpInput from './IpInput';
import SlotPortGrid, { SlotPortLegend } from './SlotPortGrid';
import { isValidIPv4 } from '../utils/validation';
import { useAlert } from './CustomAlert';
import '../styles/asset-management.css';
import EnvironmentBox from '../features/device-detail/components/EnvironmentBox';
import PortInfoTab from '../features/device-detail/components/PortInfoTab';
import FaultInfoTab from '../features/device-detail/components/FaultInfoTab';
import ChangeHistoryTab from '../features/device-detail/components/ChangeHistoryTab';
import SshHistoryTab from '../features/device-detail/components/SshHistoryTab';
import ConfigTab from '../features/device-detail/components/ConfigTab';
import DeviceInfoTab from '../features/device-detail/components/DeviceInfoTab';

export default function DeviceDetailModal({ deviceId, onClose, initialTab, initialErrorId }) {
  const { alert: showAlert, success: showSuccess, error: showError, warning: showWarning } = useAlert();

  // F11 토글 후 ECharts 내부 치수 재계산 강제 (delayed resize 재발행)
  useEffect(() => {
    const trigger = () => {
      setTimeout(() => window.dispatchEvent(new Event('resize')), 200);
    };
    document.addEventListener('fullscreenchange', trigger);
    return () => {
      document.removeEventListener('fullscreenchange', trigger);
    };
  }, []);

  const [activeTab, setActiveTab] = useState(initialTab || 'device-info');
  const focusErrorIdRef = useRef(initialErrorId || null);
  const [cpuMemData, setCpuMemData] = useState(null);
  const [chartPortsSet, setChartPortsSet] = useState(new Set());
  const [portSortField, setPortSortField] = useState('IF_INDEX');
  const [portSortOrder, setPortSortOrder] = useState('asc');
  const [deviceMetrics, setDeviceMetrics] = useState([]);

  // 포트 우클릭 → 컨텍스트 메뉴 → 포트 체크 (DOM 직접 렌더링, 모달 stacking context 회피)
  const handlePortContextMenu = useCallback((e, port) => {
    e.preventDefault();
    e.stopPropagation();
    const portalId = 'port-ctx-portal';
    document.getElementById(portalId)?.remove();

    const backdrop = document.createElement('div');
    backdrop.id = portalId;
    backdrop.style.cssText = 'position:fixed;inset:0;z-index:999999;';
    backdrop.onclick = () => backdrop.remove();

    // 컨텍스트 메뉴
    const menu = document.createElement('div');
    menu.style.cssText = `position:fixed;top:${e.clientY}px;left:${e.clientX}px;z-index:1000000;background:rgba(15,15,35,0.97);border:1px solid rgba(99,102,241,0.3);border-radius:8px;padding:4px;min-width:140px;box-shadow:0 8px 24px rgba(0,0,0,0.5);`;
    const btn = document.createElement('button');
    btn.style.cssText = 'display:flex;align-items:center;gap:8px;width:100%;padding:8px 12px;border:none;border-radius:6px;background:transparent;color:#e2e8f0;font-size:13px;cursor:pointer;';
    btn.innerHTML = '<i class="bi bi-activity"></i> 포트 체크';
    btn.onmouseenter = () => { btn.style.background = 'rgba(99,102,241,0.2)'; };
    btn.onmouseleave = () => { btn.style.background = 'transparent'; };
    btn.onclick = () => {
      backdrop.remove();
      showPortCheckResult(port);
    };
    menu.appendChild(btn);
    backdrop.appendChild(menu);
    document.body.appendChild(backdrop);
  }, [deviceId]);

  // 포트 체크 결과 표시 (DOM 직접 렌더링)
  const showPortCheckResult = useCallback((port) => {
    const portalId = 'port-check-portal';
    document.getElementById(portalId)?.remove();

    const portName = port.IF_NAME || port.IF_DESCR || `ifIndex ${port.IF_INDEX}`;
    const backdrop = document.createElement('div');
    backdrop.id = portalId;
    backdrop.style.cssText = 'position:fixed;inset:0;z-index:999999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.3);';
    backdrop.onclick = () => backdrop.remove();

    const card = document.createElement('div');
    card.style.cssText = 'background:rgba(15,23,42,0.95);border:1px solid rgba(99,102,241,0.2);border-radius:12px;padding:0;min-width:260px;box-shadow:0 12px 40px rgba(0,0,0,0.5);backdrop-filter:blur(12px);';
    card.onclick = (e) => e.stopPropagation();

    // 헤더
    const header = document.createElement('div');
    header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid rgba(148,163,184,0.1);';
    header.innerHTML = `<span style="color:#e2e8f0;font-size:14px;font-weight:600;"><i class="bi bi-ethernet" style="margin-right:6px;"></i>${portName}</span>`;
    const closeBtn = document.createElement('button');
    closeBtn.style.cssText = 'background:none;border:none;color:#64748b;font-size:18px;cursor:pointer;padding:0;line-height:1;';
    closeBtn.innerHTML = '<i class="bi bi-x"></i>';
    closeBtn.onclick = () => backdrop.remove();
    header.appendChild(closeBtn);
    card.appendChild(header);

    // 로딩
    const body = document.createElement('div');
    body.style.cssText = 'padding:16px;';
    body.innerHTML = '<div style="display:flex;align-items:center;gap:8px;color:#94a3b8;font-size:13px;"><div style="width:16px;height:16px;border:2px solid #6366f1;border-top-color:transparent;border-radius:50%;animation:spin 0.8s linear infinite;"></div>SNMP 조회 중...</div>';
    card.appendChild(body);
    backdrop.appendChild(card);
    document.body.appendChild(backdrop);

    // spin 애니메이션 (없으면 추가)
    if (!document.getElementById('port-check-spin-style')) {
      const style = document.createElement('style');
      style.id = 'port-check-spin-style';
      style.textContent = '@keyframes spin{to{transform:rotate(360deg)}}';
      document.head.appendChild(style);
    }

    // SNMP 조회
    devicesApi.checkPortStatus(deviceId, port.IF_INDEX)
      .then(res => {
        const d = res.data?.data;
        if (d?.success) {
          const badge = (status, text) => `<span style="padding:3px 10px;border-radius:6px;font-size:12px;font-weight:600;background:${status === 1 ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)'};color:${status === 1 ? '#34d399' : '#f87171'};">${text}</span>`;
          body.innerHTML = `
            <div style="display:flex;flex-direction:column;gap:10px;">
              <div style="display:flex;justify-content:space-between;align-items:center;">
                <span style="color:#94a3b8;font-size:13px;">Admin Status</span>
                ${badge(d.adminStatus, d.adminStatusText)}
              </div>
              <div style="display:flex;justify-content:space-between;align-items:center;">
                <span style="color:#94a3b8;font-size:13px;">Oper Status</span>
                ${badge(d.operStatus, d.operStatusText)}
              </div>
            </div>`;
        } else {
          body.innerHTML = `<div style="color:#f87171;font-size:13px;"><i class="bi bi-exclamation-triangle"></i> ${d?.message || 'SNMP 조회 실패'}</div>`;
        }
      })
      .catch(err => {
        body.innerHTML = `<div style="color:#f87171;font-size:13px;"><i class="bi bi-exclamation-triangle"></i> ${err.message}</div>`;
      });
  }, [deviceId]);

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
  const [faultPageReady, setFaultPageReady] = useState(!initialErrorId?.startsWith('hist_'));
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

  // SSH 세션 확장 상태 (세션 클릭 시 명령어 표시)
  const [expandedSessionId, setExpandedSessionId] = useState(null);
  const [sessionCommands, setSessionCommands] = useState([]);
  const [sessionCommandsLoading, setSessionCommandsLoading] = useState(false);

  // Config 탭 상태 - 2개 날짜 diff 비교 (AssetConfigDetail과 동일한 구조)
  const [configLeftDate, setConfigLeftDate] = useState('');
  const [configRightDate, setConfigRightDate] = useState('');
  const [configLeft, setConfigLeft] = useState('');
  const [configRight, setConfigRight] = useState('');
  const [configLoading, setConfigLoading] = useState(false);
  const [configDates, setConfigDates] = useState([]); // 이력 있는 날짜 목록 (YYYY-MM-DD)
  const [configShowOnlyChanges, setConfigShowOnlyChanges] = useState(false);
  const [configSyncScroll, setConfigSyncScroll] = useState(true);
  const configDatesInitialized = useRef(false);
  const configLeftPanelRef = useRef(null);
  const configRightPanelRef = useRef(null);
  const configIsScrollingRef = useRef(false);
  const configLeftDateRef = useRef(null);
  const configRightDateRef = useRef(null);

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

  // hist_* errorId인 경우 해당 페이지 계산 후 faultPage 설정
  useEffect(() => {
    if (!initialErrorId?.startsWith('hist_') || !deviceId) return;
    const histId = initialErrorId.replace('hist_', '');
    (async () => {
      try {
        const posRes = await faultApi.getHistoryPosition(histId, deviceId, faultPageSize);
        const targetPage = posRes.data?.data?.page || 1;
        setFaultPage(targetPage);
      } catch { /* 실패 시 1페이지 유지 */ }
      setFaultPageReady(true);
    })();
  }, []);

  // 장애 데이터 조회 (장애 탭 활성화 시)
  useEffect(() => {
    if (!deviceId || activeTab !== 'fault-info' || !faultPageReady) return;
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

        // initialErrorId로 전달된 장애 행 포커스
        if (focusErrorIdRef.current) {
          const faultRowId = focusErrorIdRef.current;
          focusErrorIdRef.current = null;
          setTimeout(() => {
            const targetRow = document.querySelector(`[data-fault-row="${faultRowId}"]`);
            if (targetRow) {
              targetRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
              targetRow.classList.add('fault-focus-row');
              setTimeout(() => targetRow.classList.remove('fault-focus-row'), 3000);
            }
          }, 200);
        }
      } catch {
        setFaultData([]);
      } finally {
        setFaultLoading(false);
      }
    };
    fetchFaults();
  }, [deviceId, activeTab, faultPage, faultPageSize, faultSortField, faultSortOrder, faultPageReady]);

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

  // deviceId 변경 시 Config 상태 리셋
  useEffect(() => {
    configDatesInitialized.current = false;
    setConfigDates([]);
    setConfigLeftDate('');
    setConfigRightDate('');
    setConfigLeft('');
    setConfigRight('');
  }, [deviceId]);

  // Config 탭 진입 시 날짜 목록 로드 + 초기 날짜 설정 (AssetConfigDetail 로직 동일)
  useEffect(() => {
    if (!deviceId || activeTab !== 'config' || configDatesInitialized.current) return;

    // 공통: 오늘/어제 계산
    const today = new Date().toISOString().split('T')[0];
    const yesterday = (() => {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      return d.toISOString().split('T')[0];
    })();

    // 먼저 기본값 설정 (API 실패 대비)
    setConfigRightDate(today);
    setConfigLeftDate(yesterday);
    configDatesInitialized.current = true;

    // 백엔드에서 수집 이력 날짜 조회 (있으면 초기값 조정)
    (async () => {
      try {
        const res = await apiClient.get(`/device-config/${deviceId}/dates`);
        const dates = res.data?.data || [];
        setConfigDates(dates);

        // rightDate = 오늘 (항상)
        // leftDate = 가장 최근 수집일이 오늘이 아니면 그 날짜, 오늘이면 dates[1] or 어제
        if (dates.length > 0 && dates[0] !== today) {
          setConfigLeftDate(dates[0]);
        } else if (dates.length > 1) {
          setConfigLeftDate(dates[1]);
        }
        // 그 외는 기본값(어제) 유지
      } catch {
        setConfigDates([]);
      }
    })();
  }, [deviceId, activeTab]);

  // Config 데이터 조회 (2개 날짜 병렬)
  useEffect(() => {
    if (!deviceId || activeTab !== 'config' || !configLeftDate || !configRightDate) return;
    const fetchConfig = async () => {
      setConfigLoading(true);
      try {
        const [leftRes, rightRes] = await Promise.all([
          apiClient.get(`/device-config/${deviceId}`, { params: { date: configLeftDate } }).catch(() => ({})),
          apiClient.get(`/device-config/${deviceId}`, { params: { date: configRightDate } }).catch(() => ({})),
        ]);
        setConfigLeft(leftRes?.data?.data?.config || '');
        setConfigRight(rightRes?.data?.data?.config || '');
      } catch {
        setConfigLeft('');
        setConfigRight('');
      } finally {
        setConfigLoading(false);
      }
    };
    fetchConfig();
  }, [deviceId, activeTab, configLeftDate, configRightDate]);

  // Config diff 계산
  const configDiff = useMemo(() => {
    if (!configLeft && !configRight) return [];
    return diffLines(configLeft || '', configRight || '');
  }, [configLeft, configRight]);

  // Config 변경 통계
  const configDiffStats = useMemo(() => {
    let added = 0, removed = 0, unchanged = 0;
    configDiff.forEach(part => {
      const lines = part.value.split('\n').filter(l => l.length > 0).length;
      if (part.added) added += lines;
      else if (part.removed) removed += lines;
      else unchanged += lines;
    });
    return { added, removed, unchanged, total: added + removed };
  }, [configDiff]);

  // 날짜 라벨 포맷 (오늘/어제/날짜)
  const formatConfigDateLabel = (dateStr) => {
    if (!dateStr) return '';
    const today = new Date().toISOString().split('T')[0];
    const yesterday = (() => {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      return d.toISOString().split('T')[0];
    })();
    if (dateStr === today) return '오늘';
    if (dateStr === yesterday) return '어제';
    const dt = new Date(dateStr);
    return dt.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
  };

  // Config 스크롤 동기화
  const handleConfigScroll = (source) => {
    if (!configSyncScroll || configIsScrollingRef.current) return;
    configIsScrollingRef.current = true;
    const src = source === 'left' ? configLeftPanelRef.current : configRightPanelRef.current;
    const tgt = source === 'left' ? configRightPanelRef.current : configLeftPanelRef.current;
    if (src && tgt) {
      tgt.scrollTop = src.scrollTop;
      tgt.scrollLeft = src.scrollLeft;
    }
    requestAnimationFrame(() => { configIsScrollingRef.current = false; });
  };

  // SSH 세션 명령어 조회 (확장 시)
  const toggleSessionExpand = async (sessionId) => {
    if (expandedSessionId === sessionId) {
      setExpandedSessionId(null);
      setSessionCommands([]);
      return;
    }
    setExpandedSessionId(sessionId);
    setSessionCommandsLoading(true);
    try {
      const res = await sshSessionApi.getCommands(sessionId, { page: 1, size: 100 });
      const data = res.data?.data || {};
      setSessionCommands(data.content || []);
    } catch {
      setSessionCommands([]);
    } finally {
      setSessionCommandsLoading(false);
    }
  };

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
      showError('수집 설정 업데이트에 실패했습니다.');
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
    const ip = (editFormData.DEVICE_IP || '').trim();
    if (!ip) {
      showWarning('IP를 입력하세요.');
      return;
    }
    if (!isValidIPv4(ip)) {
      showWarning(`유효하지 않은 IP 주소입니다: ${ip}\n예: 192.168.1.10 (각 옥텟 0~255)`);
      return;
    }
    setEditSaving(true);
    try {
      await updateDeviceMutation.mutateAsync({
        deviceId: device.DEVICE_ID || deviceId,
        data: editFormData
      });
      showSuccess('장비 정보가 저장되었습니다.');
    } catch (error) {
      console.error('장비 수정 오류:', error);
      showError('장비 수정에 실패했습니다: ' + (error.response?.data?.message || error.message));
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
      showError('설정 저장에 실패했습니다: ' + (error.response?.data?.message || error.message));
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
      showError('포트 정보 업데이트에 실패했습니다.');
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
      showError('인지 처리에 실패했습니다.');
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
            <button className={`detail-tab ${activeTab === 'config' ? 'active' : ''}`} onClick={() => setActiveTab('config')}>
              <i className="bi bi-file-earmark-code"></i> Config
            </button>
          </div>
        </div>

        {/* 장비 정보 탭 - 2열 레이아웃 (인라인 편집) */}
        {activeTab === 'device-info' && (
          <DeviceInfoTab
            deviceLoading={deviceLoading}
            device={device}
            deviceId={deviceId}
            hasEditChanges={hasEditChanges}
            handleSaveDevice={handleSaveDevice}
            editSaving={editSaving}
            handleOpenSettingsSidebar={handleOpenSettingsSidebar}
            editFormData={editFormData}
            setEditFormData={setEditFormData}
            deviceMetrics={deviceMetrics}
            cpuMemData={cpuMemData}
            trafficRawData={trafficRawData}
            portsData={portsData}
            chartPortsSet={chartPortsSet}
            handlePortContextMenu={handlePortContextMenu}
            handleToggleChartPort={handleToggleChartPort}
            trafficChartSettings={trafficChartSettings}
            trafficLoading={trafficLoading}
            switchLayout={switchLayout}
          />
        )}

        {activeTab === 'port-info' && (
          <PortInfoTab
            columns={portColumns}
            data={sortedPorts}
            loading={portsLoading}
            sort={{ field: portSortField, order: portSortOrder }}
            onSort={handlePortSort}
          />
        )}

        {activeTab === 'fault-info' && (
          <FaultInfoTab
            columns={faultColumns}
            data={faultData}
            loading={faultLoading}
            sort={{ field: faultSortField, order: faultSortOrder }}
            onSort={handleFaultSort}
            pageState={{
              page: faultPage,
              pageSize: faultPageSize,
              total: faultTotal,
              onPageChange: setFaultPage,
              onPageSizeChange: (size) => { setFaultPageSize(size); setFaultPage(1); },
            }}
            setPageState={{
              onPageChange: setFaultPage,
              onPageSizeChange: (size) => { setFaultPageSize(size); setFaultPage(1); },
            }}
            ackModal={{
              open: showFaultAckModal,
              onClose: () => setShowFaultAckModal(false),
            }}
            device={device}
            selectedError={selectedFaultError}
            ackMessage={faultAckMessage}
            onAckMessageChange={setFaultAckMessage}
            onAcknowledge={handleFaultAcknowledge}
          />
        )}

        {activeTab === 'change-history' && (
          <ChangeHistoryTab
            loading={changeHistoryLoading}
            history={changeHistory}
            total={changeHistoryTotal}
            page={changeHistoryPage}
            onPageChange={setChangeHistoryPage}
          />
        )}

        {/* SSH이력 탭 */}
        {activeTab === 'ssh-history' && (
          <SshHistoryTab
            loading={sshHistoryLoading}
            history={sshHistory}
            expandedSessionId={expandedSessionId}
            onToggleExpand={toggleSessionExpand}
            sessionCommands={sessionCommands}
            sessionCommandsLoading={sessionCommandsLoading}
            page={sshHistoryPage}
            total={sshHistoryTotal}
            onPageChange={setSshHistoryPage}
          />
        )}

        {activeTab === 'config' && (
          <ConfigTab
            configDiffStats={configDiffStats}
            configSyncScroll={configSyncScroll}
            setConfigSyncScroll={setConfigSyncScroll}
            configLeftDateRef={configLeftDateRef}
            configLeftDate={configLeftDate}
            setConfigLeftDate={setConfigLeftDate}
            configRightDate={configRightDate}
            configLeftPanelRef={configLeftPanelRef}
            handleConfigScroll={handleConfigScroll}
            configLeft={configLeft}
            configRight={configRight}
            configDates={configDates}
            configShowOnlyChanges={configShowOnlyChanges}
            setConfigShowOnlyChanges={setConfigShowOnlyChanges}
            formatConfigDateLabel={formatConfigDateLabel}
            configRightDateRef={configRightDateRef}
            setConfigRightDate={setConfigRightDate}
            configRightPanelRef={configRightPanelRef}
            configLoading={configLoading}
            configDiff={configDiff}
          />
        )}
      </div>
    </div>
  );
}

