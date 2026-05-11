import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { faultApi } from '../api/fault';
import { devicesApi } from '../api/devices';
import { useAlertStore } from '../stores/alertStore';
import DataTable from '../components/DataTable';
import SshTerminalModal from '../components/SshTerminalModal';
import WatchSidebar from '../components/WatchSidebar';
import { useWatchGroupDetail } from '../hooks/useWatch';
import ConnectivityCheckModal from '../components/ConnectivityCheckModal';
import DeviceDetailModal from '../components/DeviceDetailModal';
import '../styles/fault-monitoring.css';
import { historyApi } from '../api/history';
import '../styles/fault-stats.css';
import DevCodeDropdown from '../components/DevCodeDropdown';

// 장애 등급 설정
import { ERROR_LEVELS } from '../shared/config/errorLevels';

export default function RealtimeFault() {
  const [searchParams, setSearchParams] = useSearchParams();

  // URL 쿼리 파라미터에서 초기 등급 필터 설정
  const getInitialLevels = () => {
    const levelParam = searchParams.get('level');
    if (levelParam && ['C', 'M', 'N', 'W'].includes(levelParam)) {
      return [levelParam];
    }
    return ['C', 'M', 'N', 'W'];
  };

  // 등급 체크박스
  const [selectedLevels, setSelectedLevels] = useState(getInitialLevels);
  const [errors, setErrors] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedError, setSelectedError] = useState(null);
  const [showAckModal, setShowAckModal] = useState(false);
  const [ackMessage, setAckMessage] = useState('');
  const [checkDevice, setCheckDevice] = useState(null); // 장비 점검 대상 장비
  const [detailDeviceId, setDetailDeviceId] = useState(null); // 장비 상세 모달
  const fetchIdRef = useRef(0); // race condition 방지용

  // 관제 그룹 기반 필터링
  const [selectedGroup, setSelectedGroup] = useState(null);
  const { data: groupDetail } = useWatchGroupDetail(selectedGroup?.watchGroupId);
  const { data: regularDevices } = useQuery({
    queryKey: ['regularGroupDevices', selectedGroup?.groupId],
    queryFn: () => devicesApi.getDevicesByGroup(selectedGroup.groupId).then(r => r.data?.data?.content || []),
    enabled: !!selectedGroup?.groupId && selectedGroup?.type === 'regular',
  });
  const deviceIdsParam = useMemo(() => {
    if (!selectedGroup) return undefined;
    if (selectedGroup.type === 'regular') {
      if (!regularDevices) return []; // 로딩 중 → 빈 결과
      return regularDevices.map(d => d.DEVICE_ID);
    }
    if (selectedGroup.watchGroupId) {
      if (!groupDetail) return []; // 로딩 중 → 빈 결과
      return (groupDetail.devices || []).map(d => d.deviceId);
    }
    return undefined;
  }, [selectedGroup, groupDetail, regularDevices]);

  // 검색 필터
  const [searchDeviceName, setSearchDeviceName] = useState('');
  const [searchErrorMessage, setSearchErrorMessage] = useState('');
  const [searchIp, setSearchIp] = useState('');
  const [searchGroupName, setSearchGroupName] = useState('');
  const [searchDevCode, setSearchDevCode] = useState('');

  // 장비 코드 목록 (최상위)
  const [devCodes, setDevCodes] = useState([]);

  const navigate = useNavigate();

  // SSH 터미널
  const [sshTerminalDevice, setSshTerminalDevice] = useState(null);
  const [sshTerminalInfo, setSshTerminalInfo] = useState(null);
  const [sshAlertDevice, setSshAlertDevice] = useState(null);

  const handleOpenSsh = useCallback(async (row, e) => {
    e.stopPropagation();
    if (!row.DEVICE_ID) return;
    try {
      const res = await devicesApi.getDeviceSsh(row.DEVICE_ID);
      const data = res.data?.data;
      if (!data?.SSH_USER) {
        setSshAlertDevice(row);
        return;
      }
      setSshTerminalInfo({ SSH_USER: data.SSH_USER, SSH_PASS: data.SSH_PASS || '', SSH_PORT: data.SSH_PORT || 22 });
      setSshTerminalDevice(row);
    } catch {
      alert('SSH 접속 정보를 불러오지 못했습니다.');
    }
  }, []);

  // 정렬
  const [sortConfig, setSortConfig] = useState({ key: 'OCCUR_AT', direction: 'desc' });

  // 페이지네이션
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // WebSocket 알림 구독 (새 알림 시 리렌더링)
  const alerts = useAlertStore((state) => state.alerts);

  // 등급 체크박스 토글
  const toggleLevel = (levelId) => {
    setSelectedLevels(prev => {
      if (prev.includes(levelId)) {
        // 최소 1개는 선택되어야 함
        if (prev.length === 1) return prev;
        return prev.filter(l => l !== levelId);
      } else {
        return [...prev, levelId];
      }
    });
  };

  // 장비 코드 목록 로드
  useEffect(() => {
    const loadDevCodes = async () => {
      try {
        const response = await devicesApi.getDevCodeTree();
        setDevCodes(response.data?.data || []);
      } catch (error) {
        console.error('장비 코드 조회 실패:', error);
      }
    };
    loadDevCodes();
  }, []);

  // 장애 목록 조회
  const fetchErrors = useCallback(async () => {
    // 그룹 선택됐지만 장비가 없거나 로딩 중 → 빈 결과
    if (Array.isArray(deviceIdsParam) && deviceIdsParam.length === 0) {
      setErrors([]);
      return;
    }
    const currentFetchId = ++fetchIdRef.current;
    setIsLoading(true);
    try {
      const params = {};
      if (searchDevCode) params.devCodeId = searchDevCode;
      if (searchDeviceName.trim()) params.deviceName = searchDeviceName.trim();
      if (searchErrorMessage.trim()) params.errorMessage = searchErrorMessage.trim();
      if (searchIp.trim()) params.deviceIp = searchIp.trim();
      if (searchGroupName.trim()) params.groupName = searchGroupName.trim();
      if (deviceIdsParam && deviceIdsParam.length > 0) params.deviceIds = deviceIdsParam;

      const response = await faultApi.getErrors(params);
      // race condition 방지: 이후에 더 새로운 요청이 시작됐으면 이 응답 무시
      if (currentFetchId !== fetchIdRef.current) return;

      const data = response.data?.data || {};
      const filteredList = (data.list || []).filter(e => selectedLevels.includes(e.ERROR_LEVEL));
      setErrors(filteredList);
    } catch (error) {
      if (currentFetchId === fetchIdRef.current) {
        console.error('장애 목록 조회 실패:', error);
      }
    } finally {
      if (currentFetchId === fetchIdRef.current) {
        setIsLoading(false);
      }
    }
  }, [selectedLevels, searchDevCode, searchDeviceName, searchErrorMessage, searchIp, searchGroupName, deviceIdsParam]);

  // 초기화 버튼
  const handleReset = () => {
    setSearchDevCode('');
    setSearchDeviceName('');
    setSearchErrorMessage('');
    setSearchIp('');
    setSearchGroupName('');
    setSelectedLevels(['C', 'M', 'N', 'W']);
    // URL 쿼리 파라미터도 제거
    if (searchParams.has('level')) {
      setSearchParams({}, { replace: true });
    }
  };

  // 초기 로드 및 필터 변경 시 (300ms 디바운스 — 검색 입력 시 연속 API 호출 방지)
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchErrors();
    }, 300);
    return () => clearTimeout(timer);
  }, [fetchErrors]);

  // WebSocket 알림 수신 시 자동 새로고침
  useEffect(() => {
    if (alerts.length > 0) {
      fetchErrors();
    }
  }, [alerts, fetchErrors]);

  // 장애 인지 처리
  const handleAcknowledge = async () => {
    if (!selectedError) return;

    try {
      await faultApi.acknowledgeError(selectedError.ERROR_ID, ackMessage);
      setShowAckModal(false);
      setAckMessage('');
      setSelectedError(null);
      fetchErrors();
    } catch (error) {
      console.error('인지 처리 실패:', error);
      alert('인지 처리에 실패했습니다.');
    }
  };

  // 장애 등급 라벨
  const getLevelLabel = (level) => {
    switch (level) {
      case 'C': return 'Cr';
      case 'M': return 'Mj';
      case 'N': return 'Mn';
      case 'W': return 'Wr';
      default: return level;
    }
  };

  // 장애 등급 클래스
  const getLevelClass = (level) => {
    switch (level) {
      case 'C': return 'critical';
      case 'M': return 'major';
      case 'N': return 'minor';
      case 'W': return 'warning';
      default: return '';
    }
  };

  // 날짜 포맷
  const formatDateTime = (dateStr) => {
    if (!dateStr) return '-';
    try {
      const date = new Date(dateStr);
      return date.toLocaleString('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  // 정렬 처리
  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  // 가장 최근 장애의 등급 색상 (LIVE 테두리용 — severity-badge 색상과 동일)
  const latestFaultColor = useMemo(() => {
    const colorMap = { C: '#ef4444', M: '#f97316', N: '#eab308', W: '#6366f1' };
    if (errors.length === 0) return '#10b981';
    // OCCUR_AT 기준 가장 최신
    const latest = errors.reduce((a, b) => (a.OCCUR_AT > b.OCCUR_AT ? a : b), errors[0]);
    return colorMap[latest.ERROR_LEVEL] || '#10b981';
  }, [errors]);

  // 등급 우선순위 (정렬용)
  const levelPriority = { 'C': 1, 'M': 2, 'N': 3, 'W': 4 };

  // 정렬된 데이터
  const sortedErrors = useMemo(() => {
    if (!sortConfig.key) return errors;

    return [...errors].sort((a, b) => {
      let aVal = a[sortConfig.key];
      let bVal = b[sortConfig.key];

      // 등급 정렬은 우선순위 기준
      if (sortConfig.key === 'ERROR_LEVEL') {
        aVal = levelPriority[aVal] || 99;
        bVal = levelPriority[bVal] || 99;
      }
      // 날짜 정렬
      else if (sortConfig.key === 'OCCUR_AT') {
        aVal = aVal ? new Date(aVal).getTime() : 0;
        bVal = bVal ? new Date(bVal).getTime() : 0;
      }
      // 문자열 정렬
      else {
        aVal = (aVal || '').toString().toLowerCase();
        bVal = (bVal || '').toString().toLowerCase();
      }

      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [errors, sortConfig]);

  // 페이지네이션 적용된 데이터
  const paginatedErrors = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return sortedErrors.slice(startIndex, endIndex);
  }, [sortedErrors, currentPage, pageSize]);

  // 페이지 변경 핸들러
  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  // 페이지 사이즈 변경 핸들러
  const handlePageSizeChange = (size) => {
    setPageSize(size);
    setCurrentPage(1); // 페이지 사이즈 변경 시 첫 페이지로 이동
  };

  // 데이터 변경 시 페이지 초기화 (필터 변경 등)
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedLevels, searchDevCode, searchDeviceName, searchErrorMessage, searchIp, searchGroupName, deviceIdsParam]);

  // 인지 버튼 클릭 핸들러
  const handleAckClick = (error, e) => {
    e.stopPropagation();
    setSelectedError(error);
    setShowAckModal(true);
  };

  // 장비 점검 버튼 클릭 핸들러
  const handleCheckClick = (row, e) => {
    e.stopPropagation();
    setCheckDevice({ DEVICE_ID: row.DEVICE_ID, DEVICE_NAME: row.DEVICE_NAME, DEVICE_IP: row.DEVICE_IP });
  };

  // 테이블 컬럼 정의
  const columns = useMemo(() => [
    {
      key: 'ERROR_LEVEL',
      label: '등급',
      width: '74px',
      sortable: true,
      align: 'center',
      hideable: true,
      className: 'cell-level',
      render: (value) => (
        <span className={`severity-badge ${getLevelClass(value)}`}>
          {getLevelLabel(value)}
        </span>
      ),
    },
    {
      key: 'ERROR_FLAG',
      label: '상태',
      width: '70px',
      sortable: true,
      align: 'center',
      hideable: true,
      render: (value) => (
        <span className={`status-badge ${value === 1 ? 'acknowledged' : 'active'}`}>
          {value === 1 ? '인지' : '발생'}
        </span>
      ),
    },
    {
      key: 'DEVICE_NAME',
      label: '장비명',
      sortable: true,
      className: 'cell-truncate',
    },
    {
      key: 'DEV_CODE_NM',
      label: '장비코드',
      sortable: true,
      className: 'cell-truncate',
      hideable: true,
      render: (value) => value
        ? <span className="cell-badge info">{value}</span>
        : <span style={{ color: 'var(--theme-text-muted)', fontSize: 12 }}>-</span>,
    },
    {
      key: 'DEVICE_IP',
      label: 'IP 주소',
      sortable: true,
      className: 'cell-ip',
      hideable: true,
    },
    {
      key: 'GROUP_NAME',
      label: '그룹명',
      sortable: true,
      className: 'cell-truncate',
      hideable: true,
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
      sortable: true,
      className: 'cell-date',
      hideable: true,
      render: (value) => formatDateTime(value),
    },
    {
      key: 'ssh',
      label: 'SSH',
      width: '60px',
      align: 'center',
      hideable: true,
      render: (_, row) => (
        <button
          className="action-btn ssh-btn"
          title="SSH 접속"
          onClick={(e) => handleOpenSsh(row, e)}
        >
          <i className="bi bi-terminal"></i>
        </button>
      ),
    },
    {
      key: 'ack',
      label: '인지',
      width: '60px',
      align: 'center',
      className: 'cell-actions',
      render: (_, row) => (
        <button
          className="action-btn ack-btn"
          title="인지처리"
          onClick={(e) => handleAckClick(row, e)}
          disabled={row.ERROR_FLAG === 1}
        >
          <i className="bi bi-check-lg"></i>
        </button>
      ),
    },
    {
      key: 'check',
      label: '점검',
      width: '60px',
      align: 'center',
      className: 'cell-actions',
      render: (_, row) => (
        <button
          className="action-btn check-btn"
          title="장비 점검"
          onClick={(e) => handleCheckClick(row, e)}
        >
          <i className="bi bi-activity"></i>
        </button>
      ),
    },
  ], []);

  return (
    <div className="fault-monitoring-page">
      {/* 페이지 헤더 */}
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">
            <i className="bi bi-broadcast"></i>
            실시간 장애감시
          </h1>
          <span className="page-subtitle">현재 발생 중인 장애를 모니터링합니다</span>
        </div>
        <div className="page-header-right">
          <div className="fault-live-chip" style={{ '--border-color': latestFaultColor }} onClick={fetchErrors}>
            <span className="fault-live-border" />
            <span className="fault-live-dot" />
            <span className="fault-live-label">LIVE</span>
          </div>
        </div>
      </div>

      {/* 사이드바 + 장애 테이블 */}
      <div className="fault-stats-panels-wrapper">
        <WatchSidebar
          onGroupSelect={setSelectedGroup}
          title="관제 그룹"
          titleIcon="bi bi-exclamation-triangle"
        />
      <div className="fault-content">
        <div className="fault-table-glow" style={{ '--table-border-color': latestFaultColor }}>
        <div className="table-panel">
        {/* 필터 영역 */}
        <div className="filter-bar">
          <div className="filter-group filter-group-levels">
            <label>등급</label>
            <div className="level-checkboxes">
              {ERROR_LEVELS.map((level) => (
                <label key={level.id} className="level-checkbox" style={{ '--level-color': level.color }}>
                  <input
                    type="checkbox"
                    checked={selectedLevels.includes(level.id)}
                    onChange={() => toggleLevel(level.id)}
                  />
                  <span className="checkbox-label" style={{ color: level.color }}>{level.label}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="filter-group">
            <label>장비코드</label>
            <DevCodeDropdown
              devCodes={devCodes}
              value={searchDevCode}
              onChange={setSearchDevCode}
            />
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
              value={searchIp}
              onChange={(e) => setSearchIp(e.target.value)}
            />
          </div>
          <div className="filter-group">
            <label>그룹명</label>
            <input
              type="text"
              className="filter-input"
              placeholder="그룹명"
              value={searchGroupName}
              onChange={(e) => setSearchGroupName(e.target.value)}
            />
          </div>
          <div className="filter-group">
            <label>장애내용</label>
            <input
              type="text"
              className="filter-input"
              placeholder="장애내용"
              value={searchErrorMessage}
              onChange={(e) => setSearchErrorMessage(e.target.value)}
            />
          </div>
          <div className="filter-actions">
            <button className="btn btn-icon-only" onClick={handleReset} title="초기화">
              <i className="bi bi-arrow-counterclockwise"></i>
            </button>
          </div>
        </div>
        <DataTable
          tableId="realtime-fault-v2"
          columns={columns}
          data={paginatedErrors}
          rowKey="ERROR_ID"
          loading={isLoading}
          loadingText="장애 정보를 불러오는 중..."
          emptyText="현재 발생한 장애가 없습니다"
          emptyIcon="bi-check-circle"
          sort={{ field: sortConfig.key, order: sortConfig.direction }}
          onSort={handleSort}
          onRowClick={(row) => {
            historyApi.recordPageView('fault_realtime', '/fault/realtime', {
              targetType: 'ERROR',
              targetName: `${row.DEVICE_NAME || ''}(${row.DEVICE_IP || ''})`,
              detail: `장애 상세 조회 - ${row.DEVICE_NAME || ''}(${row.DEVICE_IP || ''}) ${row.ERROR_MESSAGE || ''}`,
            });
            setDetailDeviceId({ id: row.DEVICE_ID, errorId: `active_${row.ERROR_ID}` });
          }}
          rowClassName={(row) => {
            const classes = [];
            if (row.ERROR_FLAG === 1) classes.push('acknowledged');
            if (selectedError?.ERROR_ID === row.ERROR_ID) classes.push('selected');
            return classes.join(' ');
          }}
          maxHeight="100%"
          pagination={{
            currentPage: currentPage,
            pageSize: pageSize,
            totalItems: sortedErrors.length,
            onPageChange: handlePageChange,
            onPageSizeChange: handlePageSizeChange,
            pageSizeOptions: [10, 20, 50, 100],
          }}
          exportConfig={{
            fileName: '실시간장애',
            fetchAllData: async () => sortedErrors,
          }}
        />
        </div>
        </div>
      </div>
      </div>

      {/* 장비 상세 모달 */}
      {detailDeviceId && (
        <DeviceDetailModal
          deviceId={detailDeviceId.id}
          initialTab="fault-info"
          initialErrorId={detailDeviceId.errorId}
          onClose={() => setDetailDeviceId(null)}
        />
      )}

      {/* 장비 점검 모달 */}
      {checkDevice && (
        <ConnectivityCheckModal
          device={checkDevice}
          onClose={() => setCheckDevice(null)}
        />
      )}

      {/* 인지 처리 모달 */}
      {showAckModal && (
        <div className="modal-overlay" onClick={() => setShowAckModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>장애 인지 처리</h3>
              <button className="modal-close" onClick={() => setShowAckModal(false)}>
                <i className="bi bi-x-lg"></i>
              </button>
            </div>
            <div className="modal-body">
              <div className="ack-info">
                <p><strong>장비:</strong> {selectedError?.DEVICE_NAME} ({selectedError?.DEVICE_IP})</p>
                <p><strong>장애:</strong> {selectedError?.ERROR_MESSAGE}</p>
              </div>
              <div className="form-group">
                <label>인지 메시지</label>
                <textarea
                  value={ackMessage}
                  onChange={(e) => setAckMessage(e.target.value)}
                  placeholder="인지 처리 메시지를 입력하세요..."
                  rows={3}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowAckModal(false)}>
                취소
              </button>
              <button className="btn btn-primary" onClick={handleAcknowledge}>
                인지 처리
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
              <h3 style={{ margin: '0 0 8px', fontSize: 17, color: '#e2e8f0' }}>
                SSH 접속 정보 없음
              </h3>
              <p style={{ margin: 0, color: '#94a3b8', fontSize: 14, lineHeight: 1.6 }}>
                <strong style={{ color: '#cbd5e1' }}>{sshAlertDevice.DEVICE_NAME}</strong> ({sshAlertDevice.DEVICE_IP})의<br />
                SSH 접속 정보가 설정되지 않았습니다.
              </p>
              <p style={{ margin: '8px 0 0', color: '#64748b', fontSize: 13 }}>
                장비 상세 &gt; 설정에서 SSH 정보를 입력해주세요.
              </p>
            </div>
            <div style={{ padding: '12px 28px 24px', display: 'flex', gap: 8, justifyContent: 'center' }}>
              <button className="btn btn-secondary" onClick={() => setSshAlertDevice(null)}>
                닫기
              </button>
              <button className="btn btn-primary" onClick={() => {
                setSshAlertDevice(null);
                navigate(`/assets/management?deviceId=${sshAlertDevice.DEVICE_ID}`);
              }}>
                <i className="bi bi-gear" style={{ marginRight: 4 }} />
                설정으로 이동
              </button>
            </div>
          </div>
        </div>
      )}

      {sshTerminalDevice && sshTerminalInfo && (
        <SshTerminalModal
          device={sshTerminalDevice}
          sshInfo={sshTerminalInfo}
          onClose={() => { setSshTerminalDevice(null); setSshTerminalInfo(null); }}
        />
      )}
    </div>
  );
}
