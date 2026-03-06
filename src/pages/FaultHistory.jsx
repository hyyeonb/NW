import { useState, useEffect, useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import DatePicker, { registerLocale } from 'react-datepicker';
import { ko } from 'date-fns/locale';
import { format } from 'date-fns';
import { faultApi, devicesApi } from '../api';
import { DataTable } from '../components';
import WatchSidebar from '../components/WatchSidebar';
import { useWatchGroupDetail } from '../hooks/useWatch';
import ConnectivityCheckModal from '../components/ConnectivityCheckModal';
import SshTerminalModal from '../components/SshTerminalModal';
import 'react-datepicker/dist/react-datepicker.css';
import '../styles/fault-monitoring.css';
import '../styles/fault-stats.css';

// 한국어 로케일 등록
registerLocale('ko', ko);

// 장애 등급 설정
const ERROR_LEVELS = [
  { id: 'C', label: 'Cr', color: '#ef4444' },
  { id: 'M', label: 'Mj', color: '#f97316' },
  { id: 'N', label: 'Mn', color: '#eab308' },
  { id: 'W', label: 'Wr', color: '#3b82f6' },
];

export default function FaultHistory() {
  // 등급 체크박스 (기본 전체 선택)
  const [selectedLevels, setSelectedLevels] = useState(['C', 'M', 'N', 'W']);
  const [histories, setHistories] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedHistory, setSelectedHistory] = useState(null);
  const [checkDevice, setCheckDevice] = useState(null); // 장비 점검 대상 장비

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

  // 페이징
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalCount, setTotalCount] = useState(0);

  // 필터 (Date 객체로 관리)
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);

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
      return regularDevices?.length ? regularDevices.map(d => d.DEVICE_ID) : undefined;
    }
    if (selectedGroup.watchGroupId && groupDetail?.devices?.length) {
      return groupDetail.devices.map(d => d.deviceId);
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

  // 정렬 (서버사이드)
  const [sortConfig, setSortConfig] = useState({ key: 'CLEAR_AT', direction: 'desc' });

  // 등급 체크박스 토글
  const toggleLevel = (levelId) => {
    setSelectedLevels(prev => {
      if (prev.includes(levelId)) {
        if (prev.length === 1) return prev;
        return prev.filter(l => l !== levelId);
      } else {
        return [...prev, levelId];
      }
    });
  };

  // 장비 코드 목록 로드 (트리를 평탄화하여 모든 레벨 표시)
  useEffect(() => {
    const flattenTree = (nodes, depth = 0) => {
      const result = [];
      for (const node of nodes) {
        result.push({ ...node, _depth: depth });
        if (node.children && node.children.length > 0) {
          result.push(...flattenTree(node.children, depth + 1));
        }
      }
      return result;
    };
    const loadDevCodes = async () => {
      try {
        const response = await devicesApi.getDevCodeTree();
        const tree = response.data?.data || [];
        setDevCodes(flattenTree(tree));
      } catch (error) {
        console.error('장비 코드 조회 실패:', error);
      }
    };
    loadDevCodes();
  }, []);

  // 장애 이력 조회
  const fetchHistory = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = {
        page, size: pageSize,
        sortKey: sortConfig.key,
        sortDirection: sortConfig.direction,
      };
      if (startDate) params.startDate = format(startDate, 'yyyy-MM-dd');
      if (endDate) params.endDate = format(endDate, 'yyyy-MM-dd');
      if (searchDevCode) params.devCodeId = searchDevCode;
      if (searchDeviceName.trim()) params.deviceName = searchDeviceName.trim();
      if (searchErrorMessage.trim()) params.errorMessage = searchErrorMessage.trim();
      if (searchIp.trim()) params.deviceIp = searchIp.trim();
      if (searchGroupName.trim()) params.groupName = searchGroupName.trim();
      if (deviceIdsParam) params.deviceIds = deviceIdsParam;

      const response = await faultApi.getHistory(params);
      const data = response.data?.data || {};

      // API 응답: { content: [...], page, size, totalElements, totalPages }
      const rawList = data.content || [];
      const filteredList = rawList.filter(e => selectedLevels.includes(e.ERROR_LEVEL));
      setHistories(filteredList);
      setTotalCount(data.totalElements || 0);
    } catch (error) {
      console.error('장애 이력 조회 실패:', error);
    } finally {
      setIsLoading(false);
    }
  }, [selectedLevels, page, pageSize, startDate, endDate, searchDevCode, searchDeviceName, searchErrorMessage, searchIp, searchGroupName, sortConfig, deviceIdsParam]);

  // 필터 변경 시 (300ms 디바운스 — 검색 입력 시 연속 API 호출 방지)
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchHistory();
    }, 300);
    return () => clearTimeout(timer);
  }, [fetchHistory]);

  useEffect(() => {
    setPage(1);
  }, [selectedLevels, startDate, endDate, searchDevCode, searchDeviceName, searchErrorMessage, searchIp, searchGroupName, deviceIdsParam]);

  // 등급 라벨
  const getLevelLabel = (level) => {
    switch (level) {
      case 'C': return 'Cr';
      case 'M': return 'Mj';
      case 'N': return 'Mn';
      case 'W': return 'Wr';
      default: return level;
    }
  };

  // 등급 클래스
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

  // 소요 시간 계산
  const calculateDuration = (occurAt, clearAt) => {
    if (!occurAt || !clearAt) return '-';
    try {
      const occur = new Date(occurAt);
      const clear = new Date(clearAt);
      const diff = Math.floor((clear - occur) / 1000);

      if (diff < 60) return `${diff}초`;
      if (diff < 3600) return `${Math.floor(diff / 60)}분 ${diff % 60}초`;
      if (diff < 86400) {
        const hours = Math.floor(diff / 3600);
        const mins = Math.floor((diff % 3600) / 60);
        return `${hours}시간 ${mins}분`;
      }
      const days = Math.floor(diff / 86400);
      const hours = Math.floor((diff % 86400) / 3600);
      return `${days}일 ${hours}시간`;
    } catch {
      return '-';
    }
  };

  // 정렬 처리 (서버사이드)
  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
    setPage(1);
  };

  // 테이블 컬럼 정의
  const columns = useMemo(() => [
    {
      key: 'ERROR_LEVEL',
      label: '등급',
      width: '62px',
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
      key: 'DEVICE_NAME',
      label: '장비명',
      width: '150px',
      sortable: true,
      className: 'cell-truncate',
    },
    {
      key: 'DEVICE_IP',
      label: 'IP 주소',
      width: '130px',
      sortable: true,
      className: 'cell-ip',
      hideable: true,
    },
    {
      key: 'GROUP_NAME',
      label: '그룹명',
      width: '120px',
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
      width: '155px',
      sortable: true,
      className: 'cell-date',
      hideable: true,
      render: (value) => formatDateTime(value),
    },
    {
      key: 'CLEAR_AT',
      label: '해소 시간',
      width: '155px',
      sortable: true,
      className: 'cell-date',
      hideable: true,
      render: (value) => formatDateTime(value),
    },
    {
      key: 'duration',
      label: '소요 시간',
      width: '100px',
      hideable: true,
      render: (_, row) => calculateDuration(row.OCCUR_AT, row.CLEAR_AT),
    },
    {
      key: 'ssh',
      label: 'SSH',
      width: '60px',
      align: 'center',
      hideable: true,
      render: (_, row) => (
        <button
          className="action-btn"
          title="SSH 접속"
          onClick={(e) => handleOpenSsh(row, e)}
          style={{ color: '#38bdf8', fontSize: '16px', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px' }}
        >
          <i className="bi bi-terminal"></i>
        </button>
      ),
    },
    {
      key: 'actions',
      label: '작업',
      width: '60px',
      align: 'center',
      className: 'cell-actions',
      render: (_, row) => (
        <button
          className="action-btn"
          title="장비 점검"
          onClick={(e) => {
            e.stopPropagation();
            setCheckDevice({ DEVICE_ID: row.DEVICE_ID, DEVICE_NAME: row.DEVICE_NAME, DEVICE_IP: row.DEVICE_IP });
          }}
        >
          <i className="bi bi-activity"></i>
        </button>
      ),
    },
  ], []);

  // 필터 초기화
  const handleReset = () => {
    setStartDate(null);
    setEndDate(null);
    setSearchDevCode('');
    setSearchDeviceName('');
    setSearchErrorMessage('');
    setSearchIp('');
    setSearchGroupName('');
    setSelectedLevels(['C', 'M', 'N', 'W']);
  };

  return (
    <div className="fault-monitoring-page">
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">
            <i className="bi bi-clock-history"></i>
            장애 이력
          </h1>
          <span className="page-subtitle">과거 발생한 장애 이력을 조회합니다</span>
        </div>
      </div>

      {/* 사이드바 + 장애 이력 테이블 */}
      <div className="fault-stats-panels-wrapper">
        <WatchSidebar
          onGroupSelect={setSelectedGroup}
          title="관제 그룹"
          titleIcon="bi bi-clock-history"
        />
      <div className="fault-content">
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
            <label>시작일</label>
            <DatePicker
              selected={startDate}
              onChange={(date) => setStartDate(date)}
              selectsStart
              startDate={startDate}
              endDate={endDate}
              maxDate={endDate || new Date()}
              locale="ko"
              dateFormat="yy.M.d"
              placeholderText="시작일"
              className="date-picker-input date-picker-sm"
              isClearable
              popperProps={{ strategy: 'fixed' }}
            />
          </div>
          <div className="filter-group">
            <label>종료일</label>
            <DatePicker
              selected={endDate}
              onChange={(date) => setEndDate(date)}
              selectsEnd
              startDate={startDate}
              endDate={endDate}
              minDate={startDate}
              maxDate={new Date()}
              locale="ko"
              dateFormat="yy.M.d"
              placeholderText="종료일"
              className="date-picker-input date-picker-sm"
              isClearable
              popperProps={{ strategy: 'fixed' }}
            />
          </div>
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
          tableId="fault-history"
          columns={columns}
          data={histories}
          rowKey="ERROR_HISTORY_ID"
          loading={isLoading}
          loadingText="장애 이력을 불러오는 중..."
          emptyText="조회된 장애 이력이 없습니다"
          emptyIcon="bi-inbox"
          sort={{ field: sortConfig.key, order: sortConfig.direction }}
          onSort={handleSort}
          onRowClick={(row) => setSelectedHistory(row)}
          rowClassName={(row) => selectedHistory?.ERROR_HISTORY_ID === row.ERROR_HISTORY_ID ? 'selected' : ''}
          pagination={{
            currentPage: page,
            pageSize: pageSize,
            totalItems: totalCount,
            onPageChange: setPage,
            onPageSizeChange: (size) => {
              setPageSize(size);
              setPage(1);
            },
            pageSizeOptions: [10, 20, 50, 100],
          }}
          maxHeight="calc(100vh - 300px)"
          exportConfig={{
            fileName: '장애이력',
            fetchAllData: async () => {
              const params = {
                page: 1, size: 999999,
                sortKey: sortConfig.key,
                sortDirection: sortConfig.direction,
              };
              if (startDate) params.startDate = format(startDate, 'yyyy-MM-dd');
              if (endDate) params.endDate = format(endDate, 'yyyy-MM-dd');
              if (searchDevCode) params.devCodeId = searchDevCode;
              if (searchDeviceName.trim()) params.deviceName = searchDeviceName.trim();
              if (searchErrorMessage.trim()) params.errorMessage = searchErrorMessage.trim();
              if (searchIp.trim()) params.deviceIp = searchIp.trim();
              if (searchGroupName.trim()) params.groupName = searchGroupName.trim();
              const res = await faultApi.getHistory(params);
              const data = res.data?.data || {};
              const rawList = data.content || [];
              return rawList.filter(e => selectedLevels.includes(e.ERROR_LEVEL));
            },
          }}
        />
        </div>
      </div>
      </div>

      {/* 장비 점검 모달 */}
      {checkDevice && (
        <ConnectivityCheckModal
          device={checkDevice}
          onClose={() => setCheckDevice(null)}
        />
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
