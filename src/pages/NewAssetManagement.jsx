import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import GroupTree from '../components/GroupTree';
import apiClient from '../api/client';
import { devicesApi, groupsApi } from '../api';

export default function NewAssetManagement() {
  const queryClient = useQueryClient();
  const [devices, setDevices] = useState([]);
  const [allGroups, setAllGroups] = useState([]); // 전체 그룹 목록 (flat)
  const [selectedDeviceIds, setSelectedDeviceIds] = useState(new Set()); // 선택된 장비 ID

  // 그룹 선택 모달 상태
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [groupModalTarget, setGroupModalTarget] = useState(null); // 'bulk' 또는 device.id
  const [tempSelectedGroup, setTempSelectedGroup] = useState(null);

  // 페이지 이탈 시 저장을 위한 ref (최신 상태 참조)
  const devicesRef = useRef(devices);

  // ref 최신화
  useEffect(() => {
    devicesRef.current = devices;
  }, [devices]);

  const [formData, setFormData] = useState({
    DEVICE_NAME: '',
    DEVICE_IP: '',
    SNMP_VERSION: 2,
    SNMP_PORT: 161,
    SNMP_COMMUNITY: 'public',
    SNMP_USER: '',
    SNMP_AUTH_PROTOCOL: '',
    SNMP_AUTH_PASSWORD: '',
    SNMP_PRIV_PROTOCOL: '',
    SNMP_PRIV_PASSWORD: '',
    // 수집 설정 (중복 체크 가능, 우선순위: SNMP > AGENT > PING)
    COLLECT_PING: false,
    COLLECT_SNMP: true,
    COLLECT_AGENT: false,
  });
  const [isRegistering, setIsRegistering] = useState(false);
  const [resultModal, setResultModal] = useState(null);
  // 실시간 등록 진행 상태
  const [registrationProgress, setRegistrationProgress] = useState(null);
  const fileInputRef = useRef(null);

  // IP 주소 검증 에러
  const [ipError, setIpError] = useState('');

  // IP 주소 정규식 검증
  const isValidIp = (ip) => {
    if (!ip) return false;
    const ipv4Regex = /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    return ipv4Regex.test(ip);
  };

  // 성공 목록 정렬 상태 (기본: 장비명 오름차순)
  const [successSortField, setSuccessSortField] = useState('deviceName');
  const [successSortOrder, setSuccessSortOrder] = useState('asc');

  // 실패 목록 정렬 상태 (기본: 장비명 오름차순)
  const [failureSortField, setFailureSortField] = useState('deviceName');
  const [failureSortOrder, setFailureSortOrder] = useState('asc');

  // 그룹 트리를 flat 배열로 변환
  const flattenGroups = useCallback((groups, result = []) => {
    if (!groups) return result;
    for (const group of groups) {
      result.push({ GROUP_ID: group.GROUP_ID, GROUP_NAME: group.GROUP_NAME });
      if (group.children && group.children.length > 0) {
        flattenGroups(group.children, result);
      }
    }
    return result;
  }, []);

  // 전체 그룹 목록 로드
  const loadAllGroups = useCallback(async () => {
    try {
      const response = await groupsApi.getGroupTree();
      const tree = response.data?.data || response.data || [];
      const flat = flattenGroups(tree);
      setAllGroups(flat);
    } catch (error) {
      console.error('그룹 목록 로드 오류:', error);
      setAllGroups([]);
    }
  }, [flattenGroups]);

  // 전체 임시 장비 목록 로드
  const loadAllTempDevices = useCallback(async () => {
    try {
      const response = await devicesApi.getAllTempDevices();
      const data = response.data?.data || response.data || [];
      const tempDevices = (Array.isArray(data) ? data : []).map((d) => ({
        ...d,
        id: d.TEMP_DEVICE_ID || Date.now() + Math.random(),
      }));
      setDevices(tempDevices);
    } catch (error) {
      console.error('임시 장비 로드 오류:', error);
      setDevices([]);
    }
  }, []);

  // 페이지 마운트 시 전체 임시 장비 + 그룹 목록 로드
  useEffect(() => {
    loadAllTempDevices();
    loadAllGroups();
  }, [loadAllTempDevices, loadAllGroups]);

  // 단일 장비 즉시 서버 저장 (추가 시 바로 DB 저장)
  const saveDeviceToServer = useCallback(async (device) => {
    try {
      const deviceToSave = {
        GROUP_ID: device.GROUP_ID || null,
        DEVICE_NAME: device.DEVICE_NAME,
        DEVICE_IP: device.DEVICE_IP,
        SNMP_VERSION: device.SNMP_VERSION,
        SNMP_PORT: device.SNMP_PORT,
        SNMP_COMMUNITY: device.SNMP_COMMUNITY || null,
        SNMP_USER: device.SNMP_USER || null,
        SNMP_AUTH_PROTOCOL: device.SNMP_AUTH_PROTOCOL || null,
        SNMP_AUTH_PASSWORD: device.SNMP_AUTH_PASSWORD || null,
        SNMP_PRIV_PROTOCOL: device.SNMP_PRIV_PROTOCOL || null,
        SNMP_PRIV_PASSWORD: device.SNMP_PRIV_PASSWORD || null,
      };
      const response = await devicesApi.createTempDevices([deviceToSave]);
      const savedDevices = response.data?.data || response.data || [];
      return savedDevices.length > 0 ? savedDevices[0].TEMP_DEVICE_ID : null;
    } catch (error) {
      console.error('임시 장비 저장 오류:', error);
      return null;
    }
  }, []);

  // 페이지 이탈 시 (다른 페이지 이동 - cleanup만)
  useEffect(() => {
    return () => {
      // 컴포넌트 언마운트 시 추가 작업 필요 없음 (이미 즉시 저장됨)
    };
  }, []);

  // 그룹명 조회
  const getGroupName = useCallback((groupId) => {
    if (!groupId) return '미지정';
    const group = allGroups.find((g) => g.GROUP_ID === groupId);
    return group?.GROUP_NAME || '미지정';
  }, [allGroups]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === 'SNMP_VERSION' || name === 'SNMP_PORT' ? parseInt(value) : value,
    }));
    // IP 주소 입력 시 에러 클리어
    if (name === 'DEVICE_IP') {
      setIpError('');
    }
  };

  // 장비 추가 (서버 측 중복 검증 포함)
  const handleAddDevice = async () => {
    if (!formData.DEVICE_NAME || !formData.DEVICE_IP) {
      alert('장비명과 IP 주소는 필수입니다.');
      return;
    }

    // IP 주소 형식 검증
    if (!isValidIp(formData.DEVICE_IP)) {
      setIpError('올바른 IP 주소를 입력해주세요 (예: 192.168.1.1)');
      return;
    }

    // 현재 목록에서 중복 검사
    if (devices.some((d) => d.DEVICE_IP === formData.DEVICE_IP)) {
      alert(`IP 주소 ${formData.DEVICE_IP}는 이미 목록에 있습니다.`);
      return;
    }

    // 서버 측 중복 IP 검증
    try {
      const response = await devicesApi.validateDevices([{ DEVICE_IP: formData.DEVICE_IP }]);
      const validDevices = response.data?.data || [];
      if (validDevices.length === 0) {
        alert(`IP 주소 ${formData.DEVICE_IP}는 이미 DB에 등록된 장비입니다.`);
        return;
      }
    } catch (error) {
      console.error('중복 검증 오류:', error);
    }

    const newDevice = {
      ...formData,
      id: Date.now(),
      GROUP_ID: null, // 그룹은 목록에서 설정
    };

    // 즉시 서버에 저장
    const tempDeviceId = await saveDeviceToServer(newDevice);
    if (tempDeviceId) {
      newDevice.TEMP_DEVICE_ID = tempDeviceId;
    }

    setDevices((prev) => [...prev, newDevice]);
    setFormData((prev) => ({
      DEVICE_NAME: '',
      DEVICE_IP: '',
      SNMP_VERSION: 2,
      SNMP_PORT: 161,
      SNMP_COMMUNITY: 'public',
      SNMP_USER: '',
      SNMP_AUTH_PROTOCOL: '',
      SNMP_AUTH_PASSWORD: '',
      SNMP_PRIV_PROTOCOL: '',
      SNMP_PRIV_PASSWORD: '',
      // 수집 설정은 이전 값 유지
      COLLECT_PING: prev.COLLECT_PING,
      COLLECT_SNMP: prev.COLLECT_SNMP,
      COLLECT_AGENT: prev.COLLECT_AGENT,
    }));
  };

  // 장비 삭제 (TEMP 테이블에서도 삭제)
  const handleRemoveDevice = async (id) => {
    const deviceToRemove = devices.find((d) => d.id === id);

    // TEMP_DEVICE_ID가 있으면 서버에서도 삭제
    if (deviceToRemove?.TEMP_DEVICE_ID) {
      try {
        await devicesApi.deleteTempDevices([deviceToRemove.TEMP_DEVICE_ID]);
      } catch (error) {
        console.error('임시 장비 삭제 오류:', error);
      }
    }

    setDevices((prev) => prev.filter((d) => d.id !== id));
  };

  // 테이블 내 장비 수정
  const handleDeviceChange = (id, field, value) => {
    setDevices((prev) =>
      prev.map((d) => {
        if (d.id === id) {
          const updated = { ...d, [field]: value };
          // SNMP 버전 변경 시 정수로 변환
          if (field === 'SNMP_VERSION') {
            updated.SNMP_VERSION = parseInt(value);
          }
          if (field === 'SNMP_PORT') {
            updated.SNMP_PORT = parseInt(value);
          }
          return updated;
        }
        return d;
      })
    );
  };

  // 장비 선택 토글
  const toggleDeviceSelection = (id) => {
    setSelectedDeviceIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // 전체 선택/해제
  const toggleSelectAll = () => {
    if (selectedDeviceIds.size === devices.length) {
      setSelectedDeviceIds(new Set());
    } else {
      setSelectedDeviceIds(new Set(devices.map((d) => d.id)));
    }
  };

  // 그룹 선택 모달 열기 (일괄)
  const openBulkGroupModal = () => {
    if (selectedDeviceIds.size === 0) {
      alert('장비를 선택해주세요.');
      return;
    }
    setGroupModalTarget('bulk');
    setTempSelectedGroup(null);
    setShowGroupModal(true);
  };

  // 그룹 선택 모달 열기 (개별)
  const openSingleGroupModal = (deviceId) => {
    const device = devices.find((d) => d.id === deviceId);
    setGroupModalTarget(deviceId);
    setTempSelectedGroup(device?.GROUP_ID ? { GROUP_ID: device.GROUP_ID, GROUP_NAME: getGroupName(device.GROUP_ID) } : null);
    setShowGroupModal(true);
  };

  // 그룹 선택 확인
  const handleGroupModalConfirm = async () => {
    if (!tempSelectedGroup) {
      alert('그룹을 선택해주세요.');
      return;
    }

    const groupId = tempSelectedGroup.GROUP_ID;

    if (groupModalTarget === 'bulk') {
      // 일괄 지정
      const selectedDevicesList = devices.filter((d) => selectedDeviceIds.has(d.id));

      setDevices((prev) =>
        prev.map((d) => (selectedDeviceIds.has(d.id) ? { ...d, GROUP_ID: groupId } : d))
      );

      // 서버에 저장된 장비들 업데이트
      const serverDevices = selectedDevicesList.filter((d) => d.TEMP_DEVICE_ID);
      for (const device of serverDevices) {
        try {
          await devicesApi.updateTempDevice(device.TEMP_DEVICE_ID, { ...device, GROUP_ID: groupId });
        } catch (error) {
          console.error(`그룹 변경 오류 (${device.DEVICE_NAME}):`, error);
        }
      }

      alert(`${selectedDeviceIds.size}개 장비의 그룹이 변경되었습니다.`);
      setSelectedDeviceIds(new Set());
    } else {
      // 개별 지정
      const device = devices.find((d) => d.id === groupModalTarget);

      setDevices((prev) =>
        prev.map((d) => (d.id === groupModalTarget ? { ...d, GROUP_ID: groupId } : d))
      );

      if (device?.TEMP_DEVICE_ID) {
        try {
          await devicesApi.updateTempDevice(device.TEMP_DEVICE_ID, { ...device, GROUP_ID: groupId });
        } catch (error) {
          console.error('그룹 변경 오류:', error);
        }
      }
    }

    setShowGroupModal(false);
    setGroupModalTarget(null);
    setTempSelectedGroup(null);
  };

  // 그룹 선택 모달 닫기
  const closeGroupModal = () => {
    setShowGroupModal(false);
    setGroupModalTarget(null);
    setTempSelectedGroup(null);
  };

  // 엑셀 업로드
  const handleExcelUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const arrayBuffer = event.target.result;
      const uint8Array = new Uint8Array(arrayBuffer);

      let csvData;
      try {
        const decoder = new TextDecoder('utf-8');
        csvData = decoder.decode(uint8Array);

        if (csvData.includes('\ufffd') || csvData.includes('�')) {
          const euckrDecoder = new TextDecoder('euc-kr');
          csvData = euckrDecoder.decode(uint8Array);
        }
      } catch (error) {
        const decoder = new TextDecoder('utf-8');
        csvData = decoder.decode(uint8Array);
      }

      parseCsvAndAddDevices(csvData);
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  // CSV 파싱 (서버 측 중복 검증 포함)
  const parseCsvAndAddDevices = async (csvData) => {
    const lines = csvData.split('\n').filter((line) => line.trim());
    if (lines.length < 2) {
      alert('유효한 CSV 파일이 아닙니다.');
      return;
    }

    const newDevices = [];
    const localDuplicates = [];
    const invalidIps = [];

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map((col) => col.trim());
      if (cols.length < 4) continue;

      const deviceIp = cols[1];

      // IP 주소 형식 검증
      if (!isValidIp(deviceIp)) {
        invalidIps.push(deviceIp);
        continue;
      }

      // 현재 목록 내 중복 검사
      if (devices.some((d) => d.DEVICE_IP === deviceIp) || newDevices.some((d) => d.DEVICE_IP === deviceIp)) {
        localDuplicates.push(deviceIp);
        continue;
      }

      const snmpVersion = parseInt(cols[2]) || 2;

      const device = {
        DEVICE_NAME: cols[0],
        DEVICE_IP: deviceIp,
        SNMP_VERSION: snmpVersion,
        SNMP_PORT: parseInt(cols[3]) || 161,
        GROUP_ID: null, // 그룹은 목록에서 설정
        SNMP_COMMUNITY: '',
        SNMP_USER: '',
        SNMP_AUTH_PROTOCOL: '',
        SNMP_AUTH_PASSWORD: '',
        SNMP_PRIV_PROTOCOL: '',
        SNMP_PRIV_PASSWORD: '',
        // 수집 설정 (CSV 컬럼 10:PING, 11:SNMP, 12:AGENT - 중복 체크 가능)
        COLLECT_PING: cols[10] === '1',
        COLLECT_SNMP: cols[11] === '1',
        COLLECT_AGENT: cols[12] === '1',
      };

      if (snmpVersion === 1 || snmpVersion === 2) {
        device.SNMP_COMMUNITY = cols[4] || 'public';
      }

      if (snmpVersion === 3 && cols.length >= 10) {
        device.SNMP_USER = cols[5] || '';
        device.SNMP_AUTH_PROTOCOL = cols[6] || '';
        device.SNMP_AUTH_PASSWORD = cols[7] || '';
        device.SNMP_PRIV_PROTOCOL = cols[8] || '';
        device.SNMP_PRIV_PASSWORD = cols[9] || '';
      }

      newDevices.push(device);
    }

    if (newDevices.length === 0) {
      const messages = [];
      if (localDuplicates.length > 0) {
        messages.push(`중복된 IP: ${localDuplicates.length}개`);
      }
      if (invalidIps.length > 0) {
        messages.push(`유효하지 않은 IP: ${invalidIps.length}개`);
      }
      if (messages.length > 0) {
        alert(`추가할 수 있는 장비가 없습니다.\n${messages.join('\n')}`);
      } else {
        alert('추가할 수 있는 장비가 없습니다.');
      }
      return;
    }

    // 서버 측 중복 검증 (DB의 기존 장비 및 임시 장비와 비교)
    try {
      const response = await devicesApi.validateDevices(newDevices);
      const validDevices = response.data?.data || [];

      if (validDevices.length === 0) {
        alert('모든 장비가 이미 등록되어 있어 추가할 수 없습니다.');
        return;
      }

      // 유효한 장비에 고유 id 부여 후 서버에 즉시 저장
      const devicesToAdd = validDevices.map((d, idx) => ({
        ...d,
        id: Date.now() + idx,
      }));

      // 서버에 일괄 저장
      try {
        const saveResponse = await devicesApi.createTempDevices(devicesToAdd);
        const savedDevices = saveResponse.data?.data || saveResponse.data || [];
        // 저장된 TEMP_DEVICE_ID를 매핑
        devicesToAdd.forEach((d, idx) => {
          if (savedDevices[idx]?.TEMP_DEVICE_ID) {
            d.TEMP_DEVICE_ID = savedDevices[idx].TEMP_DEVICE_ID;
          }
        });
      } catch (saveError) {
        console.error('CSV 장비 저장 오류:', saveError);
      }

      setDevices((prev) => [...prev, ...devicesToAdd]);

      const serverDuplicateCount = newDevices.length - validDevices.length;
      const totalDuplicates = localDuplicates.length + serverDuplicateCount;
      const excludedMessages = [];

      if (totalDuplicates > 0) {
        excludedMessages.push(`중복된 IP: ${totalDuplicates}개`);
      }
      if (invalidIps.length > 0) {
        excludedMessages.push(`유효하지 않은 IP: ${invalidIps.length}개`);
      }

      if (excludedMessages.length > 0) {
        alert(`${validDevices.length}개의 장비가 추가되었습니다.\n\n제외된 항목:\n${excludedMessages.join('\n')}`);
      } else {
        alert(`${validDevices.length}개의 장비가 추가되었습니다.`);
      }
    } catch (error) {
      console.error('CSV 업로드 검증 오류:', error);
      alert('장비 검증 중 오류가 발생했습니다.');
    }
  };

  // 일괄 등록 (실시간 진행 표시)
  const handleRegisterAll = async () => {
    if (devices.length === 0) {
      alert('등록할 장비가 없습니다.');
      return;
    }

    // 그룹 미지정 장비 체크
    const devicesWithoutGroup = devices.filter((d) => !d.GROUP_ID);
    if (devicesWithoutGroup.length > 0) {
      alert(`그룹이 지정되지 않은 장비가 ${devicesWithoutGroup.length}개 있습니다.\n모든 장비에 그룹을 지정해주세요.`);
      return;
    }

    if (!confirm(`${devices.length}개의 장비 등록을 시작하시겠습니까?`)) {
      return;
    }

    setIsRegistering(true);

    // 실시간 진행 상태 초기화
    setRegistrationProgress({
      total: devices.length,
      current: 0,
      successList: [],
      failureList: [],
      isComplete: false,
    });

    const processedIps = new Set();

    for (let i = 0; i < devices.length; i++) {
      const device = devices[i];

      // 진행 상태 업데이트 (현재 처리 중인 장비)
      setRegistrationProgress((prev) => ({
        ...prev,
        current: i + 1,
        currentDevice: device.DEVICE_NAME,
      }));

      try {
        const response = await apiClient.post('/mgmt/devices/direct', {
          DEVICE_NAME: device.DEVICE_NAME,
          DEVICE_IP: device.DEVICE_IP,
          SNMP_VERSION: device.SNMP_VERSION,
          SNMP_PORT: device.SNMP_PORT,
          SNMP_COMMUNITY: device.SNMP_COMMUNITY || null,
          SNMP_USER: device.SNMP_USER || null,
          SNMP_AUTH_PROTOCOL: device.SNMP_AUTH_PROTOCOL || null,
          SNMP_AUTH_PASSWORD: device.SNMP_AUTH_PASSWORD || null,
          SNMP_PRIV_PROTOCOL: device.SNMP_PRIV_PROTOCOL || null,
          SNMP_PRIV_PASSWORD: device.SNMP_PRIV_PASSWORD || null,
          GROUP_ID: device.GROUP_ID,
          // 수집 설정 (사용자가 선택한 값 그대로 전달)
          COLLECT_PING: device.COLLECT_PING === true,
          COLLECT_SNMP: device.COLLECT_SNMP === true,
          COLLECT_AGENT: device.COLLECT_AGENT === true,
        });

        const data = response.data?.data || response.data;

        if (data.successList && data.successList.length > 0) {
          // 실시간으로 성공 목록에 추가
          setRegistrationProgress((prev) => ({
            ...prev,
            successList: [...prev.successList, ...data.successList],
          }));
          processedIps.add(device.DEVICE_IP);
        } else if (data.failureList && data.failureList.length > 0) {
          // 실시간으로 실패 목록에 추가
          setRegistrationProgress((prev) => ({
            ...prev,
            failureList: [...prev.failureList, ...data.failureList],
          }));
        }
      } catch (error) {
        // 실시간으로 실패 목록에 추가
        setRegistrationProgress((prev) => ({
          ...prev,
          failureList: [
            ...prev.failureList,
            {
              deviceName: device.DEVICE_NAME,
              deviceIp: device.DEVICE_IP,
              errorMessage: error.response?.data?.message || error.message,
            },
          ],
        }));
      }
    }

    // 성공한 장비의 TEMP_DEVICE_ID 수집 (TEMP 테이블에서 삭제용)
    const successfulTempIds = devices
      .filter((d) => processedIps.has(d.DEVICE_IP) && d.TEMP_DEVICE_ID)
      .map((d) => d.TEMP_DEVICE_ID);

    // TEMP 테이블에서 성공한 장비 삭제
    if (successfulTempIds.length > 0) {
      try {
        await devicesApi.deleteTempDevices(successfulTempIds);
        console.log(`${successfulTempIds.length}개 임시 장비 삭제됨`);
      } catch (error) {
        console.error('임시 장비 삭제 오류:', error);
      }
    }

    // 서버에서 전체 임시 장비 목록 다시 로드 (실패한 장비들이 TEMP_DEVICE_ID를 갖도록)
    await loadAllTempDevices();

    // 완료 표시
    setRegistrationProgress((prev) => ({
      ...prev,
      isComplete: true,
      currentDevice: null,
    }));

    // 자산 관리 페이지로 이동 시 캐시 갱신을 위해 devices 캐시 무효화
    if (processedIps.size > 0) {
      queryClient.invalidateQueries({ queryKey: ['devices'] });
    }

    setIsRegistering(false);
  };

  // 진행 모달 닫기
  const closeProgressModal = () => {
    setRegistrationProgress(null);
  };

  const getSnmpVersionLabel = (version) => {
    const labels = { 1: 'v1', 2: 'v2c', 3: 'v3' };
    return labels[version] || version;
  };

  // 성공 목록 정렬 로직
  const sortedSuccessList = useMemo(() => {
    if (!registrationProgress?.successList?.length) return [];
    return [...registrationProgress.successList].sort((a, b) => {
      let aVal = a[successSortField];
      let bVal = b[successSortField];

      if (aVal == null) aVal = '';
      if (bVal == null) bVal = '';

      const strA = String(aVal).toLowerCase();
      const strB = String(bVal).toLowerCase();
      if (successSortOrder === 'asc') {
        return strA.localeCompare(strB, 'ko');
      }
      return strB.localeCompare(strA, 'ko');
    });
  }, [registrationProgress?.successList, successSortField, successSortOrder]);

  // 실패 목록 정렬 로직
  const sortedFailureList = useMemo(() => {
    if (!registrationProgress?.failureList?.length) return [];
    return [...registrationProgress.failureList].sort((a, b) => {
      let aVal = a[failureSortField];
      let bVal = b[failureSortField];

      if (aVal == null) aVal = '';
      if (bVal == null) bVal = '';

      const strA = String(aVal).toLowerCase();
      const strB = String(bVal).toLowerCase();
      if (failureSortOrder === 'asc') {
        return strA.localeCompare(strB, 'ko');
      }
      return strB.localeCompare(strA, 'ko');
    });
  }, [registrationProgress?.failureList, failureSortField, failureSortOrder]);

  // 성공 목록 정렬 핸들러
  const handleSuccessSort = (field) => {
    if (successSortField === field) {
      setSuccessSortOrder(successSortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSuccessSortField(field);
      setSuccessSortOrder('asc');
    }
  };

  // 실패 목록 정렬 핸들러
  const handleFailureSort = (field) => {
    if (failureSortField === field) {
      setFailureSortOrder(failureSortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setFailureSortField(field);
      setFailureSortOrder('asc');
    }
  };

  // 정렬 아이콘 렌더링 함수
  const renderSortIcon = (field, currentSortField, currentSortOrder) => {
    if (currentSortField !== field) {
      return <i className="bi bi-chevron-expand sort-icon inactive"></i>;
    }
    return currentSortOrder === 'asc'
      ? <i className="bi bi-chevron-up sort-icon active"></i>
      : <i className="bi bi-chevron-down sort-icon active"></i>;
  };

  // CSV 템플릿 다운로드
  const downloadCsvTemplate = () => {
    const headers = [
      '장비명',
      'IP주소',
      'SNMP버전',
      '포트',
      '커뮤니티',
      '사용자',
      '인증프로토콜',
      '인증비밀번호',
      '암호화프로토콜',
      '암호화비밀번호',
      'COLLECT_PING',
      'COLLECT_SNMP',
      'COLLECT_AGENT'
    ];

    const exampleRows = [
      ['Switch-01', '192.168.1.1', '2', '161', 'public', '', '', '', '', '', '1', '1', '0'],
      ['Router-01', '192.168.1.2', '3', '161', '', 'admin', 'SHA256', 'authpass', 'AES128', 'privpass', '0', '1', '0'],
      ['Server-01', '192.168.1.3', '', '', '', '', '', '', '', '', '1', '0', '0'],
    ];

    const csvContent = [
      headers.join(','),
      ...exampleRows.map(row => row.join(','))
    ].join('\n');

    // BOM 추가 (한글 인코딩)
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = 'DEVICE_TEMPLATE.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="page-container new-asset-page no-sidebar">
      <main className="page-main-content full-width">
        {/* 페이지 헤더 */}
        <div className="page-header">
          <div className="page-header-left">
            <h1 className="page-title">
              <i className="bi bi-plus-circle"></i>
              신규 자산 등록
            </h1>
            <span className="page-subtitle">새로운 장비를 등록합니다</span>
          </div>
          <div className="page-header-right">
            <button type="button" className="btn btn-ghost" onClick={downloadCsvTemplate}>
              <i className="bi bi-download"></i>
              CSV 양식
            </button>
          </div>
        </div>

        {/* 장비 입력 및 목록 통합 영역 */}
        <div className="device-unified-section">
          <div className="section-header-row">
            <div className="section-title">장비 목록 ({devices.length})</div>
            <div className="section-actions">
              <button type="button" className="btn btn-secondary" onClick={() => fileInputRef.current?.click()}>
                <i className="bi bi-file-earmark-spreadsheet"></i>
                CSV 업로드
              </button>
              <button
                className="btn btn-success"
                disabled={devices.length === 0 || isRegistering}
                onClick={handleRegisterAll}
              >
                {isRegistering ? '등록 중...' : '일괄 등록'}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                style={{ display: 'none' }}
                accept=".csv"
                onChange={handleExcelUpload}
              />
            </div>
          </div>

          {/* 신규 장비 입력 영역 */}
          <div className="device-input-area">
            <div className="input-area-label">
              <i className="bi bi-plus-circle"></i>
              신규 장비 입력
            </div>
            <div className="device-input-row input-row-highlight">
            <div className="input-cell">
              <label>장비명</label>
              <input
                type="text"
                name="DEVICE_NAME"
                value={formData.DEVICE_NAME}
                onChange={handleInputChange}
                placeholder="Switch-01"
              />
            </div>
            <div className="input-cell">
              <label>IP 주소</label>
              <input
                type="text"
                name="DEVICE_IP"
                value={formData.DEVICE_IP}
                onChange={handleInputChange}
                placeholder="192.168.1.1"
                className={ipError ? 'input-error' : ''}
              />
              {ipError && <span className="input-error-message">{ipError}</span>}
            </div>
            <div className="input-cell">
              <label>SNMP 버전</label>
              <select
                name="SNMP_VERSION"
                value={formData.SNMP_VERSION}
                onChange={handleInputChange}
                disabled={!formData.COLLECT_SNMP}
              >
                <option value={1}>v1</option>
                <option value={2}>v2c</option>
                <option value={3}>v3</option>
              </select>
            </div>
            <div className="input-cell">
              <label>포트</label>
              <input
                type="number"
                name="SNMP_PORT"
                value={formData.SNMP_PORT}
                onChange={handleInputChange}
                disabled={!formData.COLLECT_SNMP}
              />
            </div>
            <div className="input-cell">
              <label>커뮤니티</label>
              <input
                type="text"
                name="SNMP_COMMUNITY"
                value={formData.SNMP_COMMUNITY}
                onChange={handleInputChange}
                placeholder="public"
                disabled={!formData.COLLECT_SNMP || formData.SNMP_VERSION === 3}
              />
            </div>
            <div className="input-cell">
              <label>사용자</label>
              <input
                type="text"
                name="SNMP_USER"
                value={formData.SNMP_USER}
                onChange={handleInputChange}
                disabled={!formData.COLLECT_SNMP || formData.SNMP_VERSION !== 3}
              />
            </div>
            <div className="input-cell">
              <label>인증 프로토콜</label>
              <select
                name="SNMP_AUTH_PROTOCOL"
                value={formData.SNMP_AUTH_PROTOCOL}
                onChange={handleInputChange}
                disabled={!formData.COLLECT_SNMP || formData.SNMP_VERSION !== 3}
              >
                <option value="">없음</option>
                <option value="MD5">MD5</option>
                <option value="SHA">SHA</option>
                <option value="SHA224">SHA-224</option>
                <option value="SHA256">SHA-256</option>
                <option value="SHA384">SHA-384</option>
                <option value="SHA512">SHA-512</option>
              </select>
            </div>
            <div className="input-cell">
              <label>인증 비밀번호</label>
              <input
                type="password"
                name="SNMP_AUTH_PASSWORD"
                value={formData.SNMP_AUTH_PASSWORD}
                onChange={handleInputChange}
                disabled={!formData.COLLECT_SNMP || formData.SNMP_VERSION !== 3}
              />
            </div>
            <div className="input-cell">
              <label>암호화 프로토콜</label>
              <select
                name="SNMP_PRIV_PROTOCOL"
                value={formData.SNMP_PRIV_PROTOCOL}
                onChange={handleInputChange}
                disabled={!formData.COLLECT_SNMP || formData.SNMP_VERSION !== 3}
              >
                <option value="">없음</option>
                <option value="DES">DES</option>
                <option value="3DES">3DES</option>
                <option value="AES">AES</option>
                <option value="AES128">AES-128</option>
                <option value="AES192">AES-192</option>
                <option value="AES256">AES-256</option>
              </select>
            </div>
            <div className="input-cell">
              <label>암호화 비밀번호</label>
              <input
                type="password"
                name="SNMP_PRIV_PASSWORD"
                value={formData.SNMP_PRIV_PASSWORD}
                onChange={handleInputChange}
                disabled={!formData.COLLECT_SNMP || formData.SNMP_VERSION !== 3}
              />
            </div>
            <div className="input-cell collect-cell">
              <label>PING</label>
              <input
                type="checkbox"
                checked={formData.COLLECT_PING}
                onChange={(e) => setFormData(prev => ({ ...prev, COLLECT_PING: e.target.checked }))}
              />
            </div>
            <div className="input-cell collect-cell">
              <label>SNMP</label>
              <input
                type="checkbox"
                checked={formData.COLLECT_SNMP}
                onChange={(e) => setFormData(prev => ({ ...prev, COLLECT_SNMP: e.target.checked }))}
              />
            </div>
            <div className="input-cell collect-cell">
              <label>AGENT</label>
              <input
                type="checkbox"
                checked={formData.COLLECT_AGENT}
                onChange={(e) => setFormData(prev => ({ ...prev, COLLECT_AGENT: e.target.checked }))}
              />
            </div>
            <div className="input-cell action-cell">
              <label>&nbsp;</label>
              <button type="button" className="btn btn-primary btn-add" onClick={handleAddDevice}>
                <i className="bi bi-plus-lg"></i>
              </button>
            </div>
            </div>
          </div>

          {/* 등록된 장비 목록 */}
          {devices.length > 0 && (
            <div className="device-list-area">
              <div className="list-area-label">
                <label className="select-all-label">
                  <input
                    type="checkbox"
                    checked={devices.length > 0 && selectedDeviceIds.size === devices.length}
                    onChange={toggleSelectAll}
                  />
                  <span>전체 선택</span>
                </label>
                <div className="list-area-right">
                  {selectedDeviceIds.size > 0 && (
                    <button
                      type="button"
                      className="bulk-group-btn glass"
                      onClick={openBulkGroupModal}
                    >
                      <i className="bi bi-folder-symlink"></i>
                      그룹 지정 ({selectedDeviceIds.size})
                    </button>
                  )}
                  <span className="list-count">
                    <i className="bi bi-list-ul"></i>
                    등록 대기 장비 ({devices.length})
                  </span>
                </div>
              </div>
              {devices.map((device, index) => {
                const isV3 = device.SNMP_VERSION === 3;
                const showLabel = index === 0;
                return (
                  <div key={device.id} className={`device-input-row device-list-row ${selectedDeviceIds.has(device.id) ? 'selected' : ''}`}>
                    <div className="input-cell checkbox-cell">
                      {showLabel && <label>&nbsp;</label>}
                      <input
                        type="checkbox"
                        checked={selectedDeviceIds.has(device.id)}
                        onChange={() => toggleDeviceSelection(device.id)}
                      />
                    </div>
                    <div className="input-cell">
                      {showLabel && <label>장비명</label>}
                      <input
                        type="text"
                        value={device.DEVICE_NAME}
                        onChange={(e) => handleDeviceChange(device.id, 'DEVICE_NAME', e.target.value)}
                      />
                    </div>
                    <div className="input-cell group-cell">
                      {showLabel && <label>그룹</label>}
                      <button
                        type="button"
                        className={`group-select-btn ${!device.GROUP_ID ? 'no-group' : ''}`}
                        onClick={() => openSingleGroupModal(device.id)}
                      >
                        <i className="bi bi-folder2"></i>
                        <span>{getGroupName(device.GROUP_ID)}</span>
                        <i className="bi bi-chevron-down"></i>
                      </button>
                    </div>
                    <div className="input-cell">
                      {showLabel && <label>IP 주소</label>}
                      <input
                        type="text"
                        value={device.DEVICE_IP}
                        onChange={(e) => handleDeviceChange(device.id, 'DEVICE_IP', e.target.value)}
                        className="ip-input"
                      />
                    </div>
                    <div className="input-cell">
                      {showLabel && <label>SNMP 버전</label>}
                      <select
                        value={device.SNMP_VERSION}
                        onChange={(e) => handleDeviceChange(device.id, 'SNMP_VERSION', e.target.value)}
                        disabled={device.COLLECT_SNMP === false}
                      >
                        <option value={1}>v1</option>
                        <option value={2}>v2c</option>
                        <option value={3}>v3</option>
                      </select>
                    </div>
                    <div className="input-cell">
                      {showLabel && <label>포트</label>}
                      <input
                        type="number"
                        value={device.SNMP_PORT}
                        onChange={(e) => handleDeviceChange(device.id, 'SNMP_PORT', e.target.value)}
                        disabled={device.COLLECT_SNMP === false}
                      />
                    </div>
                    <div className="input-cell">
                      {showLabel && <label>커뮤니티</label>}
                      <input
                        type="text"
                        value={device.SNMP_COMMUNITY || ''}
                        onChange={(e) => handleDeviceChange(device.id, 'SNMP_COMMUNITY', e.target.value)}
                        disabled={device.COLLECT_SNMP === false || isV3}
                      />
                    </div>
                    <div className="input-cell">
                      {showLabel && <label>사용자</label>}
                      <input
                        type="text"
                        value={device.SNMP_USER || ''}
                        onChange={(e) => handleDeviceChange(device.id, 'SNMP_USER', e.target.value)}
                        disabled={device.COLLECT_SNMP === false || !isV3}
                      />
                    </div>
                    <div className="input-cell">
                      {showLabel && <label>인증 프로토콜</label>}
                      <select
                        value={device.SNMP_AUTH_PROTOCOL || ''}
                        onChange={(e) => handleDeviceChange(device.id, 'SNMP_AUTH_PROTOCOL', e.target.value)}
                        disabled={device.COLLECT_SNMP === false || !isV3}
                      >
                        <option value="">없음</option>
                        <option value="MD5">MD5</option>
                        <option value="SHA">SHA</option>
                        <option value="SHA224">SHA-224</option>
                        <option value="SHA256">SHA-256</option>
                        <option value="SHA384">SHA-384</option>
                        <option value="SHA512">SHA-512</option>
                      </select>
                    </div>
                    <div className="input-cell">
                      {showLabel && <label>인증 비밀번호</label>}
                      <input
                        type="password"
                        value={device.SNMP_AUTH_PASSWORD || ''}
                        onChange={(e) => handleDeviceChange(device.id, 'SNMP_AUTH_PASSWORD', e.target.value)}
                        disabled={device.COLLECT_SNMP === false || !isV3}
                      />
                    </div>
                    <div className="input-cell">
                      {showLabel && <label>암호화 프로토콜</label>}
                      <select
                        value={device.SNMP_PRIV_PROTOCOL || ''}
                        onChange={(e) => handleDeviceChange(device.id, 'SNMP_PRIV_PROTOCOL', e.target.value)}
                        disabled={device.COLLECT_SNMP === false || !isV3}
                      >
                        <option value="">없음</option>
                        <option value="DES">DES</option>
                        <option value="3DES">3DES</option>
                        <option value="AES">AES</option>
                        <option value="AES128">AES-128</option>
                        <option value="AES192">AES-192</option>
                        <option value="AES256">AES-256</option>
                      </select>
                    </div>
                    <div className="input-cell">
                      {showLabel && <label>암호화 비밀번호</label>}
                      <input
                        type="password"
                        value={device.SNMP_PRIV_PASSWORD || ''}
                        onChange={(e) => handleDeviceChange(device.id, 'SNMP_PRIV_PASSWORD', e.target.value)}
                        disabled={device.COLLECT_SNMP === false || !isV3}
                      />
                    </div>
                    <div className="input-cell collect-cell">
                      {showLabel && <label>PING</label>}
                      <input
                        type="checkbox"
                        checked={device.COLLECT_PING === true}
                        onChange={(e) => handleDeviceChange(device.id, 'COLLECT_PING', e.target.checked)}
                      />
                    </div>
                    <div className="input-cell collect-cell">
                      {showLabel && <label>SNMP</label>}
                      <input
                        type="checkbox"
                        checked={device.COLLECT_SNMP === true}
                        onChange={(e) => handleDeviceChange(device.id, 'COLLECT_SNMP', e.target.checked)}
                      />
                    </div>
                    <div className="input-cell collect-cell">
                      {showLabel && <label>AGENT</label>}
                      <input
                        type="checkbox"
                        checked={device.COLLECT_AGENT === true}
                        onChange={(e) => handleDeviceChange(device.id, 'COLLECT_AGENT', e.target.checked)}
                      />
                    </div>
                    <div className="input-cell action-cell">
                      {showLabel && <label>&nbsp;</label>}
                      <button className="btn btn-danger btn-delete" onClick={() => handleRemoveDevice(device.id)}>
                        <i className="fa-solid fa-trash"></i>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* 빈 상태 */}
          {devices.length === 0 && (
            <div className="device-list-empty">
              <i className="bi bi-hdd-network"></i>
              <span>장비를 추가해주세요</span>
            </div>
          )}
        </div>
      </main>

      {/* 실시간 등록 진행 모달 */}
      {registrationProgress && (
        <div className="modal registration-modal" style={{ display: 'flex' }}>
          <div className="modal-content registration-modal-content">
            {registrationProgress.isComplete && (
              <span className="close-btn" onClick={closeProgressModal}>&times;</span>
            )}
            <h3>
              {registrationProgress.isComplete ? '장비 등록 완료' : '장비 등록 중...'}
            </h3>

            {/* 진행 바 */}
            <div className="progress-section">
              <div className="progress-bar-container">
                <div
                  className="progress-bar-fill"
                  style={{ width: `${(registrationProgress.current / registrationProgress.total) * 100}%` }}
                />
              </div>
              <div className="progress-text">
                {registrationProgress.current} / {registrationProgress.total}
                {registrationProgress.currentDevice && !registrationProgress.isComplete && (
                  <span className="current-device"> - {registrationProgress.currentDevice} 처리 중...</span>
                )}
              </div>
            </div>

            {/* 성공 목록 */}
            {registrationProgress.successList.length > 0 && (
              <div className="result-section success-section">
                <h4><i className="bi bi-check-circle"></i> 성공한 장비</h4>
                <div className="table-wrapper">
                  <table className="result-table">
                    <thead>
                      <tr>
                        <th className="sortable" style={{ minWidth: '120px' }} onClick={() => handleSuccessSort('deviceName')}>
                          장비명 {renderSortIcon('deviceName', successSortField, successSortOrder)}
                        </th>
                        <th className="sortable" style={{ minWidth: '130px' }} onClick={() => handleSuccessSort('deviceIp')}>
                          IP 주소 {renderSortIcon('deviceIp', successSortField, successSortOrder)}
                        </th>
                        <th className="sortable" style={{ minWidth: '100px' }} onClick={() => handleSuccessSort('statusText')}>
                          상태 {renderSortIcon('statusText', successSortField, successSortOrder)}
                        </th>
                        <th className="sortable" style={{ minWidth: '120px' }} onClick={() => handleSuccessSort('systemName')}>
                          시스템명 {renderSortIcon('systemName', successSortField, successSortOrder)}
                        </th>
                        <th className="sortable" style={{ minWidth: '100px' }} onClick={() => handleSuccessSort('vendorName')}>
                          벤더 {renderSortIcon('vendorName', successSortField, successSortOrder)}
                        </th>
                        <th className="sortable desc-column" onClick={() => handleSuccessSort('deviceDesc')}>
                          장비 설명 {renderSortIcon('deviceDesc', successSortField, successSortOrder)}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedSuccessList.map((device, idx) => (
                        <tr key={idx} className="success-row">
                          <td className="device-name">{device.deviceName || '-'}</td>
                          <td className="device-ip">{device.deviceIp || '-'}</td>
                          <td className="status-text">
                            {device.collectType === 'PING' ? 'PING' :
                             device.collectType === 'SNMP' ? 'SNMP' :
                             device.collectType === 'AGENT' ? 'AGENT' :
                             (device.pingResult ? 'SNMP' : 'PING')}
                          </td>
                          <td>{device.systemName || '-'}</td>
                          <td>{device.vendorName || '-'}</td>
                          <td className="desc-column" title={device.deviceDesc}>{device.deviceDesc || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 실패 목록 */}
            {registrationProgress.failureList.length > 0 && (
              <div className="result-section failure-section">
                <h4><i className="bi bi-x-circle"></i> 실패한 장비</h4>
                <div className="table-wrapper">
                  <table className="result-table">
                    <thead>
                      <tr>
                        <th className="sortable" style={{ minWidth: '120px' }} onClick={() => handleFailureSort('deviceName')}>
                          장비명 {renderSortIcon('deviceName', failureSortField, failureSortOrder)}
                        </th>
                        <th className="sortable" style={{ minWidth: '130px' }} onClick={() => handleFailureSort('deviceIp')}>
                          IP 주소 {renderSortIcon('deviceIp', failureSortField, failureSortOrder)}
                        </th>
                        <th className="sortable" style={{ minWidth: '80px' }} onClick={() => handleFailureSort('collectType')}>
                          상태 {renderSortIcon('collectType', failureSortField, failureSortOrder)}
                        </th>
                        <th className="sortable" onClick={() => handleFailureSort('errorMessage')}>
                          실패 사유 {renderSortIcon('errorMessage', failureSortField, failureSortOrder)}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedFailureList.map((device, idx) => (
                        <tr key={idx} className="failure-row">
                          <td className="device-name">{device.deviceName || '-'}</td>
                          <td className="device-ip">{device.deviceIp || '-'}</td>
                          <td className="status-text">{device.collectType || 'SNMP'}</td>
                          <td className="error-message">{device.errorMessage || '연결 실패'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 완료 시 닫기 버튼 */}
            {registrationProgress.isComplete && (
              <div className="modal-actions">
                <button className="btn btn-primary" onClick={closeProgressModal}>
                  확인
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 그룹 선택 모달 */}
      {showGroupModal && (
        <div className="modal" style={{
          display: 'flex',
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.7)',
          zIndex: 1000,
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <div style={{
            background: 'linear-gradient(145deg, rgba(30, 41, 59, 0.98) 0%, rgba(15, 23, 42, 0.98) 100%)',
            borderRadius: '16px',
            padding: '24px',
            width: '400px',
            maxHeight: '80vh',
            border: '1px solid rgba(255,255,255,0.1)',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
            position: 'relative'
          }}>
            <span
              onClick={closeGroupModal}
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                fontSize: '24px',
                cursor: 'pointer',
                color: '#94a3b8'
              }}
            >&times;</span>
            <h3 style={{ marginBottom: '16px', color: '#f1f5f9', fontSize: '18px' }}>
              <i className="bi bi-folder-symlink" style={{ marginRight: '8px' }}></i>
              {groupModalTarget === 'bulk' ? '일괄 그룹 지정' : '그룹 선택'}
            </h3>
            <p style={{ color: '#94a3b8', marginBottom: '16px', fontSize: '14px' }}>
              {groupModalTarget === 'bulk'
                ? `${selectedDeviceIds.size}개의 장비에 적용할 그룹을 선택하세요.`
                : '장비에 적용할 그룹을 선택하세요.'}
            </p>

            {/* 선택된 그룹 표시 */}
            {tempSelectedGroup && (
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
                  선택: <strong>{tempSelectedGroup.GROUP_NAME}</strong>
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
                onSelectGroup={setTempSelectedGroup}
                customSelectedGroup={tempSelectedGroup}
              />
            </div>

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button
                className="btn btn-secondary"
                onClick={closeGroupModal}
                style={{ padding: '8px 16px' }}
              >
                취소
              </button>
              <button
                className="btn btn-primary"
                onClick={handleGroupModalConfirm}
                disabled={!tempSelectedGroup}
                style={{ padding: '8px 16px' }}
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
