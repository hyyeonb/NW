/* eslint-disable max-lines-per-function, max-params */
import DataTable from '../../../components/DataTable';

// DeviceDetailModal의 장애 탭 — 장애 이력 + 인지 처리 모달.
export default function FaultInfoTab({
  columns, data, loading, sort, onSort,
  pageState, setPageState,
  ackModal, device, selectedError,
  ackMessage, onAckMessageChange, onAcknowledge,
}) {
  const { page, pageSize, total } = pageState;
  return (
    <div id="fault-info-tab" className="detail-tab-content active">
      <DataTable
        tableId="modal-faults"
        columns={columns}
        data={data}
        rowKey="_faultRowId"
        rowAttrs={(row) => ({ 'data-fault-row': row._faultRowId || '' })}
        loading={loading}
        loadingText="장애 이력을 불러오는 중..."
        emptyText="장애 이력이 없습니다"
        emptyIcon="bi-check-circle"
        sort={sort}
        onSort={onSort}
        maxHeight="100%"
        rowClassName={(row) => row._isActive ? 'fault-active-row' : ''}
        pagination={{
          currentPage: page,
          pageSize,
          totalItems: total,
          onPageChange: setPageState.onPageChange,
          onPageSizeChange: setPageState.onPageSizeChange,
          pageSizeOptions: [10, 20, 50],
        }}
      />

      {ackModal.open && (
        <div className="modal-overlay" onClick={ackModal.onClose}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>장애 인지 처리</h3>
              <button className="modal-close" onClick={ackModal.onClose}>
                <i className="bi bi-x-lg"></i>
              </button>
            </div>
            <div className="modal-body">
              <div className="ack-info">
                <p><strong>장비:</strong> {device?.DEVICE_NAME} ({device?.DEVICE_IP})</p>
                <p><strong>장애:</strong> {selectedError?.ERROR_MESSAGE}</p>
              </div>
              <div className="form-group">
                <label>인지 메시지</label>
                <textarea
                  value={ackMessage}
                  onChange={(e) => onAckMessageChange(e.target.value)}
                  placeholder="인지 처리 메시지를 입력하세요..."
                  rows={3}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={ackModal.onClose}>취소</button>
              <button className="btn btn-primary" onClick={onAcknowledge}>인지 처리</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
