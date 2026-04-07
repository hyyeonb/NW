import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from '@xterm/addon-fit';
import { useAuthStore } from '../stores/authStore';
import { sftpApi } from '../api';
import 'xterm/css/xterm.css';
import '../styles/ssh-terminal.css';

// 파일 크기 포맷
function formatSize(bytes) {
  if (bytes == null || bytes < 0) return '-';
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}

// 날짜 포맷
function formatDate(dateStr) {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch { return dateStr; }
}

// 파일 확장자별 아이콘
function getFileIcon(name, isDir) {
  if (isDir) return 'bi-folder-fill';
  const ext = name?.split('.').pop()?.toLowerCase();
  const icons = {
    log: 'bi-file-text', txt: 'bi-file-text', md: 'bi-file-text',
    sh: 'bi-terminal', bash: 'bi-terminal', py: 'bi-filetype-py',
    js: 'bi-filetype-js', json: 'bi-filetype-json', xml: 'bi-filetype-xml',
    html: 'bi-filetype-html', css: 'bi-filetype-css',
    java: 'bi-filetype-java', jar: 'bi-file-zip',
    zip: 'bi-file-zip', tar: 'bi-file-zip', gz: 'bi-file-zip',
    conf: 'bi-gear', cfg: 'bi-gear', ini: 'bi-gear', yml: 'bi-gear', yaml: 'bi-gear',
    png: 'bi-file-image', jpg: 'bi-file-image', gif: 'bi-file-image', svg: 'bi-file-image',
    pdf: 'bi-filetype-pdf', doc: 'bi-filetype-doc', xls: 'bi-filetype-xlsx',
  };
  return icons[ext] || 'bi-file-earmark';
}

