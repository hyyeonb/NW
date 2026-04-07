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

  // 접근 가능 장비 ID (null = 전체, [] = 없음)
  accessibleDeviceIds: null,
  setAccessibleDeviceIds: (ids) => set({ accessibleDeviceIds: ids }),

  // 알림 환경설정
  notificationPrefs: null,
  setNotificationPrefs: (prefs) => set({ notificationPrefs: prefs }),

  // 알림 필터 확인 (유형 AND 등급 모두 ON이어야 true)
  isAlertEnabled: (alertType, severity) => {
    const { notificationPrefs } = get();
    if (!notificationPrefs) return true;

    // 1. 유형 체크
    const typeMap = {
      SNMP_FAIL: 'NOTIFY_SNMP', SNMP_CLEAR: 'NOTIFY_SNMP',
      PING_FAIL: 'NOTIFY_ICMP', PING_CLEAR: 'NOTIFY_ICMP',
      PORT_DOWN: 'NOTIFY_PORT', PORT_UP: 'NOTIFY_PORT',
      CPU_THRESHOLD: 'NOTIFY_CPU_MEM', MEM_THRESHOLD: 'NOTIFY_CPU_MEM', THRESHOLD_CLEAR: 'NOTIFY_CPU_MEM',
      TRAFFIC_THRESHOLD: 'NOTIFY_TRAFFIC', TRAFFIC_CLEAR: 'NOTIFY_TRAFFIC',
      URGENT: 'NOTIFY_URGENT',
    };
    const typePref = typeMap[alertType];
    if (typePref && notificationPrefs[typePref] === false) return false;

    // 2. 등급 체크
    const sevMap = {
      CRITICAL: 'NOTIFY_CRITICAL', C: 'NOTIFY_CRITICAL',
      MAJOR: 'NOTIFY_MAJOR', M: 'NOTIFY_MAJOR',
      MINOR: 'NOTIFY_MINOR', N: 'NOTIFY_MINOR',
      WARNING: 'NOTIFY_WARNING', W: 'NOTIFY_WARNING',
    };
    const sevPref = sevMap[severity];
    if (sevPref && notificationPrefs[sevPref] === false) return false;

    return true;
  },

  // 방해금지 시간대 여부
  isInQuietHours: () => {
    const { notificationPrefs } = get();
    if (!notificationPrefs?.QUIET_ENABLED) return false;
    const now = new Date();
    const h = now.getHours();
    const m = now.getMinutes();
    const current = h * 60 + m;
    const parse = (t) => {
      if (!t) return 0;
      const [hh, mm] = t.split(':').map(Number);
      return hh * 60 + (mm || 0);
    };
    const start = parse(notificationPrefs.QUIET_START_TIME);
    const end = parse(notificationPrefs.QUIET_END_TIME);
    if (start <= end) return current >= start && current <= end;
    return current >= start || current <= end;
  },

  // 새 알림 추가 (skipToast: 비활성 탭에서 Toast 억제)
  addAlert: (alert, skipToast = false) =>
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
        const clearAlerts = [alert, ...updatedAlerts];
        return {
          alerts: clearAlerts.length > MAX_ALERTS ? clearAlerts.slice(0, MAX_ALERTS) : clearAlerts,
          toasts: state.toasts,
        };
      }

      // 신규 장애 알림
      const newAlerts = [alert, ...state.alerts];
      return {
        alerts: newAlerts.length > MAX_ALERTS ? newAlerts.slice(0, MAX_ALERTS) : newAlerts,
        toasts: skipToast ? state.toasts : addToast(state.toasts, alert),
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
