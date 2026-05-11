/* eslint-disable max-lines, max-lines-per-function, complexity, max-depth, no-unused-vars, no-empty, react-hooks/exhaustive-deps */
import { useEffect, useRef, useState, useCallback } from 'react';
import { useAlert } from '../../../components/CustomAlert';
import { sftpApi } from '../../../api/sshSession';
import { formatSize, getFileIcon } from '../lib/sftpHelpers';
import { formatDateTimeMin as formatDate } from '../../../shared/lib/format';

function SftpPanel({ sessionId, connected, externalPath, sshUser }) {
  const { confirm: showConfirm } = useAlert();
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
    if (!await showConfirm(`"${name}" ${label}을(를) 삭제하시겠습니까?`)) return;
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


export default SftpPanel;
