import { useEffect, useRef, useCallback } from 'react';
import { useAlertStore } from '../stores/alertStore';
import { accountApi } from '../api/account';
import { notificationsApi } from '../api/notifications';

// WebSocket 설정
const WS_URL = import.meta.env.VITE_WS_URL || 'http://localhost:8080/ws/alerts';
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

        // 알림 목록에는 항상 추가 (이력 보존)
        addAlert(alert);

        // 방해금지 중이면 소리/토스트 억제
        if (inQuiet) return;

        // CLEAR가 아닌 CRITICAL 알림일 때만 소리 재생
        if (!isMuted && alert.severity === 'CRITICAL' && !alert.isCleared) {
          const prefs = state.notificationPrefs;
          const volume = prefs?.SOUND_ENABLED !== false ? (prefs?.SOUND_VOLUME || 30) : 0;
          const type = prefs?.SOUND_TYPE || 'SINE';
          if (volume > 0) playAlertSound(type, volume);
        }

        // 브라우저 알림
        const prefs = state.notificationPrefs;
        if (prefs?.BROWSER_NOTIFY && !alert.isCleared && Notification.permission === 'granted') {
          new Notification(`[NMS] ${alert.alertType}`, {
            body: `${alert.deviceName || ''} - ${alert.message || ''}`,
            icon: '/logo-single.svg',
          });
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
    console.log('[WebSocket] Connecting to:', WS_URL);

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
          console.log('[WebSocket] Connected successfully');
          isConnectingRef.current = false;
          reconnectAttemptsRef.current = 0;
          setConnected(true);

          // 토픽 구독
          topics.forEach((topic) => {
            client.subscribe(topic, handleMessage);
            console.log('[WebSocket] Subscribed to:', topic);
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
              console.log('[WebSocket] Urgent notice received:', notice);
              setUrgentNotice(notice);
            } catch (error) {
              console.error('[WebSocket] Failed to parse urgent notice:', error);
            }
          });
        },
        onDisconnect: () => {
          console.log('[WebSocket] Disconnected');
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
        console.log(`[WebSocket] Will retry in ${delay / 1000}s (attempt ${reconnectAttemptsRef.current}/${MAX_RECONNECT_ATTEMPTS})`);

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
function playAlertSound(type = 'SINE', volume = 30) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    gain.gain.value = volume / 100;
    osc.connect(gain);
    gain.connect(ctx.destination);

    const freqMap = { SINE: 440, BEEP: 880, CHIME: 523, ALARM: 660 };
    osc.frequency.value = freqMap[type] || 440;
    osc.type = type === 'ALARM' ? 'sawtooth' : type === 'BEEP' ? 'square' : 'sine';

    osc.start();
    osc.stop(ctx.currentTime + 0.2);
  } catch (error) {
    // 무시
  }
}

export default useAlertWebSocket;
