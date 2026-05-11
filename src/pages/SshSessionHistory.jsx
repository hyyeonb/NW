import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { sshSessionApi } from '../api/sshSession';
import DataTable from '../components/DataTable';
import { historyApi } from '../api/history';
import '../styles/ssh-session.css';

export default function SshSessionHistory() {
  // 뷰 모드
  const [viewMode, setViewMode] = useState('list'); // list | detail
  const [selectedSession, setSelectedSession] = useState(null);

  // 목록 상태
  const [sessions, setSessions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalCount, setTotalCount] = useState(0);
  const [sortConfig, setSortConfig] = useState({ key: 'SESSION_ID', direction: 'desc' });

  // 필터 (단일 검색어)
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');

  // 상세 탭
  const [detailTab, setDetailTab] = useState('commands');

  // 명령어 상세
  const [commands, setCommands] = useState([]);
  const [commandsLoading, setCommandsLoading] = useState(false);
  const [cmdPage, setCmdPage] = useState(1);
  const [cmdPageSize, setCmdPageSize] = useState(20);
  const [cmdTotalCount, setCmdTotalCount] = useState(0);

  // SFTP 로그
  const [sftpLogs, setSftpLogs] = useState([]);
  const [sftpLoading, setSftpLoading] = useState(false);
  const [sftpPage, setSftpPage] = useState(1);
  const [sftpPageSize, setSftpPageSize] = useState(20);
  const [sftpTotalCount, setSftpTotalCount] = useState(0);

  // 세션 목록 조회
  const sessionLoadingRef = useRef(false);
  const fetchSessions = useCallback(async () => {
    if (sessionLoadingRef.current) return;
    sessionLoadingRef.current = true;
    setIsLoading(true);
    try {
      const params = {
        page,
        size: pageSize,
        sort: sortConfig.key,
        order: sortConfig.direction,
      };
      if (search.trim()) params.search = search.trim();

      const response = await sshSessionApi.getSessions(params);
      const data = response.data?.data || response.data || {};
      const list = data.content || (Array.isArray(data) ? data : []);
      setSessions(list);
      setTotalCount(data.totalElements || list.length || 0);
    } catch (error) {
      console.error('SSH 세션 이력 조회 실패:', error);
      setSessions([]);
    } finally {
      setIsLoading(false);
      sessionLoadingRef.current = false;
    }
  }, [page, pageSize, sortConfig, search]);

  useEffect(() => { fetchSessions(); }, [fetchSessions]);

  // 명령어 목록 조회
  const cmdLoadingRef = useRef(false);
  const fetchCommands = useCallback(async (sessionId, p = 1, s = 20) => {
    if (cmdLoadingRef.current) return;
    cmdLoadingRef.current = true;
    setCommandsLoading(true);
    try {
      const response = await sshSessionApi.getCommands(sessionId, { page: p, size: s });
      const data = response.data?.data || response.data || {};
      const list = Array.isArray(data.content) ? data.content : (Array.isArray(data) ? data : []);
      setCommands(list);
      setCmdTotalCount(data.totalElements || list.length || 0);
    } catch (error) {
      console.error('SSH 명령어 조회 실패:', error);
      setCommands([]);
    } finally {
      setCommandsLoading(false);
      cmdLoadingRef.current = false;
    }
  }, []);

  // SFTP 로그 조회
  const sftpLoadingRef = useRef(false);
  const fetchSftpLogs = useCallback(async (sessionId, p = 1, s = 20) => {
    if (sftpLoadingRef.current) return;
    sftpLoadingRef.current = true;
    setSftpLoading(true);
    try {
      const response = await sshSessionApi.getSftpLogs(sessionId, { page: p, size: s });
      const data = response.data?.data || response.data || {};
      const list = Array.isArray(data.content) ? data.content : (Array.isArray(data) ? data : []);
      setSftpLogs(list);
      setSftpTotalCount(data.totalElements || list.length || 0);
    } catch (error) {
      console.error('SFTP 로그 조회 실패:', error);
      setSftpLogs([]);
    } finally {
      setSftpLoading(false);
      sftpLoadingRef.current = false;
    }
  }, []);

  // 날짜 포맷
  const formatDateTime = (dateStr) => {
    if (!dateStr) return '-';
    try {
      const date = new Date(dateStr);
      return date.toLocaleString('ko-KR', {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
      });
    } catch { return dateStr; }
  };

  // 파일 크기 포맷
  const formatFileSize = (bytes) => {
    if (bytes == null || bytes < 0) return '-';
    if (bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
  };

  // SFTP 작업 유형 라벨
  const operationLabel = {
    UPLOAD: { text: '업로드', icon: 'bi-cloud-upload', cls: 'op-upload' },
    DOWNLOAD: { text: '다운로드', icon: 'bi-cloud-download', cls: 'op-download' },
    MKDIR: { text: '디렉토리 생성', icon: 'bi-folder-plus', cls: 'op-mkdir' },
    DELETE: { text: '삭제', icon: 'bi-trash3', cls: 'op-delete' },
  };

  // 접속 시간 계산
  const calculateDuration = (connectedAt, disconnectedAt) => {
    if (!connectedAt) return '-';
    const start = new Date(connectedAt);
    const end = disconnectedAt ? new Date(disconnectedAt) : new Date();
    const diff = Math.floor((end - start) / 1000);
    if (diff < 0) return '-';
    if (diff < 60) return `${diff}초`;
    if (diff < 3600) return `${Math.floor(diff / 60)}분 ${diff % 60}초`;
    if (diff < 86400) {
      const h = Math.floor(diff / 3600);
      const m = Math.floor((diff % 3600) / 60);
      return `${h}시간 ${m}분`;
    }
    const d = Math.floor(diff / 86400);
    const h = Math.floor((diff % 86400) / 3600);
    return `${d}일 ${h}시간`;
  };

  // 정렬
  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
    setPage(1);
  };

  // 검색 실행
  const handleSearch = () => {
    setSearch(searchInput);
    setPage(1);
  };

  const handleSearchKeyDown = (e) => {
    if (e.key === 'Enter') handleSearch();
  };

  // 필터 초기화
  const handleReset = () => {
    setSearchInput('');
    setSearch('');
    setPage(1);
  };

  // ROW 클릭 → 상세
  const handleRowClick = useCallback((row) => {
    setSelectedSession(row);
    setViewMode('detail');
    historyApi.recordPageView('ssh_sessions', '/history/ssh-sessions', {
      targetType: 'SSH_SESSION',
      targetName: `${row.userName || ''}@${row.host || ''}`,
      detail: `SSH 세션 조회 - ${row.userName || ''}@${row.host || ''}`,
    });
    setDetailTab('commands');
    setCmdPage(1);
    setSftpPage(1);
    fetchCommands(row.sessionId, 1, cmdPageSize);
    fetchSftpLogs(row.sessionId, 1, sftpPageSize);
  }, [fetchCommands, fetchSftpLogs, cmdPageSize, sftpPageSize]);

  // 명령어 페이지 변경
  const handleCmdPageChange = useCallback((newPage) => {
    setCmdPage(newPage);
    if (selectedSession) fetchCommands(selectedSession.sessionId, newPage, cmdPageSize);
  }, [fetchCommands, selectedSession, cmdPageSize]);

  const handleCmdPageSizeChange = useCallback((newSize) => {
    setCmdPageSize(newSize);
    setCmdPage(1);
    if (selectedSession) fetchCommands(selectedSession.sessionId, 1, newSize);
  }, [fetchCommands, selectedSession]);

  // SFTP 페이지 변경
  const handleSftpPageChange = useCallback((newPage) => {
    setSftpPage(newPage);
    if (selectedSession) fetchSftpLogs(selectedSession.sessionId, newPage, sftpPageSize);
  }, [fetchSftpLogs, selectedSession, sftpPageSize]);

  const handleSftpPageSizeChange = useCallback((newSize) => {
    setSftpPageSize(newSize);
    setSftpPage(1);
    if (selectedSession) fetchSftpLogs(selectedSession.sessionId, 1, newSize);
  }, [fetchSftpLogs, selectedSession]);

  // 목록으로 돌아가기
  const handleBackToList = useCallback(() => {
    setViewMode('list');
    setSelectedSession(null);
    setCommands([]);
    setSftpLogs([]);
    setCmdPage(1);
    setCmdTotalCount(0);
    setSftpPage(1);
    setSftpTotalCount(0);
  }, []);

  // 목록 컬럼
  const columns = useMemo(() => [
    {
      key: '_index',
      label: 'No.',
      width: '60px',
      align: 'center',
      render: (_, row, index) => totalCount - ((page - 1) * pageSize) - index,
    },
    {
      key: 'userName',
      label: '사용자',
      width: '100px',
      sortable: true,
      className: 'cell-truncate',
      render: (value) => value || '-',
    },
    {
      key: 'host',
      label: '접속 호스트',
      sortable: true,
      className: 'cell-ip',
      render: (value) => value || '-',
    },
    {
      key: 'sshUser',
      label: 'SSH 계정',
      width: '120px',
      sortable: true,
      render: (value) => value || '-',
    },
    {
      key: 'remoteAddr',
      label: '접속 IP',
      sortable: true,
      className: 'cell-ip',
      render: (value) => value || '-',
    },
    {
      key: 'connectedAt',
      label: '접속 시간',
      width: '170px',
      sortable: true,
      className: 'cell-date',
      render: (value) => formatDateTime(value),
    },
    {
      key: 'disconnectedAt',
      label: '종료 시간',
      width: '170px',
      sortable: true,
      className: 'cell-date',
      render: (value) => formatDateTime(value),
    },
    {
      key: '_duration',
      label: '소요시간',
      width: '110px',
      render: (_, row) => calculateDuration(row.connectedAt, row.disconnectedAt),
    },
    {
      key: '_status',
      label: '상태',
      width: '80px',
      align: 'center',
      render: (_, row) => (
        <span className={`ssh-status-badge ${row.disconnectedAt ? 'closed' : 'active'}`}>
          {row.disconnectedAt ? '종료' : '접속중'}
        </span>
      ),
    },
  ], [totalCount, page, pageSize]);

  // 명령어 컬럼
  const commandColumns = useMemo(() => [
    {
      key: '_index',
      label: 'No.',
      width: '60px',
      align: 'center',
      render: (_, _row, index) => (cmdPage - 1) * cmdPageSize + index + 1,
    },
    {
      key: 'executedAt',
      label: '실행 시간',
      width: '200px',
      className: 'cell-date',
      render: (value) => formatDateTime(value),
    },
    {
      key: 'command',
      label: '명령어',
      className: 'cell-command',
      render: (value) => (
        <code className="ssh-command-text">{value || '-'}</code>
      ),
    },
  ], [cmdTotalCount, cmdPage, cmdPageSize]);

  // SFTP 로그 컬럼
  const sftpColumns = useMemo(() => [
    {
      key: '_index',
      label: 'No.',
      width: '60px',
      align: 'center',
      render: (_, _row, index) => (sftpPage - 1) * sftpPageSize + index + 1,
    },
    {
      key: 'operation',
      label: '작업',
      width: '140px',
      render: (value) => {
        const op = operationLabel[(value || '').toUpperCase()] || { text: value, icon: 'bi-question-circle', cls: '' };
        return (
          <span className={`sftp-op-badge ${op.cls}`}>
            <i className={`bi ${op.icon}`} />
            {op.text}
          </span>
        );
      },
    },
    {
      key: 'filePath',
      label: '파일 경로',
      className: 'cell-command',
      render: (value) => (
        <code className="ssh-command-text" style={{ color: '#38bdf8' }}>{value || '-'}</code>
      ),
    },
    {
      key: 'fileSize',
      label: '파일 크기',
      width: '100px',
      align: 'right',
      render: (value) => formatFileSize(value),
    },
    {
      key: 'userName',
      label: '사용자',
      width: '100px',
      render: (value) => value || '-',
    },
    {
      key: 'executedAt',
      label: '실행 시간',
      width: '180px',
      className: 'cell-date',
      render: (value) => formatDateTime(value),
    },
  ], [sftpPage, sftpPageSize]);

  // 상세 뷰
  if (viewMode === 'detail' && selectedSession) {
    const s = selectedSession;
    return (
      <div className="ssh-session-page">
        <div className="page-header">
          <div className="page-header-left">
            <button className="btn-back" onClick={handleBackToList}>
              <i className="bi bi-arrow-left"></i>
            </button>
            <h1 className="page-title">
              <i className="bi bi-terminal"></i>
              SSH 명령어 기록
            </h1>
            <span className="page-subtitle">세션 #{s.sessionId}</span>
          </div>
        </div>

        {/* 세션 정보 카드 */}
        <div className="ssh-session-info-card">
          <div className="ssh-info-grid">
            <div className="ssh-info-item">
              <label>사용자</label>
              <span>{s.userName || '-'}</span>
            </div>
            <div className="ssh-info-item">
              <label>접속 호스트</label>
              <span className="mono">{s.host || '-'}</span>
            </div>
            <div className="ssh-info-item">
              <label>SSH 계정</label>
              <span>{s.sshUser || '-'}</span>
            </div>
            <div className="ssh-info-item">
              <label>접속 IP</label>
              <span className="mono">{s.remoteAddr || '-'}</span>
            </div>
            <div className="ssh-info-item">
              <label>접속 시간</label>
              <span>{formatDateTime(s.connectedAt)}</span>
            </div>
            <div className="ssh-info-item">
              <label>종료 시간</label>
              <span>{formatDateTime(s.disconnectedAt)}</span>
            </div>
            <div className="ssh-info-item">
              <label>소요시간</label>
              <span>{calculateDuration(s.connectedAt, s.disconnectedAt)}</span>
            </div>
            <div className="ssh-info-item">
              <label>상태</label>
              <span className={`ssh-status-badge ${s.disconnectedAt ? 'closed' : 'active'}`}>
                {s.disconnectedAt ? '종료' : '접속중'}
              </span>
            </div>
          </div>
        </div>

        {/* 탭 */}
        <div className="ssh-detail-tabs">
          <button
            className={`ssh-detail-tab ${detailTab === 'commands' ? 'active' : ''}`}
            onClick={() => setDetailTab('commands')}
          >
            <i className="bi bi-terminal" />
            명령어 기록
            {cmdTotalCount > 0 && <span className="tab-count">{cmdTotalCount}</span>}
          </button>
          <button
            className={`ssh-detail-tab ${detailTab === 'sftp' ? 'active' : ''}`}
            onClick={() => setDetailTab('sftp')}
          >
            <i className="bi bi-folder2-open" />
            SFTP 기록
            {sftpTotalCount > 0 && <span className="tab-count">{sftpTotalCount}</span>}
          </button>
        </div>

        {/* 명령어 목록 */}
        {detailTab === 'commands' && (
          <div className="ssh-commands-section">
            <div className="table-panel">
              <DataTable
                tableId="ssh-commands"
                columns={commandColumns}
                data={commands}
                rowKey="commandsId"
                loading={commandsLoading}
                loadingText="명령어 기록을 불러오는 중..."
                emptyText="기록된 명령어가 없습니다"
                emptyIcon="bi-terminal"
                pagination={{
                  currentPage: cmdPage,
                  pageSize: cmdPageSize,
                  totalItems: cmdTotalCount,
                  onPageChange: handleCmdPageChange,
                  onPageSizeChange: handleCmdPageSizeChange,
                  pageSizeOptions: [10, 20, 50, 100],
                }}
                maxHeight="100%"
              />
            </div>
          </div>
        )}

        {/* SFTP 로그 */}
        {detailTab === 'sftp' && (
          <div className="ssh-commands-section">
            <div className="table-panel">
              <DataTable
                tableId="ssh-sftp-logs"
                columns={sftpColumns}
                data={sftpLogs}
                rowKey="logId"
                loading={sftpLoading}
                loadingText="SFTP 기록을 불러오는 중..."
                emptyText="SFTP 파일 작업 기록이 없습니다"
                emptyIcon="bi-folder2-open"
                pagination={{
                  currentPage: sftpPage,
                  pageSize: sftpPageSize,
                  totalItems: sftpTotalCount,
                  onPageChange: handleSftpPageChange,
                  onPageSizeChange: handleSftpPageSizeChange,
                  pageSizeOptions: [10, 20, 50, 100],
                }}
                maxHeight="100%"
              />
            </div>
          </div>
        )}
      </div>
    );
  }

  // 목록 뷰
  return (
    <div className="ssh-session-page">
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">
            <i className="bi bi-terminal"></i>
            SSH 접속 이력
          </h1>
          <span className="page-subtitle">SSH 접속 기록 및 실행 명령어를 조회합니다</span>
        </div>
      </div>

      <div className="ssh-content">
        <div className="table-panel">
          {/* 필터 */}
          <div className="filter-bar">
            <div className="filter-group">
              <label>검색</label>
              <input
                type="text"
                className="filter-input"
                placeholder="사용자, 호스트, IP 검색"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                style={{ width: '200px' }}
              />
            </div>
            <div className="filter-actions">
              <button className="btn btn-sm btn-primary" onClick={handleSearch} title="검색">
                <i className="bi bi-search"></i>
              </button>
              <button className="btn btn-icon-only" onClick={handleReset} title="초기화">
                <i className="bi bi-arrow-counterclockwise"></i>
              </button>
            </div>
          </div>

          <DataTable
            tableId="ssh-sessions"
            columns={columns}
            data={sessions}
            rowKey="sessionId"
            exportConfig={{ fileName: 'SSH접속이력' }}
            loading={isLoading}
            loadingText="SSH 세션 이력을 불러오는 중..."
            emptyText="조회된 SSH 접속 이력이 없습니다"
            emptyIcon="bi-terminal"
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
      </div>
    </div>
  );
}
