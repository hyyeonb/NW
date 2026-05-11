import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { devicesApi } from '../../../api/devices';
import { watchApi } from '../../../api/watch';

const extractDevices = (rawData) => {
  if (!rawData) return [];
  const arr = rawData.content || rawData.devices || rawData;
  if (!Array.isArray(arr)) return [];
  return arr.map(d => ({
    deviceId: d.DEVICE_ID ?? d.deviceId,
    deviceName: d.DEVICE_NAME ?? d.deviceName,
    deviceIp: d.DEVICE_IP ?? d.deviceIp,
    modelName: d.MODEL_NAME ?? d.modelName,
  })).filter(d => d.deviceId != null);
};

// 선택 그룹(일반 / 커스텀 watchGroup)으로부터 장비 목록을 가져온다.
// 커스텀 그룹은 watchApi.getGroupDetail 사용, 일반 그룹은 devicesApi.getDevicesByGroup 사용.
export function usePerfDeviceList(selectedGroup) {
  const isCustom = selectedGroup?.watchGroupId != null && selectedGroup?.type !== 'regular';
  const groupId = isCustom
    ? selectedGroup.watchGroupId
    : (selectedGroup?.groupId ?? selectedGroup?.GROUP_ID);
  const groupName = selectedGroup?.groupName || selectedGroup?.GROUP_NAME || '';

  const { data: groupDevices = [] } = useQuery({
    queryKey: ['pe-group-devices', isCustom ? 'watch' : 'regular', groupId],
    queryFn: async () => {
      if (!groupId) return [];
      if (isCustom) {
        const r = await watchApi.getGroupDetail(groupId);
        const data = r.data?.data;
        return (data?.devices || []).map(d => ({
          deviceId: d.DEVICE_ID ?? d.deviceId,
          deviceName: d.DEVICE_NAME ?? d.deviceName,
          deviceIp: d.DEVICE_IP ?? d.deviceIp,
          modelName: d.MODEL_NAME ?? d.modelName,
        })).filter(d => d.deviceId != null);
      }
      const r = await devicesApi.getDevicesByGroup(groupId);
      return extractDevices(r.data?.data);
    },
    enabled: !!groupId,
    staleTime: 60000,
  });

  const deviceIds = useMemo(() => groupDevices.map(d => d.deviceId), [groupDevices]);

  return { groupId, groupName, isCustom, groupDevices, deviceIds };
}
