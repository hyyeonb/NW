import { useState, useEffect, useMemo } from 'react';
import GroupTree from '../components/GroupTree';
import { useGroupStore } from '../stores';
import {
  useDevicesByGroupPaged,
  useDeleteDevices,
  useDevicePorts,
  useUpdatePort,
  useDeviceScope,
  useUpdateDeviceScope,
} from '../hooks';

export default function AssetManagement() {
  const { selectedGroup } = useGroupStore();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedDevices, setSelectedDevices] = useState([]);
  const [detailDevice, setDetailDevice] = useState(null);
  const [activeTab, setActiveTab] = useState('device-info');

  // 장비 테이블 정렬 상태 (기본: ID 오름차순)
  const [deviceSortField, setDeviceSortField] = useState('DEVICE_ID');
  const [deviceSortOrder, setDeviceSortOrder] = useState('asc');

  // 포트 테이블 정렬 상태 (기본: Index 오름차순)
  const [portSortField, setPortSortField] = useState('IF_INDEX');
  const [portSortOrder, setPortSortOrder] = useState('asc');

  // 그룹 변경 시 페이지 초기화
  useEffect(() => {
    setPage(1);
    setSelectedDevices([]);
  }, [selectedGroup?.GROUP_ID]);

  // 서버 측 페이지네이션 + 정렬 사용 (LIMIT OFFSET + ORDER BY)
  const { data: devicesData, isLoading } = useDevicesByGroupPaged(
    selectedGroup?.GROUP_ID, page, pageSize, deviceSortField, deviceSortOrder
  );
  const { data: portsData, isLoading: portsLoading } = useDevicePorts(detailDevice?.DEVICE_ID);
  const { data: deviceScope, isLoading: scopeLoading } = useDeviceScope(detailDevice?.DEVICE_ID);

  const deleteDevicesMutation = useDeleteDevices();
  const updatePortMutation = useUpdatePort();
  const updateDeviceScopeMutation = useUpdateDeviceScope();

  // 수집 설정 토글 핸들러
  const handleToggleScope = async (field) => {
    if (!deviceScope) return;

    const newValue = !deviceScope[field];
    try {
      await updateDeviceScopeMutation.mutateAsync({
        deviceId: detailDevice.DEVICE_ID,
        data: { [field]: newValue }
      });
    } catch (error) {
      console.error('수집 설정 업데이트 오류:', error);
      alert('수집 설정 업데이트에 실패했습니다.');
    }
  };

  // 포트 감시 플래그 토글
  const handleTogglePortFlag = async (port, field) => {
    const ifIndex = port.IF_INDEX || port.ifIndex;
    const currentValue = port[field] === true || port[field] === 1;
    const newValue = !currentValue;

    try {
      await updatePortMutation.mutateAsync({
        deviceId: detailDevice.DEVICE_ID,
        ifIndex: ifIndex,
        data: { [field]: newValue }
      });
    } catch (error) {
      console.error('포트 업데이트 오류:', error);
      alert('포트 정보 업데이트에 실패했습니다.');
    }
  };

  // 서버 측 페이지네이션 + 정렬 결과 사용
  const pagedDevices = devicesData?.content || [];
  const totalPages = devicesData?.totalPages || 0;

  // 장비 테이블 정렬 핸들러 (서버에서 정렬하므로 페이지 리셋)
  const handleDeviceSort = (field) => {
    if (deviceSortField === field) {
      setDeviceSortOrder(deviceSortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setDeviceSortField(field);
      setDeviceSortOrder('asc');
    }
    setPage(1);
  };

  // 포트 테이블 정렬 로직
  const sortedPorts = useMemo(() => {
    if (!portsData?.length) return [];
    return [...portsData].sort((a, b) => {
      let aVal = a[portSortField];
      let bVal = b[portSortField];

      if (aVal == null) aVal = '';
      if (bVal == null) bVal = '';

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return portSortOrder === 'asc' ? aVal - bVal : bVal - aVal;
      }

      const strA = String(aVal).toLowerCase();
      const strB = String(bVal).toLowerCase();
      if (portSortOrder === 'asc') {
        return strA.localeCompare(strB, 'ko');
      }
      return strB.localeCompare(strA, 'ko');
    });
  }, [portsData, portSortField, portSortOrder]);

  // 포트 테이블 정렬 핸들러
  const handlePortSort = (field) => {
    if (portSortField === field) {
      setPortSortOrder(portSortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setPortSortField(field);
      setPortSortOrder('asc');
    }
  };

  // 정렬 아이콘 렌더링 함수
  const renderSortIcon = (field, currentSortField, currentSortOrder) => {
    if (currentSortField !== field) {
      return <i className="bi bi-chevron-expand sort-icon inactive"></i>;
    }
    return currentSortOrder === 'asc'
      ? <i className="bi bi-chevron-up sort-icon active"></i>
      : <i className="bi bi-chevron-down sort-icon active"></i>;
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedDevices(pagedDevices.map((d) => d.DEVICE_ID));
    } else {
      setSelectedDevices([]);
    }
  };

  const handleSelectDevice = (deviceId) => {
    setSelectedDevices((prev) =>
      prev.includes(deviceId) ? prev.filter((id) => id !== deviceId) : [...prev, deviceId]
    );
  };

  const handleDeleteSelected = async () => {
    if (!confirm(`${selectedDevices.length}개의 장비를 삭제하시겠습니까?`)) return;
    try {
      await deleteDevicesMutation.mutateAsync(selectedDevices);
      setSelectedDevices([]);
    } catch (error) {
      console.error('Delete error:', error);
      alert('삭제 중 오류가 발생했습니다.');
    }
  };

  const handleRowClick = (device) => {
    setDetailDevice(device);
    setActiveTab('device-info');
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('ko-KR');
  };

  const getSnmpVersionLabel = (version) => {
    const labels = { 1: 'v1', 2: 'v2c', 3: 'v3' };
    return labels[version] || version;
  };

  // 포트 타입 변환
  const getPortTypeText = (type) => {
    if (!type) return '-';
    const types = {
      6: 'ethernet',
      24: 'loopback',
      53: 'propVirtual',
      117: 'gigabitEthernet',
      131: 'tunnel',
      135: 'l2vlan',
      161: 'ieee8023adLag',
    };
    return types[type] || `type(${type})`;
  };

  // 포트 타입에 따른 배지 클래스
  const getPortTypeBadgeClass = (type) => {
    if (type === 6) return 'ethernet';
    if (type === 117) return 'gigabit';
    if (type === 24) return 'loopback';
    return '';
  };

  // 속도 포맷팅
  const formatSpeed = (port) => {
    if (port.speedText) return port.speedText;

    if (port.IF_HIGH_SPEED && port.IF_HIGH_SPEED > 0) {
      if (port.IF_HIGH_SPEED >= 1000) {
        return `${port.IF_HIGH_SPEED / 1000} Gbps`;
      }
      return `${port.IF_HIGH_SPEED} Mbps`;
    }
    if (port.IF_SPEED && port.IF_SPEED > 0) {
      if (port.IF_SPEED >= 1_000_000_000) {
        return `${Math.floor(port.IF_SPEED / 1_000_000_000)} Gbps`;
      } else if (port.IF_SPEED >= 1_000_000) {
        return `${Math.floor(port.IF_SPEED / 1_000_000)} Mbps`;
      } else if (port.IF_SPEED >= 1_000) {
        return `${Math.floor(port.IF_SPEED / 1_000)} Kbps`;
      }
      return `${port.IF_SPEED} bps`;
    }
    return '-';
  };

  // 긴 텍스트에 툴팁 필요 여부 확인
  const needsTooltip = (value, maxLength = 20) => {
    return value && value.length > maxLength;
  };

  return (
    <div className="page-container">
      <GroupTree />
      <main className="page-main-content">
        <div className="content-header">
          <h2 id="page-title">자산 목록</h2>
          {selectedGroup && (
            <span style={{ color: '#60a5fa', fontSize: '16px', marginLeft: '20px' }}>
              [{selectedGroup.GROUP_NAME}]
            </span>
          )}
        </div>

        {!selectedGroup ? (
          <p id="welcome-message">그룹을 선택하여 해당 그룹의 장비 목록을 확인하세요.</p>
        ) : isLoading ? (
          <p style={{ color: '#94a3b8' }}>로딩 중...</p>
        ) : (
          <div id="device-list-section" style={{ display: 'block' }}>
            {selectedDevices.length > 0 && (
              <div style={{ display: 'flex', marginBottom: '12px', gap: '8px' }}>
                <button
                  className="btn btn-danger btn-sm"
                  onClick={handleDeleteSelected}
                  disabled={deleteDevicesMutation.isPending}
                  style={{ padding: '6px 12px', fontSize: '12px' }}
                >
                  <i className="bi bi-trash"></i> 선택 삭제 ({selectedDevices.length})
                </button>
              </div>
            )}

            <div className="table-wrapper">
              <table id="device-table" className="device-table">
                <thead>
                  <tr>
                    <th>
                      <input
                        type="checkbox"
                        id="select-all-devices"
                        checked={selectedDevices.length === pagedDevices.length && pagedDevices.length > 0}
                        onChange={handleSelectAll}
                      />
                    </th>
                    <th className="sortable" onClick={() => handleDeviceSort('DEVICE_NAME')}>
                      이름 {renderSortIcon('DEVICE_NAME', deviceSortField, deviceSortOrder)}
                    </th>
                    <th className="sortable" onClick={() => handleDeviceSort('DEVICE_SYSTEM_NAME')}>
                      시스템명 {renderSortIcon('DEVICE_SYSTEM_NAME', deviceSortField, deviceSortOrder)}
                    </th>
                    <th className="sortable" onClick={() => handleDeviceSort('DEVICE_IP')}>
                      IP {renderSortIcon('DEVICE_IP', deviceSortField, deviceSortOrder)}
                    </th>
                    <th className="sortable" onClick={() => handleDeviceSort('MODEL_NAME')}>
                      모델 {renderSortIcon('MODEL_NAME', deviceSortField, deviceSortOrder)}
                    </th>
                    <th className="sortable" onClick={() => handleDeviceSort('VENDOR_NAME')}>
                      벤더 {renderSortIcon('VENDOR_NAME', deviceSortField, deviceSortOrder)}
                    </th>
                    <th className="sortable" onClick={() => handleDeviceSort('PORT_COUNT')}>
                      포트수 {renderSortIcon('PORT_COUNT', deviceSortField, deviceSortOrder)}
                    </th>
                    <th className="sortable" onClick={() => handleDeviceSort('CREATE_AT')}>
                      등록일 {renderSortIcon('CREATE_AT', deviceSortField, deviceSortOrder)}
                    </th>
                  </tr>
                </thead>
                <tbody id="device-table-tbody">
                  {pagedDevices.length > 0 ? (
                    pagedDevices.map((device) => (
                      <tr
                        key={device.DEVICE_ID}
                        onClick={() => handleRowClick(device)}
                        style={{ cursor: 'pointer' }}
                      >
                        <td onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selectedDevices.includes(device.DEVICE_ID)}
                            onChange={() => handleSelectDevice(device.DEVICE_ID)}
                          />
                        </td>
                        <td>{device.DEVICE_NAME}</td>
                        <td>{device.DEVICE_SYSTEM_NAME || '-'}</td>
                        <td style={{ color: '#60a5fa' }}>{device.DEVICE_IP}</td>
                        <td>{device.MODEL_NAME || '-'}</td>
                        <td>{device.VENDOR_NAME || '-'}</td>
                        <td>
                          {device.PORT_COUNT != null ? (
                            <span className="port-badge">{device.PORT_COUNT}</span>
                          ) : '-'}
                        </td>
                        <td>{formatDate(device.CREATE_AT)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="8" style={{ textAlign: 'center', color: '#94a3b8' }}>
                        등록된 장비가 없습니다.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="pagination-controls">
              <div className="items-per-page">
                <label htmlFor="items-per-page-selector">개수:</label>
                <select
                  id="items-per-page-selector"
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setPage(1);
                  }}
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
              <div id="pagination" className="pagination">
                {totalPages > 1 && (
                  <>
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                    >
                      이전
                    </button>
                    <span>{page} / {totalPages}</span>
                    <button
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                    >
                      다음
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* 장비 상세 보기 모달 */}
      {detailDevice && (
        <div id="device-detail-modal" className="modal" style={{ display: 'flex' }}>
          <div className="modal-content device-detail-modal">
            <span className="close-btn" onClick={() => setDetailDevice(null)}>&times;</span>
            <h3 className="detail-modal-title">
              <i className="bi bi-hdd-network"></i>
              <span id="detail-device-name">{detailDevice.DEVICE_NAME}</span>
            </h3>

            {/* 탭 헤더 */}
            <div className="detail-tabs">
              <button
                className={`detail-tab ${activeTab === 'device-info' ? 'active' : ''}`}
                onClick={() => setActiveTab('device-info')}
              >
                <i className="bi bi-info-circle"></i> 장비 정보
              </button>
              <button
                className={`detail-tab ${activeTab === 'scope-settings' ? 'active' : ''}`}
                onClick={() => setActiveTab('scope-settings')}
              >
                <i className="bi bi-sliders"></i> 수집 설정
              </button>
              <button
                className={`detail-tab ${activeTab === 'port-info' ? 'active' : ''}`}
                onClick={() => setActiveTab('port-info')}
              >
                <i className="bi bi-ethernet"></i> 포트 정보
                {portsData?.length > 0 && (
                  <span id="port-count-badge" className="tab-badge">{portsData.length}</span>
                )}
              </button>
            </div>

            {/* 장비 정보 탭 */}
            {activeTab === 'device-info' && (
              <div id="device-info-tab" className="detail-tab-content active">
                <div className="detail-section-wrapper">
                  <div className="detail-section">
                    <div className="detail-section-header">
                      <i className="bi bi-info-circle"></i>
                      <span>기본 정보</span>
                    </div>
                    <div className="detail-grid detail-grid-single-row">
                      <div className={`detail-item ${needsTooltip(detailDevice.DEVICE_NAME) ? 'has-tooltip' : ''}`}>
                        <span className="detail-label">장비명</span>
                        <span className="detail-value">{detailDevice.DEVICE_NAME}</span>
                        {needsTooltip(detailDevice.DEVICE_NAME) && (
                          <span className="detail-tooltip">{detailDevice.DEVICE_NAME}</span>
                        )}
                      </div>
                      <div className={`detail-item ${needsTooltip(detailDevice.DEVICE_SYSTEM_NAME) ? 'has-tooltip' : ''}`}>
                        <span className="detail-label">시스템명</span>
                        <span className="detail-value">{detailDevice.DEVICE_SYSTEM_NAME || '-'}</span>
                        {needsTooltip(detailDevice.DEVICE_SYSTEM_NAME) && (
                          <span className="detail-tooltip">{detailDevice.DEVICE_SYSTEM_NAME}</span>
                        )}
                      </div>
                      <div className="detail-item">
                        <span className="detail-label">IP 주소</span>
                        <span className="detail-value highlight">{detailDevice.DEVICE_IP}</span>
                      </div>
                      <div className={`detail-item ${needsTooltip(detailDevice.VENDOR_NAME) ? 'has-tooltip' : ''}`}>
                        <span className="detail-label">벤더</span>
                        <span className="detail-value">{detailDevice.VENDOR_NAME || '-'}</span>
                        {needsTooltip(detailDevice.VENDOR_NAME) && (
                          <span className="detail-tooltip">{detailDevice.VENDOR_NAME}</span>
                        )}
                      </div>
                      <div className={`detail-item ${needsTooltip(detailDevice.MODEL_NAME) ? 'has-tooltip' : ''}`}>
                        <span className="detail-label">모델명</span>
                        <span className="detail-value">{detailDevice.MODEL_NAME || '-'}</span>
                        {needsTooltip(detailDevice.MODEL_NAME) && (
                          <span className="detail-tooltip">{detailDevice.MODEL_NAME}</span>
                        )}
                      </div>
                      <div className={`detail-item ${needsTooltip(detailDevice.DEVICE_DESC, 15) ? 'has-tooltip' : ''}`}>
                        <span className="detail-label">장비 설명</span>
                        <span className="detail-value">{detailDevice.DEVICE_DESC || '-'}</span>
                        {needsTooltip(detailDevice.DEVICE_DESC, 15) && (
                          <span className="detail-tooltip">{detailDevice.DEVICE_DESC}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="detail-section">
                    <div className="detail-section-header">
                      <i className="bi bi-diagram-3"></i>
                      <span>SNMP 설정</span>
                    </div>
                    <div className="detail-grid">
                      <div className="detail-item">
                        <span className="detail-label">SNMP 버전</span>
                        <span className="detail-value">{getSnmpVersionLabel(detailDevice.SNMP_VERSION)}</span>
                      </div>
                      <div className="detail-item">
                        <span className="detail-label">포트</span>
                        <span className="detail-value">{detailDevice.SNMP_PORT || 161}</span>
                      </div>
                      <div className="detail-item">
                        <span className="detail-label">커뮤니티</span>
                        <span className="detail-value">{detailDevice.SNMP_COMMUNITY || '-'}</span>
                      </div>
                      {detailDevice.SNMP_VERSION === 3 && (
                        <>
                          <div className="detail-item">
                            <span className="detail-label">사용자</span>
                            <span className="detail-value">{detailDevice.SNMP_USER || '-'}</span>
                          </div>
                          <div className="detail-item">
                            <span className="detail-label">인증 프로토콜</span>
                            <span className="detail-value">{detailDevice.SNMP_AUTH_PROTOCOL || '-'}</span>
                          </div>
                          <div className="detail-item">
                            <span className="detail-label">암호화 프로토콜</span>
                            <span className="detail-value">{detailDevice.SNMP_PRIV_PROTOCOL || '-'}</span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="detail-section">
                    <div className="detail-section-header">
                      <i className="bi bi-clock-history"></i>
                      <span>등록 정보</span>
                    </div>
                    <div className="detail-grid">
                      <div className="detail-item">
                        <span className="detail-label">등록일</span>
                        <span className="detail-value">{formatDate(detailDevice.CREATE_AT)}</span>
                      </div>
                      <div className="detail-item">
                        <span className="detail-label">수정일</span>
                        <span className="detail-value">{formatDate(detailDevice.MODIFY_AT)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 수집 설정 탭 */}
            {activeTab === 'scope-settings' && (
              <div id="scope-settings-tab" className="detail-tab-content active">
                <div className="detail-section-wrapper">
                  <div className="detail-section">
                    <div className="detail-section-header">
                      <i className="bi bi-broadcast"></i>
                      <span>데이터 수집 설정</span>
                    </div>
                    {scopeLoading ? (
                      <div className="scope-loading">
                        <i className="bi bi-arrow-repeat spinning"></i> 설정 정보를 불러오는 중...
                      </div>
                    ) : (
                      <div className="scope-settings-grid">
                        <div className="scope-item">
                          <div className="scope-info">
                            <i className="bi bi-wifi scope-icon ping"></i>
                            <div className="scope-text">
                              <span className="scope-title">PING 수집</span>
                              <span className="scope-desc">ICMP 프로토콜로 장비 상태 모니터링</span>
                            </div>
                          </div>
                          <label className="toggle-switch">
                            <input
                              type="checkbox"
                              checked={deviceScope?.COLLECT_PING || false}
                              onChange={() => handleToggleScope('COLLECT_PING')}
                              disabled={updateDeviceScopeMutation.isPending}
                            />
                            <span className="toggle-slider"></span>
                          </label>
                        </div>

                        <div className="scope-item">
                          <div className="scope-info">
                            <i className="bi bi-diagram-3 scope-icon snmp"></i>
                            <div className="scope-text">
                              <span className="scope-title">SNMP 수집</span>
                              <span className="scope-desc">SNMP 프로토콜로 상세 정보 수집</span>
                            </div>
                          </div>
                          <label className="toggle-switch">
                            <input
                              type="checkbox"
                              checked={deviceScope?.COLLECT_SNMP || false}
                              onChange={() => handleToggleScope('COLLECT_SNMP')}
                              disabled={updateDeviceScopeMutation.isPending}
                            />
                            <span className="toggle-slider"></span>
                          </label>
                        </div>

                        <div className="scope-item">
                          <div className="scope-info">
                            <i className="bi bi-cpu scope-icon agent"></i>
                            <div className="scope-text">
                              <span className="scope-title">AGENT 수집</span>
                              <span className="scope-desc">에이전트를 통한 시스템 정보 수집</span>
                            </div>
                          </div>
                          <label className="toggle-switch">
                            <input
                              type="checkbox"
                              checked={deviceScope?.COLLECT_AGENT || false}
                              onChange={() => handleToggleScope('COLLECT_AGENT')}
                              disabled={updateDeviceScopeMutation.isPending}
                            />
                            <span className="toggle-slider"></span>
                          </label>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* 포트 정보 탭 */}
            {activeTab === 'port-info' && (
              <div id="port-info-tab" className="detail-tab-content active">
                {portsLoading ? (
                  <div id="port-loading" className="port-loading">
                    <i className="bi bi-arrow-repeat spinning"></i> 포트 정보를 불러오는 중...
                  </div>
                ) : portsData?.length > 0 ? (
                  <div id="port-table-wrapper" className="port-table-wrapper">
                    <table className="port-table">
                      <thead>
                        <tr>
                          <th className="sortable" onClick={() => handlePortSort('IF_INDEX')}>
                            Index {renderSortIcon('IF_INDEX', portSortField, portSortOrder)}
                          </th>
                          <th className="sortable" onClick={() => handlePortSort('IF_NAME')}>
                            이름 {renderSortIcon('IF_NAME', portSortField, portSortOrder)}
                          </th>
                          <th className="sortable" onClick={() => handlePortSort('IF_DESCR')}>
                            설명 {renderSortIcon('IF_DESCR', portSortField, portSortOrder)}
                          </th>
                          <th className="sortable" onClick={() => handlePortSort('IF_ALIAS')}>
                            별칭 {renderSortIcon('IF_ALIAS', portSortField, portSortOrder)}
                          </th>
                          <th className="sortable" onClick={() => handlePortSort('IF_TYPE')}>
                            타입 {renderSortIcon('IF_TYPE', portSortField, portSortOrder)}
                          </th>
                          <th className="sortable" onClick={() => handlePortSort('IF_MTU')}>
                            MTU {renderSortIcon('IF_MTU', portSortField, portSortOrder)}
                          </th>
                          <th className="sortable" onClick={() => handlePortSort('IF_HIGH_SPEED')}>
                            속도 {renderSortIcon('IF_HIGH_SPEED', portSortField, portSortOrder)}
                          </th>
                          <th className="sortable" onClick={() => handlePortSort('IF_PHYS_ADDRESS')}>
                            MAC {renderSortIcon('IF_PHYS_ADDRESS', portSortField, portSortOrder)}
                          </th>
                          <th className="sortable" onClick={() => handlePortSort('IF_ADMIN_STATUS')}>
                            Admin {renderSortIcon('IF_ADMIN_STATUS', portSortField, portSortOrder)}
                          </th>
                          <th className="sortable" onClick={() => handlePortSort('IF_OPER_STATUS')}>
                            Oper {renderSortIcon('IF_OPER_STATUS', portSortField, portSortOrder)}
                          </th>
                          <th className="sortable" onClick={() => handlePortSort('IF_OPER_FLAG')}>
                            Oper 감시 {renderSortIcon('IF_OPER_FLAG', portSortField, portSortOrder)}
                          </th>
                          <th className="sortable" onClick={() => handlePortSort('IF_PERF_FLAG')}>
                            성능 감시 {renderSortIcon('IF_PERF_FLAG', portSortField, portSortOrder)}
                          </th>
                        </tr>
                      </thead>
                      <tbody id="port-table-tbody">
                        {sortedPorts.map((port) => (
                          <tr key={port.IF_INDEX}>
                            <td>{port.IF_INDEX}</td>
                            <td>{port.IF_NAME || '-'}</td>
                            <td className={`${port.IF_DESCR && port.IF_DESCR.length > 15 ? 'tooltip-cell truncate-cell' : ''}`}>
                              {port.IF_DESCR || '-'}
                              {port.IF_DESCR && port.IF_DESCR.length > 15 && (
                                <span className="tooltip-text">{port.IF_DESCR}</span>
                              )}
                            </td>
                            <td className={`${port.IF_ALIAS && port.IF_ALIAS.length > 15 ? 'tooltip-cell truncate-cell' : ''}`}>
                              {port.IF_ALIAS || '-'}
                              {port.IF_ALIAS && port.IF_ALIAS.length > 15 && (
                                <span className="tooltip-text">{port.IF_ALIAS}</span>
                              )}
                            </td>
                            <td>
                              <span className={`port-type-badge ${getPortTypeBadgeClass(port.IF_TYPE)}`}>
                                {port.ifTypeText || getPortTypeText(port.IF_TYPE)}
                              </span>
                            </td>
                            <td>{port.IF_MTU || '-'}</td>
                            <td className="port-speed">{formatSpeed(port)}</td>
                            <td className="port-mac">{port.IF_PHYS_ADDRESS || '-'}</td>
                            <td>
                              <span className={`status-badge ${port.IF_ADMIN_STATUS === 1 ? 'up' : 'down'}`}>
                                {port.IF_ADMIN_STATUS === 1 ? 'Up' : 'Down'}
                              </span>
                            </td>
                            <td>
                              <span className={`status-badge ${port.IF_OPER_STATUS === 1 ? 'up' : 'down'}`}>
                                {port.IF_OPER_STATUS === 1 ? 'Up' : 'Down'}
                              </span>
                            </td>
                            <td>
                              <span
                                className={`flag-badge clickable ${port.IF_OPER_FLAG === 1 || port.IF_OPER_FLAG === true ? 'active' : 'inactive'}`}
                                onClick={(e) => { e.stopPropagation(); handleTogglePortFlag(port, 'IF_OPER_FLAG'); }}
                                title="클릭하여 토글"
                              >
                                {port.IF_OPER_FLAG === 1 || port.IF_OPER_FLAG === true ? 'ON' : 'OFF'}
                              </span>
                            </td>
                            <td>
                              <span
                                className={`flag-badge clickable ${port.IF_PERF_FLAG === 1 || port.IF_PERF_FLAG === true ? 'active' : 'inactive'}`}
                                onClick={(e) => { e.stopPropagation(); handleTogglePortFlag(port, 'IF_PERF_FLAG'); }}
                                title="클릭하여 토글"
                              >
                                {port.IF_PERF_FLAG === 1 || port.IF_PERF_FLAG === true ? 'ON' : 'OFF'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div id="port-empty" className="port-empty">
                    <i className="bi bi-ethernet"></i>
                    <p>등록된 포트가 없습니다.</p>
                  </div>
                )}
              </div>
            )}

            <div className="detail-modal-footer">
              <button id="detail-modal-ok-btn" className="btn btn-primary" onClick={() => setDetailDevice(null)}>
                <i className="bi bi-check-lg"></i> 확인
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