// SFTP 파일 브라우저 컴포넌트
function SftpPanel({ sessionId, connected, externalPath, sshUser }) {
  const homePath = sshUser === 'root' ? '/root' : `/home/${sshUser}`;
  const [currentPath, setCurrentPath] = useState(homePath);
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showMkdir, setShowMkdir] = useState(false);
  const [mkdirName, setMkdirName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadName, setUploadName] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [editingPath, setEditingPath] = useState(false);
  const [pathInput, setPathInput] = useState('');
  const [sftpUnavailable, setSftpUnavailable] = useState(false);
  const pathInputRef = useRef(null);
  const fileInputRef = useRef(null);
  const loadingRef = useRef(false);

  // 에러 메시지 변환
  const formatError = (err, fallback) => {
    const msg = (err.response?.data?.message || err.response?.data?.error || err.message || fallback).toLowerCase();
    if (msg.includes('permission denied')) return '접근 권한이 없습니다 (Permission Denied)';
    if (msg.includes('no such file')) return '경로를 찾을 수 없습니다';
    if (msg.includes('not a directory')) return '디렉토리가 아닙니다';
    if (msg.includes('connection') || msg.includes('session')) return '세션이 만료되었습니다. 재접속해주세요';
    return err.response?.data?.message || err.response?.data?.error || fallback;
  };

  // SSH 연결됐는데 sessionId 없으면 즉시 SFTP 미지원 처리
  useEffect(() => {
    if (sessionId) { setSftpUnavailable(false); return; }
    if (connected && !sessionId) { setSftpUnavailable(true); return; }
    setSftpUnavailable(false);
  }, [connected, sessionId]);

  // 디렉토리 조회
  const fetchFiles = useCallback(async (path) => {
    if (!sessionId || loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    setError('');
    try {
      const res = await sftpApi.list(sessionId, path);
      const data = res.data?.data || res.data || {};
      const list = Array.isArray(data.entries) ? data.entries : (Array.isArray(data) ? data : []);
      // 폴더 먼저, 그 다음 이름순
      list.sort((a, b) => {
        if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
        return (a.name || '').localeCompare(b.name || '');
      });
      setFiles(list);
      setCurrentPath(path);
    } catch (err) {
      setError(formatError(err, '디렉토리 조회 실패'));
      setFiles([]);
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, [sessionId]);

  // 외부 경로 변경 시 (SSH cd 동기화) - # 뒤의 타임스탬프 제거
  useEffect(() => {
    if (connected && sessionId && externalPath) {
      const path = externalPath.split('#')[0];
      if (path && path !== currentPath) {
        fetchFiles(path);
      }
    }
  }, [externalPath]); // eslint-disable-line react-hooks/exhaustive-deps

  // 연결 시 홈 디렉토리 조회 (실패 시 SFTP 미지원 처리)
  useEffect(() => {
    if (connected && sessionId) {
      sftpApi.list(sessionId, homePath).then((res) => {
        const data = res.data?.data || res.data || {};
        const list = Array.isArray(data.entries) ? data.entries : (Array.isArray(data) ? data : []);
        list.sort((a, b) => {
          if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
          return (a.name || '').localeCompare(b.name || '');
        });
        setFiles(list);
        setCurrentPath(homePath);
      }).catch(() => {
        setSftpUnavailable(true);
      });
    }
  }, [connected, sessionId]);

  // 폴더 클릭
  const handleNavigate = useCallback((name, isDir) => {
    if (!isDir) return;
    let newPath;
    if (name === '..') {
      const parts = currentPath.split('/').filter(Boolean);
      parts.pop();
      newPath = '/' + parts.join('/');
    } else {
      newPath = currentPath === '/' ? `/${name}` : `${currentPath}/${name}`;
    }
    fetchFiles(newPath);
  }, [currentPath, fetchFiles]);

  // 파일 다운로드
  const handleDownload = useCallback((name) => {
    const filePath = currentPath === '/' ? `/${name}` : `${currentPath}/${name}`;
    sftpApi.download(sessionId, filePath);
  }, [sessionId, currentPath]);

  // 파일 삭제
  const handleDelete = useCallback(async (name, isDirectory) => {
    const label = isDirectory ? '폴더' : '파일';
    if (!confirm(`"${name}" ${label}을(를) 삭제하시겠습니까?`)) return;
    const filePath = currentPath === '/' ? `/${name}` : `${currentPath}/${name}`;
    try {
      await sftpApi.delete(sessionId, filePath);
      fetchFiles(currentPath);
    } catch (err) {
      setError(formatError(err, '삭제 실패'));
    }
  }, [sessionId, currentPath, fetchFiles]);

  // 폴더 생성
  const handleMkdir = useCallback(async () => {
    if (!mkdirName.trim()) return;
    const dirPath = currentPath === '/' ? `/${mkdirName.trim()}` : `${currentPath}/${mkdirName.trim()}`;
    try {
      await sftpApi.mkdir(sessionId, dirPath);
      setShowMkdir(false);
      setMkdirName('');
      fetchFiles(currentPath);
    } catch (err) {
      setError(formatError(err, '폴더 생성 실패'));
    }
  }, [sessionId, currentPath, mkdirName, fetchFiles]);

  // 파일 업로드 (최대 100MB)
  const MAX_UPLOAD_SIZE = 100 * 1024 * 1024; // 100MB
  const uploadFile = useCallback(async (file) => {
    if (file.size > MAX_UPLOAD_SIZE) {
      setError(`파일 크기 초과: ${file.name} (${(file.size / 1024 / 1024).toFixed(1)}MB) - 최대 100MB까지 업로드 가능합니다.`);
      return;
    }
    setUploading(true);
    setUploadName(file.name);
    try {
      await sftpApi.upload(sessionId, currentPath, file);
      fetchFiles(currentPath);
    } catch (err) {
      setError(formatError(err, '업로드 실패'));
    } finally {
      setUploading(false);
      setUploadName('');
    }
  }, [sessionId, currentPath, fetchFiles]);

  // 파일 선택 업로드
  const handleFileSelect = useCallback((e) => {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
    e.target.value = '';
  }, [uploadFile]);

  // 드래그 앤 드롭
  const handleDragOver = useCallback((e) => { e.preventDefault(); setDragOver(true); }, []);
  const handleDragLeave = useCallback(() => setDragOver(false), []);
  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) uploadFile(file);
  }, [uploadFile]);

  if (!connected || !sessionId) {
    return (
      <div className="sftp-loading" style={{ flexDirection: 'column', gap: 10, padding: 32 }}>
        {sftpUnavailable ? (
          <>
            <i className="bi bi-folder-x" style={{ fontSize: 24, color: '#64748b' }} />
            <span style={{ color: '#94a3b8', textAlign: 'center', lineHeight: 1.5 }}>
              SFTP를 사용할 수 없습니다
            </span>
            <span style={{ color: '#64748b', fontSize: 10, textAlign: 'center' }}>
              해당 장비가 SFTP를 지원하지 않습니다
            </span>
          </>
        ) : (
          <>
            <div className="spinner" />
            <span>SFTP 연결 대기 중...</span>
          </>
        )}
      </div>
    );
  }

  const dirCount = files.filter(f => f.isDir).length;
  const fileCount = files.length - dirCount;

  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', height: '100%', position: 'relative' }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {dragOver && (
        <div className="sftp-drop-overlay">
          <span><i className="bi bi-cloud-upload" /> 파일을 여기에 놓으세요</span>
        </div>
      )}

      {/* 헤더 */}
      <div className="sftp-header">
        <div className="sftp-header-title">
          <i className="bi bi-folder2-open" />
          SFTP
        </div>
        <div className="sftp-header-actions">
          <button className="sftp-btn" onClick={() => fetchFiles(currentPath)} title="새로고침" disabled={loading}>
            <i className="bi bi-arrow-clockwise" />
          </button>
          <button className="sftp-btn" onClick={() => setShowMkdir(!showMkdir)} title="새 폴더">
            <i className="bi bi-folder-plus" />
          </button>
          <button className="sftp-btn" onClick={() => fileInputRef.current?.click()} title="업로드" disabled={uploading}>
            <i className="bi bi-cloud-upload" />
          </button>
          <input ref={fileInputRef} type="file" hidden onChange={handleFileSelect} />
        </div>
      </div>

      {/* 경로 */}
      <div className="sftp-path-bar">
        <button className="sftp-btn" onClick={() => handleNavigate('..', true)} title="상위 폴더" style={{ width: 20, height: 20, fontSize: 11 }}>
          <i className="bi bi-arrow-up" />
        </button>
        {editingPath ? (
          <input
            ref={pathInputRef}
            className="sftp-path-input"
            value={pathInput}
            onChange={(e) => setPathInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const p = pathInput.trim();
                if (p && p.startsWith('/')) fetchFiles(p);
                setEditingPath(false);
              }
              if (e.key === 'Escape') setEditingPath(false);
            }}
            onBlur={() => setEditingPath(false)}
            autoFocus
          />
        ) : (
          <span
            className="sftp-path-text"
            title={`${currentPath} (클릭하여 경로 입력)`}
            onClick={() => { setPathInput(currentPath); setEditingPath(true); }}
            style={{ cursor: 'text' }}
          >
            {currentPath}
          </span>
        )}
      </div>

      {/* 에러 메시지 */}
      {error && (
        <div className="sftp-error">
          <i className="bi bi-exclamation-circle" />
          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{error}</span>
          <button onClick={() => setError('')}><i className="bi bi-x" /></button>
        </div>
      )}

      {/* 폴더 생성 */}
      {showMkdir && (
        <div className="sftp-mkdir-input">
          <input
            placeholder="폴더명"
            value={mkdirName}
            onChange={(e) => setMkdirName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleMkdir(); if (e.key === 'Escape') { setShowMkdir(false); setMkdirName(''); } }}
            autoFocus
          />
          <button onClick={handleMkdir}>생성</button>
        </div>
      )}

      {/* 업로드 진행 */}
      {uploading && (
        <div className="sftp-upload-progress">
          <div className="sftp-upload-progress-bar">
            <div className="sftp-upload-progress-fill" style={{ width: '100%' }} />
          </div>
          <div className="sftp-upload-text">{uploadName} 업로드 중...</div>
        </div>
      )}

      {/* 파일 목록 */}
      <div className="sftp-file-list">
        {loading ? (
          <div className="sftp-loading">
            <div className="spinner" />
            <span>불러오는 중...</span>
          </div>
        ) : (
          <>
            {/* 상위 폴더 */}
            {currentPath !== '/' && (
              <div className="sftp-file-item directory" onDoubleClick={() => handleNavigate('..', true)}>
                <i className="sftp-file-icon parent bi-arrow-90deg-up" />
                <div className="sftp-file-info">
                  <span className="sftp-file-name">..</span>
                </div>
              </div>
            )}
            {files.map((file, idx) => (
              <div
                key={`${file.name}-${idx}`}
                className={`sftp-file-item ${file.isDir ? 'directory' : ''}`}
                onDoubleClick={() => file.isDir ? handleNavigate(file.name, true) : handleDownload(file.name)}
              >
                <i className={`sftp-file-icon ${file.isDir ? 'folder' : 'file'} ${getFileIcon(file.name, file.isDir)}`} />
                <div className="sftp-file-info">
                  <span className="sftp-file-name" title={file.name}>{file.name}</span>
                  <div className="sftp-file-meta">
                    {!file.isDir && <span>{formatSize(file.size)}</span>}
                    <span>{formatDate(file.modTime)}</span>
                    {file.mode && <span>{file.mode}</span>}
                  </div>
                </div>
                <div className="sftp-file-actions">
                  {!file.isDir && (
                    <button className="sftp-file-action-btn" onClick={(e) => { e.stopPropagation(); handleDownload(file.name); }} title="다운로드">
                      <i className="bi bi-download" />
                    </button>
                  )}
                  <button className="sftp-file-action-btn delete" onClick={(e) => { e.stopPropagation(); handleDelete(file.name, file.isDir); }} title="삭제">
                    <i className="bi bi-trash3" />
                  </button>
                </div>
              </div>
            ))}
            {files.length === 0 && !loading && (
              <div className="sftp-loading" style={{ color: '#475569' }}>
                <i className="bi bi-folder2" style={{ fontSize: 18 }} />
                <span>비어있는 폴더</span>
              </div>
            )}
          </>
        )}
      </div>

      {/* 상태바 */}
      <div className="sftp-status-bar">
        <span>{dirCount}개 폴더, {fileCount}개 파일</span>
        <span style={{ color: '#64748b', fontSize: '9px' }}>업로드 최대 100MB</span>
        <span>{currentPath}</span>
      </div>
    </div>
  );
}

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
            console.log('[SSH] connected 이벤트 전체:', JSON.stringify(msg));
            const d = msg.data || {};
            term.writeln(`\r\n[CONNECTED] ${d.user || ''}@${d.host || ''}\r\n`);
            setStatus('connected');
            // sessionId 저장 (SFTP용) - 다양한 키 이름 대응
            const sid = d.sessionId || d.session_id || d.sshSessionId || d.id;
            if (sid) {
              console.log('[SSH] sessionId 캡처:', sid);
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
