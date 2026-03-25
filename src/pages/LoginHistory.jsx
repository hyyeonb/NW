import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { historyApi } from '../api/history';
import { DataTable } from '../components';
import '../styles/ssh-session.css';

const LOGIN_TYPE_BADGE = {
  LOCAL: { label: 'Local', className: 'badge-info' },
  KAKAO: { label: 'Kakao', className: 'badge-warning' },
  GOOGLE: { label: 'Google', className: 'badge-danger' },
  NAVER: { label: 'Naver', className: 'badge-success' },
};

const ACTION_TYPE_BADGE = {
  PAGE_VIEW: { label: '조회', className: 'badge-info' },
  CREATE: { label: '등록', className: 'badge-success' },
  UPDATE: { label: '수정', className: 'badge-warning' },
  DELETE: { label: '삭제', className: 'badge-danger' },
};

const TARGET_TYPE_LABEL = {
  DEVICE: '장비', GROUP: '그룹', PORT: '포트', DEVICE_SCOPE: '수집 설정',
  DEVICE_SNMP: 'SNMP 설정', DEVICE_SSH: 'SSH 접속 정보', MODEL: '모델',
  DEV_CODE: '장비 분류', TEMP_DEVICE: '신규 자산', NOTICE: '공지사항',
  BOARD_FILE: '자료실', THRESHOLD: '시스템 임계치', DEVICE_THRESHOLD: '장비별 임계치',
  WATCH_GROUP: '관제 그룹', WATCH_CONTROL: '관제 수집', ERROR: '장애 인지',
  USER_PERMISSION: '사용자 권한', USER_STATUS: '사용자 상태',
  USER_SETTING: '사용자 설정', USER_REVIEW: '가입 심사',
  ACCOUNT: '계정 정보', PASSWORD: '비밀번호', DASHBOARD: '대시보드',
  TOPOLOGY: '토폴로지', USER_TOPOLOGY: '사용자 토폴로지', MODEL_OID: '모델 OID',
};

const PAGE_CODE_LABEL = {
  dashboard: '대시보드', topology: '토폴로지', user_topology: '사용자 토폴로지',
  watch_realtime: '실시간 관제', perf_stats: '성능 통계',
  fault_realtime: '실시간 장애', fault_history: '장애 이력', fault_stats: '장애 통계',
  group_mgmt: '그룹 관리', asset_mgmt: '자산 관리', asset_config: '자산 Config',
  new_asset_mgmt: '신규 자산', model_mgmt: '모델 관리',
  login_history: '로그인 이력', ssh_sessions: 'SSH 이력',
  board_files: '자료실', board_notices: '공지사항',
  system_admin: '시스템 관리', account_settings: '계정 설정',
};

