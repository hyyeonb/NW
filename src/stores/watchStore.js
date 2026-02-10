import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useWatchStore = create(
  persist(
    (set, get) => ({
      // 선택된 관제 그룹
      selectedWatchGroup: null,
      setSelectedWatchGroup: (group) => set({ selectedWatchGroup: group }),

      // 관제 실행 상태
      isWatching: false,
      setIsWatching: (value) => set({ isWatching: value }),

      // 선택된 장비 (카드 확장용)
      expandedDeviceId: null,
      setExpandedDeviceId: (deviceId) => set({ expandedDeviceId: deviceId }),

      // 인터페이스 선택 (트래픽 차트용)
      selectedInterfaces: {}, // { [deviceId]: ifIndex }
      setSelectedInterface: (deviceId, ifIndex) => set((state) => ({
        selectedInterfaces: {
          ...state.selectedInterfaces,
          [deviceId]: ifIndex,
        },
      })),

      // 마지막 갱신 시간
      lastUpdated: null,
      setLastUpdated: (time) => set({ lastUpdated: time }),

      // 그리드 사이즈 프리셋
      gridSize: 'S', // 'S' | 'M' | 'L'
      setGridSize: (size) => set({ gridSize: size }),

      // 전역 차트 설정
      globalChartSettings: {
        showCpu: false,
        showMem: false,
        counterType: '32bit', // '32bit' | '64bit'
        showError: false,
        showDiscard: false,
        trafficUnit: 'bit', // 'bit' | 'byte' | 'bps'
      },
      setGlobalChartSettings: (settings) => set({ globalChartSettings: settings }),

      // 일괄 설정 적용 트리거 (카운터 증가 시 각 카드에서 감지)
      globalSettingsVersion: 0,
      applyGlobalSettings: () => set((state) => ({
        globalSettingsVersion: state.globalSettingsVersion + 1,
      })),

      // 그룹 편집 모달
      isGroupModalOpen: false,
      editingGroup: null, // null이면 생성, 값이 있으면 수정
      parentGroupIdForCreate: null, // 하위 그룹 생성 시 부모 ID
      modalMode: null, // 'rename' | 'devices' | null (전체 편집)
      openGroupModal: (group = null, parentGroupId = null, mode = null) => set({
        isGroupModalOpen: true,
        editingGroup: group,
        parentGroupIdForCreate: parentGroupId,
        modalMode: mode,
      }),
      closeGroupModal: () => set({
        isGroupModalOpen: false,
        editingGroup: null,
        parentGroupIdForCreate: null,
        modalMode: null,
      }),

      // 드래그 앤 드롭
      draggedWatchGroup: null,
      setDraggedWatchGroup: (group) => set({ draggedWatchGroup: group }),

      // 아이콘 모달
      iconModalWatchGroup: null,
      showIconModal: (group) => set({ iconModalWatchGroup: group }),
      hideIconModal: () => set({ iconModalWatchGroup: null }),

      // 초기화
      reset: () => set({
        selectedWatchGroup: null,
        isWatching: false,
        expandedDeviceId: null,
        selectedInterfaces: {},
        lastUpdated: null,
        draggedWatchGroup: null,
        iconModalWatchGroup: null,
        globalSettingsVersion: 0,
      }),
    }),
    {
      name: 'watch-storage',
      partialize: (state) => ({
        selectedWatchGroup: state.selectedWatchGroup,
        selectedInterfaces: state.selectedInterfaces,
        globalChartSettings: state.globalChartSettings,
        gridSize: state.gridSize,
      }),
    }
  )
);
