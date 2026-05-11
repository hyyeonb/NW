import { useEffect, useRef, useCallback } from 'react';
import { useAlertStore } from '../stores/alertStore';
import { accountApi } from '../api/account';
import { notificationsApi } from '../api/notifications';

// WebSocket 설정
// VITE_ALERT_WS_URL 없으면 현재 origin 기반으로 자동 결정 (개발: localhost:8080, 운영: 현재 도메인)
const WS_URL = import.meta.env.VITE_ALERT_WS_URL
  || (import.meta.env.DEV
      ? 'http://localhost:8080/ws/alerts'
      : `${window.location.protocol}//${window.location.host}/ws/alerts`);
const RECONNECT_INTERVAL = 10000; // 10초 후 재연결
const HEARTBEAT_INTERVAL = 30000; // 30초마다 heartbeat
const MAX_RECONNECT_ATTEMPTS = 3; // 최대 재연결 시도 횟수

/**
 * Alert WebSocket Hook
 * STOMP over SockJS를 사용한 실시간 알림 수신
 * - 접근 가능 장비 필터링 (그룹 권한)
 * - 알림 환경설정 필터링 (유형별 ON/OFF, 방해금지)
 */
export function useAlertWebSocket(options = {}) {
  const {
    autoConnect = true,
    topics = ['/topic/alerts'],
  } = options;

  const stompClientRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const isConnectingRef = useRef(false);
  const isMountedRef = useRef(true);

  const {
    addAlert, setConnected, setSummary, setUrgentNotice, isMuted,
    setAccessibleDeviceIds, setNotificationPrefs,
  } = useAlertStore();

  // 접근 가능 장비 + 알림 환경설정 로드
  const loadPermissions = useCallback(async () => {
    try {
      const [devRes, prefRes] = await Promise.all([
        accountApi.getAccessibleDevices(),
        notificationsApi.getPreferences(),
      ]);
      const deviceIds = devRes.data?.data;
      const prefs = prefRes.data?.data;
      setAccessibleDeviceIds(deviceIds); // null = 전체 허용
      setNotificationPrefs(prefs);
    } catch (e) {
      console.warn('[WebSocket] Failed to load permissions:', e);
    }
  }, [setAccessibleDeviceIds, setNotificationPrefs]);

  // 알림 처리 (필터링 적용)
  const handleMessage = useCallback(
    (message) => {
      try {
        const alert = JSON.parse(message.body);
        const state = useAlertStore.getState();

        // 1. 접근 가능 장비 필터링
        const { accessibleDeviceIds } = state;
        if (accessibleDeviceIds !== null && alert.deviceId) {
          if (!accessibleDeviceIds.includes(alert.deviceId)) {
            return; // 접근 불가 장비 알림 무시
          }
        }

        // 2. 알림 유형 + 등급 필터링 (AND 조건)
        if (!state.isAlertEnabled(alert.alertType, alert.severity || alert.errorLevel)) {
          return; // 유형 또는 등급이 비활성화
        }

        // 3. 방해금지 시간대 체크
        const inQuiet = state.isInQuietHours();

        // 비활성 탭이면 알림 목록만 추가 (Toast/사운드 억제)
        const isHiddenTab = document.visibilityState === 'hidden';

        // 알림 목록에는 항상 추가 (이력 보존), Toast는 활성 탭에서만
        addAlert(alert, isHiddenTab);

        // 방해금지 또는 비활성 탭이면 소리/토스트 억제
        if (inQuiet || isHiddenTab) return;

        // CLEAR가 아닌 장애 알림일 때 소리 재생 (CRITICAL/MAJOR/MINOR/WARNING)
        if (!isMuted && !alert.isCleared) {
          const prefs = state.notificationPrefs;
          const volume = prefs?.SOUND_ENABLED !== false ? (prefs?.SOUND_VOLUME || 30) : 0;
          const type = prefs?.SOUND_TYPE || 'SINE';
          if (volume > 0) playAlertSound(type, volume, alert.severity);
        }

        // 브라우저 알림 (Notification API 사용 가능한 환경에서만)
        if (!alert.isCleared && typeof Notification !== 'undefined') {
          const prefs = state.notificationPrefs;
          if (prefs?.BROWSER_NOTIFY) {
            if (Notification.permission === 'granted') {
              new Notification(`[NMS] ${alert.alertType}`, {
                body: `${alert.deviceName || ''} - ${alert.message || ''}`,
                icon: '/logo-single.svg',
                tag: `nms-${alert.deviceId}-${alert.alertType}`, // 중복 방지
              });
            } else if (Notification.permission === 'default') {
              // 아직 권한 미결정 → 요청 (HTTPS 또는 localhost에서만 동작)
              Notification.requestPermission().then(perm => {
                if (perm === 'granted') {
                  new Notification(`[NMS] ${alert.alertType}`, {
                    body: `${alert.deviceName || ''} - ${alert.message || ''}`,
                    icon: '/logo-single.svg',
                  });
                }
              }).catch(() => {});
            }
          }
        }
      } catch (error) {
        console.error('[WebSocket] Failed to parse message:', error);
      }
    },
    [addAlert, isMuted]
  );

  // 연결 해제
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    reconnectAttemptsRef.current = MAX_RECONNECT_ATTEMPTS + 1;
    isConnectingRef.current = false;

    if (stompClientRef.current) {
      try {
        stompClientRef.current.deactivate();
      } catch (e) {
        // ignore
      }
      stompClientRef.current = null;
    }

    setConnected(false);
  }, [setConnected]);

  // 연결
  const connect = useCallback(async () => {
    if (isConnectingRef.current || stompClientRef.current?.connected) {
      return;
    }

    if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
      console.warn('[WebSocket] Max reconnect attempts reached. Stopping.');
      return;
    }

    if (!isMountedRef.current) {
      return;
    }

    isConnectingRef.current = true;

    // 연결 전 권한 정보 로드
    await loadPermissions();

    try {
      const { Client } = await import('@stomp/stompjs');
      const SockJS = (await import('sockjs-client')).default;

      const client = new Client({
        webSocketFactory: () => new SockJS(WS_URL),
        reconnectDelay: 0,
        heartbeatIncoming: HEARTBEAT_INTERVAL,
        heartbeatOutgoing: HEARTBEAT_INTERVAL,
        debug: () => {},
        onConnect: () => {
          isConnectingRef.current = false;
          reconnectAttemptsRef.current = 0;
          setConnected(true);

          // 토픽 구독
          topics.forEach((topic) => {
            client.subscribe(topic, handleMessage);
          });

          // 요약 정보 토픽 구독
          client.subscribe('/topic/alerts/summary', (message) => {
            try {
              const summary = JSON.parse(message.body);
              setSummary(summary);
            } catch (error) {
              console.error('[WebSocket] Failed to parse summary:', error);
            }
          });

          // 긴급 공지사항 토픽 구독
          client.subscribe('/topic/notice/urgent', (message) => {
            try {
              const notice = JSON.parse(message.body);
              setUrgentNotice(notice);
            } catch (error) {
              console.error('[WebSocket] Failed to parse urgent notice:', error);
            }
          });
        },
        onDisconnect: () => {
          isConnectingRef.current = false;
          setConnected(false);
        },
        onStompError: (frame) => {
          console.error('[WebSocket] STOMP Error:', frame.headers?.message);
          isConnectingRef.current = false;
          setConnected(false);
        },
      });

      stompClientRef.current = client;
      client.activate();
    } catch (error) {
      console.error('[WebSocket] Connection failed:', error);
      isConnectingRef.current = false;
      setConnected(false);

      if (isMountedRef.current && reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
        reconnectAttemptsRef.current += 1;
        const delay = RECONNECT_INTERVAL * reconnectAttemptsRef.current;

        reconnectTimeoutRef.current = setTimeout(() => {
          if (isMountedRef.current) {
            isConnectingRef.current = false;
            connect();
          }
        }, delay);
      }
    }
  }, [topics, handleMessage, setConnected, setSummary, setUrgentNotice, loadPermissions]);

  // 자동 연결 / 정리
  useEffect(() => {
    isMountedRef.current = true;
    reconnectAttemptsRef.current = 0;

    if (autoConnect) {
      const timer = setTimeout(() => {
        if (isMountedRef.current) {
          connect();
        }
      }, 500);

      return () => {
        clearTimeout(timer);
        isMountedRef.current = false;
        disconnect();
      };
    }

    return () => {
      isMountedRef.current = false;
      disconnect();
    };
  }, [autoConnect]);

  return {
    connect,
    disconnect,
    isConnected: useAlertStore((state) => state.isConnected),
  };
}

