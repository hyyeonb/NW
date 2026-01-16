import { useEffect, useRef, useCallback } from 'react';
import { useAlertStore } from '../stores/alertStore';

// WebSocket 설정
const WS_URL = import.meta.env.VITE_WS_URL || 'http://localhost:8080/ws/alerts';
const RECONNECT_INTERVAL = 10000; // 10초 후 재연결
const HEARTBEAT_INTERVAL = 30000; // 30초마다 heartbeat
const MAX_RECONNECT_ATTEMPTS = 3; // 최대 재연결 시도 횟수

/**
 * Alert WebSocket Hook
 * STOMP over SockJS를 사용한 실시간 알림 수신
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

  const { addAlert, setConnected, setSummary, isMuted } = useAlertStore();

  // 알림 처리
  const handleMessage = useCallback(
    (message) => {
      try {
        const alert = JSON.parse(message.body);
        console.log('[WebSocket] Alert received:', alert);
        addAlert(alert);

        // CLEAR가 아닌 CRITICAL 알림일 때만 소리 재생
        if (!isMuted && alert.severity === 'CRITICAL' && !alert.isCleared) {
          playAlertSound();
        }
      } catch (error) {
        console.error('[WebSocket] Failed to parse message:', error);
      }
    },
    [addAlert, isMuted]
  );

  // 연결 해제
  const disconnect = useCallback(() => {
    // 타이머 정리
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    // 재연결 방지
    reconnectAttemptsRef.current = MAX_RECONNECT_ATTEMPTS + 1;
    isConnectingRef.current = false;

    // STOMP 클라이언트 정리
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
    // 이미 연결 중이거나 연결됨이면 무시
    if (isConnectingRef.current || stompClientRef.current?.connected) {
      return;
    }

    // 최대 재연결 횟수 초과 시 중단
    if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
      console.warn('[WebSocket] Max reconnect attempts reached. Stopping.');
      return;
    }

    // 마운트 해제됐으면 중단
    if (!isMountedRef.current) {
      return;
    }

    isConnectingRef.current = true;
    console.log('[WebSocket] Connecting to:', WS_URL);

    try {
      const { Client } = await import('@stomp/stompjs');
      const SockJS = (await import('sockjs-client')).default;

      const client = new Client({
        webSocketFactory: () => new SockJS(WS_URL),
        reconnectDelay: 0, // 자동 재연결 비활성화
        heartbeatIncoming: HEARTBEAT_INTERVAL,
        heartbeatOutgoing: HEARTBEAT_INTERVAL,
        debug: () => {}, // 디버그 로그 비활성화
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

      // 재연결 스케줄링
      if (isMountedRef.current && reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
        reconnectAttemptsRef.current += 1;
        const delay = RECONNECT_INTERVAL * reconnectAttemptsRef.current;
        console.log(`[WebSocket] Will retry in ${delay / 1000}s (attempt ${reconnectAttemptsRef.current}/${MAX_RECONNECT_ATTEMPTS})`);

        reconnectTimeoutRef.current = setTimeout(() => {
          if (isMountedRef.current) {
            isConnectingRef.current = false; // 리셋하고 재시도
            connect();
          }
        }, delay);
      }
    }
  }, [topics, handleMessage, setConnected, setSummary]);

  // 자동 연결 / 정리
  useEffect(() => {
    isMountedRef.current = true;
    reconnectAttemptsRef.current = 0;

    if (autoConnect) {
      // 약간의 지연 후 연결 (렌더링 완료 후)
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
  }, [autoConnect]); // connect, disconnect 의존성 제거

  return {
    connect,
    disconnect,
    isConnected: useAlertStore((state) => state.isConnected),
  };
}

// 알림음 재생
function playAlertSound() {
  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = 880;
    oscillator.type = 'sine';
    gainNode.gain.value = 0.3;

    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.2);
  } catch (error) {
    // 무시
  }
}

export default useAlertWebSocket;
