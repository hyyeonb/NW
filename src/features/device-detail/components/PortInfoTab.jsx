import DataTable from '../../../components/DataTable';

// DeviceDetailModal의 port-info 탭 — 포트 목록 DataTable.
export default function PortInfoTab({ columns, data, loading, sort, onSort }) {
  return (
    <div id="port-info-tab" className="detail-tab-content active">
      <DataTable
        tableId="modal-ports"
        columns={columns}
        data={data}
        rowKey="IF_INDEX"
        loading={loading}
        loadingText="포트 정보를 불러오는 중..."
        emptyText="등록된 포트가 없습니다"
        emptyIcon="bi-ethernet"
        sort={sort}
        onSort={onSort}
        maxHeight="calc(100vh - 380px)"
        className="port-data-table"
        exportConfig={{ fileName: '포트정보' }}
      />
    </div>
  );
}
