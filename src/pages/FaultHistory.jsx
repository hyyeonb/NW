import { useState, useEffect, useCallback, useMemo } from 'react';
import DatePicker, { registerLocale } from 'react-datepicker';
import { ko } from 'date-fns/locale';
import { format } from 'date-fns';
import { faultApi } from '../api';
import { DataTable } from '../components';
import 'react-datepicker/dist/react-datepicker.css';
import '../styles/fault-monitoring.css';

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

  // 페이징
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalCount, setTotalCount] = useState(0);

  // 필터 (Date 객체로 관리)
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);

  // 검색 필터
  const [searchDeviceName, setSearchDeviceName] = useState('');
  const [searchErrorMessage, setSearchErrorMessage] = useState('');
  const [searchIp, setSearchIp] = useState('');
  const [searchGroupName, setSearchGroupName] = useState('');

  // 정렬
  const [sortConfig, setSortConfig] = useState({ key: 'OCCUR_AT', direction: 'desc' });

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

  // 장애 이력 조회
  const fetchHistory = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = { page, size: pageSize };
      if (startDate) params.startDate = format(startDate, 'yyyy-MM-dd');
      if (endDate) params.endDate = format(endDate, 'yyyy-MM-dd');
      if (searchDeviceName.trim()) params.deviceName = searchDeviceName.trim();
      if (searchErrorMessage.trim()) params.errorMessage = searchErrorMessage.trim();
      if (searchIp.trim()) params.deviceIp = searchIp.trim();
      if (searchGroupName.trim()) params.groupName = searchGroupName.trim();

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
  }, [selectedLevels, page, pageSize, startDate, endDate, searchDeviceName, searchErrorMessage, searchIp, searchGroupName]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  useEffect(() => {
    setPage(1);
  }, [selectedLevels, startDate, endDate, searchDeviceName, searchErrorMessage, searchIp, searchGroupName]);

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

  // 정렬 처리
  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const levelPriority = { 'C': 1, 'M': 2, 'N': 3, 'W': 4 };

  const sortedHistories = useMemo(() => {
    if (!sortConfig.key) return histories;

    return [...histories].sort((a, b) => {
      let aVal = a[sortConfig.key];
      let bVal = b[sortConfig.key];

      if (sortConfig.key === 'ERROR_LEVEL') {
        aVal = levelPriority[aVal] || 99;
        bVal = levelPriority[bVal] || 99;
      } else if (sortConfig.key === 'OCCUR_AT' || sortConfig.key === 'CLEAR_AT') {
        aVal = aVal ? new Date(aVal).getTime() : 0;
        bVal = bVal ? new Date(bVal).getTime() : 0;
      } else {
        aVal = (aVal || '').toString().toLowerCase();
        bVal = (bVal || '').toString().toLowerCase();
      }

      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [histories, sortConfig]);

  // 테이블 컬럼 정의
  const columns = useMemo(() => [
    {
      key: 'ERROR_LEVEL',
      label: '등급',
      width: '80px',
      sortable: true,
      align: 'center',
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
    },
    {
      key: 'GROUP_NAME',
      label: '그룹명',
      width: '120px',
      sortable: true,
      className: 'cell-truncate',
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
      render: (value) => formatDateTime(value),
    },
    {
      key: 'CLEAR_AT',
      label: '해소 시간',
      width: '155px',
      sortable: true,
      className: 'cell-date',
      render: (value) => formatDateTime(value),
    },
    {
      key: 'duration',
      label: '소요 시간',
      width: '100px',
      render: (_, row) => calculateDuration(row.OCCUR_AT, row.CLEAR_AT),
    },
  ], []);

  // 필터 초기화
  const handleReset = () => {
    setStartDate(null);
    setEndDate(null);
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

      {/* 필터 영역 */}
      <div className="filter-bar glass-card">
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

      {/* 장애 이력 테이블 */}
      <div className="fault-content glass-card">
        <DataTable
          columns={columns}
          data={sortedHistories}
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
          maxHeight="calc(100vh - 340px)"
        />
      </div>
    </div>
  );
}
