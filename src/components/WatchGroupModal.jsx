import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import ReactECharts from 'echarts-for-react';
import { devicesApi } from '../api';
import { watchApi } from '../api/watch';

// 트래픽 포맷팅 함수
const formatBps = (bps) => {
  if (bps === null || bps === undefined || bps === 0) return '0';
  if (bps >= 1e9) return `${(bps / 1e9).toFixed(1)}G`;
  if (bps >= 1e6) return `${(bps / 1e6).toFixed(1)}M`;
  if (bps >= 1e3) return `${(bps / 1e3).toFixed(1)}K`;
  return `${bps.toFixed(0)}`;
};

// 포트별 미니 차트 컴포넌트 (테이블용)
function PortMiniChart({ deviceId, ifIndex }) {
  const { data: trafficData, isLoading } = useQuery({
    queryKey: ['portTraffic', deviceId, ifIndex],
    queryFn: async () => {
      const response = await devicesApi.getPortTraffic(deviceId, ifIndex, 30);
      return response.data?.data || [];
    },
    staleTime: 300000,
    enabled: !!deviceId && !!ifIndex,
  });

  const { peakIn, peakOut } = useMemo(() => {
    if (!trafficData || trafficData.length === 0) {
      return { peakIn: 0, peakOut: 0 };
    }
    const inValues = trafficData.map(d => d.IN_BPS || 0);
    const outValues = trafficData.map(d => d.OUT_BPS || 0);
    return {
      peakIn: Math.max(...inValues),
      peakOut: Math.max(...outValues),
    };
  }, [trafficData]);

  const chartOption = useMemo(() => {
    if (!trafficData || trafficData.length === 0) return null;
    const inData = trafficData.map(d => d.IN_BPS || 0);
    const outData = trafficData.map(d => d.OUT_BPS || 0);
    return {
      grid: { left: 0, right: 0, top: 2, bottom: 2 },
      xAxis: { type: 'category', show: false, data: trafficData.map((_, i) => i) },
      yAxis: { type: 'value', show: false },
      series: [
        { type: 'line', data: inData, smooth: true, symbol: 'none', lineStyle: { width: 1.5, color: '#3b82f6' }, areaStyle: { color: 'rgba(59, 130, 246, 0.2)' } },
        { type: 'line', data: outData, smooth: true, symbol: 'none', lineStyle: { width: 1.5, color: '#10b981' }, areaStyle: { color: 'rgba(16, 185, 129, 0.2)' } },
      ],
    };
  }, [trafficData]);

  if (isLoading) return <div className="port-mini-chart loading"><div className="mini-spinner"></div></div>;
  if (!chartOption) return <div className="port-mini-chart no-data"><span>-</span></div>;

  return (
    <div className="port-mini-chart-wrapper">
      <div className="port-mini-chart">
        <ReactECharts option={chartOption} style={{ width: 120, height: 32 }} opts={{ renderer: 'svg' }} />
      </div>
      <div className="port-traffic-info">
        <span className="traffic-peak">
          <span className="in">▲{formatBps(peakIn)}</span>
          <span className="out">▼{formatBps(peakOut)}</span>
        </span>
      </div>
    </div>
  );
}

