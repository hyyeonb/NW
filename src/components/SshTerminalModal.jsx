import { useEffect, useRef, useState, useMemo } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from '@xterm/addon-fit';
import { useAuthStore } from '../stores/authStore';
import 'xterm/css/xterm.css';
import '../styles/ssh-terminal.css';

import SftpPanel from '../features/ssh-terminal/components/SftpPanel';

// 메인 컴포넌트
export default function SshTerminalModal({ device, sshInfo, onClose }) {
  const user = useAuthStore((s) => s.user);
  const elRef = useRef(null);
  const wsRef = useRef(null);
  const termRef = useRef(null);
  const fitRef = useRef(null);
  const [status, setStatus] = useState('disconnected');
  const [sessionId, setSessionId] = useState(null);

  const [sftpOpen, setSftpOpen] = useState(true);
  const [syncPath, setSyncPath] = useState(false);
  const syncPathRef = useRef(false);
  const [sftpNavPath, setSftpNavPath] = useState(null);
  const inputBufRef = useRef('');
  const waitingPwdRef = useRef(false);

  // syncPath 상태를 ref에 동기화 (클로저에서 접근용)
  useEffect(() => { syncPathRef.current = syncPath; }, [syncPath]);

  const wsUrl = useMemo(() => {
    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
    return `${proto}://${window.location.hostname}:8082/ws/ssh`;
  }, []);

  const connectInfo = useMemo(() => ({
    host: `${device.DEVICE_IP}:${sshInfo.SSH_PORT || 22}`,
    user: sshInfo.SSH_USER || '',
    password: sshInfo.SSH_PASS || '',
  }), [device.DEVICE_IP, sshInfo]);

  useEffect(() => {
    if (!elRef.current) return;
    let disposed = false;

    // StrictMode 재마운트 시 이전 터미널 잔여 DOM 제거
    elRef.current.innerHTML = '';

    const term = new Terminal({
      cursorBlink: true,
      scrollback: 10000,
      convertEol: true,
      fontFamily: "Consolas, Menlo, Monaco, 'Courier New', monospace",
      fontSize: 13,
      theme: {
        background: '#0f172a',
        foreground: '#e2e8f0',
        cursor: '#38bdf8',
        selectionBackground: 'rgba(56, 189, 248, 0.3)',
      },
    });

    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(elRef.current);

    setTimeout(() => {
      if (disposed) return;
      try { fit.fit(); } catch {}
      term.focus();
    }, 150);

    termRef.current = term;
    fitRef.current = fit;

    term.writeln('Connecting...\r\n');

    const ws = new WebSocket(wsUrl);
    ws.binaryType = 'arraybuffer';
    wsRef.current = ws;

    let outBuf = '';
    let flushTimer = null;
    const flush = () => {
      if (disposed || !termRef.current) return;
      termRef.current.write(outBuf);
      outBuf = '';
      flushTimer = null;
    };

    ws.onopen = () => {
      setStatus('connecting');
      ws.send(JSON.stringify({
        type: 'connect',
        data: {
          userId: String(user?.USER_ID || ''),
          host: connectInfo.host,
          user: connectInfo.user,
          password: connectInfo.password,
          cols: term.cols,
          rows: term.rows,
        },
      }));
    };

    ws.onmessage = (ev) => {
      if (typeof ev.data === 'string') {
        try {
          const msg = JSON.parse(ev.data);
          if (msg.type === 'error') {
            term.writeln(`\r\n[ERROR] ${msg.data}\r\n`);
            setStatus('error');
          } else if (msg.type === 'connected') {
            const d = msg.data || {};
            term.writeln(`\r\n[CONNECTED] ${d.user || ''}@${d.host || ''}\r\n`);
            setStatus('connected');
            // sessionId 저장 (SFTP용) - 다양한 키 이름 대응
            const sid = d.sessionId || d.session_id || d.sshSessionId || d.id;
            if (sid) {
              setSessionId(String(sid));
            } else {
              console.warn('[SSH] sessionId를 찾을 수 없음. data:', d);
            }
          } else if (msg.type === 'closed') {
            term.writeln(`\r\n[CLOSED] ${msg.data}\r\n`);
            setStatus('disconnected');
            setSessionId(null);
            setTimeout(() => onClose(), 500);
          } else if (msg.type === 'info') {
            term.writeln(`\r\n[INFO] ${msg.data}\r\n`);
          }
        } catch {
          term.write(ev.data);
        }
        return;
      }

      const text = new TextDecoder().decode(new Uint8Array(ev.data));

      // pwd 결과 캡처 (경로 동기화)
      if (waitingPwdRef.current) {
        const lines = text.split(/[\r\n]+/).map(l => l.trim()).filter(Boolean);
        for (const line of lines) {
          // 절대 경로 형태의 라인을 찾음 (pwd 출력)
          if (/^\/[^\s$#@]*$/.test(line) && !line.includes('pwd')) {
            waitingPwdRef.current = false;
            setSftpNavPath(line + '#' + Date.now());
            break;
          }
        }
      }

      outBuf += text;
      if (!flushTimer) flushTimer = setTimeout(flush, 10);
    };

    ws.onerror = () => {
      term.writeln('\r\n[WebSocket Error]\r\n');
      setStatus('error');
    };

    ws.onclose = () => {
      if (disposed) return;
      term.writeln('\r\n[Disconnected]\r\n');
      setStatus('disconnected');
      setSessionId(null);
    };

    // 복사/붙여넣기
    term.attachCustomKeyEventHandler((e) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'C' && e.type === 'keydown') {
        const sel = term.getSelection();
        if (sel) navigator.clipboard.writeText(sel).catch(() => {});
        return false;
      }
      if (e.ctrlKey && !e.shiftKey && e.key === 'c' && e.type === 'keydown') {
        const sel = term.getSelection();
        if (sel) {
          navigator.clipboard.writeText(sel).catch(() => {});
          term.clearSelection();
          return false;
        }
      }
      if (e.ctrlKey && e.shiftKey && e.key === 'V' && e.type === 'keydown') {
        navigator.clipboard.readText().then((text) => {
          const sock = wsRef.current;
          if (sock && sock.readyState === WebSocket.OPEN && text) {
            sock.send(JSON.stringify({ type: 'input', data: { text } }));
          }
        }).catch(() => {});
        return false;
      }
      return true;
    });

    const disposable = term.onData((data) => {
      const sock = wsRef.current;
      if (!sock || sock.readyState !== WebSocket.OPEN) return;

      // 명령어 감지
      if (data === '\r' || data === '\n') {
        const cmd = inputBufRef.current.trim();
        // cd 명령어 감지 (경로 동기화용)
        if (syncPathRef.current && (cmd.startsWith('cd') || cmd === 'cd')) {
          // cd 실행 후 pwd로 실제 경로 확인
          setTimeout(() => {
            const s = wsRef.current;
            if (s && s.readyState === WebSocket.OPEN) {
              waitingPwdRef.current = true;
              s.send(JSON.stringify({ type: 'input', data: { text: 'pwd\n' } }));
            }
          }, 500);
        }
        inputBufRef.current = '';
      } else if (data === '\x7f' || data === '\b') {
        inputBufRef.current = inputBufRef.current.slice(0, -1);
      } else if (data === '\t') {
        // Tab 키 - 버퍼에 추가하지 않음 (자동완성)
      } else if (data.length === 1 && data.charCodeAt(0) >= 32) {
        inputBufRef.current += data;
      } else if (data === '\x03') {
        inputBufRef.current = '';
      }

      sock.send(JSON.stringify({ type: 'input', data: { text: data } }));
    });

    const ro = new ResizeObserver((entries) => {
      if (!fitRef.current || !termRef.current) return;
      const { width, height } = entries[0].contentRect;
      if (width === 0 || height === 0) return;
      try { fitRef.current.fit(); } catch {}
      const sock = wsRef.current;
      if (!sock || sock.readyState !== WebSocket.OPEN) return;
      sock.send(JSON.stringify({
        type: 'resize',
        data: { cols: termRef.current.cols, rows: termRef.current.rows },
      }));
    });
    ro.observe(elRef.current);

    return () => {
      disposed = true;
      termRef.current = null;
      fitRef.current = null;
      wsRef.current = null;
      try { disposable.dispose(); } catch {}
      try { ro.disconnect(); } catch {}
      try {
        if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'close', data: {} }));
          }
          ws.close();
        }
      } catch {}
      try { term.dispose(); } catch {}
      if (elRef.current) elRef.current.innerHTML = '';
      if (flushTimer) clearTimeout(flushTimer);
    };
  }, [wsUrl, connectInfo]);

  // SFTP 패널 토글 시 터미널 리사이즈
  useEffect(() => {
    const timer = setTimeout(() => {
      try { fitRef.current?.fit(); } catch {}
    }, 250);
    return () => clearTimeout(timer);
  }, [sftpOpen]);

  const handleKeyDown = (e) => {
    if (e.key === 'Escape' && e.shiftKey) onClose();
  };

  const statusColor = status === 'connected' ? '#22c55e' : status === 'connecting' ? '#fbbf24' : status === 'error' ? '#ef4444' : '#94a3b8';
  const statusLabel = status === 'connected' ? '연결됨' : status === 'connecting' ? '연결 중...' : status === 'error' ? '오류' : '연결 해제';

  return (
    <div className="modal-overlay" onKeyDown={handleKeyDown} style={{ zIndex: 10000 }}>
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '90vw',
          height: '80vh',
          maxWidth: '1400px',
          maxHeight: '900px',
          display: 'flex',
          flexDirection: 'column',
          padding: 0,
          overflow: 'hidden',
        }}
      >
        {/* 헤더 */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 16px',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          background: 'rgba(15, 23, 42, 0.95)',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <i className="bi bi-terminal" style={{ fontSize: '16px', color: '#38bdf8' }} />
            <span style={{ fontWeight: 600, color: '#e2e8f0', fontSize: '14px' }}>
              {device.DEVICE_NAME}
            </span>
            <span style={{ color: '#94a3b8', fontSize: '12px' }}>
              {connectInfo.user}@{connectInfo.host}
            </span>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: '5px',
              fontSize: '11px', color: statusColor,
            }}>
              <span style={{
                width: 7, height: 7, borderRadius: '50%',
                backgroundColor: statusColor, display: 'inline-block',
              }} />
              {statusLabel}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={() => setSftpOpen(!sftpOpen)}
              style={{
                background: sftpOpen ? 'rgba(56, 189, 248, 0.15)' : 'none',
                border: sftpOpen ? '1px solid rgba(56, 189, 248, 0.3)' : '1px solid transparent',
                color: sftpOpen ? '#38bdf8' : '#94a3b8',
                cursor: 'pointer', fontSize: '13px', padding: '4px 8px',
                borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '4px',
              }}
              title="SFTP 파일 브라우저"
            >
              <i className="bi bi-folder2-open" />
              <span style={{ fontSize: '11px' }}>SFTP</span>
            </button>
            <button
              onClick={() => setSyncPath(!syncPath)}
              style={{
                background: syncPath ? 'rgba(251, 191, 36, 0.15)' : 'none',
                border: syncPath ? '1px solid rgba(251, 191, 36, 0.3)' : '1px solid transparent',
                color: syncPath ? '#fbbf24' : '#94a3b8',
                cursor: 'pointer', fontSize: '13px', padding: '4px 8px',
                borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '4px',
              }}
              title={syncPath ? '경로 동기화 ON: SSH에서 cd 시 SFTP 경로 따라감' : '경로 동기화 OFF'}
            >
              <i className={`bi ${syncPath ? 'bi-link-45deg' : 'bi-link'}`} />
              <span style={{ fontSize: '11px' }}>동기화</span>
            </button>
            <span style={{ color: '#475569', fontSize: '10px' }}>Ctrl+C 복사 | Shift+ESC 닫기</span>
            <button
              onClick={onClose}
              style={{
                background: 'none', border: 'none', color: '#94a3b8',
                cursor: 'pointer', fontSize: '16px', padding: '4px',
              }}
            >
              <i className="bi bi-x-lg" />
            </button>
          </div>
        </div>

        {/* 본문: SFTP 패널 + 터미널 */}
        <div style={{ flex: 1, minHeight: 0, display: 'flex', position: 'relative' }}>
          {/* SFTP 패널 */}
          <div className={`sftp-panel ${sftpOpen ? '' : 'collapsed'}`}>
            {sftpOpen && (
              <SftpPanel sessionId={sessionId} connected={status === 'connected'} externalPath={syncPath ? sftpNavPath : null} sshUser={sshInfo.SSH_USER || ''} />
            )}
          </div>

          {/* 터미널 영역 */}
          <div style={{ flex: 1, minWidth: 0, background: '#0f172a' }}>
            <div ref={elRef} style={{ height: '100%', width: '100%' }} />
          </div>
        </div>
      </div>
    </div>
  );
}
