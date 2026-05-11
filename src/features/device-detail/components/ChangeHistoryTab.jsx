/* eslint-disable max-lines-per-function */
// DeviceDetailModal의 변경이력 탭 — timeline 형태로 CREATE/UPDATE/DELETE 표시.
export default function ChangeHistoryTab({ loading, history, total, page, onPageChange }) {
  const totalPages = Math.ceil(total / 20);
  return (
    <div id="change-history-tab" className="detail-tab-content active">
      {loading ? (
        <div className="tab-loading"><i className="bi bi-arrow-repeat spinning"></i> 변경이력을 불러오는 중...</div>
      ) : history.length === 0 ? (
        <div className="tab-empty"><i className="bi bi-clock-history"></i><span>변경이력이 없습니다</span></div>
      ) : (
        <>
          <div className="history-timeline">
            {history.map((log, idx) => (
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
                  {log.DETAIL && <div className="history-item-detail">{log.DETAIL}</div>}
                </div>
              </div>
            ))}
          </div>
          {total > 20 && (
            <div className="history-pagination">
              <button disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
                <i className="bi bi-chevron-left"></i>
              </button>
              <span>{page} / {totalPages}</span>
              <button disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
                <i className="bi bi-chevron-right"></i>
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
