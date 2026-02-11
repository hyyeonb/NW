import { useEffect, useRef, useState, useMemo } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from '@xterm/addon-fit';
import 'xterm/css/xterm.css';

export default function SshTerminalModal({ device, sshInfo, onClose }) {
  const elRef = useRef(null);
  const wsRef = useRef(null);
  const termRef = useRef(null);
  const fitRef = useRef(null);
  const [status, setStatus] = useState('disconnected');

  const wsUrl = useMemo(() => {
    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
    return `${proto}://${window.location.host}/ws/ssh`;
  }, []);

  const connectInfo = useMemo(() => ({
    host: `${device.DEVICE_IP}:${sshInfo.SSH_PORT || 22}`,
    user: sshInfo.SSH_USER || '',
    password: sshInfo.SSH_PASS || '',
  }), [device.DEVICE_IP, sshInfo]);

  useEffect(() => {
    if (!elRef.current) return;

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

    // 약간의 딜레이 후 fit (모달 렌더링 완료 대기)
    requestAnimationFrame(() => {
      fit.fit();
    });

    termRef.current = term;
    fitRef.current = fit;

    term.writeln('Connecting...\r\n');

    // WebSocket 연결
    const ws = new WebSocket(wsUrl);
    ws.binaryType = 'arraybuffer';
    wsRef.current = ws;

    // 출력 버퍼링
    let outBuf = '';
    let flushTimer = null;
    const flush = () => {
      if (!termRef.current) return;
      termRef.current.write(outBuf);
      outBuf = '';
      flushTimer = null;
    };

    ws.onopen = () => {
      setStatus('connected');
      ws.send(JSON.stringify({
        type: 'connect',
        data: {
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
            term.writeln(`\r\n[CONNECTED] ${msg.data?.user || ''}@${msg.data?.host || ''}\r\n`);
          } else if (msg.type === 'closed') {
            term.writeln(`\r\n[CLOSED] ${msg.data}\r\n`);
            setStatus('disconnected');
          } else if (msg.type === 'info') {
            term.writeln(`\r\n[INFO] ${msg.data}\r\n`);
          }
        } catch {
          term.write(ev.data);
        }
        return;
      }

      // SSH output (binary)
      const text = new TextDecoder().decode(new Uint8Array(ev.data));
      outBuf += text;
      if (!flushTimer) flushTimer = setTimeout(flush, 10);
    };

    ws.onerror = () => {
      term.writeln('\r\n[WebSocket Error]\r\n');
      setStatus('error');
    };

    ws.onclose = () => {
      term.writeln('\r\n[Disconnected]\r\n');
      setStatus('disconnected');
    };

    // 키 입력 -> 서버 전송
    const disposable = term.onData((data) => {
      const sock = wsRef.current;
      if (!sock || sock.readyState !== WebSocket.OPEN) return;
      sock.send(JSON.stringify({ type: 'input', data: { text: data } }));
    });

    // ResizeObserver
    const ro = new ResizeObserver(() => {
      if (!fitRef.current || !termRef.current) return;
      fitRef.current.fit();
      const sock = wsRef.current;
      if (!sock || sock.readyState !== WebSocket.OPEN) return;
      sock.send(JSON.stringify({
        type: 'resize',
        data: { cols: termRef.current.cols, rows: termRef.current.rows },
      }));
    });
    ro.observe(elRef.current);

    // cleanup
    return () => {
      try { disposable.dispose(); } catch {}
      try { ro.disconnect(); } catch {}
      try {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'close', data: {} }));
        }
        ws.close();
      } catch {}
      try { term.dispose(); } catch {}
      if (flushTimer) clearTimeout(flushTimer);
    };
  }, [wsUrl, connectInfo]);

  // ESC 키로 닫기 방지 (터미널에서 ESC 사용하므로)
  const handleKeyDown = (e) => {
    if (e.key === 'Escape' && e.shiftKey) {
      onClose();
    }
  };

  const statusColor = status === 'connected' ? '#22c55e' : status === 'error' ? '#ef4444' : '#94a3b8';
  const statusLabel = status === 'connected' ? '연결됨' : status === 'error' ? '오류' : '연결 해제';

  return (
    <div className="modal-overlay" onKeyDown={handleKeyDown} style={{ zIndex: 10000 }}>
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '80vw',
          height: '75vh',
          maxWidth: '1200px',
          maxHeight: '800px',
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
          padding: '12px 16px',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          background: 'rgba(15, 23, 42, 0.95)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <i className="bi bi-terminal" style={{ fontSize: '18px', color: '#38bdf8' }} />
            <span style={{ fontWeight: 600, color: '#e2e8f0' }}>
              SSH Console - {device.DEVICE_NAME}
            </span>
            <span style={{ color: '#94a3b8', fontSize: '13px' }}>
              {connectInfo.user}@{connectInfo.host}
            </span>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '12px',
              color: statusColor,
            }}>
              <span style={{
                width: 8, height: 8, borderRadius: '50%',
                backgroundColor: statusColor,
                display: 'inline-block',
              }} />
              {statusLabel}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: '#64748b', fontSize: '11px' }}>Shift+ESC로 닫기</span>
            <button
              onClick={onClose}
              style={{
                background: 'none', border: 'none', color: '#94a3b8',
                cursor: 'pointer', fontSize: '18px', padding: '4px',
              }}
            >
              <i className="bi bi-x-lg" />
            </button>
          </div>
        </div>

        {/* 터미널 영역 */}
        <div style={{ flex: 1, minHeight: 0, background: '#0f172a' }}>
          <div ref={elRef} style={{ height: '100%', width: '100%' }} />
        </div>
      </div>
    </div>
  );
}
