import { useQuery } from '@tanstack/react-query';
import { sshSessionApi } from '../api';

// SSH 세션 이력 목록 조회
export const useSshSessions = (page = 1, size = 20, sort = 'session_id', order = 'desc', filters = {}) => {
  return useQuery({
    queryKey: ['sshSessions', page, size, sort, order, filters],
    queryFn: async () => {
      const params = { page, size, sort, order, ...filters };
      const response = await sshSessionApi.getSessions(params);
      const pageData = response.data?.data || response.data || {};
      return {
        content: Array.isArray(pageData.content) ? pageData.content : (Array.isArray(pageData) ? pageData : []),
        page: pageData.page || page,
        size: pageData.size || size,
        totalElements: pageData.totalElements || 0,
        totalPages: pageData.totalPages || 0,
      };
    },
    staleTime: 0,
    refetchOnMount: 'always',
    placeholderData: (prev) => prev,
  });
};

// 세션별 명령어 목록 조회
export const useSshCommands = (sessionId) => {
  return useQuery({
    queryKey: ['sshCommands', sessionId],
    queryFn: async () => {
      const response = await sshSessionApi.getCommands(sessionId);
      const data = response.data?.data || response.data || [];
      return Array.isArray(data.content) ? data.content : (Array.isArray(data) ? data : []);
    },
    enabled: !!sessionId,
    staleTime: 30000,
  });
};
