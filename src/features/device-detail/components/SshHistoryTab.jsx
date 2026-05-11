/* eslint-disable max-lines-per-function */
import Pagination from '../../../components/Pagination';

// DeviceDetailModal의 SSH 이력 탭.
export default function SshHistoryTab({
  loading, history, expandedSessionId, onToggleExpand,
  sessionCommands, sessionCommandsLoading,
  page, total, onPageChange,
}) {
  return (
    <div id="ssh-history-tab" className="detail-tab-content active">
      {loading ? (
        <div className="tab-loading"><i className="bi bi-arrow-repeat spinning"></i> SSH이력을 불러오는 중...</div>
      ) : history.length === 0 ? (
        <div className="tab-empty"><i className="bi bi-terminal"></i><span>SSH 접속 이력이 없습니다</span></div>
      ) : (
        <>
          <div className="ssh-history-list">
            {history.map((session, idx) => {
              const isExpanded = expandedSessionId === session.sessionId;
              return (
                <div key={session.sessionId || idx} className={`ssh-history-item ${isExpanded ? 'expanded' : ''}`} onClick={() => session.sessionId && onToggleExpand(session.sessionId)} style={{ cursor: 'pointer' }}>
                  <div className="ssh-history-icon">
                    <i className={`bi ${isExpanded ? 'bi-chevron-down' : (session.disconnectedAt ? 'bi-plug' : 'bi-plug-fill text-success')}`}></i>
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
                    {isExpanded && (
                      <div className="ssh-commands-expand" onClick={(e) => e.stopPropagation()} style={{
                        marginTop: 12, padding: 12,
                        background: 'rgba(15, 23, 42, 0.6)', borderRadius: 6,
                        border: '1px solid rgba(148, 163, 184, 0.15)',
                      }}>
                        {sessionCommandsLoading ? (
                          <div style={{ color: '#94a3b8', fontSize: 12 }}>
                            <i className="bi bi-arrow-repeat spinning" /> 명령어 로딩 중...
                          </div>
                        ) : sessionCommands.length === 0 ? (
                          <div style={{ color: '#64748b', fontSize: 12 }}>실행된 명령어가 없습니다</div>
                        ) : (
                          <div style={{ fontFamily: 'Consolas, Monaco, monospace', fontSize: 12, color: '#e2e8f0', maxHeight: 300, overflow: 'auto' }}>
                            {sessionCommands.map((cmd, i) => (
                              <div key={cmd.commandsId || i} style={{ padding: '4px 0', borderBottom: '1px solid rgba(148,163,184,0.08)' }}>
                                <span style={{ color: '#64748b', marginRight: 8 }}>
                                  {cmd.executedAt ? new Date(cmd.executedAt).toLocaleTimeString('ko-KR') : ''}
                                </span>
                                <span style={{ color: '#34d399', marginRight: 4 }}>$</span>
                                <span>{cmd.command || '-'}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <Pagination
            currentPage={page}
            pageSize={20}
            totalItems={total}
            onPageChange={onPageChange}
            showPageSizeSelector={false}
          />
        </>
      )}
    </div>
  );
}
