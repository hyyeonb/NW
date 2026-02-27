import { create } from 'zustand';

// 최대 저장할 알림 수
const MAX_ALERTS = 100;
const MAX_TOASTS = 5;

export const useAlertStore = create((set, get) => ({
  // 전체 알림 목록 (히스토리)
  alerts: [],

  // 현재 표시 중인 Toast 알림
  toasts: [],

  // 현재 장애 수 요약
  summary: {
    total: 0,
    critical: 0,
    major: 0,
    minor: 0,
    warning: 0,
  },

  // WebSocket 연결 상태
  isConnected: false,

  // 알림 음소거 상태
  isMuted: false,

  // 새 알림 추가
  addAlert: (alert) =>
    set((state) => {
      // 장애 해소 알림인 경우 (isCleared = true)
      if (alert.isCleared) {
        // 기존 장애 목록에서 해당 장애 제거
        const updatedAlerts = state.alerts.filter(
          (a) =>
            !(
              a.deviceId === alert.deviceId &&
              a.alertType === getClearTargetType(alert.alertType) &&
              (alert.ifIndex === null || a.ifIndex === alert.ifIndex)
            )
        );

        // CLEAR 알림은 목록에만 추가, Toast는 띄우지 않음
        return {
          alerts: [alert, ...updatedAlerts].slice(0, MAX_ALERTS),
          toasts: state.toasts, // Toast 유지 (CLEAR 알림은 Toast 표시 안함)
        };
      }

      // 신규 장애 알림
      return {
        alerts: [alert, ...state.alerts].slice(0, MAX_ALERTS),
        toasts: addToast(state.toasts, alert),
      };
    }),

  // Toast 제거
  removeToast: (alertId) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.alertId !== alertId),
    })),

  // 모든 Toast 제거
  clearToasts: () => set({ toasts: [] }),

  // 알림 요약 업데이트
  setSummary: (summary) => set({ summary }),

  // 알림 목록 설정 (초기 로딩 시)
  setAlerts: (alerts) => set({ alerts }),

  // WebSocket 연결 상태 설정
  setConnected: (isConnected) => set({ isConnected }),

  // 음소거 토글
  toggleMute: () =>
    set((state) => ({ isMuted: !state.isMuted })),

  // 음소거 설정
  setMuted: (isMuted) => set({ isMuted }),

  // 특정 심각도 알림 필터
  getAlertsBySeverity: (severity) => {
    const { alerts } = get();
    return alerts.filter((a) => a.severity === severity && !a.isCleared);
  },

  // 특정 카테고리 알림 필터
  getAlertsByCategory: (category) => {
    const { alerts } = get();
    return alerts.filter((a) => a.category === category && !a.isCleared);
  },

  // 현재 장애만 필터 (해소되지 않은 것)
  getCurrentAlerts: () => {
    const { alerts } = get();
    return alerts.filter((a) => !a.isCleared);
  },

  // 특정 장비의 장애 조회
  getAlertsByDevice: (deviceId) => {
    const { alerts } = get();
    return alerts.filter((a) => a.deviceId === deviceId && !a.isCleared);
  },

  // 알림 초기화
  clearAlerts: () =>
    set({
      alerts: [],
      toasts: [],
      summary: { total: 0, critical: 0, major: 0, minor: 0, warning: 0 },
    }),

  // 긴급 공지사항
  urgentNotice: null,

  // 긴급 공지 설정
  setUrgentNotice: (notice) => set({ urgentNotice: notice }),

  // 긴급 공지 닫기
  clearUrgentNotice: () => set({ urgentNotice: null }),
}));

// Toast 추가 헬퍼 (최대 개수 제한)
function addToast(toasts, alert) {
  const newToast = {
    ...alert,
    timestamp: Date.now(),
  };
  return [newToast, ...toasts].slice(0, MAX_TOASTS);
}

// 해소 알림 타입에서 원본 장애 타입 추출
function getClearTargetType(alertType) {
  if (!alertType) return null;

  const clearMap = {
    PING_CLEAR: 'PING_FAIL',
    SNMP_CLEAR: 'SNMP_FAIL',
    PORT_UP: 'PORT_DOWN',
  };

  return clearMap[alertType] || alertType.replace('_CLEAR', '_FAIL');
}
