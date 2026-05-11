/* eslint-disable max-lines, max-lines-per-function, complexity, max-depth */
import { useState, useEffect } from 'react';
import { useDevicesByGroup } from '../../../hooks/useDevices';
import { useGroupStore } from '../../../stores/groupStore';

function DeviceListSidebar({ selectedDevice, onSelectDevice, isEditMode, onAddMultipleDevices, registeredDeviceIds = new Set(), topologyLoading = false }) {
  const { selectedGroup } = useGroupStore();
  const { data: devicesData, isLoading, error } = useDevicesByGroup(selectedGroup?.GROUP_ID);
  const devices = devicesData?.content || [];
  const [checkedDevices, setCheckedDevices] = useState(new Set());

  // 토폴로지에 등록되지 않은 장비인지 확인 (토폴로지 로딩 중이면 체크하지 않음)
  const isNotRegistered = (deviceId) => {
    if (topologyLoading) return false; // 로딩 중이면 미등록 표시 안함
    return !registeredDeviceIds.has(String(deviceId)) && !registeredDeviceIds.has(deviceId);
  };

  // 그룹 변경 시 체크 초기화
  useEffect(() => {
    setCheckedDevices(new Set());
  }, [selectedGroup?.GROUP_ID]);

  // 드래그 시작 핸들러
  const handleDragStart = (e, device) => {
    if (!isEditMode) {
      e.preventDefault();
      return;
    }
    e.dataTransfer.setData('application/json', JSON.stringify(device));
    e.dataTransfer.effectAllowed = 'copy';
  };

  // 체크박스 토글
  const handleCheckToggle = (e, deviceId) => {
    e.stopPropagation();
    setCheckedDevices(prev => {
      const newSet = new Set(prev);
      if (newSet.has(deviceId)) {
        newSet.delete(deviceId);
      } else {
        newSet.add(deviceId);
      }
      return newSet;
    });
  };

  // 전체 선택/해제
  const handleSelectAll = () => {
    if (checkedDevices.size === devices.length) {
      setCheckedDevices(new Set());
    } else {
      setCheckedDevices(new Set(devices.map(d => d.DEVICE_ID)));
    }
  };

  // 선택된 장비들 토폴로지에 추가
  const handleAddSelected = () => {
    const selectedDevices = devices.filter(d => checkedDevices.has(d.DEVICE_ID));
    if (selectedDevices.length > 0 && onAddMultipleDevices) {
      onAddMultipleDevices(selectedDevices);
      setCheckedDevices(new Set());
    }
  };

  if (!selectedGroup) {
    return (
      <aside className="topology-sidebar topology-device-sidebar">
        <div className="topology-sidebar-header">
          <h3>장비 목록</h3>
        </div>
        <div className="topology-sidebar-content">
          <div className="topology-empty-state">
            <i className="bi bi-arrow-left-circle"></i>
            <span>그룹을 선택하세요</span>
          </div>
        </div>
      </aside>
    );
  }

  const isAllChecked = devices.length > 0 && checkedDevices.size === devices.length;
  const hasChecked = checkedDevices.size > 0;

  return (
    <aside className="topology-sidebar topology-device-sidebar">
      <div className="topology-sidebar-header">
        <h3>장비 목록</h3>
        <span className="topology-sidebar-badge">{devices.length}</span>
      </div>
      <div className="topology-sidebar-subheader">
        <i className="bi bi-folder2"></i>
        <span title={selectedGroup.GROUP_NAME}>{selectedGroup.GROUP_NAME}</span>
      </div>

      {/* 편집 모드에서 다중 선택 툴바 */}
      {isEditMode && devices.length > 0 && (
        <div className="topology-multi-select-toolbar">
          <label className="topology-checkbox-label" onClick={handleSelectAll}>
            <input
              type="checkbox"
              checked={isAllChecked}
              onChange={handleSelectAll}
              className="topology-checkbox"
            />
            <span>전체 선택</span>
          </label>
          {hasChecked && (
            <button
              className="topology-add-selected-btn"
              onClick={handleAddSelected}
            >
              <i className="bi bi-plus-circle"></i>
              <span>{checkedDevices.size}개 추가</span>
            </button>
          )}
        </div>
      )}

      <div className="topology-sidebar-content">
        {isLoading ? (
          <div className="topology-loading-state">
            <i className="bi bi-arrow-repeat spinning"></i>
            <span>로딩 중...</span>
          </div>
        ) : devices.length > 0 ? (
          <ul className="topology-device-list">
            {[...devices]
              .sort((a, b) => {
                // 미등록 장비를 상단에 정렬
                const aNotRegistered = isNotRegistered(a.DEVICE_ID);
                const bNotRegistered = isNotRegistered(b.DEVICE_ID);
                if (aNotRegistered && !bNotRegistered) return -1;
                if (!aNotRegistered && bNotRegistered) return 1;
                return 0;
              })
              .map((device) => {
              const notRegistered = isNotRegistered(device.DEVICE_ID);
              return (
                <li
                  key={device.DEVICE_ID}
                  className={`topology-device-item ${selectedDevice?.DEVICE_ID === device.DEVICE_ID ? 'selected' : ''} ${isEditMode ? 'draggable' : ''} ${checkedDevices.has(device.DEVICE_ID) ? 'checked' : ''} ${notRegistered ? 'not-registered' : ''}`}
                  onClick={() => onSelectDevice(device)}
                  title={isEditMode
                    ? `드래그하여 토폴로지에 추가: ${device.DEVICE_NAME} (${device.DEVICE_IP})${notRegistered ? ' - 미등록' : ''}`
                    : `${device.DEVICE_NAME} (${device.DEVICE_IP})${notRegistered ? ' - 토폴로지 미등록' : ''}`}
                  draggable={isEditMode}
                  onDragStart={(e) => handleDragStart(e, device)}
                >
                  {isEditMode && (
                    <input
                      type="checkbox"
                      checked={checkedDevices.has(device.DEVICE_ID)}
                      onChange={(e) => handleCheckToggle(e, device.DEVICE_ID)}
                      onClick={(e) => e.stopPropagation()}
                      className="topology-device-checkbox"
                    />
                  )}
                  <i className={`bi ${notRegistered ? 'bi-exclamation-circle' : 'bi-hdd-network'} device-icon ${notRegistered ? 'not-registered-icon' : ''}`}></i>
                  <div className="device-info">
                    <span className={`device-name ${notRegistered ? 'not-registered-name' : ''}`} title={device.DEVICE_NAME || device.DEVICE_ID}>
                      {device.DEVICE_NAME || device.DEVICE_ID}
                      {notRegistered && <span className="not-registered-badge">미등록</span>}
                    </span>
                    <span className="device-ip">{device.DEVICE_IP || '-'}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="topology-empty-state">
            <i className="bi bi-hdd-network"></i>
            <span>장비 없음</span>
          </div>
        )}
      </div>
    </aside>
  );
}

// 메인 TopologySidebar 컴포넌트


export default DeviceListSidebar;