export default function WatchGroupModal({ isOpen, onClose, onSave, editingGroup = null, parentGroupId = null, mode = null }) {
  // 폼 상태
  const [groupName, setGroupName] = useState('');
  const [selectedDevices, setSelectedDevices] = useState([]); // [{ deviceId, ifIndexes: [] }]
  const [browsingDeviceId, setBrowsingDeviceId] = useState(null); // 현재 포트를 보고 있는 장비

  // 장비 목록 조회
  const { data: devicesData, isLoading: devicesLoading } = useQuery({
    queryKey: ['allDevices'],
    queryFn: async () => {
      const response = await devicesApi.getAllDevices();
      return response.data?.data || [];
    },
    staleTime: 60000,
  });
  const devices = devicesData || [];

  // 편집 모드일 때 그룹 상세 정보 조회 (devices 정보 포함)
  const { data: groupDetailData } = useQuery({
    queryKey: ['watchGroupDetail', editingGroup?.watchGroupId],
    queryFn: async () => {
      if (!editingGroup?.watchGroupId) return null;
      const response = await watchApi.getGroupDetail(editingGroup.watchGroupId);
      const data = response.data?.data;
      if (!data) return null;
      return {
        watchGroupId: data.WATCH_GROUP_ID || data.watchGroupId,
        groupName: data.GROUP_NAME || data.groupName,
        devices: (data.devices || []).map(d => ({
          deviceId: d.DEVICE_ID || d.deviceId,
          ifIndexes: (d.interfaces || []).map(i => i.IF_INDEX || i.ifIndex),
        })),
      };
    },
    enabled: isOpen && !!editingGroup?.watchGroupId,
    staleTime: 0,
  });

  // 현재 보고 있는 장비의 포트 목록
  const { data: portsData, isLoading: portsLoading } = useQuery({
    queryKey: ['devicePorts', browsingDeviceId],
    queryFn: async () => {
      const response = await devicesApi.getDevicePorts(browsingDeviceId);
      return response.data?.data || [];
    },
    enabled: !!browsingDeviceId,
    staleTime: 60000,
  });
  const ports = portsData || [];

  // UP 상태 포트만 필터링
  const upPorts = useMemo(() => {
    return ports.filter(p => p.IF_OPER_STATUS === 1);
  }, [ports]);

  // 편집 모드일 때 초기값 설정 (groupDetailData 사용)
  useEffect(() => {
    if (editingGroup) {
      setGroupName(editingGroup.groupName || '');
    } else {
      setGroupName('');
      setSelectedDevices([]);
    }
    setBrowsingDeviceId(null);
  }, [editingGroup, isOpen]);

  // groupDetailData 로드 후 선택 상태 복원
  useEffect(() => {
    if (groupDetailData && groupDetailData.devices) {
      const deviceSelections = groupDetailData.devices.map(d => ({
        deviceId: d.deviceId,
        ifIndexes: d.ifIndexes || [],
      }));
      setSelectedDevices(deviceSelections);
    }
  }, [groupDetailData]);

  // 장비 선택 토글
  const toggleDeviceSelection = (deviceId) => {
    setSelectedDevices(prev => {
      const exists = prev.find(d => d.deviceId === deviceId);
      if (exists) {
        return prev.filter(d => d.deviceId !== deviceId);
      } else {
        return [...prev, { deviceId, ifIndexes: [] }];
      }
    });
  };

  // 장비가 선택되었는지 확인
  const isDeviceSelected = (deviceId) => {
    return selectedDevices.some(d => d.deviceId === deviceId);
  };

  // 인터페이스 선택 토글 (최대 5개 제한)
  const MAX_PORTS_PER_DEVICE = 5;

  const toggleInterfaceSelection = (deviceId, ifIndex) => {
    setSelectedDevices(prev => {
      const deviceExists = prev.find(d => d.deviceId === deviceId);

      // 장비가 선택되지 않은 상태에서 포트 선택 시 장비도 함께 선택
      if (!deviceExists) {
        return [...prev, { deviceId, ifIndexes: [ifIndex] }];
      }

      return prev.map(d => {
        if (d.deviceId !== deviceId) return d;
        const ifExists = d.ifIndexes.includes(ifIndex);

        // 이미 선택된 경우 제거
        if (ifExists) {
          return {
            ...d,
            ifIndexes: d.ifIndexes.filter(i => i !== ifIndex),
          };
        }

        // 새로 추가하려는 경우 최대 5개 제한 체크
        if (d.ifIndexes.length >= MAX_PORTS_PER_DEVICE) {
          alert(`포트는 장비당 최대 ${MAX_PORTS_PER_DEVICE}개까지만 선택할 수 있습니다.`);
          return d;
        }

        return {
          ...d,
          ifIndexes: [...d.ifIndexes, ifIndex],
        };
      });
    });
  };

  // 해당 장비의 선택된 포트 개수
  const getSelectedPortCount = (deviceId) => {
    const device = selectedDevices.find(d => d.deviceId === deviceId);
    return device?.ifIndexes?.length || 0;
  };

  // 인터페이스가 선택되었는지 확인
  const isInterfaceSelected = (deviceId, ifIndex) => {
    const device = selectedDevices.find(d => d.deviceId === deviceId);
    return device?.ifIndexes?.includes(ifIndex) || false;
  };

  // 장비 이름 가져오기
  const getDeviceName = (deviceId) => {
    const device = devices.find(d => d.DEVICE_ID === deviceId);
    return device?.DEVICE_NAME || `장비 ${deviceId}`;
  };

  // 저장 핸들러
  const handleSave = () => {
    if (!groupName.trim()) {
      alert('그룹명을 입력해주세요.');
      return;
    }

    // 수정 시: editingGroup의 기존 parentGroupId 유지
    // 생성 시: prop으로 받은 parentGroupId 사용
    const finalParentGroupId = editingGroup
      ? editingGroup.parentGroupId
      : parentGroupId;

    const data = {
      groupName: groupName.trim(),
      intervalSec: 5, // 5초 고정
      devices: selectedDevices,
      parentGroupId: finalParentGroupId, // 부모 그룹 ID 포함
    };

    onSave(data);
  };

  // 모달이 닫혀있으면 렌더링하지 않음
  if (!isOpen) return null;

  // 모달 타이틀 결정
  const getModalTitle = () => {
    if (mode === 'rename') return '그룹 이름 변경';
    if (mode === 'devices') return '관제 장비 설정';
    return editingGroup ? '관제 그룹 수정' : '관제 그룹 생성';
  };

  // 모달 크기 결정 (rename 모드는 작은 모달)
  const modalSizeClass = mode === 'rename' ? 'watch-modal-small' : 'watch-modal-large';

  return (
    <div className="watch-modal-overlay" onClick={onClose}>
      <div className={`watch-modal ${modalSizeClass}`} onClick={(e) => e.stopPropagation()}>
        <div className="watch-modal-header">
          <h3>{getModalTitle()}</h3>
          <button className="modal-close" onClick={onClose}>
            <i className="bi bi-x-lg"></i>
          </button>
        </div>

        <div className="watch-modal-body">
          {/* 그룹명 - rename 모드이거나 전체 모드일 때 표시 */}
          {(mode === 'rename' || mode === null) && (
            <div className="modal-form-group">
              <label>그룹명 *</label>
              <input
                type="text"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="관제 그룹명을 입력하세요"
                autoFocus
              />
            </div>
          )}

          {/* 장비 선택 영역 - devices 모드이거나 전체 모드일 때 표시 */}
          {(mode === 'devices' || mode === null) && (
          <div className="device-selection-area two-column">
            {/* LEFT: 장비 목록 */}
            <div className="device-list-panel">
              <h4>장비 목록</h4>
              {devicesLoading ? (
                <div className="watch-loading">
                  <div className="spinner"></div>
                  <p>장비 목록 로딩 중...</p>
                </div>
              ) : (
                <div className="device-list">
                  {devices.map((device) => (
                    <div
                      key={device.DEVICE_ID}
                      className={`device-list-item ${isDeviceSelected(device.DEVICE_ID) ? 'selected' : ''} ${browsingDeviceId === device.DEVICE_ID ? 'browsing' : ''}`}
                      onClick={() => setBrowsingDeviceId(device.DEVICE_ID)}
                    >
                      <input
                        type="checkbox"
                        checked={isDeviceSelected(device.DEVICE_ID)}
                        onChange={(e) => {
                          e.stopPropagation();
                          toggleDeviceSelection(device.DEVICE_ID);
                        }}
                      />
                      <span className="device-name">{device.DEVICE_NAME}</span>
                      <span className="device-ip">{device.DEVICE_IP}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* RIGHT: 포트 선택 패널 */}
            <div className="port-selection-panel">
              <h4>포트 선택 {browsingDeviceId && `(${getDeviceName(browsingDeviceId)})`}</h4>
              {browsingDeviceId ? (
                portsLoading ? (
                  <div className="port-loading">
                    <div className="mini-spinner"></div>
                    <span>포트 로딩 중...</span>
                  </div>
                ) : upPorts.length > 0 ? (
                  <div className="port-table-wrapper">
                    <div className="port-table-scroll">
                      <table className="port-table">
                        <thead>
                          <tr>
                            <th style={{ width: '50px' }} className="port-count-header">
                              {getSelectedPortCount(browsingDeviceId)}/{MAX_PORTS_PER_DEVICE}
                            </th>
                            <th>포트명</th>
                            <th style={{ width: '80px' }}>속도</th>
                            <th style={{ width: '180px' }}>최근 30분 트래픽</th>
                          </tr>
                        </thead>
                        <tbody>
                          {upPorts.map((port) => {
                            const isSelected = isInterfaceSelected(browsingDeviceId, port.IF_INDEX);
                            const isDisabled = !isSelected && getSelectedPortCount(browsingDeviceId) >= MAX_PORTS_PER_DEVICE;
                            return (
                              <tr
                                key={port.IF_INDEX}
                                className={`${isSelected ? 'selected' : ''} ${isDisabled ? 'disabled' : ''}`}
                              >
                                <td>
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    disabled={isDisabled}
                                    onChange={() => toggleInterfaceSelection(browsingDeviceId, port.IF_INDEX)}
                                  />
                                </td>
                                <td className="port-name">{port.IF_NAME || `if${port.IF_INDEX}`}</td>
                                <td className="port-speed">
                                  {port.IF_SPEED >= 1e9
                                    ? `${(port.IF_SPEED / 1e9).toFixed(0)}G`
                                    : port.IF_SPEED >= 1e6
                                    ? `${(port.IF_SPEED / 1e6).toFixed(0)}M`
                                    : `${port.IF_SPEED || '-'}`}
                                </td>
                                <td className="port-chart-cell">
                                  <PortMiniChart deviceId={browsingDeviceId} ifIndex={port.IF_INDEX} />
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="no-ports">
                    <i className="bi bi-ethernet"></i>
                    <span>UP 상태 포트가 없습니다</span>
                  </div>
                )
              ) : (
                <div className="empty-panel">
                  <i className="bi bi-arrow-left"></i>
                  <span>장비를 클릭하세요</span>
                </div>
              )}
            </div>
          </div>
          )}
        </div>

        <div className="watch-modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            취소
          </button>
          <button className="btn btn-primary" onClick={handleSave}>
            {editingGroup ? '수정' : '생성'}
          </button>
        </div>
      </div>
    </div>
  );
}