// 알림음 재생 (환경설정 반영)
// 공유 AudioContext (사용자 인터랙션 후 resume 보장)
let sharedAudioCtx = null;
function getAudioCtx() {
  if (!sharedAudioCtx) {
    sharedAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  // suspended 상태면 resume (Chrome 자동재생 정책)
  if (sharedAudioCtx.state === 'suspended') {
    sharedAudioCtx.resume().catch(() => {});
  }
  return sharedAudioCtx;
}

// 사용자 최초 클릭 시 AudioContext resume (Chrome 정책 대응)
if (typeof document !== 'undefined') {
  const resumeAudio = () => {
    if (sharedAudioCtx?.state === 'suspended') sharedAudioCtx.resume();
    document.removeEventListener('click', resumeAudio);
    document.removeEventListener('keydown', resumeAudio);
  };
  document.addEventListener('click', resumeAudio, { once: true });
  document.addEventListener('keydown', resumeAudio, { once: true });
}

function playAlertSound(type = 'SINE', volume = 30, severity = 'CRITICAL') {
  try {
    const ctx = getAudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    gain.gain.value = volume / 100;
    osc.connect(gain);
    gain.connect(ctx.destination);

    // 심각도별 주파수 + 재생 시간 차등
    const severityConfig = {
      CRITICAL: { freq: 880, duration: 0.5, wave: 'sawtooth' },
      MAJOR:    { freq: 660, duration: 0.3, wave: 'square' },
      MINOR:    { freq: 523, duration: 0.2, wave: 'sine' },
      WARNING:  { freq: 440, duration: 0.15, wave: 'sine' },
    };
    const typeOverride = { SINE: 'sine', BEEP: 'square', CHIME: 'sine', ALARM: 'sawtooth' };

    const config = severityConfig[severity] || severityConfig.WARNING;
    osc.frequency.value = config.freq;
    osc.type = typeOverride[type] || config.wave;

    osc.start();
    osc.stop(ctx.currentTime + config.duration);

    // CRITICAL: 2연타
    if (severity === 'CRITICAL') {
      setTimeout(() => {
        try {
          const osc2 = ctx.createOscillator();
          const gain2 = ctx.createGain();
          gain2.gain.value = volume / 100;
          osc2.connect(gain2);
          gain2.connect(ctx.destination);
          osc2.frequency.value = config.freq * 1.2;
          osc2.type = config.wave;
          osc2.start();
          osc2.stop(ctx.currentTime + 0.3);
        } catch {}
      }, 300);
    }
  } catch (error) {
    // 무시 — AudioContext 미지원 환경
  }
}

export default useAlertWebSocket;
