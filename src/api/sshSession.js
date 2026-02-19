import apiClient from './client';

export const sshSessionApi = {
  // SSH 세션 이력 목록 조회
  getSessions: (params = {}) =>
    apiClient.get('/ssh/sessions', { params }),

  // 세션별 명령어 목록 조회
  getCommands: (sessionId, params = {}) =>
    apiClient.get(`/ssh/sessions/${sessionId}/commands`, { params }),

  // 세션별 SFTP 로그 조회
  getSftpLogs: (sessionId, params = {}) =>
    apiClient.get(`/ssh/sessions/${sessionId}/sftp-logs`, { params }),
};

export const sftpApi = {
  // 디렉토리 목록 조회
  list: (sessionId, path) =>
    apiClient.get('/sftp/list', { params: { sessionId, path } }),

  // 파일 다운로드
  download: (sessionId, path) => {
    const params = new URLSearchParams({ sessionId, path });
    window.open(`/api/sftp/download?${params.toString()}`, '_blank');
  },

  // 파일 업로드 (multipart)
  upload: (sessionId, path, file) => {
    const formData = new FormData();
    formData.append('sessionId', sessionId);
    formData.append('path', path);
    formData.append('file', file);
    return apiClient.post('/sftp/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  // 디렉토리 생성
  mkdir: (sessionId, path) =>
    apiClient.post('/sftp/mkdir', { sessionId, path }),

  // 파일/폴더 삭제
  delete: (sessionId, path) =>
    apiClient.post('/sftp/delete', { sessionId, path }),
};
