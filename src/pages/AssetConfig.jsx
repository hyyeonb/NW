import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { GroupTree, DataTable } from '../components';
import { useGroupStore } from '../stores';
import apiClient from '../api/client';

// 장비 목록 조회 훅
const useDeviceConfigList = (groupId, page, size, sort, order, search = {}) => {
  const searchKey = JSON.stringify(search);

  return useQuery({
    queryKey: ['deviceConfigList', groupId, page, size, sort, order, searchKey],
    queryFn: async () => {
      if (!groupId) return { content: [], totalElements: 0 };

      const params = {
        includeChildren: true,
        page,
        size,
        sort,
        order,
      };

      if (search.deviceName) params.deviceName = search.deviceName;
      if (search.deviceIp) params.deviceIp = search.deviceIp;

      const response = await apiClient.get(`/device-config/devices/by-group/${groupId}`, { params });
      return response.data?.data || { content: [], totalElements: 0 };
    },
    enabled: !!groupId,
    staleTime: 30000,
    placeholderData: (previousData) => previousData,
  });
};

export default function AssetConfig() {
  const navigate = useNavigate();
  const { selectedGroup } = useGroupStore();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedDevices, setSelectedDevices] = useState([]);

  // 장비 테이블 정렬 상태 (기본: ID 오름차순)
  const [deviceSortField, setDeviceSortField] = useState('DEVICE_ID');
  const [deviceSortOrder, setDeviceSortOrder] = useState('asc');

  // 검색 상태
  const [searchDeviceName, setSearchDeviceName] = useState('');
  const [searchDeviceIp, setSearchDeviceIp] = useState('');

  // 그룹 변경 시 페이지 및 검색 초기화
  useEffect(() => {
    setPage(1);
    setSelectedDevices([]);
    setSearchDeviceName('');
    setSearchDeviceIp('');
  }, [selectedGroup?.GROUP_ID]);

  // 검색 파라미터 (useMemo로 불필요한 객체 생성 방지)
  const searchParams = useMemo(() => ({
    deviceName: searchDeviceName.trim(),
    deviceIp: searchDeviceIp.trim()
  }), [searchDeviceName, searchDeviceIp]);

  // 검색 초기화 함수
  const handleSearchReset = () => {
    setSearchDeviceName('');
    setSearchDeviceIp('');
    setPage(1);
  };

  // 서버 측 페이지네이션 + 정렬 + 검색 사용
  const { data: devicesData, isLoading } = useDeviceConfigList(
    selectedGroup?.GROUP_ID,
    page,
    pageSize,
    deviceSortField,
    deviceSortOrder,
    searchParams
  );

  // 서버 측 페이지네이션 + 정렬 결과 사용
  const pagedDevices = devicesData?.content || [];
  const totalElements = devicesData?.totalElements || 0;

  // 장비 테이블 정렬 핸들러
  const handleDeviceSort = (field) => {
    if (deviceSortField === field) {
      setDeviceSortOrder(deviceSortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setDeviceSortField(field);
      setDeviceSortOrder('asc');
    }
    setPage(1);
  };

  // 행 클릭 시 상세 페이지로 이동
  const handleRowClick = (device) => {
    navigate(`/mgmt/asset-config/${device.deviceId}`, {
      state: { deviceName: device.deviceNm, deviceIp: device.deviceIp }
    });
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('ko-KR');
  };

  // 장비 테이블 컬럼 정의
  const deviceColumns = useMemo(() => [
    {
      key: 'deviceNm',
      label: '장비명',
      width: '25%',
      minWidth: '180px',
      sortable: true,
      className: 'cell-truncate',
    },
    {
      key: 'groupNm',
      label: '그룹',
      width: '20%',
      minWidth: '120px',
      sortable: true,
      className: 'cell-truncate',
      render: (value) => (
        <span style={{ color: '#94a3b8' }}>{value || '-'}</span>
      ),
    },
    {
      key: 'deviceIp',
      label: 'IP 주소',
      width: '15%',
      minWidth: '130px',
      sortable: true,
      className: 'cell-ip',
    },
    {
      key: 'modelNm',
      label: '모델',
      width: '20%',
      minWidth: '120px',
      sortable: true,
      className: 'cell-truncate',
      render: (value) => value || '-',
    },
    {
      key: 'deviceConfigDate',
      label: '최근 수집일',
      width: '15%',
      minWidth: '120px',
      sortable: true,
      className: 'cell-date',
      render: (value) => {
        if (!value) return <span style={{ color: '#64748b' }}>미수집</span>;
        return (
          <span style={{ color: '#4ade80' }}>
            {formatDate(value)}
          </span>
        );
      },
    },
    {
      key: 'actions',
      label: '',
      width: '60px',
      render: (_, row) => (
        <button
          className="btn btn-icon-only btn-sm"
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/mgmt/asset-config/${row.deviceId}`, {
              state: { deviceName: row.deviceNm, deviceIp: row.deviceIp }
            });
          }}
          title="설정 비교"
        >
          <i className="bi bi-file-diff"></i>
        </button>
      ),
    },
  ], [navigate]);

  return (
    <div className="page-container">
      <GroupTree />
      <main className="page-main-content">
        {/* 페이지 헤더 */}
        <div className="page-header">
          <div className="page-header-left">
            <h1 className="page-title">
              <i className="bi bi-sliders"></i>
              자산 Config 관리
            </h1>
            <span className="page-subtitle">장비의 Config 정보를 조회하고 비교합니다</span>
            {selectedGroup && (
              <span className="selected-group-badge">
                <i className="bi bi-folder2"></i>
                {selectedGroup.GROUP_NAME}
              </span>
            )}
          </div>
        </div>

        {!selectedGroup ? (
          <p id="welcome-message">그룹을 선택하여 해당 그룹의 장비 설정 목록을 확인하세요.</p>
        ) : isLoading ? (
          <p style={{ color: '#94a3b8' }}>로딩 중...</p>
        ) : (
          <div id="device-list-section" style={{ display: 'block' }}>
            {/* 검색 필터 바 */}
            <div className="filter-bar glass-card">
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
                  value={searchDeviceIp}
                  onChange={(e) => setSearchDeviceIp(e.target.value)}
                />
              </div>
              <div className="filter-actions">
                <button className="btn btn-icon-only" onClick={handleSearchReset} title="초기화">
                  <i className="bi bi-arrow-counterclockwise"></i>
                </button>
              </div>
            </div>

            <DataTable
              columns={deviceColumns}
              data={pagedDevices}
              rowKey="deviceId"
              loading={isLoading}
              loadingText="장비 정보를 불러오는 중..."
              emptyText="등록된 장비가 없습니다"
              emptyIcon="bi-hdd-rack"
              sort={{ field: deviceSortField, order: deviceSortOrder }}
              onSort={handleDeviceSort}
              selectable={false}
              onRowClick={handleRowClick}
              pagination={{
                currentPage: page,
                pageSize: pageSize,
                totalItems: totalElements,
                onPageChange: setPage,
                onPageSizeChange: (newSize) => {
                  setPageSize(newSize);
                  setPage(1);
                },
              }}
              maxHeight="calc(100vh - 300px)"
            />
          </div>
        )}
      </main>
    </div>
  );
}
