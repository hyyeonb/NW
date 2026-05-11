import GroupSidebar from '../features/topology-sidebar/components/GroupSidebar';
import DeviceListSidebar from '../features/topology-sidebar/components/DeviceListSidebar';

export default function TopologySidebar({ onSelectDevice, selectedDevice, isEditMode, onAddMultipleDevices, onGroupSelect, registeredDeviceIds, topologyLoading }) {
  return (
    <div className="topology-sidebars-wrapper">
      <GroupSidebar isEditMode={isEditMode} onGroupSelect={onGroupSelect} />
      <DeviceListSidebar
        selectedDevice={selectedDevice}
        onSelectDevice={onSelectDevice}
        isEditMode={isEditMode}
        onAddMultipleDevices={onAddMultipleDevices}
        registeredDeviceIds={registeredDeviceIds}
        topologyLoading={topologyLoading}
      />
    </div>
  );
}
