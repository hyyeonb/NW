import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { noticeApi } from '../api/notice';

// 공지사항 목록 조회
export const useNoticePosts = (page = 1, size = 10, search) => {
  return useQuery({
    queryKey: ['noticePosts', page, size, search || ''],
    queryFn: async () => {
      const response = await noticeApi.getList(page, size, search);
      const pageData = response.data?.data || response.data || {};
      return {
        content: Array.isArray(pageData.content) ? pageData.content : [],
        page: pageData.page || page,
        size: pageData.size || size,
        totalElements: pageData.totalElements || 0,
        totalPages: pageData.totalPages || 0,
      };
    },
    staleTime: 30000,
    placeholderData: (previousData) => previousData,
  });
};

// 공지사항 상세 조회
export const useNoticePost = (noticeId) => {
  return useQuery({
    queryKey: ['noticePost', noticeId],
    queryFn: async () => {
      const response = await noticeApi.getPost(noticeId);
      return response.data?.data || response.data || null;
    },
    enabled: !!noticeId,
  });
};

// 공지사항 등록
export const useCreateNotice = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (postData) => noticeApi.createPost(postData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['noticePosts'] });
    },
  });
};

// 공지사항 수정
export const useUpdateNotice = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ noticeId, postData }) => noticeApi.updatePost(noticeId, postData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['noticePosts'] });
      queryClient.invalidateQueries({ queryKey: ['noticePost'] });
    },
  });
};

// 공지사항 삭제
export const useDeleteNotice = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (noticeId) => noticeApi.deletePost(noticeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['noticePosts'] });
    },
  });
};