function formatDateTime(value) {
  if (!value) return '-';
  const d = new Date(value);
  if (isNaN(d.getTime())) return value;
  return d.toLocaleString('ko-KR', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

function formatDuration(loginAt, logoutAt) {
  if (!loginAt) return '-';
  const start = new Date(loginAt);
  const end = logoutAt ? new Date(logoutAt) : new Date();
  const diff = Math.floor((end - start) / 1000);
  if (diff < 60) return `${diff}초`;
  if (diff < 3600) return `${Math.floor(diff / 60)}분 ${diff % 60}초`;
  const hours = Math.floor(diff / 3600);
  const mins = Math.floor((diff % 3600) / 60);
  return `${hours}시간 ${mins}분`;
}

export default function LoginHistory() {
  // === 뷰 모드 ===
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'detail'
  const [selectedSession, setSelectedSession] = useState(null);

  // === 로그인 이력 리스트 ===
  const [data, setData] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalCount, setTotalCount] = useState(0);
  const [sortConfig, setSortConfig] = useState({ key: 'LOGIN_AT', direction: 'desc' });
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [loginTypeFilter, setLoginTypeFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const loadingRef = useRef(false);

  // === 활동 로그 (상세 뷰) ===
  const [activities, setActivities] = useState([]);
  const [actLoading, setActLoading] = useState(false);
  const [actPage, setActPage] = useState(1);
  const [actPageSize, setActPageSize] = useState(50);
  const [actTotalCount, setActTotalCount] = useState(0);
  const actLoadingRef = useRef(false);

  // === 로그인 이력 fetch ===
  const fetchData = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setIsLoading(true);
    try {
      const params = {
        page, size: pageSize,
        sort: sortConfig.key, order: sortConfig.direction,
      };
      if (loginTypeFilter) params.loginType = loginTypeFilter;
      if (startDate) params.startDate = startDate + ' 00:00:00';
      if (endDate) params.endDate = endDate + ' 23:59:59';
      if (search) params.search = search;

      const response = await historyApi.getLoginHistory(params);
      const pageData = response.data?.data || {};
      setData(Array.isArray(pageData.content) ? pageData.content : []);
      setTotalCount(pageData.totalElements || 0);
    } catch (err) {
      console.error('로그인 이력 조회 실패:', err);
      setData([]);
      setTotalCount(0);
    } finally {
      setIsLoading(false);
      loadingRef.current = false;
    }
  }, [page, pageSize, sortConfig, loginTypeFilter, startDate, endDate, search]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // === 활동 로그 fetch ===
  const fetchActivities = useCallback(async (historyId, p = 1, s = 50) => {
    if (actLoadingRef.current) return;
    actLoadingRef.current = true;
    setActLoading(true);
    try {
      const response = await historyApi.getLoginActivities(historyId, { page: p, size: s });
      const pageData = response.data?.data || {};
      setActivities(Array.isArray(pageData.content) ? pageData.content : []);
      setActTotalCount(pageData.totalElements || 0);
    } catch (err) {
      console.error('활동 로그 조회 실패:', err);
      setActivities([]);
      setActTotalCount(0);
    } finally {
      setActLoading(false);
      actLoadingRef.current = false;
    }
  }, []);

  // === 이벤트 핸들러 ===
  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
    setPage(1);
  };

  const handleSearch = () => { setSearch(searchInput); setPage(1); };
  const handleKeyDown = (e) => { if (e.key === 'Enter') handleSearch(); };

  const handleRowClick = (row) => {
    setSelectedSession(row);
    setViewMode('detail');
    setActPage(1);
    fetchActivities(row.HISTORY_ID, 1, actPageSize);
  };

  const handleBackToList = () => {
    setViewMode('list');
    setSelectedSession(null);
    setActivities([]);
    setActTotalCount(0);
    setActPage(1);
  };

  // === 로그인 이력 컬럼 ===
  const loginColumns = useMemo(() => [
    {
      key: '_index',
      label: 'No.',
      width: '60px',
      align: 'center',
      render: (_, row, index) => (page - 1) * pageSize + index + 1,
    },
    {
      key: 'USER_NAME',
      label: '사용자',
      width: '120px',
      sortable: true,
      render: (value) => value || '-',
    },
    {
      key: 'LOGIN_TYPE',
      label: '로그인 유형',
      width: '110px',
      sortable: true,
      align: 'center',
      render: (value) => {
        const badge = LOGIN_TYPE_BADGE[value] || { label: value, className: 'badge-muted' };
        return <span className={`ssh-badge ${badge.className}`}>{badge.label}</span>;
      },
    },
    {
      key: 'IP_ADDRESS',
      label: 'IP 주소',
      width: '140px',
      sortable: true,
      className: 'cell-ip',
      render: (value) => value || '-',
    },
    {
      key: 'USER_AGENT',
      label: 'User Agent',
      sortable: false,
      className: 'cell-truncate',
      render: (value) => (
        <span title={value} style={{ maxWidth: '300px', display: 'inline-block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {value || '-'}
        </span>
      ),
    },
    {
      key: 'LOGIN_AT',
      label: '로그인 시각',
      width: '170px',
      sortable: true,
      className: 'cell-date',
      render: (value) => formatDateTime(value),
    },
    {
      key: 'LAST_ACTIVITY_AT',
      label: '마지막 활동',
      width: '170px',
      className: 'cell-date',
      render: (value) => value ? formatDateTime(value) : <span style={{ color: '#64748b' }}>-</span>,
    },
    {
      key: '_status',
      label: '상태',
      width: '80px',
      align: 'center',
      render: (_, row) => (
        <span className={`ssh-badge ${row.LOGOUT_AT ? 'badge-muted' : 'badge-success'}`}>
          {row.LOGOUT_AT ? '종료' : '활성'}
        </span>
      ),
    },
  ], [page, pageSize]);

  // === 활동 로그 컬럼 ===
  const activityColumns = useMemo(() => [
    {
      key: '_index',
      label: 'No.',
      width: '45px',
      align: 'center',
      render: (_, row, index) => (actPage - 1) * actPageSize + index + 1,
    },
    {
      key: 'CREATED_AT',
      label: '시각',
      width: '160px',
      className: 'cell-date',
      render: (value) => formatDateTime(value),
    },
    {
      key: 'ACTION_TYPE',
      label: '액션',
      width: '70px',
      align: 'center',
      render: (value) => {
        const badge = ACTION_TYPE_BADGE[value] || { label: value, className: 'badge-muted' };
        return <span className={`ssh-badge ${badge.className}`}>{badge.label}</span>;
      },
    },
    {
      key: 'TARGET_TYPE',
      label: '대상',
      width: '100px',
      render: (value) => TARGET_TYPE_LABEL[value] || value || '-',
    },
    {
      key: 'TARGET_NAME',
      label: '대상명',
      width: '150px',
      render: (value, row) => value || row.TARGET_ID || '-',
    },
    {
      key: 'DETAIL',
      label: '변경 상세',
      render: (value) => value ? (
        <span title={value} style={{ fontSize: '12px', lineHeight: '1.4', display: 'block', maxWidth: '500px', wordBreak: 'break-word' }}>
          {value}
        </span>
      ) : <span style={{ color: '#64748b' }}>-</span>,
    },
    {
      key: 'PAGE_CODE',
      label: '페이지',
      width: '100px',
      render: (value) => PAGE_CODE_LABEL[value] || value || '-',
    },
  ], [actPage, actPageSize]);

  // ===================== 상세 뷰 =====================
  if (viewMode === 'detail' && selectedSession) {
    return (
      <div className="ssh-history-page">
        <div className="ssh-page-header">
          <div className="ssh-header-left">
            <button className="ssh-btn-back" onClick={handleBackToList}>
              <i className="bi bi-arrow-left"></i>
              목록으로
            </button>
            <h2 className="ssh-page-title">
              <i className="bi bi-box-arrow-in-right"></i>
              로그인 세션 상세
            </h2>
          </div>
        </div>

        {/* 세션 정보 카드 */}
        <div className="ssh-detail-info">
          <div className="ssh-info-grid">
            <div className="ssh-info-item">
              <span className="ssh-info-label">사용자</span>
              <span className="ssh-info-value">{selectedSession.USER_NAME || '-'}</span>
            </div>
            <div className="ssh-info-item">
              <span className="ssh-info-label">로그인 유형</span>
              <span className="ssh-info-value">
                {(() => {
                  const badge = LOGIN_TYPE_BADGE[selectedSession.LOGIN_TYPE] || { label: selectedSession.LOGIN_TYPE, className: 'badge-muted' };
                  return <span className={`ssh-badge ${badge.className}`}>{badge.label}</span>;
                })()}
              </span>
            </div>
            <div className="ssh-info-item">
              <span className="ssh-info-label">IP 주소</span>
              <span className="ssh-info-value">{selectedSession.IP_ADDRESS || '-'}</span>
            </div>
            <div className="ssh-info-item">
              <span className="ssh-info-label">로그인 시각</span>
              <span className="ssh-info-value">{formatDateTime(selectedSession.LOGIN_AT)}</span>
            </div>
            <div className="ssh-info-item">
              <span className="ssh-info-label">로그아웃 시각</span>
              <span className="ssh-info-value">{selectedSession.LOGOUT_AT ? formatDateTime(selectedSession.LOGOUT_AT) : '활성 세션'}</span>
            </div>
            <div className="ssh-info-item">
              <span className="ssh-info-label">세션 시간</span>
              <span className="ssh-info-value">{formatDuration(selectedSession.LOGIN_AT, selectedSession.LOGOUT_AT)}</span>
            </div>
          </div>
        </div>

        {/* 활동 로그 테이블 */}
        <div className="ssh-detail-section">
          <div className="ssh-section-header">
            <h3>
              <i className="bi bi-journal-text"></i>
              활동 로그
            </h3>
            <span className="ssh-total-count">{actTotalCount.toLocaleString()}건</span>
          </div>

          <DataTable
            tableId="login-activities"
            columns={activityColumns}
            data={activities}
            rowKey="LOG_ID"
            loading={actLoading}
            loadingText="활동 로그를 불러오는 중..."
            emptyText="이 세션에서 기록된 활동이 없습니다"
            emptyIcon="bi-journal-text"
            pagination={{
              currentPage: actPage,
              pageSize: actPageSize,
              totalItems: actTotalCount,
              onPageChange: (p) => { setActPage(p); fetchActivities(selectedSession.HISTORY_ID, p, actPageSize); },
              onPageSizeChange: (s) => { setActPageSize(s); setActPage(1); fetchActivities(selectedSession.HISTORY_ID, 1, s); },
              pageSizeOptions: [20, 50, 100],
            }}
            maxHeight="calc(100vh - 420px)"
          />
        </div>
      </div>
    );
  }

  // ===================== 리스트 뷰 =====================
  return (
    <div className="ssh-history-page">
      <div className="ssh-page-header">
        <div className="ssh-header-left">
          <h2 className="ssh-page-title">
            <i className="bi bi-box-arrow-in-right"></i>
            로그인 이력
          </h2>
          <span className="ssh-total-count">총 {totalCount.toLocaleString()}건</span>
        </div>
      </div>

      <div className="ssh-filters">
        <div className="ssh-filter-group">
          <div className="ssh-search-box">
            <i className="bi bi-search"></i>
            <input
              type="text"
              placeholder="사용자, IP 주소 검색..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            {searchInput && (
              <button className="ssh-search-clear" onClick={() => { setSearchInput(''); setSearch(''); setPage(1); }}>
                <i className="bi bi-x"></i>
              </button>
            )}
          </div>

          <select
            className="ssh-filter-select"
            value={loginTypeFilter}
            onChange={(e) => { setLoginTypeFilter(e.target.value); setPage(1); }}
          >
            <option value="">전체 유형</option>
            <option value="LOCAL">Local</option>
            <option value="KAKAO">Kakao</option>
            <option value="GOOGLE">Google</option>
            <option value="NAVER">Naver</option>
          </select>

          <input
            type="date"
            className="ssh-filter-date"
            value={startDate}
            onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
          />
          <span className="ssh-date-separator">~</span>
          <input
            type="date"
            className="ssh-filter-date"
            value={endDate}
            onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
          />

          {(search || loginTypeFilter || startDate || endDate) && (
            <button
              className="ssh-filter-clear"
              onClick={() => {
                setSearchInput(''); setSearch('');
                setLoginTypeFilter('');
                setStartDate(''); setEndDate('');
                setPage(1);
              }}
            >
              <i className="bi bi-x-circle"></i>
              필터 초기화
            </button>
          )}
        </div>
      </div>

      <DataTable
        tableId="login-history"
        columns={loginColumns}
        data={data}
        rowKey="HISTORY_ID"
        exportConfig={{ fileName: '로그인이력' }}
        loading={isLoading}
        loadingText="로그인 이력을 불러오는 중..."
        emptyText="로그인 이력이 없습니다"
        emptyIcon="bi-box-arrow-in-right"
        sort={{ field: sortConfig.key, order: sortConfig.direction }}
        onSort={handleSort}
        onRowClick={handleRowClick}
        pagination={{
          currentPage: page,
          pageSize: pageSize,
          totalItems: totalCount,
          onPageChange: setPage,
          onPageSizeChange: (size) => { setPageSize(size); setPage(1); },
          pageSizeOptions: [10, 20, 50, 100],
        }}
        maxHeight="calc(100vh - 300px)"
      />
    </div>
  );
}
