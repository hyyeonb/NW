import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { historyApi } from '../api/history';
import DataTable from '../components/DataTable';
import '../styles/ssh-session.css';

import { LOGIN_TYPE_BADGE, ACTION_TYPE_BADGE, TARGET_TYPE_LABEL, PAGE_CODE_LABEL } from '../features/login-history/model/constants';
import { formatSessionDuration as formatDuration } from '../features/login-history/lib/formatSessionDuration';
import { formatDateTimeKo as formatDateTime } from '../shared/lib/format';

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
    // fetchActivities 호출 시 백엔드 @ViewLog가 자동 기록
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
      key: 'ACTIVITY_SUMMARY',
      label: '활동',
      width: '160px',
      align: 'center',
      render: (_, row) => {
        const c = row.ACTIVITY_CREATE || 0;
        const r = row.ACTIVITY_VIEW || 0;
        const u = row.ACTIVITY_UPDATE || 0;
        const d = row.ACTIVITY_DELETE || 0;
        const ctrl = row.ACTIVITY_CONTROL || 0;
        if (c + r + u + d + ctrl === 0) return <span style={{ color: '#64748b' }}>-</span>;
        return (
          <span className="activity-crud">
            {r > 0 && <span className="crud-badge crud-r">R {r}</span>}
            {c > 0 && <span className="crud-badge crud-c">C {c}</span>}
            {u > 0 && <span className="crud-badge crud-u">U {u}</span>}
            {d > 0 && <span className="crud-badge crud-d">D {d}</span>}
            {ctrl > 0 && <span className="crud-badge crud-ctrl">CTL {ctrl}</span>}
          </span>
        );
      },
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
      width: '180px',
      render: (value, row) => value || row.TARGET_ID || '-',
    },
    {
      key: 'DETAIL',
      label: '변경 상세',
      render: (value, row) => {
        if (value) {
          return (
            <span title={value} style={{ fontSize: '12px', lineHeight: '1.4', display: 'block', maxWidth: '500px', wordBreak: 'break-word' }}>
              {value}
            </span>
          );
        }
        // PAGE_VIEW는 순수 페이지 진입, 대상 없음 → PAGE_CODE로 페이지명 표시
        if (row.ACTION_TYPE === 'PAGE_VIEW') {
          const pageLabel = row.PAGE_CODE ? (PAGE_CODE_LABEL[row.PAGE_CODE] || row.PAGE_CODE) : '';
          return <span style={{ color: '#94a3b8', fontSize: 12 }}>{pageLabel} 페이지 진입</span>;
        }
        return <span style={{ color: '#64748b' }}>-</span>;
      },
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
        <div className="page-header">
          <div className="page-header-left">
            <button className="ssh-btn-back" onClick={handleBackToList}>
              <i className="bi bi-arrow-left"></i>
              목록으로
            </button>
            <h1 className="page-title">
              <i className="bi bi-box-arrow-in-right"></i>
              로그인 세션 상세
            </h1>
            <span className="page-subtitle">세션별 활동 로그</span>
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
            maxHeight="100%"
          />
        </div>
      </div>
    );
  }

  // ===================== 리스트 뷰 =====================
  return (
    <div className="ssh-history-page">
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">
            <i className="bi bi-box-arrow-in-right"></i>
            로그인 이력
          </h1>
          <span className="page-subtitle">사용자 로그인 세션과 활동 이력을 조회합니다</span>
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
        maxHeight="100%"
      />
    </div>
  );
}
